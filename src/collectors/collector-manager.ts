/**
 * Collector Manager - Orchestrates all telemetry collectors
 */

import { EventEmitter } from 'events';
import { SNMPCollector, createSNMPCollector } from './snmp-collector';
import { ARPCollector, createARPCollector } from './arp-collector';
import { NetFlowCollector, createNetFlowCollector } from './netflow-collector';
import { SyslogCollector, createSyslogCollector } from './syslog-collector';
import { RoutingCollector, createRoutingCollector } from './routing-collector';
import { OPCUACollector, createOPCUACollector } from './opcua-collector';
import { ModbusCollector, createModbusCollector } from './modbus-collector';
import { BaseCollector, CollectorStatus } from './base-collector';
import { TelemetrySource, CollectorConfig } from '../utils/types';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { getMQTTClient } from '../utils/mqtt-client';

// ============================================================================
// Types
// ============================================================================

export interface ManagerStatus {
  isRunning: boolean;
  startedAt?: Date;
  collectors: CollectorStatus[];
  mqttConnected: boolean;
}

export interface CollectorManagerConfig {
  snmp?: Partial<CollectorConfig> & { enabled?: boolean };
  arp?: Partial<CollectorConfig> & { enabled?: boolean };
  netflow?: Partial<CollectorConfig> & { enabled?: boolean };
  syslog?: Partial<CollectorConfig> & { enabled?: boolean };
  routing?: Partial<CollectorConfig> & { enabled?: boolean };
  opcua?: Partial<CollectorConfig> & { enabled?: boolean };
  modbus?: Partial<CollectorConfig> & { enabled?: boolean };
}

// ============================================================================
// Collector Manager Class
// ============================================================================

export class CollectorManager extends EventEmitter {
  private collectors: Map<TelemetrySource, BaseCollector> = new Map();
  private isRunning = false;
  private startedAt?: Date;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(managerConfig: CollectorManagerConfig = {}) {
    super();
    this.initializeCollectors(managerConfig);
  }

  private initializeCollectors(managerConfig: CollectorManagerConfig): void {
    if (managerConfig.snmp?.enabled !== false) {
      const snmpCollector = createSNMPCollector(managerConfig.snmp);
      this.collectors.set(TelemetrySource.SNMP, snmpCollector);
      this.setupCollectorEvents(snmpCollector);
    }

    if (managerConfig.arp?.enabled !== false) {
      const arpCollector = createARPCollector(managerConfig.arp);
      this.collectors.set(TelemetrySource.ARP, arpCollector);
      this.setupCollectorEvents(arpCollector);
    }

    if (managerConfig.netflow?.enabled !== false) {
      const netflowCollector = createNetFlowCollector(managerConfig.netflow);
      this.collectors.set(TelemetrySource.NETFLOW, netflowCollector);
      this.setupCollectorEvents(netflowCollector);
    }

    if (managerConfig.syslog?.enabled !== false) {
      const syslogCollector = createSyslogCollector(managerConfig.syslog);
      this.collectors.set(TelemetrySource.SYSLOG, syslogCollector);
      this.setupCollectorEvents(syslogCollector);
    }

    if (managerConfig.routing?.enabled !== false) {
      const routingCollector = createRoutingCollector(managerConfig.routing);
      this.collectors.set(TelemetrySource.ROUTING, routingCollector);
      this.setupCollectorEvents(routingCollector);
    }

    if (managerConfig.opcua?.enabled !== false) {
      const opcuaCollector = createOPCUACollector(managerConfig.opcua);
      this.collectors.set(TelemetrySource.OPCUA, opcuaCollector);
      this.setupCollectorEvents(opcuaCollector);
    }

    if (managerConfig.modbus?.enabled !== false) {
      const modbusCollector = createModbusCollector(managerConfig.modbus);
      this.collectors.set(TelemetrySource.MODBUS, modbusCollector);
      this.setupCollectorEvents(modbusCollector);
    }

    logger.info('Collectors initialized', {
      count: this.collectors.size,
      types: Array.from(this.collectors.keys()),
    });
  }

