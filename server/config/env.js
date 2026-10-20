const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

// Load environment variables from server/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  MONGO_URI: z.string().default('mongodb://localhost:27017/flashchat'),
  
  // JWT Tokens
  JWT_ACCESS_SECRET: z.string().default('flash_chat_super_secure_access_secret_key_32_chars_min'),
  JWT_REFRESH_SECRET: z.string().default('flash_chat_super_secure_refresh_secret_key_32_chars_min'),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  // Twilio OTP SMS
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional().default(''),
  TWILIO_PHONE_NUMBER: z.string().optional().default(''),

  // Nodemailer SMTP
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default('Flash Chat <no-reply@flashchat.io>'),
  // Legacy aliases for backward compatibility
  GMAIL_USER: z.string().optional().default(''),
  GMAIL_APP_PASSWORD: z.string().optional().default(''),

  // Google Gemini AI
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  GEMINI_MODEL_PRO: z.string().default('gemini-3.8-flash'),
  AI_DAILY_LIMIT: z.string().or(z.number()).default(50).transform(val => Number(val) || 50),
  AI_MAX_INPUT_CHARS: z.string().or(z.number()).default(8000).transform(val => Number(val) || 8000),

  // Cloudinary Media Store
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  // Redis & Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  REDIS_URL: z.string().optional().default(''),

  // Web Push VAPID Keys
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().default('mailto:support@flashchat.io'),

  // WebRTC STUN / TURN Configuration
  STUN_URLS: z.string().default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
  TURN_URL: z.string().optional().default(''),
  TURN_USERNAME: z.string().optional().default(''),
  TURN_CREDENTIAL: z.string().optional().default(''),
  TURN_SECRET: z.string().optional().default('')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Invalid Environment Configuration:');
  parsed.error.issues.forEach((issue) => {
    console.error(`   - [${issue.path.join('.')}] ${issue.message}`);
  });
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Fatal: Invalid environment configuration in production.');
  }
  console.error('\nStarting with fallback development defaults.\n');
}

const config = parsed.success ? parsed.data : envSchema.parse({});

// Fail fast in production if default/insecure JWT secrets or missing database URI
if (config.NODE_ENV === 'production') {
  if (
    config.JWT_ACCESS_SECRET.includes('32_chars_min') ||
    config.JWT_REFRESH_SECRET.includes('32_chars_min')
  ) {
    throw new Error('Fatal: Insecure default JWT secrets detected in production. Set strong random keys.');
  }
}

// Sync legacy aliases if provided
if (!config.SMTP_USER && config.GMAIL_USER) {
  config.SMTP_USER = config.GMAIL_USER;
}
if (!config.SMTP_PASS && config.GMAIL_APP_PASSWORD) {
  config.SMTP_PASS = config.GMAIL_APP_PASSWORD;
}

module.exports = config;
