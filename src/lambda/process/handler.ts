/**
 * Processing Lambda - Correlation and topology analysis
 */

import { SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';
import { TelemetryData, Device, Connection, Alert, TelemetrySource } from '../../utils/types';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';
import { snmpParser } from '../../processors/parsers/snmp-parser';
import { netflowParser } from '../../processors/parsers/netflow-parser';
import { syslogParser } from '../../processors/parsers/syslog-parser';
import { arpParser } from '../../processors/parsers/arp-parser';
import { deviceCorrelator, DeviceCandidate } from '../../processors/correlation/device-correlator';
import { topologyBuilder } from '../../processors/correlation/topology-builder';
import { purdueClassifier } from '../../processors/classification/purdue-classifier';
import { riskAnalyzer } from '../../processors/risk/risk-analyzer';
import {
  initializeDatabase,
  getDeviceRepository,
  getConnectionRepository,
  getAlertRepository,
  getTopologySnapshotRepository,
} from '../../database';

interface ProcessingResult {
  batchId: string;
  recordsProcessed: number;
  devicesDiscovered: number;
  connectionsDiscovered: number;
  alertsGenerated: number;
  errors: string[];
}

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  const batchId = generateUUID();
  logger.setContext({ batchId, function: 'process' });
  logger.info('Processing telemetry batch', { recordCount: event.Records.length });

  const result: ProcessingResult = {
    batchId,
    recordsProcessed: 0,
    devicesDiscovered: 0,
    connectionsDiscovered: 0,
    alertsGenerated: 0,
    errors: [],
  };

  const deviceCandidates: DeviceCandidate[] = [];
  const alerts: Alert[] = [];

  for (const record of event.Records) {
    try {
      const telemetry = parseSQSRecord(record);
      if (!telemetry) continue;

      const { candidates, newAlerts } = processTelemetry(telemetry);
      deviceCandidates.push(...candidates);
      alerts.push(...newAlerts);
      result.recordsProcessed++;
    } catch (error) {
      result.errors.push(`Record ${record.messageId}: ${(error as Error).message}`);
      logger.error('Failed to process record', { messageId: record.messageId, error: (error as Error).message });
    }
  }

  // Correlate devices
  if (deviceCandidates.length > 0) {
    const correlationResults = deviceCorrelator.correlate(deviceCandidates);

    for (const correlation of correlationResults) {
      // Classify device
      const classification = purdueClassifier.classify(correlation.device);
      correlation.device.purdueLevel = classification.assignedLevel;
      correlation.device.securityZone = classification.assignedZone;

      // Add to topology
      topologyBuilder.addDevice(correlation.device);
      result.devicesDiscovered++;

      // Analyze risk
      const connections = topologyBuilder.getDeviceConnections(correlation.device.id);
      const riskAssessment = riskAnalyzer.analyzeDevice(correlation.device, connections);

      const riskAlert = riskAnalyzer.createAlertFromAssessment(riskAssessment, correlation.device);
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
  const snapshot = topologyBuilder.createSnapshot();
  await storeTopologySnapshot(snapshot);

  logger.info('Processing complete', result as unknown as Record<string, unknown>);
};

function parseSQSRecord(record: SQSRecord): TelemetryData | null {
  try {
    return JSON.parse(record.body) as TelemetryData;
  } catch {
    return null;
  }
}

function processTelemetry(telemetry: TelemetryData): { candidates: DeviceCandidate[]; newAlerts: Alert[] } {
  const candidates: DeviceCandidate[] = [];
  const newAlerts: Alert[] = [];

  switch (telemetry.source) {
    case TelemetrySource.SNMP: {
      const parsed = snmpParser.parse(telemetry);
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

    case TelemetrySource.ARP: {
      const { arpEntries, macEntries } = arpParser.parse(telemetry);
      const topology = arpParser.buildL2Topology(arpEntries, macEntries);

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

    case TelemetrySource.NETFLOW: {
      const flows = netflowParser.parse(telemetry);

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

    case TelemetrySource.SYSLOG: {
      const events = syslogParser.parse(telemetry);

      for (const event of events) {
        const alert = syslogParser.toAlert(event);
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

async function storeAlerts(alerts: Alert[]): Promise<void> {
  if (alerts.length === 0) return;

  try {
    await initializeDatabase();
    const alertRepo = getAlertRepository();

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

    logger.info('Alerts stored successfully', { count: alerts.length });
  } catch (error) {
    logger.error('Failed to store alerts', {
      count: alerts.length,
      error: (error as Error).message
    });
    throw error;
  }
}

async function storeTopologySnapshot(snapshot: unknown): Promise<void> {
  try {
    await initializeDatabase();
    const snapshotRepo = getTopologySnapshotRepository();
    const typedSnapshot = snapshot as {
      id: string;
      devices: Device[];
      connections: Connection[];
      zones: unknown[];
      metadata: {
        deviceCount: number;
        connectionCount: number;
        collectionDuration: number;
        sources: TelemetrySource[];
      };
    };

    await snapshotRepo.createSnapshot({
      id: typedSnapshot.id,
      timestamp: new Date(),
      devices: typedSnapshot.devices,
      connections: typedSnapshot.connections,
      zones: typedSnapshot.zones as any,
      metadata: typedSnapshot.metadata,
    });

    logger.info('Topology snapshot stored successfully', {
      id: typedSnapshot.id,
      devices: typedSnapshot.metadata.deviceCount,
      connections: typedSnapshot.metadata.connectionCount,
    });
  } catch (error) {
    logger.error('Failed to store topology snapshot', {
      error: (error as Error).message
    });
    throw error;
  }
}

async function storeDevice(device: Device): Promise<void> {
  try {
    await initializeDatabase();
    const deviceRepo = getDeviceRepository();

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
      location: device.location as Record<string, unknown> | undefined,
      metadata: device.metadata,
      discoveredAt: device.discoveredAt,
      lastSeenAt: device.lastSeenAt,
    }, 'hostname');

    logger.debug('Device stored', { id: device.id, name: device.name });
  } catch (error) {
    logger.error('Failed to store device', {
      id: device.id,
      error: (error as Error).message
    });
    throw error;
  }
}

