import { Request, Response, NextFunction } from 'express';
import { auth as firebaseAuth } from '../config/firebase';
import { AppError } from './errorHandler';
import logger from '../utils/logger';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

// Mock auth only in dev with ALLOW_MOCK_AUTH=true.
const isDevelopmentWithMockAuth = (): boolean => {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.ALLOW_MOCK_AUTH === 'true'
  );
};

// Cron auth rate limit.
export const cronRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many failed authentication attempts',
    retryAfter: Math.ceil(15 * 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request): string => {
    return `${req.ip}-${req.originalUrl}`;
  },
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

// Parse allowed cron IPs.
const ALLOWED_CRON_IPS = (process.env.ALLOWED_CRON_IPS || '').split(',').filter(Boolean);

export const validateAuthConfig = (): void => {
  const errors: string[] = [];

  if (!process.env.CRON_SECRET) {
    errors.push('CRON_SECRET environment variable is required for cron authentication');
  } else if (process.env.CRON_SECRET.length < 32) {
    errors.push('CRON_SECRET should be at least 32 characters long for security');
  }

  if (process.env.ALLOWED_CRON_IPS) {
    const ips = ALLOWED_CRON_IPS;
    const invalidIps = ips.filter(ip => {
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

  logger.info('Authentication configuration validated successfully', {
    cronSecretConfigured: true,
    allowedIpsCount: ALLOWED_CRON_IPS.length,
    allowedIps: ALLOWED_CRON_IPS.length > 0 ? '[REDACTED - configured]' : 'none configured'
  });
};

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

// Firebase auth middleware.
export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Unauthorized: No token provided', 401, true);
    }

    const token = authHeader.split(' ')[1];

    if (!firebaseAuth) {
      // Allow mock auth in dev only.
      if (isDevelopmentWithMockAuth()) {
        logger.warn('Firebase auth not initialized - using development mock user (ALLOW_MOCK_AUTH=true)');
        req.user = {
          uid: 'dev-user-' + Date.now(),
          email: 'dev@example.com'
        };
        next();
        return;
      }
      // Fail closed if Firebase is missing.
      logger.error('Firebase auth not initialized and mock auth not enabled');
      throw new AppError('Authentication service unavailable', 503, false);
    }
    
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email
      };
      next();
    } catch (tokenError: unknown) {
      const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
      logger.error('Error verifying token:', { error: errorMessage });
      
      // Only allow mock auth fallback if explicitly enabled
      if (isDevelopmentWithMockAuth()) {
        logger.warn('Token verification failed - using mock user (ALLOW_MOCK_AUTH=true)');
        req.user = {
          uid: 'dev-user-' + Date.now(),
          email: 'dev@example.com'
        };
        next();
        return;
      }
      
      // Fail-closed: reject invalid tokens
      throw new AppError('Unauthorized: Invalid token', 401, true);
    }
  } catch (error) {
    // Delegate to global error handler for consistent error responses
    next(error instanceof AppError ? error : new AppError('Authentication failed', 500, false));
  }
};

// Helper function for normalizing IP addresses
// Handles proxy headers, IPv6-mapped IPv4, localhost mappings
const normalizeIp = (ip: string | undefined): string | null => {
  if (!ip) return null;
  
  let normalized = ip.trim();
  
  // Map localhost and ::1 to 127.0.0.1
  if (normalized === 'localhost' || normalized === '::1') {
    return '127.0.0.1';
  }
  
  // Strip IPv6-mapped IPv4 prefix (::ffff:)
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.substring(7);
  }
  
  return normalized;
};

// Helper function for timing-safe string comparison
// Uses SHA-256 hashing to ensure constant-time comparison regardless of input length
const timingSafeStringCompare = (a: string, b: string): boolean => {
  // Hash both inputs to create fixed-size buffers (32 bytes for SHA-256)
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  
  // Compare the fixed-size hash buffers in constant time
  return crypto.timingSafeEqual(hashA, hashB);
};

// Cron job authentication middleware for internal services
export const requireCronAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check IP allowlist if configured
    if (ALLOWED_CRON_IPS.length > 0) {
      const rawIp = req.ip || req.socket.remoteAddress;
      const normalizedIp = normalizeIp(rawIp);
      
      if (!normalizedIp || !ALLOWED_CRON_IPS.includes(normalizedIp)) {
        logger.warn('Unauthorized cron job attempt - IP not allowlisted', {
          rawIp: rawIp,
          normalizedIp: normalizedIp,
          allowedIps: '[REDACTED]',
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        });
        throw new AppError('Unauthorized', 401, true);
      }
    }

    // Fail closed if the secret is not configured: without this check a
    // missing CRON_SECRET would compare against the string "undefined" and
    // make the cron endpoints publicly callable.
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      logger.error('CRON_SECRET is not configured - rejecting cron request');
      throw new AppError('Cron authentication unavailable', 503, true);
    }

    // Accept the secret from either the x-cron-secret header (manual/external
    // schedulers) or Authorization: Bearer (the convention Vercel Cron uses
    // when a CRON_SECRET env var is configured).
    const bearerMatch = req.headers.authorization?.match(/^Bearer (.+)$/);
    const cronSecretHeader = req.get('x-cron-secret') || bearerMatch?.[1];

    if (!cronSecretHeader) {
      const rawIp = req.ip || req.socket.remoteAddress;
      const normalizedIp = normalizeIp(rawIp);
      logger.warn('Unauthorized cron job attempt - missing secret header', {
        rawIp: rawIp,
        normalizedIp: normalizedIp,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      throw new AppError('Unauthorized: Invalid cron secret', 401, true);
    }

    // Perform timing-safe comparison
    if (!timingSafeStringCompare(cronSecretHeader, expectedSecret)) {
      const rawIp = req.ip || req.socket.remoteAddress;
      const normalizedIp = normalizeIp(rawIp);
      logger.warn('Unauthorized cron job attempt - invalid secret', {
        rawIp: rawIp,
        normalizedIp: normalizedIp,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        ipAllowlisted: ALLOWED_CRON_IPS.length > 0 ? (normalizedIp ? ALLOWED_CRON_IPS.includes(normalizedIp) : false) : 'no allowlist configured'
      });
      throw new AppError('Unauthorized: Invalid cron secret', 401, true);
    }

    const rawIp = req.ip || req.socket.remoteAddress;
    const normalizedIp = normalizeIp(rawIp);
    logger.info('Cron job authenticated successfully', { 
      endpoint: req.originalUrl,
      rawIp: rawIp,
      normalizedIp: normalizedIp,
      ipAllowlisted: ALLOWED_CRON_IPS.length > 0 ? (normalizedIp ? ALLOWED_CRON_IPS.includes(normalizedIp) : 'unknown') : 'no allowlist configured'
    });
    next();
  } catch (error) {
    // Delegate to global error handler for consistent error responses
    next(error instanceof AppError ? error : new AppError('Cron authentication failed', 500, false));
  }
};