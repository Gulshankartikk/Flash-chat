const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

// Load environment variables from server/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  MONGO_URI: z.string({ required_error: 'MONGO_URI is required' }).min(1, 'MONGO_URI cannot be empty'),
  JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required' }).min(16, 'JWT_SECRET must be at least 16 characters'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  
  // Google OAuth 2.0
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().optional().default('http://localhost:5000/api/auth/google/callback'),
  
  // Gmail / Nodemailer configuration
  GMAIL_USER: z.string().optional().default(''),
  GMAIL_REFRESH_TOKEN: z.string().optional().default(''),
  GMAIL_APP_PASSWORD: z.string().optional().default(''),
  
  // Logging & Cache
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  REDIS_URL: z.string().optional().default('')
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n❌ Invalid Environment Configuration:');
  result.error.issues.forEach((issue) => {
    console.error(`   - [${issue.path.join('.')}] ${issue.message}`);
  });
  console.error('\nPlease update your .env file according to .env.example.\n');
  process.exit(1);
}

const config = result.data;

module.exports = config;
