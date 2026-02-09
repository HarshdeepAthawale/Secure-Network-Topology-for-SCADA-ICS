"use strict";
/**
 * Processing Lambda - Correlation and topology analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const types_1 = require("../../utils/types");
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
const snmp_parser_1 = require("../../processors/parsers/snmp-parser");
const netflow_parser_1 = require("../../processors/parsers/netflow-parser");
const syslog_parser_1 = require("../../processors/parsers/syslog-parser");
const arp_parser_1 = require("../../processors/parsers/arp-parser");
const device_correlator_1 = require("../../processors/correlation/device-correlator");
const topology_builder_1 = require("../../processors/correlation/topology-builder");
const purdue_classifier_1 = require("../../processors/classification/purdue-classifier");
const risk_analyzer_1 = require("../../processors/risk/risk-analyzer");
const database_1 = require("../../database");
const handler = async (event) => {
    const batchId = (0, crypto_1.generateUUID)();
    logger_1.logger.setContext({ batchId, function: 'process' });
    logger_1.logger.info('Processing telemetry batch', { recordCount: event.Records.length });
    const result = {
        batchId,
        recordsProcessed: 0,
        devicesDiscovered: 0,
        connectionsDiscovered: 0,
        alertsGenerated: 0,
        errors: [],
    };
    const deviceCandidates = [];
    const alerts = [];
    for (const record of event.Records) {
        try {
            const telemetry = parseSQSRecord(record);
            if (!telemetry)
                continue;
            const { candidates, newAlerts } = processTelemetry(telemetry);
            deviceCandidates.push(...candidates);
            alerts.push(...newAlerts);
            result.recordsProcessed++;
        }
        catch (error) {
            result.errors.push(`Record ${record.messageId}: ${error.message}`);
            logger_1.logger.error('Failed to process record', { messageId: record.messageId, error: error.message });
        }
    }
    // Correlate devices
    if (deviceCandidates.length > 0) {
        const correlationResults = device_correlator_1.deviceCorrelator.correlate(deviceCandidates);
        for (const correlation of correlationResults) {
            // Classify device
            const classification = purdue_classifier_1.purdueClassifier.classify(correlation.device);
            correlation.device.purdueLevel = classification.assignedLevel;
            correlation.device.securityZone = classification.assignedZone;
            // Add to topology
            topology_builder_1.topologyBuilder.addDevice(correlation.device);
            result.devicesDiscovered++;
            // Analyze risk
            const connections = topology_builder_1.topologyBuilder.getDeviceConnections(correlation.device.id);
            const riskAssessment = risk_analyzer_1.riskAnalyzer.analyzeDevice(correlation.device, connections);
            const riskAlert = risk_analyzer_1.riskAnalyzer.createAlertFromAssessment(riskAssessment, correlation.device);
            if (riskAlert) {
                alerts.push(riskAlert);
            }
        }
    }
    // Store alerts
    result.alertsGenerated = alerts.length;
    if (alerts.length > 0) {
        await storeAlerts(alerts);
    }
    // Create topology snapshot periodically
    const snapshot = topology_builder_1.topologyBuilder.createSnapshot();
    await storeTopologySnapshot(snapshot);
    logger_1.logger.info('Processing complete', result);
};
exports.handler = handler;
function parseSQSRecord(record) {
    try {
        return JSON.parse(record.body);
    }
    catch {
        return null;
    }
}
function processTelemetry(telemetry) {
    const candidates = [];
    const newAlerts = [];
    switch (telemetry.source) {
        case types_1.TelemetrySource.SNMP: {
            const parsed = snmp_parser_1.snmpParser.parse(telemetry);
            if (parsed) {
                candidates.push({
                    source: 'snmp',
                    hostname: parsed.sysName,
                    sysName: parsed.sysName,
                    vendor: parsed.vendor,
                    model: parsed.model,
                    deviceType: parsed.deviceType,
                    interfaces: parsed.interfaces,
                    confidence: 80,
                    metadata: { sysDescr: parsed.sysDescr },
                });
            }
            break;
        }
        case types_1.TelemetrySource.ARP: {
            const { arpEntries, macEntries } = arp_parser_1.arpParser.parse(telemetry);
            const topology = arp_parser_1.arpParser.buildL2Topology(arpEntries, macEntries);
            for (const l2Device of topology.devices) {
                candidates.push({
                    source: 'arp',
                    macAddress: l2Device.macAddress,
                    ipAddress: l2Device.ipAddresses[0],
                    vendor: l2Device.vendor,
                    confidence: 60,
                });
            }
            break;
        }
        case types_1.TelemetrySource.NETFLOW: {
            const flows = netflow_parser_1.netflowParser.parse(telemetry);
            for (const flow of flows) {
                // Create candidates for source and destination
                candidates.push({
                    source: 'netflow',
                    ipAddress: flow.srcAddress,
                    confidence: 40,
                    metadata: { role: 'source', protocol: flow.protocol },
                });
                candidates.push({
                    source: 'netflow',
                    ipAddress: flow.dstAddress,
                    confidence: 40,
                    metadata: { role: 'destination', protocol: flow.protocol },
                });
            }
            break;
        }
        case types_1.TelemetrySource.SYSLOG: {
            const events = syslog_parser_1.syslogParser.parse(telemetry);
            for (const event of events) {
                const alert = syslog_parser_1.syslogParser.toAlert(event);
                if (alert) {
                    newAlerts.push(alert);
                }
                if (event.extractedData.sourceIP) {
                    candidates.push({
                        source: 'syslog',
                        ipAddress: event.extractedData.sourceIP,
                        hostname: event.hostname,
                        confidence: 50,
                    });
                }
            }
            break;
        }
    }
    return { candidates, newAlerts };
}
async function storeAlerts(alerts) {
    if (alerts.length === 0)
        return;
    try {
        await (0, database_1.initializeDatabase)();
        const alertRepo = (0, database_1.getAlertRepository)();
        for (const alert of alerts) {
            await alertRepo.create({
                id: alert.id,
                type: alert.type,
                severity: alert.severity,
                title: alert.title,
                description: alert.description,
                deviceId: alert.deviceId,
                connectionId: alert.connectionId,
                details: alert.details,
                remediation: alert.remediation,
            });
        }
        logger_1.logger.info('Alerts stored successfully', { count: alerts.length });
    }
    catch (error) {
        logger_1.logger.error('Failed to store alerts', {
            count: alerts.length,
            error: error.message
        });
        throw error;
    }
}
async function storeTopologySnapshot(snapshot) {
    try {
        await (0, database_1.initializeDatabase)();
        const snapshotRepo = (0, database_1.getTopologySnapshotRepository)();
        const typedSnapshot = snapshot;
        await snapshotRepo.createSnapshot({
            id: typedSnapshot.id,
            timestamp: new Date(),
            devices: typedSnapshot.devices,
            connections: typedSnapshot.connections,
            zones: typedSnapshot.zones,
            metadata: typedSnapshot.metadata,
        });
        logger_1.logger.info('Topology snapshot stored successfully', {
            id: typedSnapshot.id,
            devices: typedSnapshot.metadata.deviceCount,
            connections: typedSnapshot.metadata.connectionCount,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to store topology snapshot', {
            error: error.message
        });
        throw error;
    }
}
async function storeDevice(device) {
    try {
        await (0, database_1.initializeDatabase)();
        const deviceRepo = (0, database_1.getDeviceRepository)();
        await deviceRepo.upsertByIdentifier({
            id: device.id,
            name: device.name,
            hostname: device.hostname,
            type: device.type,
            vendor: device.vendor,
            model: device.model,
            firmwareVersion: device.firmwareVersion,
            serialNumber: device.serialNumber,
            purdueLevel: device.purdueLevel,
            securityZone: device.securityZone,
            status: device.status,
            interfaces: device.interfaces,
            location: device.location,
            metadata: device.metadata,
            discoveredAt: device.discoveredAt,
            lastSeenAt: device.lastSeenAt,
        }, 'hostname');
        logger_1.logger.debug('Device stored', { id: device.id, name: device.name });
    }
    catch (error) {
        logger_1.logger.error('Failed to store device', {
            id: device.id,
            error: error.message
        });
        throw error;
    }
}
//# sourceMappingURL=handler.js.map