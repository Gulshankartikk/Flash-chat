const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER.trim(),
        pass: process.env.EMAIL_PASS.trim().replace(/\s+/g, ""), // handle spaced App Passwords
      },
    });

    transporter.verify((err) => {
      if (err) {
        console.warn("[NODEMAILER] SMTP verification warning:", err.message);
      } else {
        console.log(`[NODEMAILER] Ready to send emails via ${process.env.EMAIL_USER}`);
      }
    });
  } catch (e) {
    console.warn("[NODEMAILER] Transporter setup failed:", e.message);
  }
}

const sendOtpToEmail = async (email, otp) => {
  if (!email || !otp) {
    throw new Error("Email and OTP are required");
  }

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #FF6B00; font-size: 28px; margin: 0; font-weight: 800;">⚡ FLASH CHAT</h1>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Fast • Private • Real-time</p>
      </div>
      
      <p style="font-size: 15px;">Hi there,</p>
      <p style="font-size: 14px; color: #475569;">Your one-time password (OTP) to verify your Flash Chat account is:</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <span style="background: #fff7ed; color: #ea580c; border: 2px dashed #FF6B00; font-size: 32px; font-weight: bold; padding: 12px 28px; display: inline-block; border-radius: 12px; letter-spacing: 6px; font-family: monospace;">
          ${otp}
        </span>
      </div>
      
      <p style="font-size: 13px; color: #64748b;"><strong>This code is valid for 5 minutes.</strong> Never share this OTP with anyone.</p>
      <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">If you did not request this code, you can safely ignore this email.</p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <div style="font-size: 11px; color: #94a3b8; text-align: center;">
        &copy; ${new Date().getFullYear()} Flash Chat Security Team. All rights reserved.
      </div>
    </div>
  `;

  if (!transporter) {
    console.log(`[MANAGED EMAIL PROVIDER] (Simulated) OTP for ${email}: [${otp}]`);
    return { delivered: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `Flash Chat <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `⚡ ${otp} is your Flash Chat verification code`,
      html,
    });

    console.log("[EMAIL SERVICE] OTP email sent successfully. Message ID:", info.messageId);
    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    console.error("[EMAIL SERVICE] Error sending email via Nodemailer:", error.message);
    return { delivered: false, error: error.message };
  }
};

module.exports = {
  sendOtpToEmail,
};