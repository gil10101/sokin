"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
};
// Get the current environment
const NODE_ENV = process.env.NODE_ENV || 'development';
// Simple console logger with timestamp
const logger = {
    error: (message, metadata) => {
        logWithLevel(LOG_LEVELS.ERROR, message, metadata);
    },
    warn: (message, metadata) => {
        logWithLevel(LOG_LEVELS.WARN, message, metadata);
    },
    info: (message, metadata) => {
        logWithLevel(LOG_LEVELS.INFO, message, metadata);
    },
    debug: (message, metadata) => {
        // Only log debug in development
        if (NODE_ENV === 'development') {
            logWithLevel(LOG_LEVELS.DEBUG, message, metadata);
        }
    }
};
// Helper function to format and print logs
function logWithLevel(level, message, metadata) {
    const timestamp = new Date().toISOString();
    const logObject = {
        timestamp,
        level,
        message,
        ...(metadata ? { metadata } : {})
    };
    // In production, might want to format differently or send to a logging service
    if (NODE_ENV === 'production') {
        console.log(JSON.stringify(logObject));
    }
    else {
        console.log(`[${timestamp}] [${level}] ${message}`);
        if (metadata) {
            console.log(metadata);
        }
    }
}
exports.default = logger;
