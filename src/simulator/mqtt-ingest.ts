/**
 * MQTT Ingest Processor - Subscribes to MQTT telemetry topic,
 * processes through the existing pipeline, and stores in PostgreSQL
 */

import * as mqtt from 'mqtt';
import { initializeDatabase, closeDatabase } from '../database/connection';
import { getDeviceRepository } from '../database/repositories/device.repository';
import { getConnectionRepository } from '../database/repositories/connection.repository';
import { getTelemetryRepository } from '../database/repositories/telemetry.repository';
import { getAlertRepository } from '../database/repositories/alert.repository';
import { snmpParser } from '../processors/parsers/snmp-parser';
import { arpParser } from '../processors/parsers/arp-parser';
import { netflowParser } from '../processors/parsers/netflow-parser';
import { syslogParser } from '../processors/parsers/syslog-parser';
import { TelemetryData, TelemetrySource, ConnectionType, DeviceStatus, DeviceType, PurdueLevel, SecurityZone, NetFlowRecord } from '../utils/types';
import { DEVICE_TYPE_PURDUE_LEVEL, PURDUE_TO_ZONE } from '../utils/constants';
import { generateUUID } from '../utils/crypto';
import { logger } from '../utils/logger';

// ============================================================================
// MQTT Ingest Processor
// ============================================================================

export class MQTTIngestProcessor {
  private client: mqtt.MqttClient | null = null;
  private readonly brokerUrl: string;
  private readonly topic: string;
  private processedCount = 0;
  private deviceIpMap = new Map<string, string>(); // IP -> device ID cache

  constructor(brokerUrl = 'mqtt://localhost:1883', topic = 'scada/telemetry') {
    this.brokerUrl = brokerUrl;
    this.topic = topic;
  }

  async start(): Promise<void> {
    logger.info('Starting MQTT ingest processor', { broker: this.brokerUrl, topic: this.topic });

    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connection established');

    // Connect to MQTT
    this.client = mqtt.connect(this.brokerUrl, {
      clientId: `scada-ingest-${process.pid}`,
      clean: true,
      reconnectPeriod: 5000,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MQTT connection timeout')), 10000);
      this.client!.on('connect', () => {
        clearTimeout(timeout);
        logger.info('Ingest processor connected to MQTT broker');
        resolve();
      });
      this.client!.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Subscribe to telemetry topic
    this.client.subscribe(this.topic, { qos: 1 }, (err) => {
      if (err) {
        logger.error('Failed to subscribe', { error: err.message });
      } else {
        logger.info(`Subscribed to ${this.topic}`);
      }
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

    logger.info('MQTT ingest processor is running. Waiting for telemetry...');
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    await closeDatabase();
    logger.info(`Ingest processor stopped. Total processed: ${this.processedCount}`);
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

  // --------------------------------------------------------------------------
  // Reconstitute Telemetry from JSON
  // --------------------------------------------------------------------------

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
      // Try to find existing device by name
      const existing = await deviceRepo.findAll({ limit: 1 });
      const existingByName = (await deviceRepo.search({ searchTerm: device.name })).data;

      if (existingByName.length > 0) {
        // Update last seen
        await deviceRepo.updateLastSeen(existingByName[0].id);
        this.deviceIpMap.set(
          this.extractIpFromInterfaces(parsed.interfaces) || device.name,
          existingByName[0].id
        );
      } else {
        // Create new device
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
  // ARP Processing -> Update device IP/MAC mapping
  // --------------------------------------------------------------------------

  private async processARP(telemetry: TelemetryData): Promise<void> {
    const { arpEntries } = arpParser.parse(telemetry);

    if (arpEntries.length === 0) return;

    // Build L2 topology from ARP entries
    const l2 = arpParser.buildL2Topology(arpEntries, []);

    logger.debug(`ARP: ${arpEntries.length} entries, ${l2.devices.length} L2 devices`);

    // Update device IP cache
    for (const entry of arpEntries) {
      // Store IP->MAC mapping for future lookups
      const deviceRepo = getDeviceRepository();
      try {
        const device = await deviceRepo.findByIpAddress(entry.ipAddress);
        if (device) {
          this.deviceIpMap.set(entry.ipAddress, device.id);
          await deviceRepo.updateLastSeen(device.id);
        }
      } catch {
        // Device not found by IP, that's fine
      }
    }
  }

  // --------------------------------------------------------------------------
  // NetFlow Processing -> Create Connections
  // --------------------------------------------------------------------------

  private async processNetFlow(telemetry: TelemetryData): Promise<void> {
    // Reconstitute Date objects from JSON strings for NetFlow records
    const data = telemetry.data;
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
        // Resolve source and destination device IDs
        const srcDeviceId = await this.resolveDeviceId(flow.srcAddress, deviceRepo);
        const dstDeviceId = await this.resolveDeviceId(flow.dstAddress, deviceRepo);

        if (!srcDeviceId || !dstDeviceId) continue;
        if (srcDeviceId === dstDeviceId) continue;

        // Upsert connection
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
        // Skip individual flow errors silently to not flood logs
      }
    }

    if (newConnections > 0) {
      logger.debug(`NetFlow: processed ${parsedFlows.length} flows, ${newConnections} connections upserted`);
    }
  }

  private async resolveDeviceId(ipAddress: string, deviceRepo: ReturnType<typeof getDeviceRepository>): Promise<string | null> {
    // Check cache first
    const cached = this.deviceIpMap.get(ipAddress);
    if (cached) return cached;

    // Look up in database
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
    // Reconstitute Date objects from JSON strings for syslog messages
    const data = telemetry.data;
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
        // Resolve device ID from hostname
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
  const processor = new MQTTIngestProcessor();

  const shutdown = async () => {
    logger.info('Shutting down ingest processor...');
    await processor.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  processor.start().catch(err => {
    logger.error('Failed to start ingest processor', { error: (err as Error).message });
    process.exit(1);
  });
}
