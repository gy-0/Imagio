/**
 * Development logger utility
 * Provides conditional logging based on environment
 * For production builds, logs can be stripped by build tools
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment: boolean;

  constructor() {
    // Check if we're in development mode
    // Vite sets import.meta.env.DEV to true in development
    try {
      this.isDevelopment = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
    } catch {
      this.isDevelopment = false;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    // Always log errors and warnings
    if (level === 'error' || level === 'warn') {
      return true;
    }

    // Only log debug and info in development
    return this.isDevelopment;
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }

  // Performance logging (development only)
  perf(label: string, fn: () => void): void {
    if (!this.isDevelopment) {
      fn();
      return;
    }

    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
  }

  // Async performance logging
  async perfAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isDevelopment) {
      return fn();
    }

    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  // Group logging (development only)
  group(label: string, fn: () => void): void {
    if (!this.isDevelopment) {
      fn();
      return;
    }

    console.group(label);
    fn();
    console.groupEnd();
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };
