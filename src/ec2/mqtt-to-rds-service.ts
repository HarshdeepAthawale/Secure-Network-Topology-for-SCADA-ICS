/**
 * EC2 MQTT to RDS Service
 * Subscribes to AWS IoT Core MQTT topics and writes telemetry data to RDS PostgreSQL
 */

import * as mqtt from 'mqtt';
import * as fs from 'fs';
import * as path from 'path';
import { initializeDatabase, closeDatabase } from '../database/connection';
import { getDeviceRepository } from '../database/repositories/device.repository';
import { getConnectionRepository } from '../database/repositories/connection.repository';
import { getTelemetryRepository } from '../database/repositories/telemetry.repository';
import { getAlertRepository } from '../database/repositories/alert.repository';
import { snmpParser } from '../processors/parsers/snmp-parser';
import { arpParser } from '../processors/parsers/arp-parser';
import { netflowParser } from '../processors/parsers/netflow-parser';
import { syslogParser } from '../processors/parsers/syslog-parser';
import { TelemetryData, TelemetrySource, ConnectionType, DeviceStatus, DeviceType, PurdueLevel, SecurityZone } from '../utils/types';
import { generateUUID } from '../utils/crypto';
import { logger } from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

interface ServiceConfig {
  iotEndpoint: string;
  topic: string;
  certPath: string;
  keyPath: string;
  caPath: string;
  clientId: string;
}

function loadConfig(): ServiceConfig {
  const iotEndpoint = process.env.IOT_ENDPOINT;
  const topic = process.env.MQTT_TOPIC || 'scada/telemetry';
  const certPath = process.env.IOT_CERT_PATH || '/opt/scada/certs/certificate.pem.crt';
  const keyPath = process.env.IOT_KEY_PATH || '/opt/scada/certs/private.pem.key';
  const caPath = process.env.IOT_CA_PATH || '/opt/scada/certs/AmazonRootCA1.pem';
  const clientId = process.env.IOT_CLIENT_ID || `ec2-mqtt-ingest-${process.pid}`;

  if (!iotEndpoint) {
    throw new Error('IOT_ENDPOINT environment variable is required');
  }

  return {
    iotEndpoint,
    topic,
    certPath,
    keyPath,
    caPath,
    clientId,
  };
}

// ============================================================================
// MQTT to RDS Service
// ============================================================================

export class MQTTToRDSService {
  private client: mqtt.MqttClient | null = null;
  private config: ServiceConfig;
  private processedCount = 0;
  private deviceIpMap = new Map<string, string>();
  private isRunning = false;

  constructor(config?: Partial<ServiceConfig>) {
    this.config = { ...loadConfig(), ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Service is already running');
      return;
    }

    logger.info('Starting MQTT to RDS service', {
      endpoint: this.config.iotEndpoint,
      topic: this.config.topic,
      clientId: this.config.clientId,
    });

    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connection established');

    // Load TLS certificates
    const cert = fs.readFileSync(this.config.certPath);
    const key = fs.readFileSync(this.config.keyPath);
    const ca = fs.readFileSync(this.config.caPath);

    // Connect to AWS IoT Core
    const brokerUrl = `mqtts://${this.config.iotEndpoint}:8883`;
    this.client = mqtt.connect(brokerUrl, {
      clientId: this.config.clientId,
      cert,
      key,
      ca,
      rejectUnauthorized: true,
      clean: true,
      reconnectPeriod: 5000,
      keepalive: 60,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MQTT connection timeout')), 30000);
      
      this.client!.on('connect', () => {
        clearTimeout(timeout);
        logger.info('Connected to AWS IoT Core');
        resolve();
      });

      this.client!.on('error', (err) => {
        clearTimeout(timeout);
        logger.error('MQTT connection error', { error: err.message });
        reject(err);
      });
    });

    // Subscribe to telemetry topic
    this.client.subscribe(this.config.topic, { qos: 1 }, (err) => {
      if (err) {
        logger.error('Failed to subscribe', { error: err.message });
        throw err;
      }
      logger.info(`Subscribed to ${this.config.topic}`);
    });

    // Handle incoming messages
    this.client.on('message', async (_topic, payload) => {
      try {
        const message = JSON.parse(payload.toString());
        await this.processMessage(message);
      } catch (err) {
        logger.error('Failed to process message', { error: (err as Error).message });
      }
    });

    this.isRunning = true;
    logger.info('MQTT to RDS service is running. Waiting for telemetry...');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping MQTT to RDS service...');
    this.isRunning = false;

    if (this.client) {
      this.client.end();
      this.client = null;
    }

    await closeDatabase();
    logger.info(`Service stopped. Total processed: ${this.processedCount}`);
  }

