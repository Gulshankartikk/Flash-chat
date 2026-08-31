const twilio = require("twilio");
const crypto = require("crypto");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

let client = null;
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
  } catch (e) {
    console.warn("[TWILIO SERVICE] Client init failed:", e.message);
  }
}

// In-memory OTP storage with 5-minute TTL when Twilio is not configured
const localOtpStore = new Map();

const mapTwilioSendError = (error) => {
  switch (error.code) {
    case 60200:
      return "Invalid phone number format.";
    case 60203:
      return "Max send attempts reached. Please try again later.";
    case 60212:
      return "Too many requests. Please wait before trying again.";
    case 21211:
      return "This phone number is invalid.";
    default:
      return "Failed to send OTP. Please try again.";
  }
};

const mapTwilioVerifyError = (error) => {
  switch (error.code) {
    case 60200:
      return "Invalid phone number format.";
    case 60202:
      return "Max verification attempts reached. Please request a new OTP.";
    case 20404:
      return "OTP expired or not found. Please request a new one.";
    default:
      return "Invalid OTP. Please try again.";
  }
};

const sendOtpToPhone = async (phoneNumber) => {
  if (!phoneNumber) {
    throw new Error("Phone number is required");
  }

  // 1. Always generate a local secure 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiry = Date.now() + 5 * 60 * 1000;
  localOtpStore.set(phoneNumber, { otp, expiry, attempts: 0 });

  // 2. Prominently display OTP in backend terminal
  console.log("\n=======================================================");
  console.log(`📱 [FLASH CHAT OTP] Phone Number: ${phoneNumber}`);
  console.log(`🔑 OTP CODE: 👉 [ ${otp} ] 👈`);
  console.log(`⏱️  Validity: 5 Minutes (Universal Dev Test Code: 123456)`);
  console.log("=======================================================\n");

  // 3. Attempt Twilio SMS delivery if configured
  let twilioSuccess = false;
  if (client && serviceSid && !serviceSid.startsWith("VAxxxx") && !accountSid.startsWith("ACxxxx")) {
    try {
      const response = await client.verify.v2
        .services(serviceSid)
        .verifications.create({
          to: phoneNumber,
          channel: "sms",
        });

      console.log(`[TWILIO SERVICE] SMS verification initiated via Twilio for ${phoneNumber}. Status:`, response.status);
      twilioSuccess = true;
    } catch (error) {
      console.warn(`[TWILIO SERVICE] Twilio SMS delivery failed (Code: ${error.code}). Reason: ${error.message}`);
      console.log(`ℹ️  [FALLBACK ACTIVE] You can use terminal OTP [${otp}] or [123456] to log in.`);
    }
  }

  return { status: "pending", managed: true, devOtp: otp, twilioSuccess };
};

const verifyOtp = async (phoneNumber, otp) => {
  if (!phoneNumber || !otp) {
    throw new Error("Phone number and OTP are required");
  }

  console.log("[PHONE AUTH SERVICE] Verifying OTP for:", phoneNumber);

  // If live Twilio Verify is configured, attempt Twilio verification first
  if (client && serviceSid && !serviceSid.startsWith("VAxxxx") && !accountSid.startsWith("ACxxxx")) {
    try {
      const response = await client.verify.v2
        .services(serviceSid)
        .verificationChecks.create({
          to: phoneNumber,
          code: otp,
        });

      console.log("[TWILIO SERVICE] OTP verify status:", response.status);
      if (response.status === "approved") {
        return response;
      }
    } catch (error) {
      console.warn("[TWILIO SERVICE] Twilio verification failed. Checking managed provider.");
    }
  }

  // Check managed local OTP store
  const stored = localOtpStore.get(phoneNumber);
  if (!stored) {
    throw new Error("OTP expired or not found. Please request a new one.");
  }

  if (Date.now() > stored.expiry) {
    localOtpStore.delete(phoneNumber);
    throw new Error("OTP has expired. Please request a new one.");
  }

  stored.attempts = (stored.attempts || 0) + 1;
  if (stored.attempts > 5) {
    localOtpStore.delete(phoneNumber);
    throw new Error("Max verification attempts reached. Please request a new OTP.");
  }

  // Accept generated OTP or standard development test OTP (000000 / 123456)
  if (stored.otp === otp.trim() || (process.env.NODE_ENV !== "production" && ["123456", "000000"].includes(otp.trim()))) {
    localOtpStore.delete(phoneNumber);
    return { status: "approved", managed: true };
  }

  throw new Error("Incorrect OTP. Please check the code and try again.");
};

module.exports = {
  sendOtpToPhone,
  verifyOtp,
};