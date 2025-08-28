import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, getAllowedOrigins, securityConfig } from './config';
import CryptoJS from 'crypto-js';
import xss from 'xss';
import type { Express, Request, Response, NextFunction } from 'express';

// Encryption utilities for sensitive data
export class Encryption {
  private static key = config.ENCRYPTION_KEY || config.SESSION_SECRET;

  static encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.key).toString();
  }

  static decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

// Setup security middleware
export function setupSecurity(app: Express) {
  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for React
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: config.NODE_ENV === 'production',
  }));

  // CORS configuration
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.) in development
      if (!origin && config.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      const allowedOrigins = getAllowedOrigins();
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  };
  
  app.use(cors(corsOptions));

  // Request size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
}

// Rate limiters
export const authRateLimiter = rateLimit({
  windowMs: securityConfig.rateLimitWindow,
  max: securityConfig.rateLimitMaxRequests,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Store in memory (use Redis in production for distributed systems)
  skipSuccessfulRequests: false,
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Sanitize user input to prevent XSS
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return xss(input);
  } else if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  } else if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
}

// Middleware to sanitize request body
export const sanitizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  next();
};

// Filter sensitive data from logs
export function filterSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'sessionId',
    'creditCard',
    'ssn',
    'email', // Consider if you want to log emails
  ];

  const filtered = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in filtered) {
    if (filtered.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field name contains sensitive keywords
      const isSensitive = sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        filtered[key] = '[REDACTED]';
      } else if (typeof filtered[key] === 'object' && filtered[key] !== null) {
        filtered[key] = filterSensitiveData(filtered[key]);
      }
    }
  }

  return filtered;
}

// Security event logger
export function logSecurityEvent(event: string, details: any = {}) {
  const timestamp = new Date().toISOString();
  const filteredDetails = filterSensitiveData(details);
  
  console.log(JSON.stringify({
    type: 'SECURITY_EVENT',
    event,
    timestamp,
    details: filteredDetails,
  }));
}

// Password complexity validator
export function validatePasswordComplexity(password: string): { valid: boolean; message?: string } {
  if (password.length < securityConfig.passwordMinLength) {
    return { 
      valid: false, 
      message: `Password must be at least ${securityConfig.passwordMinLength} characters` 
    };
  }
  
  if (password.length > securityConfig.passwordMaxLength) {
    return { 
      valid: false, 
      message: `Password must not exceed ${securityConfig.passwordMaxLength} characters` 
    };
  }
  
  if (!securityConfig.passwordComplexityRegex.test(password)) {
    return { 
      valid: false, 
      message: securityConfig.passwordComplexityMessage 
    };
  }
  
  return { valid: true };
}