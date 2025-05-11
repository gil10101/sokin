"use strict";
// Simple in-memory cache implementation
// In production, consider using Redis or another dedicated caching solution
Object.defineProperty(exports, "__esModule", { value: true });
class Cache {
    constructor(defaultTtlSeconds = 60) {
        this.cache = new Map();
        this.defaultTtl = defaultTtlSeconds * 1000; // Convert to milliseconds
        // Set up periodic cleanup of expired items
        setInterval(() => this.cleanup(), 60000); // Clean up every minute
    }
    // Set a value in the cache
    set(key, value, ttlSeconds) {
        const expiry = Date.now() + (ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl);
        this.cache.set(key, { value, expiry });
    }
    // Get a value from the cache
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }
        // Check if the item has expired
        if (item.expiry < Date.now()) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }
    // Check if a key exists and is not expired
    has(key) {
        const item = this.cache.get(key);
        if (!item) {
            return false;
        }
        if (item.expiry < Date.now()) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    // Delete a key from cache
    del(key) {
        this.cache.delete(key);
    }
    // Clear all cache
    clear() {
        this.cache.clear();
    }
    // Remove all expired items from the cache
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (item.expiry < now) {
                this.cache.delete(key);
            }
        }
    }
}
exports.default = new Cache();
