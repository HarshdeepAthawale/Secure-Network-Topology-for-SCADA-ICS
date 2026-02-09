"use strict";
/**
 * Data Generator Lambda - Generates SCADA telemetry data and publishes to IoT Core MQTT
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
exports.handler = handler;
const AWS = __importStar(require("aws-sdk"));
const types_1 = require("../../utils/types");
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
// Initialize IoT Data Plane client (AWS SDK v2)
// Note: endpoint must be set without protocol
const getIoTDataClient = () => {
    const endpoint = process.env.IOT_ENDPOINT;
    if (!endpoint) {
        throw new Error('IOT_ENDPOINT environment variable is required');
    }
    // Remove protocol if present
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '').replace(/^mqtts?:\/\//, '');
    return new AWS.IotData({ endpoint: cleanEndpoint, region: process.env.AWS_REGION || 'ap-south-1' });
};
// IoT Core endpoint (set via environment variable)
const IOT_ENDPOINT = process.env.IOT_ENDPOINT || '';
const TELEMETRY_TOPIC = process.env.TELEMETRY_TOPIC || 'scada/telemetry';
const SIMULATED_DEVICES = [
    { name: 'TEMP-SENSOR-001', ip: '10.0.1.10', mac: '74:da:ea:01:00:01', type: 'sensor', vendor: 'Texas Instruments', model: 'TMP117', purdueLevel: 0, sysDescr: 'TI TMP117 Temperature Sensor v2.1' },
    { name: 'PRESS-SENSOR-002', ip: '10.0.1.11', mac: '74:da:ea:01:00:02', type: 'sensor', vendor: 'Texas Instruments', model: 'DRV425', purdueLevel: 0, sysDescr: 'TI DRV425 Pressure Transmitter v1.4' },
    { name: 'FLOW-SENSOR-003', ip: '10.0.1.12', mac: '68:dd:b7:01:00:03', type: 'sensor', vendor: 'Honeywell', model: 'ST800', purdueLevel: 0, sysDescr: 'Honeywell ST800 SmartLine Flow Transmitter' },
    { name: 'VALVE-ACT-001', ip: '10.0.1.20', mac: '68:dd:b7:01:00:04', type: 'actuator', vendor: 'Honeywell', model: 'HPS-V200', purdueLevel: 0, sysDescr: 'Honeywell HPS Valve Actuator v3.0' },
    { name: 'VFD-DRIVE-001', ip: '10.0.1.30', mac: '00:1a:4b:01:00:05', type: 'variable_drive', vendor: 'Siemens', model: 'G120', purdueLevel: 0, sysDescr: 'Siemens SINAMICS G120 Variable Frequency Drive' },
    { name: 'PLC-MAIN-001', ip: '10.1.1.10', mac: '00:1a:4b:02:00:01', type: 'plc', vendor: 'Siemens', model: 'S7-1500', purdueLevel: 1, sysDescr: 'Siemens S7-1500 PLC CPU 1516-3 PN/DP FW V2.9' },
    { name: 'PLC-AUX-002', ip: '10.1.1.11', mac: '2c:a8:35:02:00:02', type: 'plc', vendor: 'Rockwell Automation', model: 'ControlLogix 5580', purdueLevel: 1, sysDescr: 'Allen-Bradley ControlLogix 5580 Controller v33' },
    { name: 'RTU-FIELD-001', ip: '10.1.1.20', mac: '00:1a:4b:02:00:03', type: 'rtu', vendor: 'Siemens', model: 'SICAM A8000', purdueLevel: 1, sysDescr: 'Siemens SICAM A8000 RTU CP-8050' },
    { name: 'DCS-CTRL-001', ip: '10.1.1.30', mac: '68:dd:b7:02:00:04', type: 'dcs', vendor: 'Honeywell', model: 'Experion PKS', purdueLevel: 1, sysDescr: 'Honeywell Experion PKS DCS Controller C300' },
    { name: 'SCADA-SRV-001', ip: '10.2.1.10', mac: '8c:dc:d4:03:00:01', type: 'scada_server', vendor: 'Cisco', model: 'UCS-C220', purdueLevel: 2, sysDescr: 'Cisco UCS C220 M5 - SCADA Server ClearSCADA v6.8' },
    { name: 'HMI-OP-001', ip: '10.2.1.20', mac: '00:1a:4b:03:00:02', type: 'hmi', vendor: 'Siemens', model: 'TP1900', purdueLevel: 2, sysDescr: 'Siemens HMI TP1900 Comfort Panel v16' },
    { name: 'HMI-OP-002', ip: '10.2.1.21', mac: '2c:a8:35:03:00:03', type: 'hmi', vendor: 'Rockwell Automation', model: 'PanelView Plus 7', purdueLevel: 2, sysDescr: 'Allen-Bradley PanelView Plus 7 Standard v12' },
    { name: 'ALARM-SRV-001', ip: '10.2.1.30', mac: '8c:dc:d4:03:00:04', type: 'alarm_server', vendor: 'Cisco', model: 'UCS-C240', purdueLevel: 2, sysDescr: 'Cisco UCS C240 - Alarm Server Iconics Genesis64' },
    { name: 'L2-SWITCH-001', ip: '10.2.1.254', mac: '58:8d:09:03:00:05', type: 'switch', vendor: 'Cisco', model: 'IE-4010', purdueLevel: 2, sysDescr: 'Cisco IE-4010-4S24P Industrial Ethernet Switch IOS 15.2' },
    { name: 'HISTORIAN-001', ip: '10.3.1.10', mac: '64:00:6a:04:00:01', type: 'historian', vendor: 'Dell', model: 'PowerEdge R750', purdueLevel: 3, sysDescr: 'Dell PowerEdge R750 - OSIsoft PI Server 2021' },
    { name: 'MES-SRV-001', ip: '10.3.1.20', mac: '64:00:6a:04:00:02', type: 'mes', vendor: 'Dell', model: 'PowerEdge R650', purdueLevel: 3, sysDescr: 'Dell PowerEdge R650 - Siemens Opcenter MES v2022' },
    { name: 'ENG-WS-001', ip: '10.3.1.30', mac: '64:00:6a:04:00:03', type: 'engineering_workstation', vendor: 'Dell', model: 'Precision 5820', purdueLevel: 3, sysDescr: 'Dell Precision 5820 - Engineering Workstation TIA Portal v18' },
    { name: 'L3-ROUTER-001', ip: '10.3.1.254', mac: '58:8d:09:04:00:04', type: 'router', vendor: 'Cisco', model: 'ISR-4331', purdueLevel: 3, sysDescr: 'Cisco ISR 4331 Router IOS-XE 17.6' },
    { name: 'DMZ-FW-001', ip: '10.99.1.1', mac: '58:8d:09:99:00:01', type: 'firewall', vendor: 'Cisco', model: 'ASA-5525', purdueLevel: 99, sysDescr: 'Cisco ASA 5525-X Adaptive Security Appliance v9.16' },
    { name: 'DMZ-FW-002', ip: '10.99.1.2', mac: '58:8d:09:99:00:02', type: 'firewall', vendor: 'Cisco', model: 'Firepower 2130', purdueLevel: 99, sysDescr: 'Cisco Firepower 2130 NGFW FTD v7.2' },
    { name: 'JUMP-SRV-001', ip: '10.99.1.10', mac: '64:00:6a:99:00:03', type: 'jump_server', vendor: 'Dell', model: 'PowerEdge R450', purdueLevel: 99, sysDescr: 'Dell PowerEdge R450 - Jump Server Windows Server 2022' },
    { name: 'DATA-DIODE-001', ip: '10.99.1.20', mac: 'f4:03:21:99:00:04', type: 'data_diode', vendor: 'Belden', model: 'HIRSCHMANN Eagle40', purdueLevel: 99, sysDescr: 'Hirschmann Eagle40 Data Diode Firewall v4.3' },
    { name: 'ERP-SRV-001', ip: '10.4.1.10', mac: '64:00:6a:05:00:01', type: 'erp', vendor: 'Dell', model: 'PowerEdge R750xs', purdueLevel: 4, sysDescr: 'Dell PowerEdge R750xs - SAP ERP S/4HANA 2023' },
    { name: 'DB-SRV-001', ip: '10.4.1.20', mac: '64:00:6a:05:00:02', type: 'database_server', vendor: 'Dell', model: 'PowerEdge R650xs', purdueLevel: 4, sysDescr: 'Dell PowerEdge R650xs - PostgreSQL 15 Database Server' },
    { name: 'MAIL-SRV-001', ip: '10.5.1.10', mac: '64:00:6a:06:00:01', type: 'email_server', vendor: 'Dell', model: 'PowerEdge R350', purdueLevel: 5, sysDescr: 'Dell PowerEdge R350 - Microsoft Exchange Server 2019' },
    { name: 'WEB-SRV-001', ip: '10.5.1.20', mac: '64:00:6a:06:00:02', type: 'web_server', vendor: 'Dell', model: 'PowerEdge R350', purdueLevel: 5, sysDescr: 'Dell PowerEdge R350 - Nginx Web Server Linux' },
    { name: 'L5-SWITCH-001', ip: '10.5.1.254', mac: '58:8d:09:06:00:03', type: 'switch', vendor: 'Cisco', model: 'Catalyst 9300', purdueLevel: 5, sysDescr: 'Cisco Catalyst 9300-48P Switch IOS-XE 17.9' },
];
const CONNECTION_PAIRS = [
    [0, 5, 502, 'Modbus', false],
    [1, 5, 502, 'Modbus', false],
    [2, 6, 44818, 'EtherNet/IP', false],
    [3, 5, 502, 'Modbus', false],
    [4, 5, 102, 'S7comm', false],
    [5, 9, 102, 'S7comm', false],
    [6, 9, 44818, 'EtherNet/IP', false],
    [7, 9, 2404, 'IEC 60870-5-104', false],
    [8, 9, 4840, 'OPC UA', true],
    [5, 10, 102, 'S7comm', false],
    [6, 11, 44818, 'EtherNet/IP', false],
    [8, 12, 443, 'HTTPS', true],
    [9, 14, 5450, 'PI-SDK', true],
    [9, 15, 443, 'HTTPS', true],
    [12, 14, 5450, 'PI-SDK', true],
    [9, 16, 443, 'HTTPS', true],
    [14, 18, 443, 'HTTPS', true],
    [17, 18, 443, 'HTTPS', true],
    [18, 22, 443, 'HTTPS', true],
    [20, 22, 443, 'HTTPS', true],
    [18, 23, 5432, 'PostgreSQL', true],
    [20, 24, 25, 'SMTP', false],
    [20, 25, 443, 'HTTPS', true],
];
/**
 * Lambda handler - triggered by EventBridge schedule (every 10 seconds)
 */
