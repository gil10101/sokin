"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.clearRateLimits = void 0;
// Simple in-memory rate limiter
// In production, use a more robust solution like redis-based rate limiter
const requestCounts = {};
// Function to clear rate limits (for development)
const clearRateLimits = () => {
    Object.keys(requestCounts).forEach(key => delete requestCounts[key]);
};
exports.clearRateLimits = clearRateLimits;
const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000 // 15 minutes
) => {
    return (req, res, next) => {
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
exports.rateLimiter = rateLimiter;
