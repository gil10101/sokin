/**
 * Sentry error tracking utilities
 */

// Initialize Sentry with default functions
let captureException: (error: Error) => void = (error: Error) => {
  // Error not logged to console
};

let captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  // Message not logged to console
};

// Check if Sentry DSN is configured
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Check if DSN is valid (not placeholder and has proper format)
const isValidDSN = SENTRY_DSN &&
  SENTRY_DSN !== 'your_sentry_dsn_here' &&
  SENTRY_DSN.startsWith('https://') &&
  SENTRY_DSN.includes('@');

// DSN validation completed silently

// Only initialize if DSN is valid
if (isValidDSN) {
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
        }

        // Create wrapper functions for Sentry
        const originalCaptureException = captureException;
        const originalCaptureMessage = captureMessage;

        captureException = (error: Error) => {
          try {
            Sentry.captureException(error);
          } catch (e) {
            // Sentry capture failed, error not logged to console
          }
        };

        captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
          try {
            Sentry.captureMessage(message, level);
          } catch (e) {
            // Sentry capture failed, message not logged to console
          }
        };
      } catch (error) {
        // Failed to initialize Sentry, using fallback functions
        const originalCaptureException = captureException;
        const originalCaptureMessage = captureMessage;

        captureException = (error: Error) => {
          // Error not logged to console
        };

        captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
          // Message not logged to console
        };
      }
    }).catch((error) => {
      // Failed to load Sentry, using fallback functions
      const originalCaptureException = captureException;
      const originalCaptureMessage = captureMessage;

      captureException = (error: Error) => {
        // Error not logged to console
      };

      captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
        // Message not logged to console
      };
    });
  }, 100);
} else {
  // Sentry not configured, using fallback functions
  const originalCaptureException = captureException;
  const originalCaptureMessage = captureMessage;

  captureException = (error: Error) => {
    // Error not logged to console
  };

  captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    // Message not logged to console
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
      // Failed to identify user in Sentry
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
      // Failed to clear user identity in Sentry
    });
  }
} 