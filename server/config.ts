import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment variable validation schema
const envSchema = z.object({
  // Required
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  
  // Plaid (optional in development, required in production)
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).optional(),
  
  // Method (optional - for liability data)
  METHOD_API_KEY: z.string().optional(),
  METHOD_ENV: z.enum(['dev', 'sandbox', 'production']).default('dev'),
  
  // Server
  PORT: z.string().default('5000'),
  
  // Security
  ENCRYPTION_KEY: z.string().min(32).optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5000'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default('5'),
  
  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
});

// Validate environment variables
function validateEnv() {
  try {
    const env = envSchema.parse(process.env);
    
    // Additional production checks
    if (env.NODE_ENV === 'production') {
      if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET || !env.PLAID_ENV) {
        throw new Error('Plaid configuration is required in production');
      }
      
      if (!env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY is required in production for sensitive data encryption');
      }
      
      if (env.SESSION_SECRET.length < 32) {
        throw new Error('SESSION_SECRET must be at least 32 characters in production');
      }
    }
    
    return env;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else if (error instanceof Error) {
      console.error(`  - ${error.message}`);
    }
    process.exit(1);
  }
}

// Export validated config
export const config = validateEnv();

// Helper to get allowed origins as array
export const getAllowedOrigins = () => {
  return config.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
};

// Security configuration
export const securityConfig = {
  bcryptRounds: 12,
  sessionTtl: 7 * 24 * 60 * 60 * 1000, // 1 week
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  passwordMinLength: 8,
  passwordMaxLength: 128,
  
  // Password complexity regex
  passwordComplexityRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  passwordComplexityMessage: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  
  // Rate limiting
  rateLimitWindow: parseInt(config.RATE_LIMIT_WINDOW_MS, 10),
  rateLimitMaxRequests: parseInt(config.RATE_LIMIT_MAX_REQUESTS, 10),
};