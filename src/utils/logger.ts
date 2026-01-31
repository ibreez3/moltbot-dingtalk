/**
 * Simple logger utility
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;

  switch (level) {
    case LogLevel.ERROR:
      console.error(prefix, message, ...args);
      break;
    case LogLevel.WARN:
      console.warn(prefix, message, ...args);
      break;
    case LogLevel.DEBUG:
      console.debug(prefix, message, ...args);
      break;
    default:
      console.log(prefix, message, ...args);
  }
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => log(LogLevel.DEBUG, message, ...args),
  info: (message: string, ...args: unknown[]) => log(LogLevel.INFO, message, ...args),
  warn: (message: string, ...args: unknown[]) => log(LogLevel.WARN, message, ...args),
  error: (message: string, ...args: unknown[]) => log(LogLevel.ERROR, message, ...args),
};
