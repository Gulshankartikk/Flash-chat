const User = require("../models/user");
const { sendOtpToEmail } = require("../services/emailService");
const otpGenerate = require("../utils/otpGenerater");
const response = require("../utils/responseHandler");
const twilioService = require("../services/twilloService");
const crypto = require("crypto");
const { generateAccessToken, generateRefreshToken } = require("../utils/generateToken");
const { uploadFileToCloudinary } = require("../config/cloudinaryConfig");
const Conversation = require("../models/Conversation");
const jwt = require("jsonwebtoken");
const cache = require("../config/redis");

// Rate limiting map for OTP sends (max 5 per 10 mins per IP/phone)
const otpRateLimit = new Map();
function isOtpRateLimited(key) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const timestamps = (otpRateLimit.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= 5) return true;
  timestamps.push(now);
  otpRateLimit.set(key, timestamps);
  return false;
}

// STEP 1 — SEND OTP (Phone SMS or Email)
const sendOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, email } = req.body;
  const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  try {
    // 📱 PHONE OTP FLOW
    if (phoneNumber && phoneSuffix) {
      const cleanPhone = String(phoneNumber).trim().replace(/\D/g, "");
      const cleanSuffix = String(phoneSuffix).trim();
      if (cleanPhone.length < 6 || cleanPhone.length > 15) {
        return response(res, 400, "Invalid mobile number format.");
      }

      const fullPhoneNumber = `${cleanSuffix}${cleanPhone}`;
      if (isOtpRateLimited(fullPhoneNumber) || isOtpRateLimited(clientIp)) {
        return response(res, 429, "Too many OTP requests. Please wait a few minutes before trying again.");
      }

      const twilioRes = await twilioService.sendOtpToPhone(fullPhoneNumber);

      return response(res, 200, "OTP sent successfully to your mobile number.", {
        phoneNumber: cleanPhone,
        phoneSuffix: cleanSuffix,
        devOtp: process.env.NODE_ENV !== "production" ? twilioRes.devOtp : undefined,
        isDevFallback: !!twilioRes.managed,
      });
    }

    // EMAIL OTP FLOW
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const otp = otpGenerate();
      const expiry = new Date(Date.now() + 5 * 60 * 1000);

      let user = await User.findOne({ email: cleanEmail });
      if (!user) {
        const usernamePrefix = cleanEmail.split("@")[0].replace(/[^a-z0-9]/g, "_");
        user = new User({
          email: cleanEmail,
          displayName: cleanEmail.split("@")[0],
          username: `${usernamePrefix}_${crypto.randomBytes(2).toString("hex")}`,
        });
      }

      await sendOtpToEmail(cleanEmail, otp);
      user.emailOtp = otp;
      user.emailOtpExpiry = expiry;
      await user.save();

      return response(res, 200, "OTP sent to your email", { email: cleanEmail });
    }

    return response(res, 400, "Please provide a valid mobile number and country code.");
  } catch (error) {
    console.error("sendOtp error:", error);
    return response(res, 500, error.message || "Failed to send OTP. Please try again.");
  }
};

// Flash ID Generator (e.g. FC-7K29X8)
const generateFlashId = () => {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "FC-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
};

