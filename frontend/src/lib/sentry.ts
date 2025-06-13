/**
 * Sentry error tracking utilities
 */

// Initialize Sentry
let captureException: (error: Error) => void;
let captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;

// Check if Sentry DSN is configured
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  try {
    // Dynamic import to avoid bundling Sentry when not used
    import('@sentry/nextjs').then((Sentry) => {
      // Initialize Sentry only if not already initialized
      if (!Sentry.getClient()) {
        Sentry.init({
          dsn: SENTRY_DSN,
          tracesSampleRate: 0.2,
          // Adjust this value in production
          replaysSessionSampleRate: 0.1,
          // Adjust this value in production
          replaysOnErrorSampleRate: 1.0,
          environment: process.env.NODE_ENV,
        });
      }

      // Use Sentry's functions
      captureException = (error: Error) => {
        Sentry.captureException(error);
      };

      captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
        Sentry.captureMessage(message, level);
      };
    });
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
} else {
  // Fallback to console when Sentry is not configured
  captureException = (error: Error) => {
    console.error('Error (not sent to Sentry):', error);
  };

  captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    logMethod(`Message (not sent to Sentry) [${level}]:`, message);
  };
}

/**
 * Capture an error with additional context
 */
export function captureError(error: Error, context?: Record<string, any>) {
  if (context) {
    console.error(error, context);
  }
  captureException(error);
}

/**
 * Log a message with a specific severity level
 */
export function logMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  captureMessage(message, level);
}

/**
 * Track a user session
 */
export function identifyUser(userId: string, userData?: Record<string, any>) {
  if (SENTRY_DSN) {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.setUser({
        id: userId,
        ...userData,
      });
    });
  }
}

/**
 * Clear user session tracking
 */
export function clearUserIdentity() {
  if (SENTRY_DSN) {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.setUser(null);
    });
  }
} 