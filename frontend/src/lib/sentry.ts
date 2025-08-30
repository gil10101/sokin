/**
 * Sentry error tracking utilities
 */

// Initialize Sentry with default functions
let captureException: (error: Error) => void = (error: Error) => {
  console.error('Error (Sentry not ready):', error);
};

let captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
  logMethod(`Message (Sentry not ready) [${level}]:`, message);
};

// Check if Sentry DSN is configured
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Check if DSN is valid (not placeholder and has proper format)
const isValidDSN = SENTRY_DSN &&
  SENTRY_DSN !== 'your_sentry_dsn_here' &&
  SENTRY_DSN.startsWith('https://') &&
  SENTRY_DSN.includes('@');

console.log('Sentry DSN check:', {
  SENTRY_DSN: SENTRY_DSN ? SENTRY_DSN.substring(0, 20) + '...' : 'undefined',
  isValidDSN,
  isPlaceholder: SENTRY_DSN === 'your_sentry_dsn_here'
});

// Only initialize if DSN is valid
if (isValidDSN) {
  console.log('Initializing Sentry...');

  // Use setTimeout to defer initialization and avoid webpack issues
  setTimeout(() => {
    import('@sentry/nextjs').then((Sentry) => {
      try {
        // Initialize Sentry only if not already initialized
        if (!Sentry.getClient()) {
          Sentry.init({
            dsn: SENTRY_DSN,
            tracesSampleRate: 0.2,
            replaysSessionSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,
            environment: process.env.NODE_ENV,
          });

          console.log('Sentry initialized successfully');
        }

        // Create wrapper functions for Sentry
        const originalCaptureException = captureException;
        const originalCaptureMessage = captureMessage;

        captureException = (error: Error) => {
          try {
            Sentry.captureException(error);
          } catch (e) {
            console.error('Error (Sentry failed):', error);
          }
        };

        captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
          try {
            Sentry.captureMessage(message, level);
          } catch (e) {
            console.error('Message (Sentry failed):', message);
          }
        };
      } catch (error) {
        console.error('Failed to initialize Sentry:', error);
        // Fallback to console logging
        const originalCaptureException = captureException;
        const originalCaptureMessage = captureMessage;

        captureException = (error: Error) => {
          console.error('Error (Sentry failed):', error);
        };

        captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
          const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
          logMethod(`Message (Sentry failed) [${level}]:`, message);
        };
      }
    }).catch((error) => {
      console.error('Failed to load Sentry:', error);
      // Fallback to console logging
      const originalCaptureException = captureException;
      const originalCaptureMessage = captureMessage;

      captureException = (error: Error) => {
        console.error('Error (Sentry load failed):', error);
      };

      captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
        const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
        logMethod(`Message (Sentry load failed) [${level}]:`, message);
      };
    });
  }, 100);
} else {
  console.log('Sentry not configured, using console logging');

  // Fallback to console when Sentry is not configured
  const originalCaptureException = captureException;
  const originalCaptureMessage = captureMessage;

  captureException = (error: Error) => {
    console.error('Error (not sent to Sentry):', error);
  };

  captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    logMethod(`Message (not sent to Sentry) [${level}]:`, message);
  };
}

/**
 * Export captureException for use in error boundaries
 */
export { captureException };

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
  if (isValidDSN) {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.setUser({
        id: userId,
        ...userData,
      });
    }).catch((error) => {
      console.error('Failed to identify user in Sentry:', error);
    });
  }
}

/**
 * Clear user session tracking
 */
export function clearUserIdentity() {
  if (isValidDSN) {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.setUser(null);
    }).catch((error) => {
      console.error('Failed to clear user identity in Sentry:', error);
    });
  }
} 