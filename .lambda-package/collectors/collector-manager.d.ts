/**
 * Collector Manager - Orchestrates all telemetry collectors
 */
import { EventEmitter } from 'events';
import { SNMPCollector } from './snmp-collector';
import { ARPCollector } from './arp-collector';
import { NetFlowCollector } from './netflow-collector';
import { SyslogCollector } from './syslog-collector';
import { RoutingCollector } from './routing-collector';
import { OPCUACollector } from './opcua-collector';
import { ModbusCollector } from './modbus-collector';
import { BaseCollector, CollectorStatus } from './base-collector';
import { TelemetrySource, CollectorConfig } from '../utils/types';
export interface ManagerStatus {
    isRunning: boolean;
    startedAt?: Date;
    collectors: CollectorStatus[];
    mqttConnected: boolean;
}
export interface CollectorManagerConfig {
    snmp?: Partial<CollectorConfig> & {
        enabled?: boolean;
    };
    arp?: Partial<CollectorConfig> & {
        enabled?: boolean;
    };
    netflow?: Partial<CollectorConfig> & {
        enabled?: boolean;
    };
    syslog?: Partial<CollectorConfig> & {
        enabled?: boolean;
    };
    routing?: Partial<CollectorConfig> & {
        enabled?: boolean;
    };
    opcua?: Partial<CollectorConfig> & {
        enabled?: boolean;
    };
    modbus?: Partial<CollectorConfig> & {
        enabled?: boolean;
    };
}
export declare class CollectorManager extends EventEmitter {
    private collectors;
    private isRunning;
    private startedAt?;
    private healthCheckInterval?;
    constructor(managerConfig?: CollectorManagerConfig);
    private initializeCollectors;
    private setupCollectorEvents;
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;
    private startHealthCheck;
    private performHealthCheck;
    getCollector<T extends BaseCollector>(source: TelemetrySource): T | undefined;
    get snmp(): SNMPCollector | undefined;
    get arp(): ARPCollector | undefined;
    get netflow(): NetFlowCollector | undefined;
    get syslog(): SyslogCollector | undefined;
    get routing(): RoutingCollector | undefined;
    get opcua(): OPCUACollector | undefined;
    get modbus(): ModbusCollector | undefined;
    getCollectorStatuses(): CollectorStatus[];
    getStatus(): ManagerStatus;
    getStatistics(): {
        totalPolls: number;
        totalSuccesses: number;
        totalErrors: number;
        totalDataPoints: number;
        uptime: number;
    };
}
export declare function getCollectorManager(cfg?: CollectorManagerConfig): CollectorManager;
export declare function resetCollectorManager(): void;
//# sourceMappingURL=collector-manager.d.ts.map