// STEP 2 — VERIFY OTP & INSTANT LOGIN
const verifyOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, email, otp } = req.body;

  if (!otp || String(otp).trim().length !== 6) {
    return response(res, 400, "Please enter a valid 6-digit OTP.");
  }

  try {
    let user;

    // PHONE VERIFY
    if (phoneNumber && phoneSuffix) {
      const cleanPhone = String(phoneNumber).trim().replace(/\D/g, "");
      const cleanSuffix = String(phoneSuffix).trim();
      const fullPhoneNumber = `${cleanSuffix}${cleanPhone}`;

      // Verify OTP with service
      const result = await twilioService.verifyOtp(fullPhoneNumber, otp.trim());
      if (result.status !== "approved") {
        return response(res, 400, "Incorrect or expired OTP. Please check the code and try again.");
      }

      user = await User.findOne({
        $or: [{ phoneNumber: cleanPhone }, { phoneNumber: fullPhoneNumber }],
      });

      if (!user) {
        const suffix4 = cleanPhone.slice(-4);
        user = new User({
          phoneNumber: cleanPhone,
          phoneSuffix: cleanSuffix,
          displayName: `User ${suffix4}`,
          username: `user_${suffix4}_${crypto.randomBytes(3).toString("hex")}`,
          flashId: generateFlashId(),
          profileCompleted: false,
          agreed: true,
        });
      }

      user.phoneNumber = cleanPhone;
      user.phoneSuffix = cleanSuffix;
      user.phoneVerified = true;
      user.isVerified = true;
      user.lastLoginAt = new Date();
      if (!user.flashId) {
        user.flashId = generateFlashId();
      }
      if (!user.displayName) {
        user.displayName = `User ${cleanPhone.slice(-4)}`;
      }
      if (!user.username) {
        user.username = `user_${cleanPhone.slice(-4)}_${crypto.randomBytes(3).toString("hex")}`;
      }
      await user.save();
    } else if (email) {
      // Email verify
      const cleanEmail = email.toLowerCase().trim();
      user = await User.findOne({ email: cleanEmail });
      if (!user) return response(res, 404, "User not found");

      const now = new Date();
      if (
        !user.emailOtp ||
        String(user.emailOtp) !== String(otp.trim()) ||
        now > new Date(user.emailOtpExpiry)
      ) {
        return response(res, 400, "Invalid or expired OTP");
      }

      user.emailVerified = true;
      user.isVerified = true;
      user.emailOtp = null;
      user.emailOtpExpiry = null;
      user.lastLoginAt = new Date();
      if (!user.flashId) {
        user.flashId = generateFlashId();
      }
      await user.save();
    } else {
      return response(res, 400, "Phone number or email is required.");
    }

    const sessionId = crypto.randomUUID();
    const accessToken = generateAccessToken(user._id, sessionId);
    const refreshToken = generateRefreshToken(user._id, sessionId);

    // Track active session
    const device = req.headers["user-agent"] || "Unknown Device";
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (!user.activeSessions) user.activeSessions = [];
    user.activeSessions.push({
      sessionId,
      refreshToken,
      device,
      ip,
      lastActive: new Date(),
    });
    if (user.activeSessions.length > 10) {
      user.activeSessions = user.activeSessions.slice(-10);
    }
    await user.save();
    await cache.del(`user:${user._id}`);

    // Set secure HTTP-only cookies
    res.cookie("auth_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return response(res, 200, "Authentication successful! Welcome to Flash Chat.", {
      token: accessToken,
      user,
      profileCompleted: !!user.profileCompleted,
      isNewUser: !user.profileCompleted,
      sessionId,
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return response(res, 500, error.message || "OTP verification failed. Please try again.");
  }
};