  private setupCollectorEvents(collector: BaseCollector): void {
    collector.on('started', () => this.emit('collectorStarted', collector.getStatus()));
    collector.on('stopped', () => this.emit('collectorStopped', collector.getStatus()));
    collector.on('polled', (data) => this.emit('telemetryCollected', { source: collector.getStatus().source, ...data }));
    collector.on('data', (data) => this.emit('data', data));
    collector.on('error', (error) => this.emit('error', { source: collector.getStatus().source, error }));
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info('Starting collector manager');

    const mqttClient = getMQTTClient();
    if (config.mqtt.endpoint) {
      try {
        await mqttClient.connect();
      } catch (error) {
        logger.warn('MQTT connection failed', { error: (error as Error).message });
      }
    }

    const startPromises = Array.from(this.collectors.values()).map(
      collector => collector.start().catch(error => {
        logger.error('Failed to start collector', { collector: collector.getStatus().name, error: (error as Error).message });
      })
    );

    await Promise.all(startPromises);

    this.isRunning = true;
    this.startedAt = new Date();
    this.startHealthCheck();
    this.emit('started');
    logger.info('Collector manager started', { collectors: this.collectors.size });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping collector manager');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    const stopPromises = Array.from(this.collectors.values()).map(
      collector => collector.stop().catch(error => {
        logger.error('Error stopping collector', { collector: collector.getStatus().name, error: (error as Error).message });
      })
    );

    await Promise.all(stopPromises);
    await getMQTTClient().disconnect();

    this.isRunning = false;
    this.emit('stopped');
    logger.info('Collector manager stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => this.performHealthCheck(), 30000);
  }

  private performHealthCheck(): void {
    const statuses = this.getCollectorStatuses();
    const unhealthy = statuses.filter(s => !s.isRunning);

    if (unhealthy.length > 0) {
      logger.warn('Unhealthy collectors detected', { unhealthy: unhealthy.map(s => s.name) });
    }

    this.emit('healthCheck', { statuses, unhealthyCount: unhealthy.length });
  }

  getCollector<T extends BaseCollector>(source: TelemetrySource): T | undefined {
    return this.collectors.get(source) as T | undefined;
  }

  get snmp(): SNMPCollector | undefined { return this.getCollector<SNMPCollector>(TelemetrySource.SNMP); }
  get arp(): ARPCollector | undefined { return this.getCollector<ARPCollector>(TelemetrySource.ARP); }
  get netflow(): NetFlowCollector | undefined { return this.getCollector<NetFlowCollector>(TelemetrySource.NETFLOW); }
  get syslog(): SyslogCollector | undefined { return this.getCollector<SyslogCollector>(TelemetrySource.SYSLOG); }
  get routing(): RoutingCollector | undefined { return this.getCollector<RoutingCollector>(TelemetrySource.ROUTING); }
  get opcua(): OPCUACollector | undefined { return this.getCollector<OPCUACollector>(TelemetrySource.OPCUA); }
  get modbus(): ModbusCollector | undefined { return this.getCollector<ModbusCollector>(TelemetrySource.MODBUS); }

  getCollectorStatuses(): CollectorStatus[] {
    return Array.from(this.collectors.values()).map(c => c.getStatus());
  }

  getStatus(): ManagerStatus {
    return {
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      collectors: this.getCollectorStatuses(),
      mqttConnected: getMQTTClient().connected,
    };
  }

  getStatistics(): { totalPolls: number; totalSuccesses: number; totalErrors: number; totalDataPoints: number; uptime: number } {
    const statuses = this.getCollectorStatuses();
    return {
      totalPolls: statuses.reduce((sum, s) => sum + s.pollCount, 0),
      totalSuccesses: statuses.reduce((sum, s) => sum + s.successCount, 0),
      totalErrors: statuses.reduce((sum, s) => sum + s.errorCount, 0),
      totalDataPoints: statuses.reduce((sum, s) => sum + s.dataPointsCollected, 0),
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
    };
  }
}

let managerInstance: CollectorManager | null = null;

export function getCollectorManager(cfg?: CollectorManagerConfig): CollectorManager {
  if (!managerInstance) managerInstance = new CollectorManager(cfg);
  return managerInstance;
}

export function resetCollectorManager(): void {
  if (managerInstance) {
    managerInstance.stop().catch(() => { });
    managerInstance = null;
  }
}

if (require.main === module) {
  const manager = getCollectorManager();
  process.on('SIGINT', async () => { await manager.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await manager.stop(); process.exit(0); });
  manager.start().catch(error => { logger.error('Failed to start', { error: error.message }); process.exit(1); });
}
