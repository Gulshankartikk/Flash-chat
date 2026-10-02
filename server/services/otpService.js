const crypto = require('crypto');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const config = require('../config/env');
const redis = require('./redisService');
const logger = require('../utils/logger');

// Initialize Twilio client if configured
let twilioClient = null;
if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN && !config.TWILIO_ACCOUNT_SID.startsWith('ACxxxx')) {
  try {
    twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    logger.info('Twilio SMS client initialized');
  } catch (err) {
    logger.warn({ err: err.message }, 'Twilio client initialization failed');
  }
}

// Initialize Nodemailer transporter if configured
let emailTransporter = null;
if (config.SMTP_USER && config.SMTP_PASS) {
  try {
    emailTransporter = nodemailer.createTransport({
      host: config.SMTP_HOST || 'smtp.gmail.com',
      port: config.SMTP_PORT || 587,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS
      }
    });
    logger.info({ user: config.SMTP_USER }, 'SMTP Transporter initialized for OTP');
  } catch (err) {
    logger.warn({ err: err.message }, 'SMTP Transporter setup failed');
  }
}

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 60; // 60 seconds
const MAX_VERIFY_ATTEMPTS = 5;

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const sendOtp = async (arg1, arg2) => {
  const identifier = typeof arg1 === 'object' ? arg1.identifier : arg1;
  const type = (typeof arg1 === 'object' ? arg1.type : arg2) || (identifier?.includes('@') ? 'email' : 'phone');

  if (!identifier) {
    throw new Error('Phone number or email is required.');
  }

  const cleanIdentifier = identifier.trim().toLowerCase();
  const redisKey = `otp:${cleanIdentifier}`;
  const cooldownKey = `otp_cooldown:${cleanIdentifier}`;

  // Check cooldown
  const hasCooldown = await redis.get(cooldownKey);
  if (hasCooldown) {
    throw new Error('Please wait 60 seconds before requesting another code.');
  }

  // Generate 6-digit OTP
  const otp = generateOtp();

  // Store in Redis with 5 min TTL
  const otpPayload = {
    otp,
    attempts: 0,
    type,
    createdAt: Date.now()
  };

  await redis.set(redisKey, JSON.stringify(otpPayload), 'EX', OTP_TTL_SECONDS);
  await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SECONDS);

  // Always output prominently to terminal console for seamless DX and testing
  console.log('\n======================================================');
  console.log(`⚡ [FLASH CHAT OTP] Destination: ${cleanIdentifier} (${type.toUpperCase()})`);
  console.log(`🔑 OTP CODE: 👉 [ ${otp} ] 👈`);
  console.log(`⏱️  Validity: 5 Minutes (Universal Dev Test Code: 123456)`);
  console.log('======================================================\n');

  let delivered = false;

  if (type === 'phone') {
    // Deliver via Twilio Verify Service or Programmable SMS if configured
    if (twilioClient) {
      try {
        if (config.TWILIO_VERIFY_SERVICE_SID) {
          await twilioClient.verify.v2
            .services(config.TWILIO_VERIFY_SERVICE_SID)
            .verifications.create({ to: cleanIdentifier, channel: 'sms' });
          delivered = true;
        } else if (config.TWILIO_PHONE_NUMBER) {
          await twilioClient.messages.create({
            body: `Your Flash Chat verification code is: ${otp}. Valid for 5 minutes.`,
            from: config.TWILIO_PHONE_NUMBER,
            to: cleanIdentifier
          });
          delivered = true;
        }
      } catch (smsErr) {
        logger.warn({ err: smsErr.message }, 'Twilio SMS failed. Falling back to console OTP.');
      }
    }
  } else if (type === 'email') {
    // Deliver via SMTP Nodemailer if configured
    if (emailTransporter) {
      try {
        await emailTransporter.sendMail({
          from: config.MAIL_FROM || 'Flash Chat <no-reply@flashchat.io>',
          to: cleanIdentifier,
          subject: `⚡ Your Flash Chat Verification Code: ${otp}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #FFF7ED; border-radius: 24px; border: 1px solid #FED7AA; text-align: center;">
              <h1 style="color: #F97316; font-size: 28px; margin: 0 0 8px 0; font-weight: 900;">⚡ Flash Chat</h1>
              <p style="color: #6B7280; font-size: 14px; margin: 0 0 24px 0;">WhatsApp + Instagram + Pocket + AI</p>
              <div style="background: #FFFFFF; border-radius: 20px; padding: 24px; border: 1px solid #FED7AA; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <p style="color: #1F2937; font-size: 15px; margin: 0 0 16px 0; font-weight: 600;">Your One-Time Passcode</p>
                <div style="background: #FFF7ED; border: 2px dashed #F97316; border-radius: 12px; padding: 14px 20px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #EA580C; font-family: monospace;">
                  ${otp}
                </div>
                <p style="color: #6B7280; font-size: 12px; margin: 16px 0 0 0;">Valid for 5 minutes. Never share this code with anyone.</p>
              </div>
              <p style="color: #9CA3AF; font-size: 11px; margin-top: 24px;">© ${new Date().getFullYear()} Flash Chat. Fast, private and connected.</p>
            </div>
          `
        });
        delivered = true;
      } catch (mailErr) {
        logger.warn({ err: mailErr.message }, 'Nodemailer OTP delivery failed. Falling back to console OTP.');
      }
    }
  }

  return {
    success: true,
    message: delivered ? `OTP sent via ${type}` : `OTP generated (Check terminal in dev mode)`,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    mock: !delivered,
    ...(config.NODE_ENV !== 'production' ? { otp } : {})
  };
};

const verifyOtp = async (arg1, arg2) => {
  const identifier = typeof arg1 === 'object' ? arg1.identifier : arg1;
  const otp = typeof arg1 === 'object' ? arg1.otp : arg2;

  if (!identifier || !otp) {
    throw new Error('Identifier and OTP are required.');
  }

  const cleanIdentifier = identifier.trim().toLowerCase();
  const cleanOtp = otp.trim();
  const redisKey = `otp:${cleanIdentifier}`;

  // Accept universal development master OTP
  if (config.NODE_ENV !== 'production' && ['123456', '000000'].includes(cleanOtp)) {
    await redis.del(redisKey);
    return { verified: true, masterCode: true };
  }

  const recordStr = await redis.get(redisKey);
  if (!recordStr) {
    throw new Error('Verification code has expired or was not requested. Please request a new code.');
  }

  const record = JSON.parse(recordStr);

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await redis.del(redisKey);
    throw new Error('Maximum verification attempts exceeded. Please request a new OTP.');
  }

  if (record.otp !== cleanOtp) {
    record.attempts += 1;
    await redis.set(redisKey, JSON.stringify(record), 'EX', OTP_TTL_SECONDS);
    const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
    throw new Error(`Invalid verification code. ${remaining} attempts remaining.`);
  }

  // OTP is valid - consume it
  await redis.del(redisKey);
  return { verified: true };
};

module.exports = {
  sendOtp,
  verifyOtp
};
