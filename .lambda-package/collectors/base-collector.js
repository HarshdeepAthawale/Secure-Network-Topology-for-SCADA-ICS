"use strict";
/**
 * Base Collector - Abstract class for all telemetry collectors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCollector = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const mqtt_client_1 = require("../utils/mqtt-client");
const error_handler_1 = require("../utils/error-handler");
// ============================================================================
// Base Collector Class
// ============================================================================
class BaseCollector extends events_1.EventEmitter {
    name;
    source;
    config;
    targets = [];
    isRunning = false;
    pollTimer;
    status;
    constructor(name, source, config) {
        super();
        this.name = name;
        this.source = source;
        this.config = config;
        this.status = {
            name,
            source,
            isRunning: false,
            pollCount: 0,
            successCount: 0,
            errorCount: 0,
            dataPointsCollected: 0,
        };
        logger_1.logger.info(`Collector initialized: ${name}`, { source, enabled: config.enabled });
    }
    // ============================================================================
    // Lifecycle Methods
    // ============================================================================
    /**
     * Start the collector
     */
    async start() {
        if (this.isRunning) {
            logger_1.logger.warn(`Collector ${this.name} is already running`);
            return;
        }
        if (!this.config.enabled) {
            logger_1.logger.info(`Collector ${this.name} is disabled`);
            return;
        }
        try {
            logger_1.logger.info(`Starting collector: ${this.name}`);
            await this.initialize();
            this.isRunning = true;
            this.status.isRunning = true;
            // Start polling
            await this.poll();
            this.schedulePoll();
            this.emit('started');
            logger_1.logger.info(`Collector started: ${this.name}`);
        }
        catch (error) {
            this.status.lastError = error.message;
            this.status.lastErrorTime = new Date();
            logger_1.logger.error(`Failed to start collector: ${this.name}`, {
                error: error.message,
            });
            throw error;
        }
    }
    /**
     * Stop the collector
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        logger_1.logger.info(`Stopping collector: ${this.name}`);
        // Stop polling
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        try {
            await this.cleanup();
        }
        catch (error) {
            logger_1.logger.error(`Error during cleanup: ${this.name}`, {
                error: error.message,
            });
        }
        this.isRunning = false;
        this.status.isRunning = false;
        this.emit('stopped');
        logger_1.logger.info(`Collector stopped: ${this.name}`);
    }
    /**
     * Restart the collector
     */
    async restart() {
        await this.stop();
        await this.start();
    }
    // ============================================================================
    // Polling Methods
    // ============================================================================
    /**
     * Schedule the next poll
     */
    schedulePoll() {
        if (!this.isRunning) {
            return;
        }
        this.pollTimer = setTimeout(async () => {
            await this.poll();
            this.schedulePoll();
        }, this.config.pollInterval);
    }
    /**
     * Execute a polling cycle
     */
    async poll() {
        if (!this.isRunning) {
            return;
        }
        const startTime = Date.now();
        this.status.pollCount++;
        this.status.lastPollTime = new Date();
        logger_1.logger.debug(`Polling started: ${this.name}`, {
            pollCount: this.status.pollCount,
            targetCount: this.targets.length,
        });
        const enabledTargets = this.targets.filter(t => t.enabled);
        if (enabledTargets.length === 0) {
            logger_1.logger.warn(`No enabled targets for collector: ${this.name}`);
            return;
        }
        // Collect from targets with concurrency control
        const results = await this.collectFromTargets(enabledTargets);
        // Process and publish results
        const allData = results.flat();
        if (allData.length > 0) {
            await this.publishTelemetry(allData);
            this.status.dataPointsCollected += allData.length;
        }
        const duration = Date.now() - startTime;
        this.status.successCount++;
        this.status.lastSuccessTime = new Date();
        logger_1.logger.debug(`Polling completed: ${this.name}`, {
            duration,
            dataPoints: allData.length,
        });
        this.emit('polled', { duration, dataPoints: allData.length });
    }
    /**
     * Collect from multiple targets with concurrency control
     */
    async collectFromTargets(targets) {
        const results = [];
        const chunks = this.chunkArray(targets, this.config.maxConcurrent);
        for (const chunk of chunks) {
            const chunkResults = await Promise.allSettled(chunk.map(target => this.collectWithRetry(target)));
            for (const result of chunkResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
                else {
                    logger_1.logger.error(`Collection failed for target`, {
                        collector: this.name,
                        error: result.reason?.message,
                    });
                    this.status.errorCount++;
                }
            }
        }
        return results;
    }
    /**
     * Collect from a target with retry logic
     */
    async collectWithRetry(target) {
        return (0, error_handler_1.withRetry)(async () => {
            return (0, error_handler_1.withTimeout)(this.collect(target), this.config.timeout, `collect-${target.host}`);
        }, {
            maxRetries: this.config.retries,
            initialDelay: 1000,
            retryOn: (error) => {
                // Don't retry on certain errors
                if (error instanceof error_handler_1.CollectorError) {
                    return true;
                }
                return true;
            },
        });
    }
    // ============================================================================
    // Data Publishing
    // ============================================================================
    /**
     * Publish telemetry data to MQTT
     */
    async publishTelemetry(data) {
        const mqttClient = (0, mqtt_client_1.getMQTTClient)();
        if (!mqttClient.connected) {
            logger_1.logger.warn('MQTT client not connected, storing data locally');
            this.emit('data', data);
            return;
        }
        // Batch the data
        const batches = this.chunkArray(data, this.config.batchSize);
        for (const batch of batches) {
            try {
                await mqttClient.publishTelemetry({
                    collector: this.name,
                    source: this.source,
                    timestamp: new Date().toISOString(),
                    count: batch.length,
                    data: batch,
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to publish telemetry', {
                    collector: this.name,
                    error: error.message,
                    batchSize: batch.length,
                });
                // Emit data locally as fallback
                this.emit('data', batch);
            }
        }
    }
    // ============================================================================
    // Target Management
    // ============================================================================
    /**
     * Add a target to collect from
     */
    addTarget(target) {
        const id = (0, uuid_1.v4)();
        this.targets.push({ ...target, id });
        logger_1.logger.info(`Target added to ${this.name}`, { targetId: id, host: target.host });
        return id;
    }
    /**
     * Remove a target
     */
    removeTarget(targetId) {
        const index = this.targets.findIndex(t => t.id === targetId);
        if (index !== -1) {
            this.targets.splice(index, 1);
            logger_1.logger.info(`Target removed from ${this.name}`, { targetId });
            return true;
        }
        return false;
    }
    /**
     * Enable/disable a target
     */
    setTargetEnabled(targetId, enabled) {
        const target = this.targets.find(t => t.id === targetId);
        if (target) {
            target.enabled = enabled;
            return true;
        }
        return false;
    }
    /**
     * Get all targets
     */
    getTargets() {
        return [...this.targets];
    }
    // ============================================================================
    // Status & Configuration
    // ============================================================================
    /**
     * Get collector status
     */
    getStatus() {
        return { ...this.status };
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        logger_1.logger.info(`Configuration updated for ${this.name}`, { config: this.config });
    }
    /**
     * Check if collector is running
     */
    get running() {
        return this.isRunning;
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Create a telemetry data object
     */
    createTelemetryData(data, deviceId, raw) {
        return {
            id: (0, uuid_1.v4)(),
            source: this.source,
            deviceId,
            timestamp: new Date(),
            data,
            raw,
            processed: false,
            metadata: {
                collector: this.name,
            },
        };
    }
    /**
     * Split array into chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    /**
     * Normalize MAC address format (lowercase, colon-separated)
     */
    normalizeMacAddress(mac) {
        return mac
            .toLowerCase()
            .replace(/[^a-f0-9]/g, '')
            .replace(/(.{2})/g, '$1:')
            .slice(0, -1);
    }
}
exports.BaseCollector = BaseCollector;
//# sourceMappingURL=base-collector.js.map