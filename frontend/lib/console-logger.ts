/**
 * Console Logger Utility
 *
 * Intercepts browser console methods (log, error, warn, info) and stores
 * the last 50 logs in memory. This allows us to capture console output
 * that beta testers may not notice but is valuable for debugging.
 *
 * Usage:
 *   import { consoleLogger } from '@/lib/console-logger'
 *   const logs = consoleLogger.getLogs()
 */

export interface ConsoleLogEntry {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

class ConsoleLogger {
  private logs: ConsoleLogEntry[] = [];
  private maxLogs = 50;
  private isInitialized = false;

  // Store original console methods
  private originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  constructor() {
    // Only initialize if we're in the browser
    if (typeof window !== 'undefined') {
      this.interceptConsole();
    }
  }

  /**
   * Intercepts native console methods to capture logs
   */
  private interceptConsole() {
    if (this.isInitialized) return;

    // Intercept console.log
    console.log = (...args: any[]) => {
      this.addLog('log', args);
      this.originalConsole.log.apply(console, args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      this.addLog('error', args);
      this.originalConsole.error.apply(console, args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      this.addLog('warn', args);
      this.originalConsole.warn.apply(console, args);
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      this.addLog('info', args);
      this.originalConsole.info.apply(console, args);
    };

    this.isInitialized = true;
  }

  /**
   * Adds a log entry to the circular buffer
   */
  private addLog(type: ConsoleLogEntry['type'], args: any[]) {
    try {
      // Convert arguments to string
      const message = args
        .map((arg) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      // Add new log entry
      this.logs.push({
        type,
        message,
        timestamp: new Date().toISOString(),
      });

      // Maintain max size (circular buffer)
      if (this.logs.length > this.maxLogs) {
        this.logs.shift(); // Remove oldest log
      }
    } catch (error) {
      // Silently fail to avoid infinite loops
      this.originalConsole.error('ConsoleLogger error:', error);
    }
  }

  /**
   * Returns all captured logs
   */
  getLogs(): ConsoleLogEntry[] {
    return [...this.logs]; // Return copy to prevent external modification
  }

  /**
   * Clears all captured logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Returns logs filtered by type
   */
  getLogsByType(type: ConsoleLogEntry['type']): ConsoleLogEntry[] {
    return this.logs.filter((log) => log.type === type);
  }

  /**
   * Returns the number of logs by type
   */
  getLogCountByType(type: ConsoleLogEntry['type']): number {
    return this.logs.filter((log) => log.type === type).length;
  }

  /**
   * Restores original console methods (for cleanup if needed)
   */
  restore() {
    if (!this.isInitialized) return;

    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;

    this.isInitialized = false;
  }
}

// Export singleton instance
export const consoleLogger = new ConsoleLogger();

// Export type for use in other files
export type { ConsoleLogger };
