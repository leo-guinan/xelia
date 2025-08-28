import bcrypt from 'bcryptjs';
import type { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from './storage';
import { z } from 'zod';
import { config, securityConfig } from './config';
import { authRateLimiter, sanitizeMiddleware, logSecurityEvent, validatePasswordComplexity } from './security';

// Session configuration
export function setupSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: config.DATABASE_URL,
    createTableIfMissing: false,
    ttl: securityConfig.sessionTtl,
    tableName: 'sessions',
  });

  return session({
    secret: config.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      maxAge: securityConfig.sessionTtl,
      sameSite: 'strict',
      name: config.NODE_ENV === 'production' ? '__Host-session' : 'session',
    },
  });
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().max(255),
  password: z.string()
    .min(securityConfig.passwordMinLength)
    .max(securityConfig.passwordMaxLength)
    .refine((password) => validatePasswordComplexity(password).valid, {
      message: securityConfig.passwordComplexityMessage,
    }),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().max(255),
  password: z.string().min(1, 'Password is required').max(securityConfig.passwordMaxLength),
});

// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Setup authentication routes
export function setupAuth(app: Express) {
  // Setup session middleware
  app.set('trust proxy', 1);
  app.use(setupSession());

  // Register route with rate limiting and sanitization
  app.post('/api/auth/register', authRateLimiter, sanitizeMiddleware, async (req: Request, res: Response) => {
    try {
      // Validate input
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        logSecurityEvent('REGISTRATION_FAILED_USER_EXISTS', { email: validatedData.email });
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // Hash password with stronger rounds
      const passwordHash = await bcrypt.hash(validatedData.password, securityConfig.bcryptRounds);

      // Create user
      const user = await storage.createUser({
        email: validatedData.email,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      // Regenerate session to prevent fixation
      req.session.regenerate((err) => {
        if (err) {
          logSecurityEvent('SESSION_REGENERATION_FAILED', { userId: user.id, error: err.message });
          return res.status(500).json({ message: 'Session error' });
        }
        
        req.session.userId = user.id;
        req.session.save((err) => {
          if (err) {
            logSecurityEvent('SESSION_SAVE_FAILED', { userId: user.id, error: err.message });
            return res.status(500).json({ message: 'Session error' });
          }
          
          logSecurityEvent('USER_REGISTERED', { userId: user.id, email: user.email });
          res.status(201).json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid input', errors: error.errors });
      } else {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Failed to register user' });
      }
    }
  });

  // Login route with rate limiting and sanitization
  app.post('/api/auth/login', authRateLimiter, sanitizeMiddleware, async (req: Request, res: Response) => {
    try {
      // Validate input
      const validatedData = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        logSecurityEvent('LOGIN_FAILED_USER_NOT_FOUND', { email: validatedData.email });
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        logSecurityEvent('LOGIN_ATTEMPT_LOCKED_ACCOUNT', { userId: user.id, email: user.email });
        const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        return res.status(423).json({ 
          message: `Account is locked. Please try again in ${remainingTime} minutes.` 
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(validatedData.password, user.passwordHash);
      if (!isValidPassword) {
        // Increment failed attempts
        const attempts = (user.failedLoginAttempts || 0) + 1;
        
        if (attempts >= securityConfig.maxLoginAttempts) {
          // Lock the account
          const lockedUntil = new Date(Date.now() + securityConfig.lockoutDuration);
          await storage.updateUserSecurity(user.id, {
            failedLoginAttempts: attempts,
            lockedUntil,
          });
          logSecurityEvent('ACCOUNT_LOCKED', { userId: user.id, email: user.email, attempts });
          return res.status(423).json({ 
            message: 'Account locked due to too many failed attempts. Please try again later.' 
          });
        } else {
          await storage.updateUserSecurity(user.id, {
            failedLoginAttempts: attempts,
          });
          logSecurityEvent('LOGIN_FAILED_INVALID_PASSWORD', { userId: user.id, email: user.email, attempts });
        }
        
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      // Reset failed attempts on successful login
      if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
        await storage.updateUserSecurity(user.id, {
          failedLoginAttempts: 0,
          lockedUntil: null,
        });
      }

      // Regenerate session to prevent fixation
      req.session.regenerate((err) => {
        if (err) {
          logSecurityEvent('SESSION_REGENERATION_FAILED', { userId: user.id, error: err.message });
          return res.status(500).json({ message: 'Session error' });
        }
        
        req.session.userId = user.id;
        req.session.save((err) => {
          if (err) {
            logSecurityEvent('SESSION_SAVE_FAILED', { userId: user.id, error: err.message });
            return res.status(500).json({ message: 'Session error' });
          }
          
          logSecurityEvent('USER_LOGGED_IN', { userId: user.id, email: user.email });
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid input', errors: error.errors });
      } else {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Failed to login' });
      }
    }
  });

  // Logout route
  app.post('/api/auth/logout', isAuthenticated, (req: Request, res: Response) => {
    const userId = req.session.userId;
    req.session.destroy((err) => {
      if (err) {
        logSecurityEvent('LOGOUT_FAILED', { userId, error: err.message });
        return res.status(500).json({ message: 'Failed to logout' });
      }
      const cookieName = config.NODE_ENV === 'production' ? '__Host-session' : 'session';
      res.clearCookie(cookieName);
      logSecurityEvent('USER_LOGGED_OUT', { userId });
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Get current user route
  app.get('/api/auth/user', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });
}

// Authentication middleware
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', { 
      path: req.path, 
      method: req.method,
      ip: req.ip 
    });
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};