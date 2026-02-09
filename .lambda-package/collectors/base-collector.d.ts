/**
 * Base Collector - Abstract class for all telemetry collectors
 */
import { EventEmitter } from 'events';
import { TelemetryData, TelemetrySource, CollectorConfig } from '../utils/types';
export interface CollectorStatus {
    name: string;
    source: TelemetrySource;
    isRunning: boolean;
    lastPollTime?: Date;
    lastSuccessTime?: Date;
    lastErrorTime?: Date;
    lastError?: string;
    pollCount: number;
    successCount: number;
    errorCount: number;
    dataPointsCollected: number;
}
export interface CollectorTarget {
    id: string;
    host: string;
    port?: number;
    enabled: boolean;
    metadata?: Record<string, unknown>;
}
export declare abstract class BaseCollector extends EventEmitter {
    protected readonly name: string;
    protected readonly source: TelemetrySource;
    protected config: CollectorConfig;
    protected targets: CollectorTarget[];
    private isRunning;
    private pollTimer?;
    private status;
    constructor(name: string, source: TelemetrySource, config: CollectorConfig);
    /**
     * Initialize the collector (connect to resources, etc.)
     */
    protected abstract initialize(): Promise<void>;
    /**
     * Perform data collection from a target
     */
    protected abstract collect(target: CollectorTarget): Promise<TelemetryData[]>;
    /**
     * Clean up resources
     */
    protected abstract cleanup(): Promise<void>;
    /**
     * Start the collector
     */
    start(): Promise<void>;
    /**
     * Stop the collector
     */
    stop(): Promise<void>;
    /**
     * Restart the collector
     */
    restart(): Promise<void>;
    /**
     * Schedule the next poll
     */
    private schedulePoll;
    /**
     * Execute a polling cycle
     */
    private poll;
    /**
     * Collect from multiple targets with concurrency control
     */
    private collectFromTargets;
    /**
     * Collect from a target with retry logic
     */
    private collectWithRetry;
    /**
     * Publish telemetry data to MQTT
     */
    private publishTelemetry;
    /**
     * Add a target to collect from
     */
    addTarget(target: Omit<CollectorTarget, 'id'>): string;
    /**
     * Remove a target
     */
    removeTarget(targetId: string): boolean;
    /**
     * Enable/disable a target
     */
    setTargetEnabled(targetId: string, enabled: boolean): boolean;
    /**
     * Get all targets
     */
    getTargets(): CollectorTarget[];
    /**
     * Get collector status
     */
    getStatus(): CollectorStatus;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<CollectorConfig>): void;
    /**
     * Check if collector is running
     */
    get running(): boolean;
    /**
     * Create a telemetry data object
     */
    protected createTelemetryData(data: Record<string, unknown>, deviceId?: string, raw?: string): TelemetryData;
    /**
     * Split array into chunks
     */
    protected chunkArray<T>(array: T[], chunkSize: number): T[][];
    /**
     * Normalize MAC address format (lowercase, colon-separated)
     */
    protected normalizeMacAddress(mac: string): string;
}
//# sourceMappingURL=base-collector.d.ts.map