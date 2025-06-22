"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stocksController_1 = __importDefault(require("../controllers/stocksController"));
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Rate limiting for stock API calls (more lenient than other endpoints)
const stocksRateLimit = (0, rateLimiter_1.rateLimiter)(30, 60 * 1000); // 30 requests per minute
// Validation schemas
const searchStocksSchema = zod_1.z.object({
    query: zod_1.z.object({
        q: zod_1.z.string().min(1).max(20),
        limit: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 10)
    })
});
const stockSymbolSchema = zod_1.z.object({
    params: zod_1.z.object({
        symbol: zod_1.z.string().min(1).max(10).regex(/^[A-Z^]+$/, 'Invalid stock symbol format')
    })
});
const userIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string().min(1)
    })
});
// Public routes (no authentication required for basic market data)
router.get('/market-indices', stocksRateLimit, stocksController_1.default.getMarketIndices);
router.get('/trending', stocksRateLimit, stocksController_1.default.getTrendingStocks);
router.get('/search', stocksRateLimit, stocksController_1.default.searchStocks);
router.get('/stock/:symbol', stocksRateLimit, stocksController_1.default.getStockData);
// Protected routes (require authentication)
router.get('/portfolio/:userId', auth_1.auth, stocksRateLimit, stocksController_1.default.getUserPortfolio);
exports.default = router;
