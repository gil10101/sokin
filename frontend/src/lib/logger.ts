/**
 * Frontend logging utility for Sokin application
 * Provides structured logging with environment-aware output
 */

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

  /**
   * Log error messages
   */
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

  /**
   * Log warning messages
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata)
  }

  /**
   * Log info messages
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata)
  }

  /**
   * Log debug messages (development only)
   */
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
      // In production, you might want to send logs to a service like Sentry
      // For now, we'll just use console but with structured format
      console[level](JSON.stringify(entry))
    } else {
      // Development: pretty print to console
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`
      console[level](`${prefix} ${message}`, metadata || '')
      
      if (stack && level === 'error') {
        console.error(stack)
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export default for convenience
export default logger
