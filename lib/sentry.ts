import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV,
    integrations: [],
  })
}

export function captureError(error: Error, context?: Record<string, any>) {
  if (SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: {
        app: context,
      },
    })
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (SENTRY_DSN) {
    Sentry.captureMessage(message, level)
  }
} 