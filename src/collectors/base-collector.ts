/**
 * Base Collector - Abstract class for all telemetry collectors
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  TelemetryData,
  TelemetrySource,
  CollectorConfig,
} from '../utils/types';
import { logger } from '../utils/logger';
import { getMQTTClient } from '../utils/mqtt-client';
import { CollectorError, withRetry, withTimeout } from '../utils/error-handler';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Base Collector Class
// ============================================================================

export abstract class BaseCollector extends EventEmitter {
  protected readonly name: string;
  protected readonly source: TelemetrySource;
  protected config: CollectorConfig;
  protected targets: CollectorTarget[] = [];

  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private status: CollectorStatus;

  constructor(
    name: string,
    source: TelemetrySource,
    config: CollectorConfig
  ) {
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

    logger.info(`Collector initialized: ${name}`, { source, enabled: config.enabled });
  }

  // ============================================================================
  // Abstract Methods (to be implemented by subclasses)
  // ============================================================================

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

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Start the collector
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Collector ${this.name} is already running`);
      return;
    }

    if (!this.config.enabled) {
      logger.info(`Collector ${this.name} is disabled`);
      return;
    }

    try {
      logger.info(`Starting collector: ${this.name}`);
      await this.initialize();

      this.isRunning = true;
      this.status.isRunning = true;

      // Start polling
      await this.poll();
      this.schedulePoll();

      this.emit('started');
      logger.info(`Collector started: ${this.name}`);
    } catch (error) {
      this.status.lastError = (error as Error).message;
      this.status.lastErrorTime = new Date();
      logger.error(`Failed to start collector: ${this.name}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Stop the collector
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info(`Stopping collector: ${this.name}`);

    // Stop polling
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    try {
      await this.cleanup();
    } catch (error) {
      logger.error(`Error during cleanup: ${this.name}`, {
        error: (error as Error).message,
      });
    }

    this.isRunning = false;
    this.status.isRunning = false;

    this.emit('stopped');
    logger.info(`Collector stopped: ${this.name}`);
  }

  /**
   * Restart the collector
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  // ============================================================================
  // Polling Methods
  // ============================================================================

  /**
   * Schedule the next poll
   */
  private schedulePoll(): void {
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
  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();
    this.status.pollCount++;
    this.status.lastPollTime = new Date();

    logger.debug(`Polling started: ${this.name}`, {
      pollCount: this.status.pollCount,
      targetCount: this.targets.length,
    });

    const enabledTargets = this.targets.filter(t => t.enabled);

    if (enabledTargets.length === 0) {
      logger.warn(`No enabled targets for collector: ${this.name}`);
      return;
    }

    // Collect from targets with concurrency control
    const results = await this.collectFromTargets(enabledTargets);

    // Process and publish results
    const allData: TelemetryData[] = results.flat();

    if (allData.length > 0) {
      await this.publishTelemetry(allData);
      this.status.dataPointsCollected += allData.length;
    }

    const duration = Date.now() - startTime;
    this.status.successCount++;
    this.status.lastSuccessTime = new Date();

    logger.debug(`Polling completed: ${this.name}`, {
      duration,
      dataPoints: allData.length,
    });

    this.emit('polled', { duration, dataPoints: allData.length });
  }

  /**
   * Collect from multiple targets with concurrency control
   */
  private async collectFromTargets(targets: CollectorTarget[]): Promise<TelemetryData[][]> {
    const results: TelemetryData[][] = [];
    const chunks = this.chunkArray(targets, this.config.maxConcurrent);

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(target => this.collectWithRetry(target))
      );

      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error(`Collection failed for target`, {
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
  private async collectWithRetry(target: CollectorTarget): Promise<TelemetryData[]> {
    return withRetry(
      async () => {
        return withTimeout(
          this.collect(target),
          this.config.timeout,
          `collect-${target.host}`
        );
      },
      {
        maxRetries: this.config.retries,
        initialDelay: 1000,
        retryOn: (error) => {
          // Don't retry on certain errors
          if (error instanceof CollectorError) {
            return true;
          }
          return true;
        },
      }
    );
  }

  // ============================================================================
  // Data Publishing
  // ============================================================================

  /**
   * Publish telemetry data to MQTT
   */
  private async publishTelemetry(data: TelemetryData[]): Promise<void> {
    const mqttClient = getMQTTClient();

    if (!mqttClient.connected) {
      logger.warn('MQTT client not connected, storing data locally');
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
      } catch (error) {
        logger.error('Failed to publish telemetry', {
          collector: this.name,
          error: (error as Error).message,
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
  addTarget(target: Omit<CollectorTarget, 'id'>): string {
    const id = uuidv4();
    this.targets.push({ ...target, id });
    logger.info(`Target added to ${this.name}`, { targetId: id, host: target.host });
    return id;
  }

  /**
   * Remove a target
   */
  removeTarget(targetId: string): boolean {
    const index = this.targets.findIndex(t => t.id === targetId);
    if (index !== -1) {
      this.targets.splice(index, 1);
      logger.info(`Target removed from ${this.name}`, { targetId });
      return true;
    }
    return false;
  }

  /**
   * Enable/disable a target
   */
  setTargetEnabled(targetId: string, enabled: boolean): boolean {
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
  getTargets(): CollectorTarget[] {
    return [...this.targets];
  }

  // ============================================================================
  // Status & Configuration
  // ============================================================================

  /**
   * Get collector status
   */
  getStatus(): CollectorStatus {
    return { ...this.status };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CollectorConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info(`Configuration updated for ${this.name}`, { config: this.config });
  }

  /**
   * Check if collector is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Create a telemetry data object
   */
  protected createTelemetryData(
    data: Record<string, unknown>,
    deviceId?: string,
    raw?: string
  ): TelemetryData {
    return {
      id: uuidv4(),
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
  protected chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Normalize MAC address format (lowercase, colon-separated)
   */
  protected normalizeMacAddress(mac: string): string {
    return mac
      .toLowerCase()
      .replace(/[^a-f0-9]/g, '')
      .replace(/(.{2})/g, '$1:')
      .slice(0, -1);
  }
}
