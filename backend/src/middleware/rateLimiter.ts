import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter
// In production, use a more robust solution like redis-based rate limiter
const requestCounts: Record<string, { count: number; resetTime: number }> = {};

// Function to clear rate limits (for development)
export const clearRateLimits = () => {
  Object.keys(requestCounts).forEach(key => delete requestCounts[key]);
};

export const rateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Initialize or clean up expired entries
    if (!requestCounts[ip] || requestCounts[ip].resetTime < now) {
      requestCounts[ip] = { count: 0, resetTime: now + windowMs };
    }
    
    // Increment request count
    requestCounts[ip].count += 1;
    
    // Check if limit exceeded
    if (requestCounts[ip].count > maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((requestCounts[ip].resetTime - now) / 1000)
      });
    }
    
    next();
  };
}; 