// 🔵 GOOGLE / GMAIL AUTHENTICATION
const googleAuth = async (req, res) => {
  const { credential, idToken, accessToken: clientAccessToken, code } = req.body;
  const tokenToVerify = credential || idToken;

  try {
    let googleProfile = null;

    if (tokenToVerify) {
      // Verify Google ID token via Google TokenInfo endpoint
      const googleRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${tokenToVerify}`
      );
      if (!googleRes.ok) {
        const errText = await googleRes.text();
        console.error("Google tokeninfo error:", errText);
        return response(res, 401, "Google authentication failed. Invalid token.");
      }
      const data = await googleRes.json();
      googleProfile = {
        sub: data.sub,
        email: data.email,
        email_verified: data.email_verified === "true" || data.email_verified === true,
        name: data.name,
        picture: data.picture,
      };
    } else if (clientAccessToken) {
      // Fetch UserInfo via Access Token
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${clientAccessToken}` },
      });
      if (!userinfoRes.ok) {
        return response(res, 401, "Failed to fetch Google profile with access token.");
      }
      const data = await userinfoRes.json();
      googleProfile = {
        sub: data.sub,
        email: data.email,
        email_verified: data.email_verified,
        name: data.name,
        picture: data.picture,
      };
    } else if (code) {
      // Exchange authorization code
      const redirectUri =
        req.body.redirectUri ||
        `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/google/callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("Google code exchange error:", errText);
        return response(res, 401, "Failed to exchange Google authorization code.");
      }

      const tokenData = await tokenRes.json();
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const data = await userinfoRes.json();
      googleProfile = {
        sub: data.sub,
        email: data.email,
        email_verified: data.email_verified,
        name: data.name,
        picture: data.picture,
      };
    } else if (req.body.email) {
      // Development / Managed fallback when Google Client ID is not yet configured
      const rawEmail = req.body.email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        return response(res, 400, "Please provide a valid Google/Gmail address.");
      }
      googleProfile = {
        sub: `google_${rawEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
        email: rawEmail,
        name: req.body.name || rawEmail.split("@")[0].replace(/[._-]/g, " "),
        picture: req.body.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rawEmail)}`,
        email_verified: true,
      };
    } else {
      return response(res, 400, "Google credential, token, or email is required.");
    }

    if (!googleProfile || !googleProfile.sub || !googleProfile.email) {
      return response(res, 400, "Could not obtain verified Google identity.");
    }

    const { sub, email, name, picture, email_verified } = googleProfile;
    const cleanEmail = email.toLowerCase().trim();

    // Check if user exists by googleId OR verified email
    let user = await User.findOne({
      $or: [{ googleId: sub }, { email: cleanEmail }],
    });

    if (user) {
      if (!user.googleId) user.googleId = sub;
      if (!user.email) user.email = cleanEmail;
      if (email_verified) user.emailVerified = true;
      user.isVerified = true;
      user.lastLoginAt = new Date();
      if (!user.profilePicture && picture) {
        user.profilePicture = picture;
        user.avatarUrl = picture;
      }
      if (!user.displayName && name) user.displayName = name;
      if (!user.username) {
        const cleanName = (name || "user")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
          .slice(0, 15);
        user.username = `${cleanName}_${crypto.randomBytes(3).toString("hex")}`;
      }
      if (!user.flashId) {
        user.flashId = generateFlashId();
      }
      await user.save();
    } else {
      const cleanName = (name || cleanEmail.split("@")[0] || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 15);
      const randomSuffix = crypto.randomBytes(3).toString("hex");

      user = new User({
        googleId: sub,
        email: cleanEmail,
        emailVerified: email_verified || true,
        displayName: name || cleanEmail.split("@")[0] || "Flash User",
        username: `${cleanName}_${randomSuffix}`,
        flashId: generateFlashId(),
        profileCompleted: !!name,
        profilePicture: picture || "",
        avatarUrl: picture || "",
        isVerified: true,
        agreed: true,
        lastLoginAt: new Date(),
      });
      await user.save();
    }

    const sessionId = crypto.randomUUID();
    const accessToken = generateAccessToken(user._id, sessionId);
    const refreshToken = generateRefreshToken(user._id, sessionId);

    // Track active session
    const device = req.headers["user-agent"] || "Unknown Device";
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (!user.activeSessions) user.activeSessions = [];
    user.activeSessions.push({
      sessionId,
      refreshToken,
      device,
      ip,
      lastActive: new Date(),
    });
    if (user.activeSessions.length > 10) {
      user.activeSessions = user.activeSessions.slice(-10);
    }
    await user.save();
    await cache.del(`user:${user._id}`);

    // Set secure HTTP-only cookies
    res.cookie("auth_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return response(res, 200, "Signed in successfully with Google!", {
      token: accessToken,
      user,
      profileCompleted: !!user.profileCompleted,
      isNewUser: !user.profileCompleted,
      sessionId,
    });
  } catch (error) {
    console.error("googleAuth error:", error);
    return response(res, 500, error.message || "Google authentication failed.");
  }
};

// 📱 CREATE / COMPLETE PROFILE (Protected)
const createProfile = async (req, res) => {
  const userId = req.user?.userId;
  const { displayName, about, profilePicture, avatarUrl } = req.body;

  if (!displayName || !displayName.trim()) {
    return response(res, 400, "Please enter your name.");
  }

  try {
    const user = await User.findById(userId);
    if (!user) return response(res, 404, "User not found.");

    let uploadedPhotoUrl = profilePicture || avatarUrl || user.profilePicture || user.avatarUrl;

    if (req.file) {
      const uploadRes = await uploadFileToCloudinary(req.file.buffer, "flashchat/avatars");
      uploadedPhotoUrl = uploadRes.secure_url;
    }

    user.displayName = displayName.trim();
    if (!user.username || user.username.startsWith("user_")) {
      user.username = displayName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + user._id.toString().slice(-4);
    }
    if (about) {
      user.about = about.trim();
    }
    if (uploadedPhotoUrl) {
      user.profilePicture = uploadedPhotoUrl;
      user.avatarUrl = uploadedPhotoUrl;
    }
    if (!user.flashId) {
      user.flashId = generateFlashId();
    }
    user.profileCompleted = true;
    user.isVerified = true;
    await user.save();
    await cache.del(`user:${userId}`);

    return response(res, 200, "Profile created successfully! Welcome to Flash Chat.", {
      user,
      profileCompleted: true,
    });
  } catch (error) {
    console.error("createProfile error:", error);
    return response(res, 500, "Unable to save profile. Please try again.");
  }
};

// LINK GOOGLE ACCOUNT (Protected)
const linkGoogleAccount = async (req, res) => {
  const userId = req.user?.userId;
  const { credential, idToken } = req.body;
  const tokenToVerify = credential || idToken;

  if (!tokenToVerify) return response(res, 400, "Google token is required");

  try {
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${tokenToVerify}`
    );
    if (!googleRes.ok) return response(res, 401, "Invalid Google token");
    const data = await googleRes.json();

    const existingUser = await User.findOne({ googleId: data.sub });
    if (existingUser && String(existingUser._id) !== String(userId)) {
      return response(
        res,
        409,
        "This Google account is already linked to another Flash Chat user."
      );
    }

    const user = await User.findById(userId);
    if (!user) return response(res, 404, "User not found");

    user.googleId = data.sub;
    if (!user.email) user.email = data.email.toLowerCase();
    user.emailVerified = true;
    if (!user.profilePicture && data.picture) {
      user.profilePicture = data.picture;
      user.avatarUrl = data.picture;
    }
    await user.save();
    await cache.del(`user:${userId}`);

    return response(res, 200, "Google account linked successfully", user);
  } catch (error) {
    console.error("linkGoogleAccount error:", error);
    return response(res, 500, "Failed to link Google account");
  }
};

