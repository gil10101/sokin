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

// Helper function to format and print logs
function logWithLevel(level: string, message: string, metadata?: Record<string, unknown>) {
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
  } else {
    console.log(`[${timestamp}] [${level}] ${message}`);
    if (metadata) {
      console.log(metadata);
    }
  }
}

export default logger; 