/**
 * Custom error classes and error handling utilities for SCADA Topology Discovery
 */

import { logger } from './logger';

// ============================================================================
// Base Error Classes
// ============================================================================

/**
 * Base application error
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

export class ConfigurationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', 500, true, details);
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

export class ValidationError extends AppError {
  public readonly fields: Record<string, string[]>;

  constructor(message: string, fields: Record<string, string[]> = {}) {
    super(message, 'VALIDATION_ERROR', 400, true, { fields });
    this.fields = fields;
  }

  static fromZodError(zodError: { errors: Array<{ path: (string | number)[]; message: string }> }): ValidationError {
    const fields: Record<string, string[]> = {};

    for (const error of zodError.errors) {
      const path = error.path.join('.');
      if (!fields[path]) {
        fields[path] = [];
      }
      fields[path].push(error.message);
    }

    return new ValidationError('Validation failed', fields);
  }
}

// ============================================================================
// Authentication & Authorization Errors
// ============================================================================

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401, true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', resource?: string, action?: string) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, { resource, action });
  }
}

// ============================================================================
// Resource Errors
// ============================================================================

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, true, { resource, identifier });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, true, details);
  }
}

// ============================================================================
// Connection Errors
// ============================================================================

export class ConnectionError extends AppError {
  constructor(
    service: string,
    message: string = `Failed to connect to ${service}`,
    details?: Record<string, unknown>
  ) {
    super(message, 'CONNECTION_ERROR', 503, true, { service, ...details });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, query?: string) {
    super(message, 'DATABASE_ERROR', 500, true, { query });
  }
}

export class MQTTError extends AppError {
  constructor(message: string, topic?: string) {
    super(message, 'MQTT_ERROR', 500, true, { topic });
  }
}

// ============================================================================
// Collector Errors
// ============================================================================

export class CollectorError extends AppError {
  public readonly collectorType: string;
  public readonly targetHost?: string;

  constructor(
    collectorType: string,
    message: string,
    targetHost?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'COLLECTOR_ERROR', 500, true, { collectorType, targetHost, ...details });
    this.collectorType = collectorType;
    this.targetHost = targetHost;
  }
}

export class SNMPError extends CollectorError {
  constructor(message: string, targetHost?: string, details?: Record<string, unknown>) {
    super('snmp', message, targetHost, details);
  }
}

export class SyslogError extends CollectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('syslog', message, undefined, details);
  }
}

export class NetFlowError extends CollectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('netflow', message, undefined, details);
  }
}

// ============================================================================
// Timeout & Rate Limit Errors
// ============================================================================

export class TimeoutError extends AppError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      504,
      true,
      { operation, timeoutMs }
    );
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      'RATE_LIMIT_ERROR',
      429,
      true,
      { retryAfter }
    );
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// Security Errors
// ============================================================================

export class SecurityError extends AppError {
  public readonly securityEvent: string;

  constructor(event: string, message: string, details?: Record<string, unknown>) {
    super(message, 'SECURITY_ERROR', 403, true, { event, ...details });
    this.securityEvent = event;
  }
}

export class EncryptionError extends AppError {
  constructor(message: string, operation: 'encrypt' | 'decrypt') {
    super(message, 'ENCRYPTION_ERROR', 500, true, { operation });
  }
}

// ============================================================================
// Error Handler Functions
// ============================================================================

/**
 * Check if error is operational (expected) or programmer error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Handle error and log appropriately
 */
export function handleError(error: Error, context?: Record<string, unknown>): void {
  if (error instanceof AppError) {
    if (error.isOperational) {
      logger.warn(error.message, {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        ...context,
      });
    } else {
      logger.error(error.message, {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        stack: error.stack,
        ...context,
      });
    }
  } else {
    logger.exception(error, 'Unhandled error', context);
  }
}

/**
 * Wrap async function with error handling
 */
export function wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorHandler?: (error: Error) => void
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (errorHandler) {
        errorHandler(error as Error);
      } else {
        handleError(error as Error);
      }
      throw error;
    }
  }) as T;
}

/**
 * Create a timeout wrapper for promises
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    retryOn?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryOn = () => true,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !retryOn(lastError)) {
        throw lastError;
      }

      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, {
        error: lastError.message,
        delay,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

// ============================================================================
// Global Error Handlers
// ============================================================================

/**
 * Setup global error handlers for uncaught exceptions and rejections
 */
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });

    // Give the logger time to flush
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