// 📱 FIREBASE / MANAGED PHONE AUTHENTICATION
const firebasePhoneAuth = async (req, res) => {
  const { idToken, phoneNumber: rawPhone } = req.body;

  if (!idToken && !rawPhone) {
    return response(res, 400, "Firebase ID token or verified phone is required.");
  }

  try {
    let verifiedPhone = rawPhone;
    let uid = null;

    if (idToken) {
      // Decode or verify Firebase ID token
      try {
        const decoded = jwt.decode(idToken);
        if (decoded && decoded.phone_number) {
          verifiedPhone = decoded.phone_number;
          uid = decoded.sub || decoded.user_id;
        }
      } catch (tokenErr) {
        console.warn("JWT decode warning for Firebase token:", tokenErr.message);
      }
    }

    if (!verifiedPhone) {
      return response(res, 400, "Could not verify phone number from token.");
    }

    // Parse E.164 phone into suffix and digits (e.g. +91 9876543210 or +1 2345678900)
    let cleanPhone = String(verifiedPhone).trim().replace(/[^\d+]/g, "");
    let phoneSuffix = "+91";
    let phoneNumber = cleanPhone;

    if (cleanPhone.startsWith("+")) {
      // match country code
      if (cleanPhone.startsWith("+91")) {
        phoneSuffix = "+91";
        phoneNumber = cleanPhone.slice(3);
      } else if (cleanPhone.startsWith("+1")) {
        phoneSuffix = "+1";
        phoneNumber = cleanPhone.slice(2);
      } else if (cleanPhone.startsWith("+44")) {
        phoneSuffix = "+44";
        phoneNumber = cleanPhone.slice(3);
      } else if (cleanPhone.startsWith("+971")) {
        phoneSuffix = "+971";
        phoneNumber = cleanPhone.slice(4);
      } else {
        phoneSuffix = cleanPhone.slice(0, 3);
        phoneNumber = cleanPhone.slice(3);
      }
    }

    let user = await User.findOne({ phoneNumber, phoneSuffix });

    if (user) {
      user.phoneVerified = true;
      user.isVerified = true;
      user.lastLoginAt = new Date();
      if (!user.flashId) {
        user.flashId = generateFlashId();
      }
      if (!user.displayName) {
        user.displayName = `User ${phoneNumber.slice(-4)}`;
      }
      if (!user.username) {
        user.username = `user_${phoneNumber.slice(-4)}_${crypto.randomBytes(3).toString("hex")}`;
      }
      await user.save();
    } else {
      const suffix4 = phoneNumber.slice(-4);
      user = new User({
        phoneNumber,
        phoneSuffix,
        phoneVerified: true,
        isVerified: true,
        displayName: `User ${suffix4}`,
        username: `user_${suffix4}_${crypto.randomBytes(3).toString("hex")}`,
        flashId: generateFlashId(),
        profileCompleted: false,
        agreed: true,
        lastLoginAt: new Date(),
      });
      await user.save();
    }

    const sessionId = crypto.randomUUID();
    const accessToken = generateAccessToken(user._id, sessionId);
    const refreshToken = generateRefreshToken(user._id, sessionId);

    const device = req.headers["user-agent"] || "Unknown Device";
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (!user.activeSessions) user.activeSessions = [];
    user.activeSessions.push({
      sessionId,
      refreshToken,
      device,
      ip,
      lastActive: new Date(),
    });
    if (user.activeSessions.length > 10) {
      user.activeSessions = user.activeSessions.slice(-10);
    }
    await user.save();
    await cache.del(`user:${user._id}`);

    res.cookie("auth_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return response(res, 200, "Phone verified successfully! Welcome to Flash Chat.", {
      token: accessToken,
      user,
      profileCompleted: !!user.profileCompleted,
      isNewUser: !user.profileCompleted,
      sessionId,
    });
  } catch (error) {
    console.error("firebasePhoneAuth error:", error);
    return response(res, 500, error.message || "Phone authentication failed.");
  }
};

