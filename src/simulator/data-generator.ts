/**
 * SCADA Data Generator - Generates realistic SCADA/ICS telemetry
 * and publishes to MQTT broker for pipeline testing
 */

import * as mqtt from 'mqtt';
import { generateUUID } from '../utils/crypto';
import { TelemetrySource } from '../utils/types';
import { logger } from '../utils/logger';

// ============================================================================
// Simulated Device Definitions
// ============================================================================

interface SimDevice {
  name: string;
  ip: string;
  mac: string;
  type: string;
  vendor: string;
  model: string;
  purdueLevel: number;
  sysDescr: string;
}

const SIMULATED_DEVICES: SimDevice[] = [
  // Level 0 - Process (Sensors, Actuators)
  { name: 'TEMP-SENSOR-001', ip: '10.0.1.10', mac: '74:da:ea:01:00:01', type: 'sensor', vendor: 'Texas Instruments', model: 'TMP117', purdueLevel: 0, sysDescr: 'TI TMP117 Temperature Sensor v2.1' },
  { name: 'PRESS-SENSOR-002', ip: '10.0.1.11', mac: '74:da:ea:01:00:02', type: 'sensor', vendor: 'Texas Instruments', model: 'DRV425', purdueLevel: 0, sysDescr: 'TI DRV425 Pressure Transmitter v1.4' },
  { name: 'FLOW-SENSOR-003', ip: '10.0.1.12', mac: '68:dd:b7:01:00:03', type: 'sensor', vendor: 'Honeywell', model: 'ST800', purdueLevel: 0, sysDescr: 'Honeywell ST800 SmartLine Flow Transmitter' },
  { name: 'VALVE-ACT-001', ip: '10.0.1.20', mac: '68:dd:b7:01:00:04', type: 'actuator', vendor: 'Honeywell', model: 'HPS-V200', purdueLevel: 0, sysDescr: 'Honeywell HPS Valve Actuator v3.0' },
  { name: 'VFD-DRIVE-001', ip: '10.0.1.30', mac: '00:1a:4b:01:00:05', type: 'variable_drive', vendor: 'Siemens', model: 'G120', purdueLevel: 0, sysDescr: 'Siemens SINAMICS G120 Variable Frequency Drive' },

  // Level 1 - Basic Control (PLCs, RTUs)
  { name: 'PLC-MAIN-001', ip: '10.1.1.10', mac: '00:1a:4b:02:00:01', type: 'plc', vendor: 'Siemens', model: 'S7-1500', purdueLevel: 1, sysDescr: 'Siemens S7-1500 PLC CPU 1516-3 PN/DP FW V2.9' },
  { name: 'PLC-AUX-002', ip: '10.1.1.11', mac: '2c:a8:35:02:00:02', type: 'plc', vendor: 'Rockwell Automation', model: 'ControlLogix 5580', purdueLevel: 1, sysDescr: 'Allen-Bradley ControlLogix 5580 Controller v33' },
  { name: 'RTU-FIELD-001', ip: '10.1.1.20', mac: '00:1a:4b:02:00:03', type: 'rtu', vendor: 'Siemens', model: 'SICAM A8000', purdueLevel: 1, sysDescr: 'Siemens SICAM A8000 RTU CP-8050' },
  { name: 'DCS-CTRL-001', ip: '10.1.1.30', mac: '68:dd:b7:02:00:04', type: 'dcs', vendor: 'Honeywell', model: 'Experion PKS', purdueLevel: 1, sysDescr: 'Honeywell Experion PKS DCS Controller C300' },

  // Level 2 - Supervisory (SCADA, HMI)
  { name: 'SCADA-SRV-001', ip: '10.2.1.10', mac: '8c:dc:d4:03:00:01', type: 'scada_server', vendor: 'Cisco', model: 'UCS-C220', purdueLevel: 2, sysDescr: 'Cisco UCS C220 M5 - SCADA Server ClearSCADA v6.8' },
  { name: 'HMI-OP-001', ip: '10.2.1.20', mac: '00:1a:4b:03:00:02', type: 'hmi', vendor: 'Siemens', model: 'TP1900', purdueLevel: 2, sysDescr: 'Siemens HMI TP1900 Comfort Panel v16' },
  { name: 'HMI-OP-002', ip: '10.2.1.21', mac: '2c:a8:35:03:00:03', type: 'hmi', vendor: 'Rockwell Automation', model: 'PanelView Plus 7', purdueLevel: 2, sysDescr: 'Allen-Bradley PanelView Plus 7 Standard v12' },
  { name: 'ALARM-SRV-001', ip: '10.2.1.30', mac: '8c:dc:d4:03:00:04', type: 'alarm_server', vendor: 'Cisco', model: 'UCS-C240', purdueLevel: 2, sysDescr: 'Cisco UCS C240 - Alarm Server Iconics Genesis64' },
  { name: 'L2-SWITCH-001', ip: '10.2.1.254', mac: '58:8d:09:03:00:05', type: 'switch', vendor: 'Cisco', model: 'IE-4010', purdueLevel: 2, sysDescr: 'Cisco IE-4010-4S24P Industrial Ethernet Switch IOS 15.2' },

  // Level 3 - Operations (MES, Historian)
  { name: 'HISTORIAN-001', ip: '10.3.1.10', mac: '64:00:6a:04:00:01', type: 'historian', vendor: 'Dell', model: 'PowerEdge R750', purdueLevel: 3, sysDescr: 'Dell PowerEdge R750 - OSIsoft PI Server 2021' },
  { name: 'MES-SRV-001', ip: '10.3.1.20', mac: '64:00:6a:04:00:02', type: 'mes', vendor: 'Dell', model: 'PowerEdge R650', purdueLevel: 3, sysDescr: 'Dell PowerEdge R650 - Siemens Opcenter MES v2022' },
  { name: 'ENG-WS-001', ip: '10.3.1.30', mac: '64:00:6a:04:00:03', type: 'engineering_workstation', vendor: 'Dell', model: 'Precision 5820', purdueLevel: 3, sysDescr: 'Dell Precision 5820 - Engineering Workstation TIA Portal v18' },
  { name: 'L3-ROUTER-001', ip: '10.3.1.254', mac: '58:8d:09:04:00:04', type: 'router', vendor: 'Cisco', model: 'ISR-4331', purdueLevel: 3, sysDescr: 'Cisco ISR 4331 Router IOS-XE 17.6' },

  // DMZ
  { name: 'DMZ-FW-001', ip: '10.99.1.1', mac: '58:8d:09:99:00:01', type: 'firewall', vendor: 'Cisco', model: 'ASA-5525', purdueLevel: 99, sysDescr: 'Cisco ASA 5525-X Adaptive Security Appliance v9.16' },
  { name: 'DMZ-FW-002', ip: '10.99.1.2', mac: '58:8d:09:99:00:02', type: 'firewall', vendor: 'Cisco', model: 'Firepower 2130', purdueLevel: 99, sysDescr: 'Cisco Firepower 2130 NGFW FTD v7.2' },
  { name: 'JUMP-SRV-001', ip: '10.99.1.10', mac: '64:00:6a:99:00:03', type: 'jump_server', vendor: 'Dell', model: 'PowerEdge R450', purdueLevel: 99, sysDescr: 'Dell PowerEdge R450 - Jump Server Windows Server 2022' },
  { name: 'DATA-DIODE-001', ip: '10.99.1.20', mac: 'f4:03:21:99:00:04', type: 'data_diode', vendor: 'Belden', model: 'HIRSCHMANN Eagle40', purdueLevel: 99, sysDescr: 'Hirschmann Eagle40 Data Diode Firewall v4.3' },

  // Level 4 - Enterprise
  { name: 'ERP-SRV-001', ip: '10.4.1.10', mac: '64:00:6a:05:00:01', type: 'erp', vendor: 'Dell', model: 'PowerEdge R750xs', purdueLevel: 4, sysDescr: 'Dell PowerEdge R750xs - SAP ERP S/4HANA 2023' },
  { name: 'DB-SRV-001', ip: '10.4.1.20', mac: '64:00:6a:05:00:02', type: 'database_server', vendor: 'Dell', model: 'PowerEdge R650xs', purdueLevel: 4, sysDescr: 'Dell PowerEdge R650xs - PostgreSQL 15 Database Server' },

  // Level 5 - Enterprise Network
  { name: 'MAIL-SRV-001', ip: '10.5.1.10', mac: '64:00:6a:06:00:01', type: 'email_server', vendor: 'Dell', model: 'PowerEdge R350', purdueLevel: 5, sysDescr: 'Dell PowerEdge R350 - Microsoft Exchange Server 2019' },
  { name: 'WEB-SRV-001', ip: '10.5.1.20', mac: '64:00:6a:06:00:02', type: 'web_server', vendor: 'Dell', model: 'PowerEdge R350', purdueLevel: 5, sysDescr: 'Dell PowerEdge R350 - Nginx Web Server Linux' },
  { name: 'L5-SWITCH-001', ip: '10.5.1.254', mac: '58:8d:09:06:00:03', type: 'switch', vendor: 'Cisco', model: 'Catalyst 9300', purdueLevel: 5, sysDescr: 'Cisco Catalyst 9300-48P Switch IOS-XE 17.9' },
];

