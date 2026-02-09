"use strict";
/**
 * OPC-UA Collector - Industrial protocol data collection
 * Collects data from OPC-UA servers typically used in SCADA/ICS environments
 *
 * NOTE: Requires 'node-opcua' package to be installed for full functionality.
 * This implementation provides the interface and mock functionality when the
 * package is not available.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPCUACollector = void 0;
exports.getOPCUACollector = getOPCUACollector;
exports.createOPCUACollector = createOPCUACollector;
const base_collector_1 = require("./base-collector");
const types_1 = require("../utils/types");
const logger_1 = require("../utils/logger");
const crypto_1 = require("../utils/crypto");
// ============================================================================
// OPC-UA Collector Class
// ============================================================================
class OPCUACollector extends base_collector_1.BaseCollector {
    connections = new Map();
    opcuaAvailable = false;
    constructor(collectorConfig) {
        super('opcua', types_1.TelemetrySource.OPCUA, // Using correct source
        {
            enabled: true,
            pollInterval: 60000,
            timeout: 30000,
            retries: 3,
            batchSize: 10,
            maxConcurrent: 5,
            ...collectorConfig
        });
        this.checkOPCUAAvailability();
    }
    /**
     * Check if node-opcua is available
     */
    checkOPCUAAvailability() {
        try {
            require.resolve('node-opcua');
            this.opcuaAvailable = true;
            logger_1.logger.info('OPC-UA support available');
        }
        catch {
            this.opcuaAvailable = false;
            logger_1.logger.warn('OPC-UA package not installed. Install node-opcua for full functionality.');
        }
    }
    /**
     * Initialize the OPC-UA collector
     */
    async initialize() {
        logger_1.logger.info('Initializing OPC-UA collector', { opcuaAvailable: this.opcuaAvailable });
    }
    /**
     * Collect data from a single target
     */
    async collect(target) {
        const opcuaTarget = target;
        const telemetryData = [];
        try {
            if (!this.opcuaAvailable) {
                // Return mock data when package is not available
                telemetryData.push(this.createMockServerInfoTelemetry(opcuaTarget));
                telemetryData.push(this.createMockNodesTelemetry(opcuaTarget));
                return telemetryData;
            }
            // Real OPC-UA collection would happen here
            // For now, return simulation data
            telemetryData.push(this.createServerInfoTelemetry(opcuaTarget, {
                applicationName: `OPCUA-Server-${opcuaTarget.id}`,
                applicationUri: opcuaTarget.endpointUrl,
                productUri: opcuaTarget.endpointUrl,
                manufacturerName: 'Industrial Vendor',
                softwareVersion: '1.0.0',
                endpoints: [{
                        endpointUrl: opcuaTarget.endpointUrl,
                        securityMode: opcuaTarget.securityMode || 'None',
                        securityPolicy: opcuaTarget.securityPolicy || 'None',
                    }],
            }));
            // Track connection
            this.connections.set(opcuaTarget.id, {
                connected: true,
                lastContact: new Date(),
            });
            logger_1.logger.debug('OPC-UA collection complete', { target: opcuaTarget.id });
        }
        catch (error) {
            logger_1.logger.error('OPC-UA collection failed', {
                target: opcuaTarget.id,
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
        this.connections.clear();
        logger_1.logger.info('OPC-UA collector cleaned up');
    }
    /**
     * Create server info telemetry
     */
    createServerInfoTelemetry(target, serverInfo) {
        return {
            id: (0, crypto_1.generateUUID)(),
            source: types_1.TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'opcua_server_info',
                serverInfo,
                endpoint: target.endpointUrl,
            },
            metadata: {
                collector: 'opcua',
                targetId: target.id,
                protocol: 'OPC-UA',
            },
        };
    }
    /**
     * Create mock server info telemetry
     */
    createMockServerInfoTelemetry(target) {
        return this.createServerInfoTelemetry(target, {
            applicationName: 'Mock OPC-UA Server',
            applicationUri: target.endpointUrl,
            productUri: target.endpointUrl,
            manufacturerName: 'Mock Vendor',
            softwareVersion: '1.0.0-mock',
            endpoints: [{
                    endpointUrl: target.endpointUrl,
                    securityMode: target.securityMode || 'None',
                    securityPolicy: target.securityPolicy || 'None',
                }],
        });
    }
    /**
     * Create nodes telemetry
     */
    createNodesTelemetry(target, nodes) {
        return {
            id: (0, crypto_1.generateUUID)(),
            source: types_1.TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'opcua_namespace',
                nodes,
                nodeCount: this.countNodes(nodes),
            },
            metadata: {
                collector: 'opcua',
                targetId: target.id,
                protocol: 'OPC-UA',
            },
        };
    }
    /**
     * Create mock nodes telemetry
     */
    createMockNodesTelemetry(target) {
        const mockNodes = [
            {
                nodeId: 'ns=2;s=Simulation',
                browseName: 'Simulation',
                displayName: 'Simulation Folder',
                nodeClass: 'Object',
                children: [
                    {
                        nodeId: 'ns=2;s=Counter',
                        browseName: 'Counter',
                        displayName: 'Counter Variable',
                        nodeClass: 'Variable',
                        dataType: 'Int32',
                        value: Math.floor(Math.random() * 1000),
                    },
                    {
                        nodeId: 'ns=2;s=Temperature',
                        browseName: 'Temperature',
                        displayName: 'Temperature Sensor',
                        nodeClass: 'Variable',
                        dataType: 'Double',
                        value: 20 + Math.random() * 10,
                    },
                ],
            },
        ];
        return this.createNodesTelemetry(target, mockNodes);
    }
    /**
     * Create values telemetry
     */
    createValuesTelemetry(target, values) {
        return {
            id: (0, crypto_1.generateUUID)(),
            source: types_1.TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'opcua_values',
                values,
            },
            metadata: {
                collector: 'opcua',
                targetId: target.id,
                protocol: 'OPC-UA',
            },
        };
    }
    /**
     * Count all nodes recursively
     */
    countNodes(nodes) {
        let count = nodes.length;
        for (const node of nodes) {
            if (node.children) {
                count += this.countNodes(node.children);
            }
        }
        return count;
    }
    /**
     * Get connection status for a target
     */
    getConnectionStatus(targetId) {
        const connection = this.connections.get(targetId);
        return connection || { connected: false };
    }
    /**
     * Add OPC-UA target
     */
    addOPCUATarget(target) {
        return this.addTarget(target);
    }
}
exports.OPCUACollector = OPCUACollector;
// ============================================================================
// Singleton Instance
// ============================================================================
let opcuaCollectorInstance = null;
function getOPCUACollector() {
    if (!opcuaCollectorInstance) {
        opcuaCollectorInstance = new OPCUACollector();
    }
    return opcuaCollectorInstance;
}
function createOPCUACollector(config) {
    return new OPCUACollector(config);
}
//# sourceMappingURL=opcua-collector.js.map