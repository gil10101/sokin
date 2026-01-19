"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Set NODE_ENV to development if not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}
// Import utilities
const logger_1 = __importDefault(require("./utils/logger"));
// Initialize Firebase - this is now handled in the config/firebase.ts file
require("./config/firebase");
// Import middleware
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = require("./middleware/auth");
// Create Express app
const app = (0, express_1.default)();
const port = process.env.PORT || '5001';
// Parse and validate CORS origins
const corsOrigins = (_a = process.env.CORS_ORIGIN) === null || _a === void 0 ? void 0 : _a.split(',').map(o => o.trim()).filter(Boolean);
// Validate no wildcards when credentials are enabled (required by CORS spec)
if (corsOrigins === null || corsOrigins === void 0 ? void 0 : corsOrigins.includes('*')) {
    logger_1.default.error('CORS_ORIGIN cannot contain "*" when credentials are enabled - browsers will block all requests');
    process.exit(1);
}
// In production, CORS must be explicitly configured
if (process.env.NODE_ENV === 'production' && (!corsOrigins || corsOrigins.length === 0)) {
    logger_1.default.error('CORS_ORIGIN environment variable must be configured in production');
    process.exit(1);
}
// Basic middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Platform'],
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Apply rate limiting to all requests
// More lenient in development mode
const rateLimiterConfig = process.env.NODE_ENV === 'development'
    ? (0, rateLimiter_1.rateLimiter)(1000, 60 * 1000) // 1000 requests per minute in dev
    : (0, rateLimiter_1.rateLimiter)(100, 15 * 60 * 1000); // 100 requests per 15 minutes in prod
app.use(rateLimiterConfig);
// Import routes directly (serverless functions are stateless anyway)
const expenses_1 = __importDefault(require("./routes/expenses"));
const users_1 = __importDefault(require("./routes/users"));
const budgets_1 = __importDefault(require("./routes/budgets"));
const receiptRoutes_1 = __importDefault(require("./routes/receiptRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const goalsRoutes_1 = __importDefault(require("./routes/goalsRoutes"));
const billRemindersRoutes_1 = __importDefault(require("./routes/billRemindersRoutes"));
const stocksRoutes_1 = __importDefault(require("./routes/stocksRoutes"));
const netWorthRoutes_1 = __importDefault(require("./routes/netWorthRoutes"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
// Mount routes
// Note: User routes consolidated - /api/users handles both profile and user management
app.use('/api/expenses', expenses_1.default);
app.use('/api/users', users_1.default);
app.use('/api/budgets', budgets_1.default);
app.use('/api/receipts', receiptRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/goals', goalsRoutes_1.default);
app.use('/api/bill-reminders', billRemindersRoutes_1.default);
app.use('/api/stocks', stocksRoutes_1.default);
app.use('/api/net-worth', netWorthRoutes_1.default);
app.use('/api/dashboard', dashboard_1.default);
// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Development endpoint to clear rate limits
if (process.env.NODE_ENV === 'development') {
    app.post('/dev/clear-rate-limits', async (req, res) => {
        try {
            await (0, rateLimiter_1.clearRateLimits)();
            res.json({ message: 'Rate limits cleared successfully' });
        }
        catch (error) {
            logger_1.default.error('Error clearing rate limits:', { error });
            res.status(500).json({ error: 'Failed to clear rate limits' });
        }
    });
}
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Global error handler
app.use(errorHandler_1.errorHandler);
// Validate configuration before starting server (only for local, not Vercel)
if (process.env.VERCEL !== '1') {
    try {
        (0, auth_1.validateAuthConfig)();
    }
    catch (error) {
        logger_1.default.error('Configuration validation failed:', { error: String(error) });
        process.exit(1);
    }
}
// Start server (only for local development, not in Vercel)
if (process.env.VERCEL !== '1') {
    app.listen(Number(port), () => {
        logger_1.default.info(`Server running on port ${port}`);
        if (process.env.NODE_ENV === 'development') {
            logger_1.default.info('Running in development mode with mock data');
            logger_1.default.info(`CORS configured for: ${process.env.CORS_ORIGIN || 'configured origin'}`);
        }
    });
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
        logger_1.default.error('Unhandled Promise Rejection', { error: err });
        // In production, consider graceful shutdown:
        // process.exit(1);
    });
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        logger_1.default.error('Uncaught Exception', { error: err });
        // In production, consider graceful shutdown:
        // process.exit(1);
    });
}
// Export for Vercel serverless
exports.default = app;
