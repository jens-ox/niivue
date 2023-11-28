enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/** not included in public docs
 * @class Log
 * @type Log
 * @param logLevel lowest level to log
 */
export class Log {
  static LOG_PREFIX = 'NiiVue:'

  logLevel: LogLevel

  constructor(logLevel = LogLevel.ERROR) {
    this.logLevel = logLevel
  }

  getTimeStamp(): string {
    return `${Log.LOG_PREFIX} `
  }

  debug(...args: unknown[]): void {
    if (this.logLevel === LogLevel.DEBUG) {
      console.log(this.getTimeStamp(), 'DEBUG', ...args)
    }
  }

  info(...args: unknown[]): void {
    if ([LogLevel.DEBUG, LogLevel.INFO].includes(this.logLevel)) {
      console.log(this.getTimeStamp(), 'INFO', ...args)
    }
  }

  warn(...args: unknown[]): void {
    if ([LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN].includes(this.logLevel)) {
      console.warn(this.getTimeStamp(), 'WARN', ...args)
    }
  }

  error(...args: unknown[]): void {
    console.error(this.getTimeStamp(), 'ERROR', ...args)
  }

  setLogLevel(logLevel: LogLevel): void {
    this.logLevel = logLevel
  }
}