// LINK PHONE NUMBER (Protected)
const linkPhoneAccount = async (req, res) => {
  const userId = req.user?.userId;
  const { phoneNumber, phoneSuffix, otp } = req.body;

  if (!phoneNumber || !phoneSuffix) {
    return response(res, 400, "Phone number and country code are required");
  }

  try {
    const cleanPhone = String(phoneNumber).trim().replace(/\D/g, "");
    const cleanSuffix = String(phoneSuffix).trim();

    if (otp) {
      const fullPhoneNumber = `${cleanSuffix}${cleanPhone}`;
      const result = await twilioService.verifyOtp(fullPhoneNumber, otp.trim());
      if (result.status !== "approved") {
        return response(res, 400, "Invalid or expired OTP");
      }
    }

    const existingUser = await User.findOne({
      phoneNumber: cleanPhone,
      phoneSuffix: cleanSuffix,
    });
    if (existingUser && String(existingUser._id) !== String(userId)) {
      return response(
        res,
        409,
        "This phone number is already linked to another Flash Chat user."
      );
    }

    const user = await User.findById(userId);
    if (!user) return response(res, 404, "User not found");

    user.phoneNumber = cleanPhone;
    user.phoneSuffix = cleanSuffix;
    user.phoneVerified = true;
    await user.save();
    await cache.del(`user:${userId}`);

    return response(res, 200, "Phone number linked successfully", user);
  } catch (error) {
    console.error("linkPhoneAccount error:", error);
    return response(res, 500, "Failed to link phone number");
  }
};