// ============================================================================
// Connection Pairs (src index -> dst index in SIMULATED_DEVICES)
// ============================================================================

const CONNECTION_PAIRS: Array<[number, number, number, string, boolean]> = [
  // [srcIdx, dstIdx, dstPort, protocol, isSecure]
  // L0 -> L1 (sensors to PLCs)
  [0, 5, 502, 'Modbus', false],
  [1, 5, 502, 'Modbus', false],
  [2, 6, 44818, 'EtherNet/IP', false],
  [3, 5, 502, 'Modbus', false],
  [4, 5, 102, 'S7comm', false],
  // L1 -> L2 (PLCs to SCADA/HMI)
  [5, 9, 102, 'S7comm', false],
  [6, 9, 44818, 'EtherNet/IP', false],
  [7, 9, 2404, 'IEC 60870-5-104', false],
  [8, 9, 4840, 'OPC UA', true],
  [5, 10, 102, 'S7comm', false],
  [6, 11, 44818, 'EtherNet/IP', false],
  [8, 12, 443, 'HTTPS', true],
  // L2 -> L3 (SCADA to Historian/MES)
  [9, 14, 5450, 'PI-SDK', true],
  [9, 15, 443, 'HTTPS', true],
  [12, 14, 5450, 'PI-SDK', true],
  [9, 16, 443, 'HTTPS', true],
  // L3 -> DMZ
  [14, 18, 443, 'HTTPS', true],
  [17, 18, 443, 'HTTPS', true],
  // DMZ -> L4/L5
  [18, 22, 443, 'HTTPS', true],
  [20, 22, 443, 'HTTPS', true],
  [18, 23, 5432, 'PostgreSQL', true],
  [20, 24, 25, 'SMTP', false],
  [20, 25, 443, 'HTTPS', true],
];

