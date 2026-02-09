"use strict";
/**
 * Collector Manager - Orchestrates all telemetry collectors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectorManager = void 0;
exports.getCollectorManager = getCollectorManager;
exports.resetCollectorManager = resetCollectorManager;
const events_1 = require("events");
const snmp_collector_1 = require("./snmp-collector");
const arp_collector_1 = require("./arp-collector");
const netflow_collector_1 = require("./netflow-collector");
const syslog_collector_1 = require("./syslog-collector");
const routing_collector_1 = require("./routing-collector");
const opcua_collector_1 = require("./opcua-collector");
const modbus_collector_1 = require("./modbus-collector");
const types_1 = require("../utils/types");
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
const mqtt_client_1 = require("../utils/mqtt-client");
// ============================================================================
// Collector Manager Class
// ============================================================================
class CollectorManager extends events_1.EventEmitter {
    collectors = new Map();
    isRunning = false;
    startedAt;
    healthCheckInterval;
    constructor(managerConfig = {}) {
        super();
        this.initializeCollectors(managerConfig);
    }
    initializeCollectors(managerConfig) {
        if (managerConfig.snmp?.enabled !== false) {
            const snmpCollector = (0, snmp_collector_1.createSNMPCollector)(managerConfig.snmp);
            this.collectors.set(types_1.TelemetrySource.SNMP, snmpCollector);
            this.setupCollectorEvents(snmpCollector);
        }
        if (managerConfig.arp?.enabled !== false) {
            const arpCollector = (0, arp_collector_1.createARPCollector)(managerConfig.arp);
            this.collectors.set(types_1.TelemetrySource.ARP, arpCollector);
            this.setupCollectorEvents(arpCollector);
        }
        if (managerConfig.netflow?.enabled !== false) {
            const netflowCollector = (0, netflow_collector_1.createNetFlowCollector)(managerConfig.netflow);
            this.collectors.set(types_1.TelemetrySource.NETFLOW, netflowCollector);
            this.setupCollectorEvents(netflowCollector);
        }
        if (managerConfig.syslog?.enabled !== false) {
            const syslogCollector = (0, syslog_collector_1.createSyslogCollector)(managerConfig.syslog);
            this.collectors.set(types_1.TelemetrySource.SYSLOG, syslogCollector);
            this.setupCollectorEvents(syslogCollector);
        }
        if (managerConfig.routing?.enabled !== false) {
            const routingCollector = (0, routing_collector_1.createRoutingCollector)(managerConfig.routing);
            this.collectors.set(types_1.TelemetrySource.ROUTING, routingCollector);
            this.setupCollectorEvents(routingCollector);
        }
        if (managerConfig.opcua?.enabled !== false) {
            const opcuaCollector = (0, opcua_collector_1.createOPCUACollector)(managerConfig.opcua);
            this.collectors.set(types_1.TelemetrySource.OPCUA, opcuaCollector);
            this.setupCollectorEvents(opcuaCollector);
        }
        if (managerConfig.modbus?.enabled !== false) {
            const modbusCollector = (0, modbus_collector_1.createModbusCollector)(managerConfig.modbus);
            this.collectors.set(types_1.TelemetrySource.MODBUS, modbusCollector);
            this.setupCollectorEvents(modbusCollector);
        }
        logger_1.logger.info('Collectors initialized', {
            count: this.collectors.size,
            types: Array.from(this.collectors.keys()),
        });
    }
    setupCollectorEvents(collector) {
        collector.on('started', () => this.emit('collectorStarted', collector.getStatus()));
        collector.on('stopped', () => this.emit('collectorStopped', collector.getStatus()));
        collector.on('polled', (data) => this.emit('telemetryCollected', { source: collector.getStatus().source, ...data }));
        collector.on('data', (data) => this.emit('data', data));
        collector.on('error', (error) => this.emit('error', { source: collector.getStatus().source, error }));
    }
    async start() {
        if (this.isRunning)
            return;
        logger_1.logger.info('Starting collector manager');
        const mqttClient = (0, mqtt_client_1.getMQTTClient)();
        if (config_1.config.mqtt.endpoint) {
            try {
                await mqttClient.connect();
            }
            catch (error) {
                logger_1.logger.warn('MQTT connection failed', { error: error.message });
            }
        }
        const startPromises = Array.from(this.collectors.values()).map(collector => collector.start().catch(error => {
            logger_1.logger.error('Failed to start collector', { collector: collector.getStatus().name, error: error.message });
        }));
        await Promise.all(startPromises);
        this.isRunning = true;
        this.startedAt = new Date();
        this.startHealthCheck();
        this.emit('started');
        logger_1.logger.info('Collector manager started', { collectors: this.collectors.size });
    }
    async stop() {
        if (!this.isRunning)
            return;
        logger_1.logger.info('Stopping collector manager');
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
        const stopPromises = Array.from(this.collectors.values()).map(collector => collector.stop().catch(error => {
            logger_1.logger.error('Error stopping collector', { collector: collector.getStatus().name, error: error.message });
        }));
        await Promise.all(stopPromises);
        await (0, mqtt_client_1.getMQTTClient)().disconnect();
        this.isRunning = false;
        this.emit('stopped');
        logger_1.logger.info('Collector manager stopped');
    }
    async restart() {
        await this.stop();
        await this.start();
    }
    startHealthCheck() {
        this.healthCheckInterval = setInterval(() => this.performHealthCheck(), 30000);
    }
    performHealthCheck() {
        const statuses = this.getCollectorStatuses();
        const unhealthy = statuses.filter(s => !s.isRunning);
        if (unhealthy.length > 0) {
            logger_1.logger.warn('Unhealthy collectors detected', { unhealthy: unhealthy.map(s => s.name) });
        }
        this.emit('healthCheck', { statuses, unhealthyCount: unhealthy.length });
    }
    getCollector(source) {
        return this.collectors.get(source);
    }
    get snmp() { return this.getCollector(types_1.TelemetrySource.SNMP); }
    get arp() { return this.getCollector(types_1.TelemetrySource.ARP); }
    get netflow() { return this.getCollector(types_1.TelemetrySource.NETFLOW); }
    get syslog() { return this.getCollector(types_1.TelemetrySource.SYSLOG); }
    get routing() { return this.getCollector(types_1.TelemetrySource.ROUTING); }
    get opcua() { return this.getCollector(types_1.TelemetrySource.OPCUA); }
    get modbus() { return this.getCollector(types_1.TelemetrySource.MODBUS); }
    getCollectorStatuses() {
        return Array.from(this.collectors.values()).map(c => c.getStatus());
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            startedAt: this.startedAt,
            collectors: this.getCollectorStatuses(),
            mqttConnected: (0, mqtt_client_1.getMQTTClient)().connected,
        };
    }
    getStatistics() {
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
exports.CollectorManager = CollectorManager;
let managerInstance = null;
function getCollectorManager(cfg) {
    if (!managerInstance)
        managerInstance = new CollectorManager(cfg);
    return managerInstance;
}
function resetCollectorManager() {
    if (managerInstance) {
        managerInstance.stop().catch(() => { });
        managerInstance = null;
    }
}
if (require.main === module) {
    const manager = getCollectorManager();
    process.on('SIGINT', async () => { await manager.stop(); process.exit(0); });
    process.on('SIGTERM', async () => { await manager.stop(); process.exit(0); });
    manager.start().catch(error => { logger_1.logger.error('Failed to start', { error: error.message }); process.exit(1); });
}
//# sourceMappingURL=collector-manager.js.map