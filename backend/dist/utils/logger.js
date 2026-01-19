"use strict";
/**
 * Logger with redaction and env-aware output.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
};
const NODE_ENV = process.env.NODE_ENV || 'development';
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
        if (NODE_ENV === 'development') {
            logWithLevel(LOG_LEVELS.DEBUG, message, metadata);
        }
    }
};
// Redact inline secrets from strings.
function sanitizeString(value) {
    let sanitized = value;
    const patterns = [
        /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
        /eyJ[A-Za-z0-9\-._~+/]*\.eyJ[A-Za-z0-9\-._~+/]*\.[A-Za-z0-9\-._~+/]*/gi,
        /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{24,}/gi,
        /gh[pousr]_[A-Za-z0-9]{36}/gi,
        /xox[baprs]-[A-Za-z0-9\-]{10,}/gi,
        /AKIA[0-9A-Z]{16}/gi,
        /[A-Za-z0-9+/]{32,}={0,2}/g
    ];
    patterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized;
}
// JSON stringify with redaction and circular handling.
function safeStringify(obj) {
    try {
        const seen = new WeakSet();
        const secretKeyPattern = /\b(?:password|secret|token|api[_-]?key|bearer|authorization|cookie|x[_-]?api[_-]?key|access[_-]?token|refresh[_-]?token)\b/i;
        const result = JSON.stringify(obj, (key, value) => {
            if (typeof key === 'string' && secretKeyPattern.test(key)) {
                return '[REDACTED]';
            }
            if (typeof value === 'string') {
                return sanitizeString(value);
            }
            if (typeof value === 'bigint') {
                return value.toString();
            }
            if (value !== null && typeof value === 'object') {
                if (value instanceof Error) {
                    const errorObj = {
                        name: value.name,
                        message: value.message
                    };
                    if ('code' in value && value.code !== undefined) {
                        errorObj.code = value.code;
                    }
                    if ('cause' in value && value.cause !== undefined) {
                        errorObj.cause = value.cause;
                    }
                    if (value.stack) {
                        errorObj.stack = value.stack;
                    }
                    return errorObj;
                }
                if (seen.has(value)) {
                    return '[Circular]';
                }
                seen.add(value);
            }
            return value;
        });
        return result;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return JSON.stringify({
            error: 'unserializable',
            message: errorMessage,
            originalType: typeof obj
        });
    }
}
// Write JSON in prod, console in dev.
function logWithLevel(level, message, metadata) {
    const timestamp = new Date().toISOString();
    const logObject = {
        timestamp,
        level,
        message,
        ...(metadata ? { metadata } : {})
    };
    if (NODE_ENV === 'production') {
        try {
            process.stdout.write(safeStringify(logObject) + '\n');
        }
        catch (error) {
            const fallbackError = {
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                message: 'Logger failed',
                originalMessage: message,
                loggerError: error instanceof Error ? error.message : String(error)
            };
            process.stderr.write(safeStringify(fallbackError) + '\n');
        }
    }
    else {
        console.log(`[${timestamp}] [${level}] ${message}`);
        if (metadata) {
            console.log(metadata);
        }
    }
}
exports.default = logger;