async function handler(event) {
    const requestId = (0, crypto_1.generateUUID)();
    logger_1.logger.setContext({ requestId, function: 'generator' });
    logger_1.logger.info('Generating SCADA telemetry data');
    const result = {
        success: true,
        messagesPublished: 0,
        errors: [],
    };
    if (!IOT_ENDPOINT) {
        result.success = false;
        result.errors.push('IOT_ENDPOINT environment variable not set');
        logger_1.logger.error('IoT endpoint not configured');
        return result;
    }
    try {
        const now = new Date();
        // Generate SNMP batch
        const snmpBatch = generateSNMPBatch(now);
        for (const telemetry of snmpBatch) {
            try {
                await publishToIoT(telemetry);
                result.messagesPublished++;
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                result.errors.push(errorMsg);
                logger_1.logger.error('Failed to publish SNMP telemetry', {
                    error: errorMsg,
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        }
        // Generate ARP telemetry
        const arpTelemetry = generateARPTelemetry(now);
        try {
            await publishToIoT(arpTelemetry);
            result.messagesPublished++;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(errorMsg);
            logger_1.logger.error('Failed to publish ARP telemetry', {
                error: errorMsg,
                stack: error instanceof Error ? error.stack : undefined
            });
        }
        // Generate NetFlow telemetry
        const netflowTelemetry = generateNetFlowTelemetry(now);
        try {
            await publishToIoT(netflowTelemetry);
            result.messagesPublished++;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(errorMsg);
            logger_1.logger.error('Failed to publish NetFlow telemetry', {
                error: errorMsg,
                stack: error instanceof Error ? error.stack : undefined
            });
        }
        // Generate Syslog telemetry (every 3rd invocation)
        const invocationCount = parseInt(event.id?.split('-').pop() || '0', 16) % 3;
        if (invocationCount === 0) {
            const syslogTelemetry = generateSyslogTelemetry(now);
            try {
                await publishToIoT(syslogTelemetry);
                result.messagesPublished++;
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                result.errors.push(errorMsg);
                logger_1.logger.error('Failed to publish Syslog telemetry', {
                    error: errorMsg,
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        }
        result.success = result.errors.length === 0;
        logger_1.logger.info('Data generation complete', {
            published: result.messagesPublished,
            errors: result.errors.length,
        });
    }
    catch (error) {
        result.success = false;
        result.errors.push(error.message);
        logger_1.logger.exception(error, 'Data generation failed');
    }
    return result;
}
/**
 * Publish message to IoT Core MQTT topic
 */
async function publishToIoT(message) {
    try {
        const payload = JSON.stringify(message);
        const iotDataClient = getIoTDataClient();
        const params = {
            topic: TELEMETRY_TOPIC,
            payload: payload,
            qos: 1,
        };
        const response = await iotDataClient.publish(params).promise();
        logger_1.logger.debug('Message published successfully', {
            topic: TELEMETRY_TOPIC,
            response: JSON.stringify(response)
        });
    }
    catch (error) {
        const errorDetails = error;
        const errorMessage = errorDetails?.message || (error instanceof Error ? error.message : String(error));
        const errorCode = errorDetails?.code || 'Unknown';
        logger_1.logger.error('Failed to publish message', {
            error: errorMessage,
            code: errorCode,
            statusCode: errorDetails?.statusCode,
            stack: error instanceof Error ? error.stack : undefined
        });
        throw new Error(`IoT Publish failed: ${errorCode} - ${errorMessage}`);
    }
}
/**
 * Generate SNMP telemetry batch
 */
function generateSNMPBatch(now) {
    const selected = pickRandom(SIMULATED_DEVICES, 8);
    return selected.map(device => ({
        id: (0, crypto_1.generateUUID)(),
        source: types_1.TelemetrySource.SNMP,
        timestamp: now.toISOString(),
        processed: false,
        metadata: { generatedBy: 'lambda-generator' },
        data: {
            type: 'system',
            sysName: device.name,
            sysDescr: device.sysDescr,
            sysLocation: `Plant-A/Zone-L${device.purdueLevel}`,
            sysContact: 'ot-admin@scada.local',
            sysUpTime: Math.floor(Math.random() * 86400000),
            sysObjectID: '1.3.6.1.4.1.0',
            interfaces: [{
                    index: 1,
                    name: 'eth0',
                    description: `${device.vendor} ${device.model} Ethernet`,
                    type: 6,
                    speed: 1000000000,
                    physAddress: device.mac,
                    adminStatus: 1,
                    operStatus: 1,
                    inOctets: Math.floor(Math.random() * 1000000000),
                    outOctets: Math.floor(Math.random() * 500000000),
                }],
        },
    }));
}
/**
 * Generate ARP telemetry
 */
function generateARPTelemetry(now) {
    const entries = SIMULATED_DEVICES.map(device => ({
        ipAddress: device.ip,
        macAddress: device.mac,
        interface: 'eth0',
        vlanId: device.purdueLevel === 99 ? 99 : (device.purdueLevel + 1) * 10,
        type: 'dynamic',
        age: Math.floor(Math.random() * 300),
    }));
    return {
        id: (0, crypto_1.generateUUID)(),
        source: types_1.TelemetrySource.ARP,
        timestamp: now.toISOString(),
        processed: false,
        metadata: { generatedBy: 'lambda-generator' },
        data: {
            type: 'arp',
            entries,
        },
    };
}
/**
 * Generate NetFlow telemetry
 */
function generateNetFlowTelemetry(now) {
    const flows = CONNECTION_PAIRS.map(([srcIdx, dstIdx, dstPort, protocol, isSecure]) => {
        const src = SIMULATED_DEVICES[srcIdx];
        const dst = SIMULATED_DEVICES[dstIdx];
        const startTime = new Date(now.getTime() - Math.floor(Math.random() * 10000));
        const endTime = now;
        return {
            srcAddress: src.ip,
            dstAddress: dst.ip,
            srcPort: 30000 + Math.floor(Math.random() * 30000),
            dstPort,
            protocol: dstPort === 502 || dstPort === 44818 ? 6 : (isSecure ? 6 : 17),
            bytes: Math.floor(Math.random() * 50000) + 100,
            packets: Math.floor(Math.random() * 100) + 1,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            tcpFlags: 0x18,
        };
    });
    return {
        id: (0, crypto_1.generateUUID)(),
        source: types_1.TelemetrySource.NETFLOW,
        timestamp: now.toISOString(),
        processed: false,
        metadata: { generatedBy: 'lambda-generator' },
        data: {
            type: 'netflow',
            flows,
        },
    };
}
/**
 * Generate Syslog telemetry
 */
function generateSyslogTelemetry(now) {
    const templates = [
        { facility: 4, severity: 6, hostname: 'PLC-MAIN-001', message: `Accepted publickey for ot-admin from 10.2.1.10 port 22 ssh2` },
        { facility: 4, severity: 4, hostname: 'DMZ-FW-001', message: `Failed password for admin from 10.5.1.100 port 443 https` },
        { facility: 0, severity: 6, hostname: 'SCADA-SRV-001', message: `Connection established to PLC-MAIN-001 on port 102 S7comm` },
        { facility: 13, severity: 3, hostname: 'DMZ-FW-001', message: `firewall: denied connection from 10.5.1.50 to 10.1.1.10 port 502 - policy violation` },
        { facility: 1, severity: 5, hostname: 'HISTORIAN-001', message: `PI Server: Data collection rate 1500 points/sec from 12 sources` },
    ];
    const selected = pickRandom(templates, 3 + Math.floor(Math.random() * 4));
    const messages = selected.map(tmpl => ({
        facility: tmpl.facility,
        severity: tmpl.severity,
        timestamp: now.toISOString(),
        hostname: tmpl.hostname,
        appName: 'scada-sim',
        message: tmpl.message,
    }));
    return {
        id: (0, crypto_1.generateUUID)(),
        source: types_1.TelemetrySource.SYSLOG,
        timestamp: now.toISOString(),
        processed: false,
        metadata: { generatedBy: 'lambda-generator' },
        data: {
            type: 'syslog',
            messages,
        },
    };
}
/**
 * Utility: Pick random items from array
 */
function pickRandom(arr, count) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, arr.length));
}
//# sourceMappingURL=handler.js.map