/**
 * Custom error classes and error handling utilities for SCADA Topology Discovery
 */
/**
 * Base application error
 */
export declare class AppError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly details?: Record<string, unknown>;
    constructor(message: string, code?: string, statusCode?: number, isOperational?: boolean, details?: Record<string, unknown>);
    toJSON(): Record<string, unknown>;
}
export declare class ConfigurationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ValidationError extends AppError {
    readonly fields: Record<string, string[]>;
    constructor(message: string, fields?: Record<string, string[]>);
    static fromZodError(zodError: {
        errors: Array<{
            path: (string | number)[];
            message: string;
        }>;
    }): ValidationError;
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class AuthorizationError extends AppError {
    constructor(message?: string, resource?: string, action?: string);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string, identifier?: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ConnectionError extends AppError {
    constructor(service: string, message?: string, details?: Record<string, unknown>);
}
export declare class DatabaseError extends AppError {
    constructor(message: string, query?: string);
}
export declare class MQTTError extends AppError {
    constructor(message: string, topic?: string);
}
export declare class CollectorError extends AppError {
    readonly collectorType: string;
    readonly targetHost?: string;
    constructor(collectorType: string, message: string, targetHost?: string, details?: Record<string, unknown>);
}
export declare class SNMPError extends CollectorError {
    constructor(message: string, targetHost?: string, details?: Record<string, unknown>);
}
export declare class SyslogError extends CollectorError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class NetFlowError extends CollectorError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class TimeoutError extends AppError {
    constructor(operation: string, timeoutMs: number);
}
export declare class RateLimitError extends AppError {
    readonly retryAfter: number;
    constructor(retryAfter?: number);
}
export declare class SecurityError extends AppError {
    readonly securityEvent: string;
    constructor(event: string, message: string, details?: Record<string, unknown>);
}
export declare class EncryptionError extends AppError {
    constructor(message: string, operation: 'encrypt' | 'decrypt');
}
/**
 * Check if error is operational (expected) or programmer error
 */
export declare function isOperationalError(error: Error): boolean;
/**
 * Handle error and log appropriately
 */
export declare function handleError(error: Error, context?: Record<string, unknown>): void;
/**
 * Wrap async function with error handling
 */
export declare function wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, errorHandler?: (error: Error) => void): T;
/**
 * Create a timeout wrapper for promises
 */
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T>;
/**
 * Retry a function with exponential backoff
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    retryOn?: (error: Error) => boolean;
}): Promise<T>;
/**
 * Setup global error handlers for uncaught exceptions and rejections
 */
export declare function setupGlobalErrorHandlers(): void;
//# sourceMappingURL=error-handler.d.ts.map