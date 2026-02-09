"use strict";
/**
 * MQTT Ingest Processor - Subscribes to MQTT telemetry topic,
 * processes through the existing pipeline, and stores in PostgreSQL
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MQTTIngestProcessor = void 0;
const mqtt = __importStar(require("mqtt"));
const connection_1 = require("../database/connection");
const device_repository_1 = require("../database/repositories/device.repository");
const connection_repository_1 = require("../database/repositories/connection.repository");
const telemetry_repository_1 = require("../database/repositories/telemetry.repository");
const alert_repository_1 = require("../database/repositories/alert.repository");
const snmp_parser_1 = require("../processors/parsers/snmp-parser");
const arp_parser_1 = require("../processors/parsers/arp-parser");
const netflow_parser_1 = require("../processors/parsers/netflow-parser");
const syslog_parser_1 = require("../processors/parsers/syslog-parser");
const types_1 = require("../utils/types");
const crypto_1 = require("../utils/crypto");
const logger_1 = require("../utils/logger");
// ============================================================================
// MQTT Ingest Processor
// ============================================================================
class MQTTIngestProcessor {
    client = null;
    brokerUrl;
    topic;
    processedCount = 0;
    deviceIpMap = new Map(); // IP -> device ID cache
    constructor(brokerUrl = 'mqtt://localhost:1883', topic = 'scada/telemetry') {
        this.brokerUrl = brokerUrl;
        this.topic = topic;
    }
    async start() {
        logger_1.logger.info('Starting MQTT ingest processor', { broker: this.brokerUrl, topic: this.topic });
        // Initialize database connection
        await (0, connection_1.initializeDatabase)();
        logger_1.logger.info('Database connection established');
        // Connect to MQTT
        this.client = mqtt.connect(this.brokerUrl, {
            clientId: `scada-ingest-${process.pid}`,
            clean: true,
            reconnectPeriod: 5000,
        });
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('MQTT connection timeout')), 10000);
            this.client.on('connect', () => {
                clearTimeout(timeout);
                logger_1.logger.info('Ingest processor connected to MQTT broker');
                resolve();
            });
            this.client.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        // Subscribe to telemetry topic
        this.client.subscribe(this.topic, { qos: 1 }, (err) => {
            if (err) {
                logger_1.logger.error('Failed to subscribe', { error: err.message });
            }
            else {
                logger_1.logger.info(`Subscribed to ${this.topic}`);
            }
        });
        // Handle incoming messages
        this.client.on('message', async (_topic, payload) => {
            try {
                const message = JSON.parse(payload.toString());
                await this.processMessage(message);
            }
            catch (err) {
                logger_1.logger.error('Failed to process message', { error: err.message });
            }
        });
        logger_1.logger.info('MQTT ingest processor is running. Waiting for telemetry...');
    }
    async stop() {
        if (this.client) {
            this.client.end();
            this.client = null;
        }
        await (0, connection_1.closeDatabase)();
        logger_1.logger.info(`Ingest processor stopped. Total processed: ${this.processedCount}`);
    }
    // --------------------------------------------------------------------------
    // Message Processing
    // --------------------------------------------------------------------------
    async processMessage(message) {
        const source = message.source;
        const telemetry = this.reconstituteTelemetry(message);
        // Store raw telemetry
        const telemetryRepo = (0, telemetry_repository_1.getTelemetryRepository)();
        await telemetryRepo.insertTelemetry({
            id: telemetry.id,
            source: telemetry.source,
            timestamp: telemetry.timestamp,
            data: telemetry.data,
            processed: false,
            metadata: telemetry.metadata,
        });
        // Process based on source type
        switch (source) {
            case types_1.TelemetrySource.SNMP:
                await this.processSNMP(telemetry);
                break;
            case types_1.TelemetrySource.ARP:
                await this.processARP(telemetry);
                break;
            case types_1.TelemetrySource.NETFLOW:
                await this.processNetFlow(telemetry);
                break;
            case types_1.TelemetrySource.SYSLOG:
                await this.processSyslog(telemetry);
                break;
            default:
                logger_1.logger.debug(`Unknown telemetry source: ${source}`);
        }
        // Mark telemetry as processed
        await telemetryRepo.markProcessed(telemetry.id);
        this.processedCount++;
        if (this.processedCount % 10 === 0) {
            logger_1.logger.info(`Processed ${this.processedCount} telemetry messages`);
        }
    }
    // --------------------------------------------------------------------------
    // Reconstitute Telemetry from JSON
    // --------------------------------------------------------------------------
    reconstituteTelemetry(msg) {
        return {
            id: msg.id || (0, crypto_1.generateUUID)(),
            source: msg.source,
            timestamp: new Date(msg.timestamp),
            data: msg.data,
            processed: false,
            metadata: msg.metadata || {},
        };
    }
    // --------------------------------------------------------------------------
    // SNMP Processing -> Upsert Devices
    // --------------------------------------------------------------------------
    async processSNMP(telemetry) {
        const parsed = snmp_parser_1.snmpParser.parse(telemetry);
        if (!parsed)
            return;
        const device = snmp_parser_1.snmpParser.toDevice(parsed);
        const deviceRepo = (0, device_repository_1.getDeviceRepository)();
        try {
            // Try to find existing device by name
            const existing = await deviceRepo.findAll({ limit: 1 });
            const existingByName = (await deviceRepo.search({ searchTerm: device.name })).data;
            if (existingByName.length > 0) {
                // Update last seen
                await deviceRepo.updateLastSeen(existingByName[0].id);
                this.deviceIpMap.set(this.extractIpFromInterfaces(parsed.interfaces) || device.name, existingByName[0].id);
            }
            else {
                // Create new device
                const created = await deviceRepo.create({
                    name: device.name,
                    hostname: device.hostname,
                    type: device.type,
                    vendor: device.vendor,
                    model: device.model,
                    purdueLevel: device.purdueLevel,
                    securityZone: device.securityZone,
                    status: types_1.DeviceStatus.ONLINE,
                    metadata: device.metadata,
                    discoveredAt: new Date(),
                    lastSeenAt: new Date(),
                });
                logger_1.logger.info(`New device discovered: ${created.name} (${created.type}) at Purdue Level ${created.purdueLevel}`);
            }
        }
        catch (err) {
            logger_1.logger.error('Error processing SNMP device', { error: err.message, device: device.name });
        }
    }
    extractIpFromInterfaces(interfaces) {
        for (const iface of interfaces) {
            if (iface.ipAddress)
                return iface.ipAddress;
        }
        return undefined;
    }
    // --------------------------------------------------------------------------
    // ARP Processing -> Update device IP/MAC mapping
    // --------------------------------------------------------------------------
    async processARP(telemetry) {
        const { arpEntries } = arp_parser_1.arpParser.parse(telemetry);
        if (arpEntries.length === 0)
            return;
        // Build L2 topology from ARP entries
        const l2 = arp_parser_1.arpParser.buildL2Topology(arpEntries, []);
        logger_1.logger.debug(`ARP: ${arpEntries.length} entries, ${l2.devices.length} L2 devices`);
        // Update device IP cache
        for (const entry of arpEntries) {
            // Store IP->MAC mapping for future lookups
            const deviceRepo = (0, device_repository_1.getDeviceRepository)();
            try {
                const device = await deviceRepo.findByIpAddress(entry.ipAddress);
                if (device) {
                    this.deviceIpMap.set(entry.ipAddress, device.id);
                    await deviceRepo.updateLastSeen(device.id);
                }
            }
            catch {
                // Device not found by IP, that's fine
            }
        }
    }
    // --------------------------------------------------------------------------
    // NetFlow Processing -> Create Connections
    // --------------------------------------------------------------------------
    async processNetFlow(telemetry) {
        // Reconstitute Date objects from JSON strings for NetFlow records
        const data = telemetry.data;
        if (data.type === 'netflow' && Array.isArray(data.flows)) {
            data.flows = data.flows.map(flow => ({
                ...flow,
                startTime: new Date(flow.startTime),
                endTime: new Date(flow.endTime),
            }));
        }
        const parsedFlows = netflow_parser_1.netflowParser.parse(telemetry);
        if (parsedFlows.length === 0)
            return;
        const connRepo = (0, connection_repository_1.getConnectionRepository)();
        const deviceRepo = (0, device_repository_1.getDeviceRepository)();
        let newConnections = 0;
        for (const flow of parsedFlows) {
            try {
                // Resolve source and destination device IDs
                const srcDeviceId = await this.resolveDeviceId(flow.srcAddress, deviceRepo);
                const dstDeviceId = await this.resolveDeviceId(flow.dstAddress, deviceRepo);
                if (!srcDeviceId || !dstDeviceId)
                    continue;
                if (srcDeviceId === dstDeviceId)
                    continue;
                // Upsert connection
                await connRepo.upsertConnection({
                    sourceDeviceId: srcDeviceId,
                    targetDeviceId: dstDeviceId,
                    connectionType: types_1.ConnectionType.ETHERNET,
                    protocol: flow.industrialProtocol || flow.protocol,
                    port: flow.dstPort,
                    bandwidth: flow.bytesPerSecond * 8 / 1000000,
                    isSecure: flow.dstPort === 443 || flow.dstPort === 8883 || flow.dstPort === 4840,
                    encryptionType: flow.dstPort === 443 ? 'TLS' : undefined,
                    discoveredAt: flow.startTime,
                    lastSeenAt: flow.endTime,
                    metadata: {
                        bytes: flow.bytes,
                        packets: flow.packets,
                        isIndustrial: flow.isIndustrial,
                    },
                });
                newConnections++;
            }
            catch (err) {
                // Skip individual flow errors silently to not flood logs
            }
        }
        if (newConnections > 0) {
            logger_1.logger.debug(`NetFlow: processed ${parsedFlows.length} flows, ${newConnections} connections upserted`);
        }
    }
    async resolveDeviceId(ipAddress, deviceRepo) {
        // Check cache first
        const cached = this.deviceIpMap.get(ipAddress);
        if (cached)
            return cached;
        // Look up in database
        try {
            const device = await deviceRepo.findByIpAddress(ipAddress);
            if (device) {
                this.deviceIpMap.set(ipAddress, device.id);
                return device.id;
            }
        }
        catch {
            // Not found
        }
        return null;
    }
    // --------------------------------------------------------------------------
    // Syslog Processing -> Create Alerts
    // --------------------------------------------------------------------------
    async processSyslog(telemetry) {
        // Reconstitute Date objects from JSON strings for syslog messages
        const data = telemetry.data;
        if (Array.isArray(data.messages)) {
            data.messages = data.messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
            }));
        }
        const events = syslog_parser_1.syslogParser.parse(telemetry);
        if (events.length === 0)
            return;
        const alertRepo = (0, alert_repository_1.getAlertRepository)();
        let newAlerts = 0;
        for (const event of events) {
            const alert = syslog_parser_1.syslogParser.toAlert(event);
            if (!alert)
                continue;
            try {
                // Resolve device ID from hostname
                const deviceRepo = (0, device_repository_1.getDeviceRepository)();
                const device = (await deviceRepo.search({ searchTerm: event.hostname })).data;
                await alertRepo.create({
                    type: alert.type,
                    severity: alert.severity,
                    title: alert.title,
                    description: alert.description,
                    deviceId: device.length > 0 ? device[0].id : undefined,
                    details: alert.details,
                });
                newAlerts++;
            }
            catch (err) {
                logger_1.logger.error('Error creating alert', { error: err.message });
            }
        }
        if (newAlerts > 0) {
            logger_1.logger.info(`Syslog: ${events.length} events parsed, ${newAlerts} alerts created`);
        }
    }
}
exports.MQTTIngestProcessor = MQTTIngestProcessor;
// ============================================================================
// Standalone Entry Point
// ============================================================================
if (require.main === module) {
    const processor = new MQTTIngestProcessor();
    const shutdown = async () => {
        logger_1.logger.info('Shutting down ingest processor...');
        await processor.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    processor.start().catch(err => {
        logger_1.logger.error('Failed to start ingest processor', { error: err.message });
        process.exit(1);
    });
}
//# sourceMappingURL=mqtt-ingest.js.map