"use strict";
/**
 * Structured logging utility for SCADA Topology Discovery
 * Uses Winston for comprehensive logging with multiple transports
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("./config");
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
winston_1.default.addColors(logLevels.colors);
// ============================================================================
// Log Format
// ============================================================================
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }));
const consoleFormat = winston_1.default.format.combine(logFormat, winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(({ level, message, timestamp, metadata }) => {
    const metaObj = metadata;
    const meta = metaObj && Object.keys(metaObj).length ? ` ${JSON.stringify(metaObj)}` : '';
    return `${timestamp} [${level}]: ${message}${meta}`;
}));
const jsonFormat = winston_1.default.format.combine(logFormat, winston_1.default.format.json());
// ============================================================================
// Logger Class
// ============================================================================
class Logger {
    logger;
    context = {};
    constructor() {
        const transports = [
            new winston_1.default.transports.Console({
                format: config_1.config.isProduction ? jsonFormat : consoleFormat,
            }),
        ];
        // Add file transport in production (but not in Lambda)
        // Lambda environment is read-only except /tmp, so skip file transports
        const isLambda = !!process.env.LAMBDA_TASK_ROOT || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
        if (config_1.config.isProduction && !isLambda) {
            transports.push(new winston_1.default.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                format: jsonFormat,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
            }), new winston_1.default.transports.File({
                filename: 'logs/combined.log',
                format: jsonFormat,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 10,
            }));
        }
        this.logger = winston_1.default.createLogger({
            level: config_1.config.logLevel,
            levels: logLevels.levels,
            transports,
            exitOnError: false,
        });
    }
    /**
     * Set persistent context for all log messages
     */
    setContext(context) {
        this.context = { ...this.context, ...context };
    }
    /**
     * Clear the logger context
     */
    clearContext() {
        this.context = {};
    }
    /**
     * Create a child logger with additional context
     */
    child(childContext) {
        const childLogger = Object.create(this);
        childLogger.context = { ...this.context, ...childContext };
        return childLogger;
    }
    /**
     * Log at error level
     */
    error(message, meta) {
        this.logger.error(message, { ...this.context, ...meta });
    }
    /**
     * Log at warn level
     */
    warn(message, meta) {
        this.logger.warn(message, { ...this.context, ...meta });
    }
    /**
     * Log at info level
     */
    info(message, meta) {
        this.logger.info(message, { ...this.context, ...meta });
    }
    /**
     * Log at debug level
     */
    debug(message, meta) {
        this.logger.debug(message, { ...this.context, ...meta });
    }
    /**
     * Log at trace level
     */
    trace(message, meta) {
        this.logger.log('trace', message, { ...this.context, ...meta });
    }
    /**
     * Log an error with stack trace
     */
    exception(error, message, meta) {
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
    telemetry(source, data) {
        this.logger.info('Telemetry received', {
            ...this.context,
            telemetrySource: source,
            ...data,
        });
    }
    /**
     * Log security event
     */
    security(event, severity, details) {
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
    audit(action, entityType, entityId, details) {
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
    metric(name, value, unit, tags) {
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
    startTimer(label) {
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
    deviceDiscovered(deviceId, deviceType, details) {
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
    connectionDiscovered(sourceId, targetId, connectionType) {
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
    topologyUpdate(deviceCount, connectionCount, duration) {
        this.logger.info('Topology updated', {
            ...this.context,
            deviceCount,
            connectionCount,
            updateDurationMs: duration,
        });
    }
}
exports.Logger = Logger;
// ============================================================================
// Singleton Export
// ============================================================================
exports.logger = new Logger();
// Set initial context
exports.logger.setContext({
    service: config_1.config.appName,
    environment: config_1.config.nodeEnv,
});
//# sourceMappingURL=logger.js.map