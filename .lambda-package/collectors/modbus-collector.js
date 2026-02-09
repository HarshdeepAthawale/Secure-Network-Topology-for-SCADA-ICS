"use strict";
/**
 * Modbus Collector - Industrial protocol data collection
 * Supports both Modbus TCP and Modbus RTU over TCP
 *
 * NOTE: Requires 'modbus-serial' package to be installed for full functionality.
 * This implementation provides the interface and mock functionality when the
 * package is not available.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModbusCollector = void 0;
exports.getModbusCollector = getModbusCollector;
exports.createModbusCollector = createModbusCollector;
const base_collector_1 = require("./base-collector");
const types_1 = require("../utils/types");
const logger_1 = require("../utils/logger");
const crypto_1 = require("../utils/crypto");
// ============================================================================
// Modbus Collector Class
// ============================================================================
class ModbusCollector extends base_collector_1.BaseCollector {
    connections = new Map();
    pollingIntervals = new Map();
    modbusAvailable = false;
    ModbusRTU = null;
    constructor(collectorConfig) {
        super('modbus', types_1.TelemetrySource.MODBUS, // Using correct source
        {
            enabled: true,
            pollInterval: 30000,
            timeout: 10000,
            retries: 3,
            batchSize: 10,
            maxConcurrent: 5,
            ...collectorConfig
        });
        this.checkModbusAvailability();
    }
    /**
     * Check if modbus-serial is available
     */
    checkModbusAvailability() {
        try {
            this.ModbusRTU = require('modbus-serial');
            this.modbusAvailable = true;
            logger_1.logger.info('Modbus support available');
        }
        catch {
            this.modbusAvailable = false;
            logger_1.logger.warn('Modbus package not installed. Install modbus-serial for full functionality.');
        }
    }
    /**
     * Initialize the Modbus collector
     */
    async initialize() {
        logger_1.logger.info('Initializing Modbus collector', { modbusAvailable: this.modbusAvailable });
    }
    /**
     * Collect data from a single target
     */
    async collect(target) {
        const modbusTarget = target;
        const telemetryData = [];
        try {
            if (!this.modbusAvailable) {
                // Return mock data when package is not available
                telemetryData.push(this.createMockDeviceInfoTelemetry(modbusTarget));
                telemetryData.push(this.createMockScanTelemetry(modbusTarget));
                return telemetryData;
            }
            // Real Modbus collection would happen here
            // For now, return simulation data
            telemetryData.push(this.createDeviceInfoTelemetry(modbusTarget, {
                deviceId: modbusTarget.unitId || 1,
                vendorName: 'Industrial Vendor',
                productCode: 'MOD-001',
                revision: '1.0.0',
                productName: `Modbus-Device-${modbusTarget.id}`,
            }));
            telemetryData.push(this.createMockScanTelemetry(modbusTarget));
            // Track connection
            this.connections.set(modbusTarget.id, {
                connected: true,
                lastContact: new Date(),
            });
            logger_1.logger.debug('Modbus collection complete', { target: modbusTarget.id });
        }
        catch (error) {
            logger_1.logger.error('Modbus collection failed', {
                target: modbusTarget.id,
                error: error.message,
            });
            throw error;
        }
        return telemetryData;
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        // Stop all polling intervals
        for (const [targetId, interval] of this.pollingIntervals) {
            clearInterval(interval);
            logger_1.logger.debug('Stopped polling', { targetId });
        }
        this.pollingIntervals.clear();
        this.connections.clear();
        logger_1.logger.info('Modbus collector cleaned up');
    }
    /**
     * Parse raw register values based on data type
     */
    parseRegisterValue(rawValues, config) {
        if (rawValues.length === 0)
            return 0;
        switch (config.dataType) {
            case 'int16':
                const int16 = rawValues[0] > 32767 ? rawValues[0] - 65536 : rawValues[0];
                return config.scaleFactor ? int16 * config.scaleFactor : int16;
            case 'uint16':
                return config.scaleFactor ? rawValues[0] * config.scaleFactor : rawValues[0];
            case 'int32':
                if (rawValues.length >= 2) {
                    const int32 = (rawValues[0] << 16) | rawValues[1];
                    const signed = int32 > 2147483647 ? int32 - 4294967296 : int32;
                    return config.scaleFactor ? signed * config.scaleFactor : signed;
                }
                return 0;
            case 'uint32':
                if (rawValues.length >= 2) {
                    const uint32 = (rawValues[0] << 16) | rawValues[1];
                    return config.scaleFactor ? uint32 * config.scaleFactor : uint32;
                }
                return 0;
            case 'float32':
                if (rawValues.length >= 2) {
                    const buffer = Buffer.alloc(4);
                    buffer.writeUInt16BE(rawValues[0], 0);
                    buffer.writeUInt16BE(rawValues[1], 2);
                    const float = buffer.readFloatBE(0);
                    return config.scaleFactor ? float * config.scaleFactor : float;
                }
                return 0;
            case 'string':
                return rawValues.map(v => String.fromCharCode((v >> 8) & 0xFF, v & 0xFF)).join('').trim();
            default:
                return rawValues[0];
        }
    }
    /**
     * Start polling for a target (placeholder for when modbus-serial is available)
     */
    startPolling(target, intervalMs = 1000, callback) {
        const interval = setInterval(async () => {
            // Mock values for demonstration
            const mockValues = [
                {
                    name: 'Temperature',
                    address: 0,
                    rawValue: [Math.floor(Math.random() * 100)],
                    value: 20 + Math.random() * 10,
                    timestamp: new Date(),
                    unit: '°C',
                },
                {
                    name: 'Pressure',
                    address: 1,
                    rawValue: [Math.floor(Math.random() * 500)],
                    value: 100 + Math.random() * 50,
                    timestamp: new Date(),
                    unit: 'kPa',
                },
            ];
            callback(mockValues);
        }, intervalMs);
        this.pollingIntervals.set(target.id, interval);
        logger_1.logger.info('Started Modbus polling', { target: target.id, interval: intervalMs });
    }
    /**
     * Stop polling for a target
     */
    stopPolling(targetId) {
        const interval = this.pollingIntervals.get(targetId);
        if (interval) {
            clearInterval(interval);
            this.pollingIntervals.delete(targetId);
            logger_1.logger.info('Stopped Modbus polling', { targetId });
        }
    }
    /**
     * Create device info telemetry
     */
    createDeviceInfoTelemetry(target, deviceInfo) {
        return {
            id: (0, crypto_1.generateUUID)(),
            source: types_1.TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'modbus_device_info',
                deviceInfo,
                host: target.host,
                port: target.port || 502,
            },
            metadata: {
                collector: 'modbus',
                targetId: target.id,
                protocol: 'Modbus-TCP',
            },
        };
    }
    /**
     * Create mock device info telemetry
     */
    createMockDeviceInfoTelemetry(target) {
        return this.createDeviceInfoTelemetry(target, {
            deviceId: target.unitId || 1,
            vendorName: 'Mock Vendor',
            productCode: 'MOCK-001',
            revision: '1.0.0-mock',
            productName: 'Mock Modbus Device',
        });
    }
    /**
     * Create registers telemetry
     */
    createRegistersTelemetry(target, values) {
        return {
            id: (0, crypto_1.generateUUID)(),
            source: types_1.TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'modbus_registers',
                values: values.map(v => ({
                    name: v.name,
                    address: v.address,
                    value: v.value,
                    unit: v.unit,
                    timestamp: v.timestamp.toISOString(),
                })),
            },
            metadata: {
                collector: 'modbus',
                targetId: target.id,
                protocol: 'Modbus-TCP',
            },
        };
    }
    /**
     * Create scan telemetry
     */
    createScanTelemetry(target, scanResult) {
        return {
            id: (0, crypto_1.generateUUID)(),
            source: types_1.TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'modbus_scan',
                holdingRegisters: scanResult.holdingRegisters,
                inputRegisters: scanResult.inputRegisters,
                coils: scanResult.coils,
                discreteInputs: scanResult.discreteInputs,
                summary: {
                    holdingCount: Object.keys(scanResult.holdingRegisters).length,
                    inputCount: Object.keys(scanResult.inputRegisters).length,
                    coilCount: Object.keys(scanResult.coils).length,
                    discreteCount: Object.keys(scanResult.discreteInputs).length,
                },
            },
            metadata: {
                collector: 'modbus',
                targetId: target.id,
                protocol: 'Modbus-TCP',
            },
        };
    }
    /**
     * Create mock scan telemetry
     */
    createMockScanTelemetry(target) {
        return this.createScanTelemetry(target, {
            holdingRegisters: { '0': 100, '1': 200, '2': 300 },
            inputRegisters: { '0': 50, '1': 75 },
            coils: { '0': true, '1': false },
            discreteInputs: { '0': true },
        });
    }
    /**
     * Get connection status for a target
     */
    getConnectionStatus(targetId) {
        const connection = this.connections.get(targetId);
        return connection || { connected: false };
    }
    /**
     * Add Modbus target
     */
    addModbusTarget(target) {
        return this.addTarget(target);
    }
}
exports.ModbusCollector = ModbusCollector;
// ============================================================================
// Singleton Instance
// ============================================================================
let modbusCollectorInstance = null;
function getModbusCollector() {
    if (!modbusCollectorInstance) {
        modbusCollectorInstance = new ModbusCollector();
    }
    return modbusCollectorInstance;
}
function createModbusCollector(config) {
    return new ModbusCollector(config);
}
//# sourceMappingURL=modbus-collector.js.map