  // --------------------------------------------------------------------------
  // Message Processing
  // --------------------------------------------------------------------------

  private async processMessage(message: Record<string, unknown>): Promise<void> {
    const source = message.source as string;
    const telemetry = this.reconstituteTelemetry(message);

    // Store raw telemetry
    const telemetryRepo = getTelemetryRepository();
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
      case TelemetrySource.SNMP:
        await this.processSNMP(telemetry);
        break;
      case TelemetrySource.ARP:
        await this.processARP(telemetry);
        break;
      case TelemetrySource.NETFLOW:
        await this.processNetFlow(telemetry);
        break;
      case TelemetrySource.SYSLOG:
        await this.processSyslog(telemetry);
        break;
      default:
        logger.debug(`Unknown telemetry source: ${source}`);
    }

    // Mark telemetry as processed
    await telemetryRepo.markProcessed(telemetry.id);
    this.processedCount++;

    if (this.processedCount % 10 === 0) {
      logger.info(`Processed ${this.processedCount} telemetry messages`);
    }
  }

  private reconstituteTelemetry(msg: Record<string, unknown>): TelemetryData {
    return {
      id: (msg.id as string) || generateUUID(),
      source: msg.source as TelemetrySource,
      timestamp: new Date(msg.timestamp as string),
      data: msg.data as Record<string, unknown>,
      processed: false,
      metadata: (msg.metadata as Record<string, unknown>) || {},
    };
  }

  // --------------------------------------------------------------------------
  // SNMP Processing -> Upsert Devices
  // --------------------------------------------------------------------------

  private async processSNMP(telemetry: TelemetryData): Promise<void> {
    const parsed = snmpParser.parse(telemetry);
    if (!parsed) return;

    const device = snmpParser.toDevice(parsed);
    const deviceRepo = getDeviceRepository();

    try {
      const existingByName = (await deviceRepo.search({ searchTerm: device.name })).data;

      if (existingByName.length > 0) {
        await deviceRepo.updateLastSeen(existingByName[0].id);
        const ip = this.extractIpFromInterfaces(parsed.interfaces) || device.name;
        this.deviceIpMap.set(ip, existingByName[0].id);
      } else {
        const created = await deviceRepo.create({
          name: device.name,
          hostname: device.hostname,
          type: device.type,
          vendor: device.vendor,
          model: device.model,
          purdueLevel: device.purdueLevel,
          securityZone: device.securityZone,
          status: DeviceStatus.ONLINE,
          metadata: device.metadata,
          discoveredAt: new Date(),
          lastSeenAt: new Date(),
        });
        logger.info(`New device discovered: ${created.name} (${created.type}) at Purdue Level ${created.purdueLevel}`);
      }
    } catch (err) {
      logger.error('Error processing SNMP device', { error: (err as Error).message, device: device.name });
    }
  }

  private extractIpFromInterfaces(interfaces: Array<{ ipAddress?: string }>): string | undefined {
    for (const iface of interfaces) {
      if (iface.ipAddress) return iface.ipAddress;
    }
    return undefined;
  }

  // --------------------------------------------------------------------------
  // ARP Processing
  // --------------------------------------------------------------------------

  private async processARP(telemetry: TelemetryData): Promise<void> {
    const { arpEntries } = arpParser.parse(telemetry);
    if (arpEntries.length === 0) return;

    const deviceRepo = getDeviceRepository();
    for (const entry of arpEntries) {
      try {
        const device = await deviceRepo.findByIpAddress(entry.ipAddress);
        if (device) {
          this.deviceIpMap.set(entry.ipAddress, device.id);
          await deviceRepo.updateLastSeen(device.id);
        }
      } catch {
        // Device not found, that's fine
      }
    }
  }

  // --------------------------------------------------------------------------
  // NetFlow Processing -> Create Connections
  // --------------------------------------------------------------------------

  private async processNetFlow(telemetry: TelemetryData): Promise<void> {
    const data = telemetry.data as Record<string, unknown>;
    if (data.type === 'netflow' && Array.isArray(data.flows)) {
      data.flows = (data.flows as Record<string, unknown>[]).map(flow => ({
        ...flow,
        startTime: new Date(flow.startTime as string),
        endTime: new Date(flow.endTime as string),
      }));
    }

    const parsedFlows = netflowParser.parse(telemetry);
    if (parsedFlows.length === 0) return;

    const connRepo = getConnectionRepository();
    const deviceRepo = getDeviceRepository();
    let newConnections = 0;

    for (const flow of parsedFlows) {
      try {
        const srcDeviceId = await this.resolveDeviceId(flow.srcAddress, deviceRepo);
        const dstDeviceId = await this.resolveDeviceId(flow.dstAddress, deviceRepo);

        if (!srcDeviceId || !dstDeviceId || srcDeviceId === dstDeviceId) continue;

        await connRepo.upsertConnection({
          sourceDeviceId: srcDeviceId,
          targetDeviceId: dstDeviceId,
          connectionType: ConnectionType.ETHERNET,
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
      } catch (err) {
        // Skip individual flow errors
      }
    }

    if (newConnections > 0) {
      logger.debug(`NetFlow: processed ${parsedFlows.length} flows, ${newConnections} connections upserted`);
    }
  }

  private async resolveDeviceId(ipAddress: string, deviceRepo: ReturnType<typeof getDeviceRepository>): Promise<string | null> {
    const cached = this.deviceIpMap.get(ipAddress);
    if (cached) return cached;

    try {
      const device = await deviceRepo.findByIpAddress(ipAddress);
      if (device) {
        this.deviceIpMap.set(ipAddress, device.id);
        return device.id;
      }
    } catch {
      // Not found
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Syslog Processing -> Create Alerts
  // --------------------------------------------------------------------------

  private async processSyslog(telemetry: TelemetryData): Promise<void> {
    const data = telemetry.data as Record<string, unknown>;
    if (Array.isArray(data.messages)) {
      data.messages = (data.messages as Record<string, unknown>[]).map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp as string),
      }));
    }

    const events = syslogParser.parse(telemetry);
    if (events.length === 0) return;

    const alertRepo = getAlertRepository();
    let newAlerts = 0;

    for (const event of events) {
      const alert = syslogParser.toAlert(event);
      if (!alert) continue;

      try {
        const deviceRepo = getDeviceRepository();
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
      } catch (err) {
        logger.error('Error creating alert', { error: (err as Error).message });
      }
    }

    if (newAlerts > 0) {
      logger.info(`Syslog: ${events.length} events parsed, ${newAlerts} alerts created`);
    }
  }
}

// ============================================================================
// Standalone Entry Point
// ============================================================================

if (require.main === module) {
  const service = new MQTTToRDSService();

  const shutdown = async () => {
    logger.info('Shutting down MQTT to RDS service...');
    await service.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  service.start().catch(err => {
    logger.error('Failed to start service', { error: (err as Error).message });
    process.exit(1);
  });
}
