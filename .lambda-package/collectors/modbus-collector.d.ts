/**
 * Modbus Collector - Industrial protocol data collection
 * Supports both Modbus TCP and Modbus RTU over TCP
 *
 * NOTE: Requires 'modbus-serial' package to be installed for full functionality.
 * This implementation provides the interface and mock functionality when the
 * package is not available.
 */
import { BaseCollector, CollectorTarget } from './base-collector';
import { TelemetryData, CollectorConfig } from '../utils/types';
export interface ModbusTarget extends CollectorTarget {
    host: string;
    port?: number;
    unitId?: number;
    protocol?: 'tcp' | 'rtu-over-tcp' | 'ascii-over-tcp';
    timeout?: number;
    registers?: ModbusRegisterConfig[];
}
export interface ModbusRegisterConfig {
    name: string;
    address: number;
    length: number;
    type: 'coil' | 'discrete' | 'holding' | 'input';
    dataType?: 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'string';
    scaleFactor?: number;
    unit?: string;
}
export interface ModbusDeviceInfo {
    deviceId: number;
    vendorName?: string;
    productCode?: string;
    revision?: string;
    vendorUrl?: string;
    productName?: string;
    modelName?: string;
    userApplicationName?: string;
}
export interface ModbusRegisterValue {
    name: string;
    address: number;
    rawValue: number[];
    value: number | string | boolean;
    timestamp: Date;
    unit?: string;
}
export declare class ModbusCollector extends BaseCollector {
    private connections;
    private pollingIntervals;
    private modbusAvailable;
    private ModbusRTU;
    constructor(collectorConfig?: Partial<CollectorConfig>);
    /**
     * Check if modbus-serial is available
     */
    private checkModbusAvailability;
    /**
     * Initialize the Modbus collector
     */
    initialize(): Promise<void>;
    /**
     * Collect data from a single target
     */
    collect(target: CollectorTarget): Promise<TelemetryData[]>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    /**
     * Parse raw register values based on data type
     */
    private parseRegisterValue;
    /**
     * Start polling for a target (placeholder for when modbus-serial is available)
     */
    startPolling(target: ModbusTarget, intervalMs: number | undefined, callback: (values: ModbusRegisterValue[]) => void): void;
    /**
     * Stop polling for a target
     */
    stopPolling(targetId: string): void;
    /**
     * Create device info telemetry
     */
    private createDeviceInfoTelemetry;
    /**
     * Create mock device info telemetry
     */
    private createMockDeviceInfoTelemetry;
    /**
     * Create registers telemetry
     */
    private createRegistersTelemetry;
    /**
     * Create scan telemetry
     */
    private createScanTelemetry;
    /**
     * Create mock scan telemetry
     */
    private createMockScanTelemetry;
    /**
     * Get connection status for a target
     */
    getConnectionStatus(targetId: string): {
        connected: boolean;
        lastContact?: Date;
    };
    /**
     * Add Modbus target
     */
    addModbusTarget(target: Omit<ModbusTarget, 'id'>): string;
}
export declare function getModbusCollector(): ModbusCollector;
export declare function createModbusCollector(config?: Partial<CollectorConfig>): ModbusCollector;
//# sourceMappingURL=modbus-collector.d.ts.map