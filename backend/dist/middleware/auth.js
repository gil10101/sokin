"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCronAuth = exports.auth = exports.validateAuthConfig = exports.cronRateLimiter = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("./errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = __importDefault(require("crypto"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Rate limiter for cron authentication endpoints
exports.cronRateLimiter = (0, express_rate_limit_1.default)({
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
    keyGenerator: (req) => {
        return `${req.ip}-${req.originalUrl}`;
    },
    // Log rate limit violations
    handler: (req, res) => {
        logger_1.default.warn('Rate limit exceeded for cron authentication', {
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
const validateAuthConfig = () => {
    const errors = [];
    // Validate CRON_SECRET
    if (!process.env.CRON_SECRET) {
        errors.push('CRON_SECRET environment variable is required for cron authentication');
    }
    else if (process.env.CRON_SECRET.length < 32) {
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
        logger_1.default.error('Authentication configuration validation failed:', { errors });
        throw new Error(`Authentication configuration errors:\n${errors.join('\n')}`);
    }
    // Log successful validation
    logger_1.default.info('Authentication configuration validated successfully', {
        cronSecretConfigured: true,
        allowedIpsCount: ALLOWED_CRON_IPS.length,
        allowedIps: ALLOWED_CRON_IPS.length > 0 ? '[REDACTED - configured]' : 'none configured'
    });
};
exports.validateAuthConfig = validateAuthConfig;
// Authentication middleware
const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('Unauthorized: No token provided', 401, true);
        }
        const token = authHeader.split(' ')[1];
        try {
            if (!firebase_1.auth) {
                // For development without proper Firebase setup, create a mock user
                if (process.env.NODE_ENV === 'development') {
                    logger_1.default.warn('Firebase auth not initialized - using development mock user');
                    req.user = {
                        uid: 'dev-user-' + Date.now(),
                        email: 'dev@example.com'
                    };
                    next();
                    return;
                }
                throw new errorHandler_1.AppError('Firebase auth not initialized', 500, false);
            }
            const decodedToken = await firebase_1.auth.verifyIdToken(token);
            req.user = {
                uid: decodedToken.uid,
                email: decodedToken.email
            };
            next();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.default.error('Error verifying token:', { error: errorMessage });
            // In development mode, if token verification fails, use mock user
            if (process.env.NODE_ENV === 'development') {
                logger_1.default.warn('Token verification failed in development - using mock user');
                req.user = {
                    uid: 'dev-user-' + Date.now(),
                    email: 'dev@example.com'
                };
                next();
                return;
            }
            throw new errorHandler_1.AppError('Unauthorized: Invalid token', 401, true);
        }
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
        }
        else {
            logger_1.default.error('Authentication error:', { error });
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
exports.auth = auth;
// Helper function for normalizing IP addresses
// Handles proxy headers, IPv6-mapped IPv4, localhost mappings
const normalizeIp = (ip) => {
    if (!ip)
        return null;
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
const timingSafeStringCompare = (a, b) => {
    // Hash both inputs to create fixed-size buffers (32 bytes for SHA-256)
    const hashA = crypto_1.default.createHash('sha256').update(a, 'utf8').digest();
    const hashB = crypto_1.default.createHash('sha256').update(b, 'utf8').digest();
    // Compare the fixed-size hash buffers in constant time
    return crypto_1.default.timingSafeEqual(hashA, hashB);
};
// Cron job authentication middleware for internal services
const requireCronAuth = async (req, res, next) => {
    try {
        // Check IP allowlist if configured
        if (ALLOWED_CRON_IPS.length > 0) {
            const rawIp = req.ip || req.socket.remoteAddress;
            const normalizedIp = normalizeIp(rawIp);
            if (!normalizedIp || !ALLOWED_CRON_IPS.includes(normalizedIp)) {
                logger_1.default.warn('Unauthorized cron job attempt - IP not allowlisted', {
                    rawIp: rawIp,
                    normalizedIp: normalizedIp,
                    allowedIps: '[REDACTED]',
                    userAgent: req.get('User-Agent'),
                    endpoint: req.originalUrl
                });
                throw new errorHandler_1.AppError('Unauthorized', 401, true);
            }
        }
        // Get the expected secret (validated at startup)
        const expectedSecret = process.env.CRON_SECRET; // Safe due to startup validation
        // Get the cron secret from header (returns string | undefined)
        const cronSecretHeader = req.get('x-cron-secret');
        if (!cronSecretHeader) {
            const rawIp = req.ip || req.socket.remoteAddress;
            const normalizedIp = normalizeIp(rawIp);
            logger_1.default.warn('Unauthorized cron job attempt - missing secret header', {
                rawIp: rawIp,
                normalizedIp: normalizedIp,
                userAgent: req.get('User-Agent'),
                endpoint: req.originalUrl
            });
            throw new errorHandler_1.AppError('Unauthorized: Invalid cron secret', 401, true);
        }
        // Perform timing-safe comparison
        if (!timingSafeStringCompare(cronSecretHeader, expectedSecret)) {
            const rawIp = req.ip || req.socket.remoteAddress;
            const normalizedIp = normalizeIp(rawIp);
            logger_1.default.warn('Unauthorized cron job attempt - invalid secret', {
                rawIp: rawIp,
                normalizedIp: normalizedIp,
                userAgent: req.get('User-Agent'),
                endpoint: req.originalUrl,
                ipAllowlisted: ALLOWED_CRON_IPS.length > 0 ? (normalizedIp ? ALLOWED_CRON_IPS.includes(normalizedIp) : false) : 'no allowlist configured'
            });
            throw new errorHandler_1.AppError('Unauthorized: Invalid cron secret', 401, true);
        }
        const rawIp = req.ip || req.socket.remoteAddress;
        const normalizedIp = normalizeIp(rawIp);
        logger_1.default.info('Cron job authenticated successfully', {
            endpoint: req.originalUrl,
            rawIp: rawIp,
            normalizedIp: normalizedIp,
            ipAllowlisted: ALLOWED_CRON_IPS.length > 0 ? (normalizedIp ? ALLOWED_CRON_IPS.includes(normalizedIp) : 'unknown') : 'no allowlist configured'
        });
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
        }
        else {
            logger_1.default.error('Cron authentication error:', { error });
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
exports.requireCronAuth = requireCronAuth;