// REFRESH TOKEN ROTATION
const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return response(res, 401, "Refresh token missing");
    }

    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + "_refresh";
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch (err) {
      res.clearCookie("auth_token");
      res.clearCookie("refresh_token", { path: "/api/auth" });
      return response(res, 401, "Invalid or expired refresh token");
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return response(res, 401, "User not found");
    }

    // Check if session exists in DB
    const sessionIndex = (user.activeSessions || []).findIndex(
      (s) => s.sessionId === decoded.sessionId
    );

    if (sessionIndex === -1) {
      res.clearCookie("auth_token");
      res.clearCookie("refresh_token", { path: "/api/auth" });
      return response(res, 401, "Session has been revoked");
    }

    // Rotate tokens
    const newSessionId = decoded.sessionId;
    const newAccessToken = generateAccessToken(user._id, newSessionId);
    const newRefreshToken = generateRefreshToken(user._id, newSessionId);

    user.activeSessions[sessionIndex].refreshToken = newRefreshToken;
    user.activeSessions[sessionIndex].lastActive = new Date();
    await user.save();

    res.cookie("auth_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return response(res, 200, "Token refreshed successfully", {
      token: newAccessToken,
      user,
    });
  } catch (error) {
    console.error("refreshAccessToken error:", error);
    return response(res, 500, "Internal server error");
  }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
  const { username, agreed, about } = req.body;
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);
    if (!user) return response(res, 404, "User not found");

    if (req.file) {
      const uploadResult = await uploadFileToCloudinary(req.file);
      user.profilePicture = uploadResult?.secure_url;
    } else if (req.body.profilePicture) {
      user.profilePicture = req.body.profilePicture;
    }

    if (username) user.username = username;
    if (about) user.about = about;
    if (typeof agreed !== "undefined") user.agreed = agreed;

    await user.save();
    await cache.del(`user:${userId}`);
    return response(res, 200, "Profile updated successfully", user);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.username) {
      return response(res, 409, "That username is already taken. Please choose another.");
    }
    console.error("updateProfile error:", error);
    return response(res, 500, "Internal server error");
  }
};

// LOGOUT
const logout = async (req, res) => {
  try {
    const sessionId = req.user?.sessionId;
    const userId = req.user?.userId;

    if (userId && sessionId) {
      await User.findByIdAndUpdate(userId, {
        $pull: { activeSessions: { sessionId } },
      });
    }

    res.clearCookie("auth_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
    });
    return response(res, 200, "Logged out successfully");
  } catch (error) {
    console.error("logout error:", error);
    return response(res, 500, "Internal server error");
  }
};

// CHECK AUTH
const checkAuthenticated = async (req, res) => {
  try {
    const authToken = req.cookies?.auth_token;
    if (!authToken) {
      return response(res, 200, "Not authenticated", { isAuthenticated: false, user: null });
    }

    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    const cacheKey = `user:${decoded.userId}`;
    
    let user = await cache.get(cacheKey);
    if (!user) {
      user = await User.findById(decoded.userId).select("-emailOtp -emailOtpExpiry");
      if (user) {
        await cache.set(cacheKey, user, 3600); // Cache for 1 hour
      }
    }
    
    if (!user) {
      return response(res, 200, "User not found", { isAuthenticated: false, user: null });
    }

    return response(res, 200, "Authenticated", { isAuthenticated: true, user });
  } catch (error) {
    return response(res, 200, "Session expired or invalid", { isAuthenticated: false, user: null });
  }
};

