"use strict";
/**
 * Custom error classes and error handling utilities for SCADA Topology Discovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionError = exports.SecurityError = exports.RateLimitError = exports.TimeoutError = exports.NetFlowError = exports.SyslogError = exports.SNMPError = exports.CollectorError = exports.MQTTError = exports.DatabaseError = exports.ConnectionError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.ConfigurationError = exports.AppError = void 0;
exports.isOperationalError = isOperationalError;
exports.handleError = handleError;
exports.wrapAsync = wrapAsync;
exports.withTimeout = withTimeout;
exports.withRetry = withRetry;
exports.setupGlobalErrorHandlers = setupGlobalErrorHandlers;
const logger_1 = require("./logger");
// ============================================================================
// Base Error Classes
// ============================================================================
/**
 * Base application error
 */
class AppError extends Error {
    code;
    statusCode;
    isOperational;
    details;
    constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, isOperational = true, details) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            details: this.details,
        };
    }
}
exports.AppError = AppError;
// ============================================================================
// Configuration Errors
// ============================================================================
class ConfigurationError extends AppError {
    constructor(message, details) {
        super(message, 'CONFIGURATION_ERROR', 500, true, details);
    }
}
exports.ConfigurationError = ConfigurationError;
// ============================================================================
// Validation Errors
// ============================================================================
class ValidationError extends AppError {
    fields;
    constructor(message, fields = {}) {
        super(message, 'VALIDATION_ERROR', 400, true, { fields });
        this.fields = fields;
    }
    static fromZodError(zodError) {
        const fields = {};
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
exports.ValidationError = ValidationError;
// ============================================================================
// Authentication & Authorization Errors
// ============================================================================
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 'AUTHENTICATION_ERROR', 401, true);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Access denied', resource, action) {
        super(message, 'AUTHORIZATION_ERROR', 403, true, { resource, action });
    }
}
exports.AuthorizationError = AuthorizationError;
// ============================================================================
// Resource Errors
// ============================================================================
class NotFoundError extends AppError {
    constructor(resource, identifier) {
        const message = identifier
            ? `${resource} with identifier '${identifier}' not found`
            : `${resource} not found`;
        super(message, 'NOT_FOUND', 404, true, { resource, identifier });
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message, details) {
        super(message, 'CONFLICT', 409, true, details);
    }
}
exports.ConflictError = ConflictError;
// ============================================================================
// Connection Errors
// ============================================================================
class ConnectionError extends AppError {
    constructor(service, message = `Failed to connect to ${service}`, details) {
        super(message, 'CONNECTION_ERROR', 503, true, { service, ...details });
    }
}
exports.ConnectionError = ConnectionError;
class DatabaseError extends AppError {
    constructor(message, query) {
        super(message, 'DATABASE_ERROR', 500, true, { query });
    }
}
exports.DatabaseError = DatabaseError;
class MQTTError extends AppError {
    constructor(message, topic) {
        super(message, 'MQTT_ERROR', 500, true, { topic });
    }
}
exports.MQTTError = MQTTError;
// ============================================================================
// Collector Errors
// ============================================================================
class CollectorError extends AppError {
    collectorType;
    targetHost;
    constructor(collectorType, message, targetHost, details) {
        super(message, 'COLLECTOR_ERROR', 500, true, { collectorType, targetHost, ...details });
        this.collectorType = collectorType;
        this.targetHost = targetHost;
    }
}
exports.CollectorError = CollectorError;
class SNMPError extends CollectorError {
    constructor(message, targetHost, details) {
        super('snmp', message, targetHost, details);
    }
}
exports.SNMPError = SNMPError;
class SyslogError extends CollectorError {
    constructor(message, details) {
        super('syslog', message, undefined, details);
    }
}
exports.SyslogError = SyslogError;
class NetFlowError extends CollectorError {
    constructor(message, details) {
        super('netflow', message, undefined, details);
    }
}
exports.NetFlowError = NetFlowError;
// ============================================================================
// Timeout & Rate Limit Errors
// ============================================================================
class TimeoutError extends AppError {
    constructor(operation, timeoutMs) {
        super(`Operation '${operation}' timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR', 504, true, { operation, timeoutMs });
    }
}
exports.TimeoutError = TimeoutError;
class RateLimitError extends AppError {
    retryAfter;
    constructor(retryAfter = 60) {
        super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, 'RATE_LIMIT_ERROR', 429, true, { retryAfter });
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
// ============================================================================
// Security Errors
// ============================================================================
class SecurityError extends AppError {
    securityEvent;
    constructor(event, message, details) {
        super(message, 'SECURITY_ERROR', 403, true, { event, ...details });
        this.securityEvent = event;
    }
}
exports.SecurityError = SecurityError;
class EncryptionError extends AppError {
    constructor(message, operation) {
        super(message, 'ENCRYPTION_ERROR', 500, true, { operation });
    }
}
exports.EncryptionError = EncryptionError;
// ============================================================================
// Error Handler Functions
// ============================================================================
/**
 * Check if error is operational (expected) or programmer error
 */
function isOperationalError(error) {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}
/**
 * Handle error and log appropriately
 */
function handleError(error, context) {
    if (error instanceof AppError) {
        if (error.isOperational) {
            logger_1.logger.warn(error.message, {
                code: error.code,
                statusCode: error.statusCode,
                details: error.details,
                ...context,
            });
        }
        else {
            logger_1.logger.error(error.message, {
                code: error.code,
                statusCode: error.statusCode,
                details: error.details,
                stack: error.stack,
                ...context,
            });
        }
    }
    else {
        logger_1.logger.exception(error, 'Unhandled error', context);
    }
}
/**
 * Wrap async function with error handling
 */
function wrapAsync(fn, errorHandler) {
    return (async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            if (errorHandler) {
                errorHandler(error);
            }
            else {
                handleError(error);
            }
            throw error;
        }
    });
}
/**
 * Create a timeout wrapper for promises
 */
async function withTimeout(promise, timeoutMs, operation) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutError(operation, timeoutMs));
        }, timeoutMs);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    }
    catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
/**
 * Retry a function with exponential backoff
 */
async function withRetry(fn, options = {}) {
    const { maxRetries = 3, initialDelay = 1000, maxDelay = 30000, backoffFactor = 2, retryOn = () => true, } = options;
    let lastError;
    let delay = initialDelay;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxRetries || !retryOn(lastError)) {
                throw lastError;
            }
            logger_1.logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, {
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
function setupGlobalErrorHandlers() {
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('Uncaught exception', {
            error: error.message,
            stack: error.stack,
        });
        // Give the logger time to flush
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error('Unhandled rejection', {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
        });
    });
}
//# sourceMappingURL=error-handler.js.map