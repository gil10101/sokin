"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
// Create Express app
const app = (0, express_1.default)();
const port = process.env.PORT || '5001';
// Basic middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Platform']
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Apply rate limiting to all requests
// More lenient in development mode
const maxRequests = process.env.NODE_ENV === 'development' ? 1000 : 100;
const windowMs = process.env.NODE_ENV === 'development' ? 60 * 1000 : 15 * 60 * 1000; // 1 minute in dev, 15 minutes in prod
app.use((0, rateLimiter_1.rateLimiter)(maxRequests, windowMs));
// Routes
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
    app.post('/dev/clear-rate-limits', (req, res) => {
        (0, rateLimiter_1.clearRateLimits)();
        res.json({ message: 'Rate limits cleared' });
    });
}
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Global error handler
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(Number(port), () => {
    logger_1.default.info(`Server running on port ${port}`);
    if (process.env.NODE_ENV === 'development') {
        logger_1.default.info('Running in development mode with mock data');
        logger_1.default.info('CORS configured for: http://localhost:3000');
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