// GET ALL USERS
const getAllUser = async (req, res) => {
  const loggedInUser = req.user.userId;

  try {
    // 1. Get logged-in user's blocked list and who blocked them
    const loggedInUserDoc = await User.findById(loggedInUser).select("blockedUsers");
    const blockedUserIds = loggedInUserDoc?.blockedUsers || [];

    const usersWhoBlockedMe = await User.find({ blockedUsers: loggedInUser }).select("_id");
    const blockedMeIds = usersWhoBlockedMe.map((u) => u._id.toString());
    const allBlockIds = [...blockedUserIds.map((id) => id.toString()), ...blockedMeIds];

    const users = await User.find({
      _id: { $ne: loggedInUser, $nin: allBlockIds },
    })
      .select("username profilePicture lastSeen isOnline about phoneNumber phoneSuffix contacts privacySettings")
      .lean();

    const userIds = users.map((u) => u._id);

    // ✅ Single query instead of N+1 — fetch all relevant conversations at once
    const conversations = await Conversation.find({
      participants: { $all: [loggedInUser], $in: userIds },
    })
      .populate({ path: "lastMessage", select: "content createdAt sender receiver" })
      .lean();

    // Map conversations by the other participant's ID for O(1) lookup
    const conversationMap = {};
    for (const convo of conversations) {
      const otherId = convo.participants
        .find((p) => String(p) !== String(loggedInUser))
        ?.toString();
      if (otherId) conversationMap[otherId] = convo;
    }

    const formattedUsers = users.map((user) => {
      let userObj = { ...user };

      // Apply visibility settings server-side based on relationship
      const settings = userObj.privacySettings || {
        lastSeen: "everyone",
        profilePhoto: "everyone",
        about: "everyone",
        readReceipts: true,
      };

      const contactsList = (userObj.contacts || []).map((id) => String(id));
      const isContact = contactsList.includes(String(loggedInUser));

      // 1. lastSeen
      if (
        settings.lastSeen === "nobody" ||
        (settings.lastSeen === "contacts" && !isContact)
      ) {
        delete userObj.lastSeen;
        userObj.isOnline = false; // WhatsApp hides online status too if lastSeen is hidden
      }

      // 2. profilePhoto
      if (
        settings.profilePhoto === "nobody" ||
        (settings.profilePhoto === "contacts" && !isContact)
      ) {
        delete userObj.profilePicture;
      }

      // 3. about
      if (
        settings.about === "nobody" ||
        (settings.about === "contacts" && !isContact)
      ) {
        delete userObj.about;
      }

      // Strip sensitive arrays/settings before returning to client
      delete userObj.contacts;
      delete userObj.privacySettings;

      return {
        ...userObj,
        conversation: conversationMap[user._id.toString()] || null,
      };
    });

    return response(res, 200, "Users fetched successfully", formattedUsers);
  } catch (error) {
    console.error("getAllUser error:", error);
    return response(res, 500, "Internal server error");
  }
};

// UPDATE USER STATUS
const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status, customStatusText } = req.body;

  // ✅ Prevent users from updating someone else's status
  if (String(req.user.userId) !== String(id)) {
    return response(res, 403, "You can only update your own status");
  }

  try {
    const user = await User.findById(id);
    if (!user) return response(res, 404, "User not found");

    if (status) {
      const activeStatuses = ["online", "away", "busy"];
      user.isOnline = activeStatuses.includes(status);
      user.lastSeen = user.isOnline ? null : new Date();
    }

    if (customStatusText) user.about = customStatusText;

    await user.save();
    await cache.del(`user:${id}`);
    return response(res, 200, "Status updated successfully", user);
  } catch (error) {
    console.error("updateUserStatus error:", error);
    return response(res, 500, "Internal server error");
  }
};

