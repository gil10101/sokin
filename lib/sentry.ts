import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

// Only initialize Sentry if a valid DSN is provided (not empty and not a placeholder)
if (SENTRY_DSN && SENTRY_DSN !== 'your_sentry_dsn_here' && !SENTRY_DSN.includes('your_sentry_dsn')) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV,
    integrations: [],
  })
}

export function captureError(error: Error, context?: Record<string, any>) {
  if (SENTRY_DSN && SENTRY_DSN !== 'your_sentry_dsn_here' && !SENTRY_DSN.includes('your_sentry_dsn')) {
    Sentry.captureException(error, {
      contexts: {
        app: context,
      },
    })
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (SENTRY_DSN && SENTRY_DSN !== 'your_sentry_dsn_here' && !SENTRY_DSN.includes('your_sentry_dsn')) {
    Sentry.captureMessage(message, level)
  }
} 