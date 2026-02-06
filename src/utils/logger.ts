/**
 * Structured logging utility for SCADA Topology Discovery
 * Uses Winston for comprehensive logging with multiple transports
 */

import winston from 'winston';
import { config } from './config';

// ============================================================================
// Log Levels
// ============================================================================

const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'magenta',
  },
};

// Add colors to Winston
winston.addColors(logLevels.colors);

// ============================================================================
// Log Format
// ============================================================================

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
);

const consoleFormat = winston.format.combine(
  logFormat,
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, metadata }) => {
    const metaObj = metadata as Record<string, unknown>;
    const meta = metaObj && Object.keys(metaObj).length ? ` ${JSON.stringify(metaObj)}` : '';
    return `${timestamp} [${level}]: ${message}${meta}`;
  })
);

const jsonFormat = winston.format.combine(
  logFormat,
  winston.format.json()
);

// ============================================================================
// Logger Class
// ============================================================================

class Logger {
  private logger: winston.Logger;
  private context: Record<string, unknown> = {};

  constructor() {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: config.isProduction ? jsonFormat : consoleFormat,
      }),
    ];

    // Add file transport in production
    if (config.isProduction) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: jsonFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: jsonFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 10,
        })
      );
    }

    this.logger = winston.createLogger({
      level: config.logLevel,
      levels: logLevels.levels,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Set persistent context for all log messages
   */
  setContext(context: Record<string, unknown>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear the logger context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: Record<string, unknown>): Logger {
    const childLogger = Object.create(this);
    childLogger.context = { ...this.context, ...childContext };
    return childLogger;
  }

  /**
   * Log at error level
   */
  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, { ...this.context, ...meta });
  }

  /**
   * Log at warn level
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, { ...this.context, ...meta });
  }

  /**
   * Log at info level
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, { ...this.context, ...meta });
  }

  /**
   * Log at debug level
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, { ...this.context, ...meta });
  }

  /**
   * Log at trace level
   */
  trace(message: string, meta?: Record<string, unknown>): void {
    this.logger.log('trace', message, { ...this.context, ...meta });
  }

  /**
   * Log an error with stack trace
   */
  exception(error: Error, message?: string, meta?: Record<string, unknown>): void {
    this.logger.error(message || error.message, {
      ...this.context,
      ...meta,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * Log telemetry data
   */
  telemetry(source: string, data: Record<string, unknown>): void {
    this.logger.info('Telemetry received', {
      ...this.context,
      telemetrySource: source,
      ...data,
    });
  }

  /**
   * Log security event
   */
  security(event: string, severity: 'critical' | 'high' | 'medium' | 'low' | 'info', details: Record<string, unknown>): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' :
                  severity === 'medium' ? 'warn' : 'info';
    this.logger.log(level, `Security: ${event}`, {
      ...this.context,
      securityEvent: event,
      severity,
      ...details,
    });
  }

  /**
   * Log audit event
   */
  audit(action: string, entityType: string, entityId: string, details?: Record<string, unknown>): void {
    this.logger.info(`Audit: ${action}`, {
      ...this.context,
      auditAction: action,
      entityType,
      entityId,
      ...details,
    });
  }

  /**
   * Log performance metric
   */
  metric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    this.logger.info(`Metric: ${name}`, {
      ...this.context,
      metricName: name,
      metricValue: value,
      metricUnit: unit,
      tags,
    });
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(label: string): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      this.metric(`timer.${label}`, durationMs, 'ms');
    };
  }

  /**
   * Log device discovery event
   */
  deviceDiscovered(deviceId: string, deviceType: string, details: Record<string, unknown>): void {
    this.logger.info('Device discovered', {
      ...this.context,
      deviceId,
      deviceType,
      ...details,
    });
  }

  /**
   * Log connection discovery event
   */
  connectionDiscovered(sourceId: string, targetId: string, connectionType: string): void {
    this.logger.info('Connection discovered', {
      ...this.context,
      sourceDeviceId: sourceId,
      targetDeviceId: targetId,
      connectionType,
    });
  }

  /**
   * Log topology update event
   */
  topologyUpdate(deviceCount: number, connectionCount: number, duration: number): void {
    this.logger.info('Topology updated', {
      ...this.context,
      deviceCount,
      connectionCount,
      updateDurationMs: duration,
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const logger = new Logger();

// Set initial context
logger.setContext({
  service: config.appName,
  environment: config.nodeEnv,
});

// Export class for testing
export { Logger };
