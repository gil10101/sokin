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
  error: (message: string, metadata?: Record<string, unknown>) => {
    logWithLevel(LOG_LEVELS.ERROR, message, metadata);
  },
  warn: (message: string, metadata?: Record<string, unknown>) => {
    logWithLevel(LOG_LEVELS.WARN, message, metadata);
  },
  info: (message: string, metadata?: Record<string, unknown>) => {
    logWithLevel(LOG_LEVELS.INFO, message, metadata);
  },
  debug: (message: string, metadata?: Record<string, unknown>) => {
    // Only log debug in development
    if (NODE_ENV === 'development') {
      logWithLevel(LOG_LEVELS.DEBUG, message, metadata);
    }
  }
};

// Helper function to sanitize strings by redacting inline secrets
function sanitizeString(value: string): string {
  let sanitized = value;
  
  // Inline token patterns
  const patterns = [
    // Bearer tokens
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    // JWT tokens (three base64 parts separated by dots)
    /eyJ[A-Za-z0-9\-._~+/]*\.eyJ[A-Za-z0-9\-._~+/]*\.[A-Za-z0-9\-._~+/]*/gi,
    // Stripe keys
    /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{24,}/gi,
    // GitHub tokens
    /gh[pousr]_[A-Za-z0-9]{36}/gi,
    // Slack tokens
    /xox[baprs]-[A-Za-z0-9\-]{10,}/gi,
    // AWS access keys
    /AKIA[0-9A-Z]{16}/gi,
    // Generic long base64-like strings (32+ chars)
    /[A-Za-z0-9+/]{32,}={0,2}/g
  ];
  
  patterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
}

// Safe stringify function that handles circular references and sensitive data
function safeStringify(obj: unknown): string {
  try {
    // WeakSet to track seen objects for circular reference detection
    const seen = new WeakSet();
    
    // Regex patterns for secret-like keys (with word boundaries)
    const secretKeyPattern = /\b(?:password|secret|token|api[_-]?key|bearer|authorization|cookie|x[_-]?api[_-]?key|access[_-]?token|refresh[_-]?token)\b/i;
    
    const result = JSON.stringify(obj, (key, value) => {
      // Redact secret-like keys completely
      if (typeof key === 'string' && secretKeyPattern.test(key)) {
        return '[REDACTED]';
      }
      
      // Sanitize all string values for inline secrets
      if (typeof value === 'string') {
        return sanitizeString(value);
      }
      
      // Handle BigInt serialization
      if (typeof value === 'bigint') {
        return value.toString();
      }
      
      if (value !== null && typeof value === 'object') {
        // Handle Error objects with comprehensive serialization
        if (value instanceof Error) {
          const errorObj: Record<string, unknown> = {
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
        
        // Check for circular references
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      
      return value;
    });
    
    return result;
  } catch (error) {
    // Return minimal JSON fallback instead of util.inspect for JSON compatibility
    const errorMessage = error instanceof Error ? error.message : String(error);
    return JSON.stringify({
      error: 'unserializable',
      message: errorMessage,
      originalType: typeof obj
    });
  }
}

// Helper function to format and send logs to appropriate service
function logWithLevel(level: string, message: string, metadata?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logObject = {
    timestamp,
    level,
    message,
    ...(metadata ? { metadata } : {})
  };
  
  if (NODE_ENV === 'production') {
    // In production, send to external logging service (Winston, Sentry, etc.)
    // Note: stdout logs are still captured by infrastructure logging systems
    try {
      // TODO: Integrate with Winston or external logging service
      // winston.log(level.toLowerCase(), logObject);
      
      // Use safe stringifier to prevent circular reference errors
      process.stdout.write(safeStringify(logObject) + '\n');
    } catch (error) {
      // Write minimal fallback error to stderr to ensure visibility
      const fallbackError = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: 'Logger failed',
        originalMessage: message,
        loggerError: error instanceof Error ? error.message : String(error)
      };
      process.stderr.write(safeStringify(fallbackError) + '\n');
    }
  } else {
    // Development: console output for debugging
    console.log(`[${timestamp}] [${level}] ${message}`);
    if (metadata) {
      console.log(metadata);
    }
  }
}

export default logger; 