"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheInvalidatePattern = cacheInvalidatePattern;
const logger_1 = __importDefault(require("./logger"));
let client = null;
function ensureClient() {
    if (client !== null)
        return client;
    const url = process.env.REDIS_URL;
    if (!url) {
        logger_1.default.warn('REDIS_URL not set; Redis caching disabled');
        return null;
    }
    try {
        // Lazy require to avoid hard dependency when not used
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Redis = require('ioredis');
        client = new Redis(url);
        return client;
    }
    catch (e) {
        logger_1.default.warn('ioredis not installed; Redis caching disabled');
        return null;
    }
}
async function cacheGet(key) {
    const c = ensureClient();
    if (!c)
        return null;
    try {
        const raw = await c.get(key);
        return raw ? JSON.parse(raw) : null;
    }
    catch (e) {
        logger_1.default.error('Redis get error', { error: e.message });
        return null;
    }
}
async function cacheSet(key, value, ttlSeconds = 300) {
    const c = ensureClient();
    if (!c)
        return;
    try {
        await c.setex(key, ttlSeconds, JSON.stringify(value));
    }
    catch (e) {
        logger_1.default.error('Redis set error', { error: e.message });
    }
}
async function cacheInvalidatePattern(pattern) {
    const c = ensureClient();
    if (!c)
        return;
    try {
        const keys = await c.keys(pattern);
        if (keys.length) {
            await Promise.all(keys.map((k) => c.del(k)));
        }
    }
    catch (e) {
        logger_1.default.error('Redis invalidate error', { error: e.message });
    }
}
