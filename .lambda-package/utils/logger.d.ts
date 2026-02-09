/**
 * Structured logging utility for SCADA Topology Discovery
 * Uses Winston for comprehensive logging with multiple transports
 */
declare class Logger {
    private logger;
    private context;
    constructor();
    /**
     * Set persistent context for all log messages
     */
    setContext(context: Record<string, unknown>): void;
    /**
     * Clear the logger context
     */
    clearContext(): void;
    /**
     * Create a child logger with additional context
     */
    child(childContext: Record<string, unknown>): Logger;
    /**
     * Log at error level
     */
    error(message: string, meta?: Record<string, unknown>): void;
    /**
     * Log at warn level
     */
    warn(message: string, meta?: Record<string, unknown>): void;
    /**
     * Log at info level
     */
    info(message: string, meta?: Record<string, unknown>): void;
    /**
     * Log at debug level
     */
    debug(message: string, meta?: Record<string, unknown>): void;
    /**
     * Log at trace level
     */
    trace(message: string, meta?: Record<string, unknown>): void;
    /**
     * Log an error with stack trace
     */
    exception(error: Error, message?: string, meta?: Record<string, unknown>): void;
    /**
     * Log telemetry data
     */
    telemetry(source: string, data: Record<string, unknown>): void;
    /**
     * Log security event
     */
    security(event: string, severity: 'critical' | 'high' | 'medium' | 'low' | 'info', details: Record<string, unknown>): void;
    /**
     * Log audit event
     */
    audit(action: string, entityType: string, entityId: string, details?: Record<string, unknown>): void;
    /**
     * Log performance metric
     */
    metric(name: string, value: number, unit: string, tags?: Record<string, string>): void;
    /**
     * Start a timer for performance measurement
     */
    startTimer(label: string): () => void;
    /**
     * Log device discovery event
     */
    deviceDiscovered(deviceId: string, deviceType: string, details: Record<string, unknown>): void;
    /**
     * Log connection discovery event
     */
    connectionDiscovered(sourceId: string, targetId: string, connectionType: string): void;
    /**
     * Log topology update event
     */
    topologyUpdate(deviceCount: number, connectionCount: number, duration: number): void;
}
export declare const logger: Logger;
export { Logger };
//# sourceMappingURL=logger.d.ts.map