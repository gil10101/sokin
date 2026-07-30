/** Frontend logger. */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  metadata?: Record<string, unknown>
  stack?: string
}

class Logger {
  private readonly isProduction = process.env.NODE_ENV === 'production'
  private readonly isDevelopment = process.env.NODE_ENV === 'development'

  error(message: string, metadata?: Record<string, unknown> | Error): void {
    let stack: string | undefined
    let meta: Record<string, unknown> | undefined

    if (metadata instanceof Error) {
      stack = metadata.stack
      meta = { 
        name: metadata.name, 
        message: metadata.message 
      }
    } else {
      meta = metadata
    }

    this.log('error', message, meta, stack)
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata)
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata)
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      this.log('debug', message, metadata)
    }
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, stack?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(metadata && { metadata }),
      ...(stack && { stack })
    }

    if (this.isProduction) {
      // next.config strips console calls from production bundles, so errors
      // and warnings must reach Sentry directly or they vanish entirely.
      if (level === 'error' || level === 'warn') {
        void import('./sentry').then(({ captureError, logMessage }) => {
          if (level === 'error') {
            captureError(new Error(message), metadata)
          } else {
            logMessage(message, 'warning')
          }
        }).catch(() => {
          // Monitoring unavailable - nothing further we can do client-side
        })
      }
      console[level](JSON.stringify(entry))
    } else {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`
      console[level](`${prefix} ${message}`, metadata || '')
      
      if (stack && level === 'error') {
        console.error(stack)
      }
    }
  }
}

export const logger = new Logger()

export default logger