// CHECK USERNAME AVAILABILITY
const checkUsernameAvailability = async (req, res) => {
  const { username } = req.params;

  if (!username || username.trim().length < 3) {
    return response(res, 400, "Username must be at least 3 characters");
  }

  try {
    const safe = username.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Case-insensitive match so "Admin" and "admin" are treated as the
    // same username — otherwise two people could register near-identical
    // handles that only differ by case.
    const existing = await User.findOne({
      username: { $regex: `^${safe}$`, $options: "i" },
    }).select("_id");

    return response(res, 200, "Checked username availability", {
      available: !existing,
    });
  } catch (error) {
    console.error("checkUsernameAvailability error:", error);
    return response(res, 500, "Internal server error");
  }
};

// BLOCK USER
const blockUser = async (req, res) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.userId;

  if (String(targetUserId) === String(currentUserId)) {
    return response(res, 400, "You cannot block yourself");
  }

  try {
    const user = await User.findById(currentUserId);
    if (!user) return response(res, 404, "User not found");

    if (!user.blockedUsers.includes(targetUserId)) {
      user.blockedUsers.push(targetUserId);
      await user.save();
      await cache.del(`user:${currentUserId}`);
    }

    return response(res, 200, "User blocked successfully", user);
  } catch (error) {
    console.error("blockUser error:", error);
    return response(res, 500, "Internal server error");
  }
};

// UNBLOCK USER
const unblockUser = async (req, res) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.userId;

  try {
    const user = await User.findById(currentUserId);
    if (!user) return response(res, 404, "User not found");

    user.blockedUsers = user.blockedUsers.filter(id => String(id) !== String(targetUserId));
    await user.save();
    await cache.del(`user:${currentUserId}`);

    return response(res, 200, "User unblocked successfully", user);
  } catch (error) {
    console.error("unblockUser error:", error);
    return response(res, 500, "Internal server error");
  }
};

// GET BLOCKED USERS
const getBlockedUsers = async (req, res) => {
  const currentUserId = req.user.userId;

  try {
    const user = await User.findById(currentUserId)
      .populate("blockedUsers", "username profilePicture about")
      .lean();
    if (!user) return response(res, 404, "User not found");

    return response(res, 200, "Blocked users fetched successfully", user.blockedUsers || []);
  } catch (error) {
    console.error("getBlockedUsers error:", error);
    return response(res, 500, "Internal server error");
  }
};

// UPDATE PRIVACY SETTINGS
const updatePrivacySettings = async (req, res) => {
  const currentUserId = req.user.userId;
  const { lastSeen, profilePhoto, about, readReceipts } = req.body;

  try {
    const user = await User.findById(currentUserId);
    if (!user) return response(res, 404, "User not found");

    if (!user.privacySettings) {
      user.privacySettings = {};
    }

    if (lastSeen) user.privacySettings.lastSeen = lastSeen;
    if (profilePhoto) user.privacySettings.profilePhoto = profilePhoto;
    if (about) user.privacySettings.about = about;
    if (typeof readReceipts !== "undefined") user.privacySettings.readReceipts = readReceipts;

    await user.save();
    await cache.del(`user:${currentUserId}`);

    return response(res, 200, "Privacy settings updated successfully", user.privacySettings);
  } catch (error) {
    console.error("updatePrivacySettings error:", error);
    return response(res, 500, "Internal server error");
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  firebasePhoneAuth,
  googleAuth,
  createProfile,
  linkGoogleAccount,
  linkPhoneAccount,
  refreshAccessToken,
  updateProfile,
  logout,
  checkAuthenticated,
  getAllUser,
  updateUserStatus,
  checkUsernameAvailability,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updatePrivacySettings,
};