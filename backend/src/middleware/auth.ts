import { Request, Response, NextFunction } from 'express';
import { auth as firebaseAuth } from '../config/firebase';
import { AppError } from './errorHandler';
import logger from '../utils/logger';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

// Rate limiter for cron authentication endpoints
export const cronRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many failed authentication attempts',
    retryAfter: Math.ceil(15 * 60) // seconds until reset
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests, only count failures
  skipSuccessfulRequests: true,
  // Custom key generator to include endpoint in the key
  keyGenerator: (req: Request): string => {
    return `${req.ip}-${req.originalUrl}`;
  },
  // Log rate limit violations
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for cron authentication', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      resetTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
    res.status(429).json({
      error: 'Too many failed authentication attempts',
      retryAfter: Math.ceil(15 * 60)
    });
  }
});

// Parse allowed cron IPs from environment variable
const ALLOWED_CRON_IPS = (process.env.ALLOWED_CRON_IPS || '').split(',').filter(Boolean);

// Configuration validation function for application startup
export const validateAuthConfig = (): void => {
  const errors: string[] = [];

  // Validate CRON_SECRET
  if (!process.env.CRON_SECRET) {
    errors.push('CRON_SECRET environment variable is required for cron authentication');
  } else if (process.env.CRON_SECRET.length < 32) {
    errors.push('CRON_SECRET should be at least 32 characters long for security');
  }

  // Validate ALLOWED_CRON_IPS format if configured
  if (process.env.ALLOWED_CRON_IPS) {
    const ips = ALLOWED_CRON_IPS;
    const invalidIps = ips.filter(ip => {
      // Basic IP validation (supports IPv4 and basic IPv6)
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
      return !ipv4Regex.test(ip) && !ipv6Regex.test(ip) && ip !== 'localhost';
    });

    if (invalidIps.length > 0) {
      errors.push(`Invalid IP addresses in ALLOWED_CRON_IPS: ${invalidIps.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    logger.error('Authentication configuration validation failed:', { errors });
    throw new Error(`Authentication configuration errors:\n${errors.join('\n')}`);
  }

  // Log successful validation
  logger.info('Authentication configuration validated successfully', {
    cronSecretConfigured: true,
    allowedIpsCount: ALLOWED_CRON_IPS.length,
    allowedIps: ALLOWED_CRON_IPS.length > 0 ? '[REDACTED - configured]' : 'none configured'
  });
};

// Add a custom user property to the Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

// Authentication middleware
export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Unauthorized: No token provided', 401, true);
    }

    const token = authHeader.split(' ')[1];

    try {
      if (!firebaseAuth) {
        // For development without proper Firebase setup, create a mock user
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Firebase auth not initialized - using development mock user');
          req.user = {
            uid: 'dev-user-' + Date.now(),
            email: 'dev@example.com'
          };
          next();
          return;
        }
        throw new AppError('Firebase auth not initialized', 500, false);
      }
      
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email
      };
      next();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error verifying token:', { error: errorMessage });
      
      // In development mode, if token verification fails, use mock user
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Token verification failed in development - using mock user');
        req.user = {
          uid: 'dev-user-' + Date.now(),
          email: 'dev@example.com'
        };
        next();
        return;
      }
      
      throw new AppError('Unauthorized: Invalid token', 401, true);
    }
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      logger.error('Authentication error:', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// Helper function for timing-safe string comparison
const timingSafeStringCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  
  return crypto.timingSafeEqual(bufferA, bufferB);
};

// Cron job authentication middleware for internal services
export const requireCronAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check IP allowlist if configured
    if (ALLOWED_CRON_IPS.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress;
      if (!clientIp || !ALLOWED_CRON_IPS.includes(clientIp)) {
        logger.warn('Unauthorized cron job attempt - IP not allowlisted', {
          ip: clientIp,
          allowedIps: ALLOWED_CRON_IPS.length > 0 ? '[REDACTED]' : 'none configured',
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        });
        throw new AppError('Unauthorized', 401, true);
      }
    }

    // Get the expected secret (validated at startup)
    const expectedSecret = process.env.CRON_SECRET!; // Safe due to startup validation

    // Get the cron secret from header (returns string | undefined)
    const cronSecretHeader = req.get('x-cron-secret');

    if (!cronSecretHeader) {
      logger.warn('Unauthorized cron job attempt - missing secret header', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      throw new AppError('Unauthorized: Invalid cron secret', 401, true);
    }

    // Perform timing-safe comparison
    if (!timingSafeStringCompare(cronSecretHeader, expectedSecret)) {
      logger.warn('Unauthorized cron job attempt - invalid secret', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        ipAllowlisted: ALLOWED_CRON_IPS.length > 0 ? ALLOWED_CRON_IPS.includes(req.ip || '') : 'no allowlist configured'
      });
      throw new AppError('Unauthorized: Invalid cron secret', 401, true);
    }

    logger.info('Cron job authenticated successfully', { 
      endpoint: req.originalUrl,
      ip: req.ip,
      ipAllowlisted: ALLOWED_CRON_IPS.length > 0 ? 'yes' : 'no allowlist configured'
    });
    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      logger.error('Cron authentication error:', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};