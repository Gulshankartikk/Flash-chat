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

  // Cloudinary Media Store
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  // Redis & Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  REDIS_URL: z.string().optional().default('')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Invalid Environment Configuration:');
  parsed.error.issues.forEach((issue) => {
    console.error(`   - [${issue.path.join('.')}] ${issue.message}`);
  });
  console.error('\nStarting with fallback development defaults.\n');
}

const config = parsed.success ? parsed.data : envSchema.parse({});

// Sync legacy aliases if provided
if (!config.SMTP_USER && config.GMAIL_USER) {
  config.SMTP_USER = config.GMAIL_USER;
}
if (!config.SMTP_PASS && config.GMAIL_APP_PASSWORD) {
  config.SMTP_PASS = config.GMAIL_APP_PASSWORD;
}

module.exports = config;