// ============================================================================
// Data Generator Class
// ============================================================================

export class DataGenerator {
  private client: mqtt.MqttClient | null = null;
  private interval: NodeJS.Timeout | null = null;
  private readonly brokerUrl: string;
  private readonly topic: string;
  private tickCount = 0;

  constructor(brokerUrl = 'mqtt://localhost:1883', topic = 'scada/telemetry') {
    this.brokerUrl = brokerUrl;
    this.topic = topic;
  }

  async start(): Promise<void> {
    logger.info('Starting SCADA data generator', { broker: this.brokerUrl, topic: this.topic });

    this.client = mqtt.connect(this.brokerUrl, {
      clientId: `scada-generator-${process.pid}`,
      clean: true,
      reconnectPeriod: 5000,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MQTT connection timeout')), 10000);
      this.client!.on('connect', () => {
        clearTimeout(timeout);
        logger.info('Data generator connected to MQTT broker');
        resolve();
      });
      this.client!.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Generate data every 10 seconds
    this.interval = setInterval(() => this.generateAndPublish(), 10000);

    // Generate immediately on start
    await this.generateAndPublish();
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    logger.info('Data generator stopped');
  }

  private async generateAndPublish(): Promise<void> {
    this.tickCount++;
    const now = new Date();

    try {
      // Every tick: generate SNMP telemetry for a subset of devices
      const snmpBatch = this.generateSNMPBatch(now);
      for (const telemetry of snmpBatch) {
        this.publish(telemetry);
      }

      // Every tick: generate ARP entries
      const arpTelemetry = this.generateARPTelemetry(now);
      this.publish(arpTelemetry);

      // Every tick: generate NetFlow records
      const netflowTelemetry = this.generateNetFlowTelemetry(now);
      this.publish(netflowTelemetry);

      // Every 3rd tick: generate syslog messages
      if (this.tickCount % 3 === 0) {
        const syslogTelemetry = this.generateSyslogTelemetry(now);
        this.publish(syslogTelemetry);
      }

      logger.info(`Tick ${this.tickCount}: published telemetry batch`, {
        snmp: snmpBatch.length,
        arp: 1,
        netflow: 1,
        syslog: this.tickCount % 3 === 0 ? 1 : 0,
      });
    } catch (err) {
      logger.error('Error generating telemetry', { error: (err as Error).message });
    }
  }

  // --------------------------------------------------------------------------
  // SNMP Telemetry Generation
  // --------------------------------------------------------------------------

  private generateSNMPBatch(now: Date): object[] {
    // Each tick, report on ~8 random devices
    const selected = this.pickRandom(SIMULATED_DEVICES, 8);

    return selected.map(device => ({
      id: generateUUID(),
      source: TelemetrySource.SNMP,
      timestamp: now.toISOString(),
      processed: false,
      metadata: { generatedBy: 'simulator' },
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

  // --------------------------------------------------------------------------
  // ARP Telemetry Generation
  // --------------------------------------------------------------------------

  private generateARPTelemetry(now: Date): object {
    const entries = SIMULATED_DEVICES.map(device => ({
      ipAddress: device.ip,
      macAddress: device.mac,
      interface: 'eth0',
      vlanId: device.purdueLevel === 99 ? 99 : (device.purdueLevel + 1) * 10,
      type: 'dynamic' as const,
      age: Math.floor(Math.random() * 300),
    }));

    return {
      id: generateUUID(),
      source: TelemetrySource.ARP,
      timestamp: now.toISOString(),
      processed: false,
      metadata: { generatedBy: 'simulator' },
      data: {
        type: 'arp',
        entries,
      },
    };
  }

  // --------------------------------------------------------------------------
  // NetFlow Telemetry Generation
  // --------------------------------------------------------------------------

  private generateNetFlowTelemetry(now: Date): object {
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
        protocol: dstPort === 502 || dstPort === 44818 ? 6 : (isSecure ? 6 : 17), // TCP or UDP
        bytes: Math.floor(Math.random() * 50000) + 100,
        packets: Math.floor(Math.random() * 100) + 1,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        tcpFlags: 0x18, // ACK+PSH
      };
    });

    return {
      id: generateUUID(),
      source: TelemetrySource.NETFLOW,
      timestamp: now.toISOString(),
      processed: false,
      metadata: { generatedBy: 'simulator' },
      data: {
        type: 'netflow',
        flows,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Syslog Telemetry Generation
  // --------------------------------------------------------------------------

  private generateSyslogTelemetry(now: Date): object {
    const messages = this.generateSyslogMessages(now);

    return {
      id: generateUUID(),
      source: TelemetrySource.SYSLOG,
      timestamp: now.toISOString(),
      processed: false,
      metadata: { generatedBy: 'simulator' },
      data: {
        type: 'syslog',
        messages,
      },
    };
  }

  private generateSyslogMessages(now: Date): object[] {
    const templates = [
      { facility: 4, severity: 6, hostname: 'PLC-MAIN-001', message: `Accepted publickey for ot-admin from 10.2.1.10 port 22 ssh2` },
      { facility: 4, severity: 4, hostname: 'DMZ-FW-001', message: `Failed password for admin from 10.5.1.100 port 443 https` },
      { facility: 0, severity: 6, hostname: 'SCADA-SRV-001', message: `Connection established to PLC-MAIN-001 on port 102 S7comm` },
      { facility: 13, severity: 3, hostname: 'DMZ-FW-001', message: `firewall: denied connection from 10.5.1.50 to 10.1.1.10 port 502 - policy violation` },
      { facility: 1, severity: 5, hostname: 'HISTORIAN-001', message: `PI Server: Data collection rate 1500 points/sec from 12 sources` },
      { facility: 4, severity: 2, hostname: 'DMZ-FW-002', message: `Brute force attack detected from 10.5.1.200: 15 failed login attempts in 60 seconds` },
      { facility: 10, severity: 4, hostname: 'L2-SWITCH-001', message: `Port Gi1/0/24: unauthorized device detected MAC aa:bb:cc:dd:ee:ff` },
      { facility: 1, severity: 6, hostname: 'ENG-WS-001', message: `TIA Portal: Project download to PLC-MAIN-001 completed successfully` },
      { facility: 13, severity: 5, hostname: 'DMZ-FW-001', message: `firewall: allowed connection from 10.3.1.10 to 10.99.1.1 port 443 HTTPS` },
      { facility: 1, severity: 4, hostname: 'RTU-FIELD-001', message: `Communication timeout with sensor TEMP-SENSOR-001 at 10.0.1.10` },
    ];

    // Pick 3-6 random messages per batch
    const selected = this.pickRandom(templates, 3 + Math.floor(Math.random() * 4));

    return selected.map(tmpl => ({
      facility: tmpl.facility,
      severity: tmpl.severity,
      timestamp: now.toISOString(),
      hostname: tmpl.hostname,
      appName: 'scada-sim',
      message: tmpl.message,
    }));
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private publish(message: object): void {
    if (!this.client || !this.client.connected) {
      logger.warn('MQTT client not connected, skipping publish');
      return;
    }
    this.client.publish(this.topic, JSON.stringify(message));
  }

  private pickRandom<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, arr.length));
  }
}

// ============================================================================
// Standalone Entry Point
// ============================================================================

if (require.main === module) {
  const generator = new DataGenerator();

  const shutdown = async () => {
    logger.info('Shutting down data generator...');
    await generator.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  generator.start().catch(err => {
    logger.error('Failed to start data generator', { error: (err as Error).message });
    process.exit(1);
  });
}
