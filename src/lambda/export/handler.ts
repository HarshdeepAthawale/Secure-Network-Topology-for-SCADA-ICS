/**
 * Export Lambda - Report generation and data export
 */

import { ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import { TopologySnapshot, Device, Connection, Alert, PurdueLevel } from '../../utils/types';
import { PURDUE_LEVEL_NAMES, COMPLIANCE_STANDARDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

interface ExportReport {
  id: string;
  type: 'topology' | 'compliance' | 'risk' | 'audit';
  generatedAt: Date;
  format: 'json' | 'csv' | 'pdf';
  data: unknown;
  metadata: Record<string, unknown>;
}

interface ComplianceReport {
  standard: string;
  assessmentDate: Date;
  overallStatus: 'compliant' | 'partial' | 'non-compliant';
  controls: Array<{
    id: string;
    name: string;
    status: 'pass' | 'fail' | 'partial' | 'not-applicable';
    findings: string[];
  }>;
  recommendations: string[];
}

export const handler: ScheduledHandler = async (event: ScheduledEvent): Promise<void> => {
  const requestId = generateUUID();
  logger.setContext({ requestId, function: 'export' });
  logger.info('Starting scheduled export');

  try {
    // Generate daily topology report
    const topologyReport = await generateTopologyReport();
    await storeReport(topologyReport);

    // Generate compliance report
    const complianceReport = await generateComplianceReport();
    await storeReport(complianceReport);

    // Generate risk summary
    const riskReport = await generateRiskReport();
    await storeReport(riskReport);

    logger.info('Export complete', {
      reports: ['topology', 'compliance', 'risk'],
    });
  } catch (error) {
    logger.exception(error as Error, 'Export failed');
    throw error;
  }
};

async function generateTopologyReport(): Promise<ExportReport> {
  logger.info('Generating topology report');

  // Placeholder - would fetch from database
  const devices: Device[] = [];
  const connections: Connection[] = [];

  const byLevel: Record<string, number> = {};
  for (const device of devices) {
    const levelName = PURDUE_LEVEL_NAMES[device.purdueLevel] || 'Unknown';
    byLevel[levelName] = (byLevel[levelName] || 0) + 1;
  }

  return {
    id: generateUUID(),
    type: 'topology',
    generatedAt: new Date(),
    format: 'json',
    data: {
      summary: {
        totalDevices: devices.length,
        totalConnections: connections.length,
        devicesByLevel: byLevel,
      },
      devices,
      connections,
    },
    metadata: {
      version: '1.0',
      generator: 'scada-topology-discovery',
    },
  };
}

async function generateComplianceReport(): Promise<ExportReport> {
  logger.info('Generating compliance report');

  const iec62443Report: ComplianceReport = {
    standard: 'IEC 62443',
    assessmentDate: new Date(),
    overallStatus: 'partial',
    controls: [
      {
        id: 'SR 1.1',
        name: 'Human user identification and authentication',
        status: 'partial',
        findings: ['Some devices lack proper authentication'],
      },
      {
        id: 'SR 2.1',
        name: 'Authorization enforcement',
        status: 'pass',
        findings: [],
      },
      {
        id: 'SR 3.1',
        name: 'Communication integrity',
        status: 'partial',
        findings: ['Unencrypted industrial protocols in use'],
      },
      {
        id: 'SR 5.1',
        name: 'Network segmentation',
        status: 'pass',
        findings: [],
      },
    ],
    recommendations: [
      'Implement SNMPv3 for all device management',
      'Enable TLS for all external communications',
      'Review firewall rules between zones',
    ],
  };

  return {
    id: generateUUID(),
    type: 'compliance',
    generatedAt: new Date(),
    format: 'json',
    data: {
      standards: [iec62443Report],
      summary: {
        totalControls: iec62443Report.controls.length,
        passing: iec62443Report.controls.filter(c => c.status === 'pass').length,
        failing: iec62443Report.controls.filter(c => c.status === 'fail').length,
        partial: iec62443Report.controls.filter(c => c.status === 'partial').length,
      },
    },
    metadata: {
      standards: ['IEC 62443', 'NERC CIP', 'NIST CSF'],
    },
  };
}

async function generateRiskReport(): Promise<ExportReport> {
  logger.info('Generating risk report');

  // Placeholder - would calculate from actual data
  return {
    id: generateUUID(),
    type: 'risk',
    generatedAt: new Date(),
    format: 'json',
    data: {
      overallRiskScore: 45,
      riskByLevel: {
        [PurdueLevel.LEVEL_0]: 35,
        [PurdueLevel.LEVEL_1]: 50,
        [PurdueLevel.LEVEL_2]: 40,
        [PurdueLevel.LEVEL_3]: 30,
        [PurdueLevel.DMZ]: 55,
      },
      highRiskDevices: [],
      criticalFindings: [],
      recommendations: [
        'Update firmware on Level 1 devices',
        'Enable encryption for Modbus communications',
        'Review DMZ firewall rules',
      ],
    },
    metadata: {
      methodology: 'CVSS-based scoring with OT-specific factors',
    },
  };
}

async function storeReport(report: ExportReport): Promise<void> {
  logger.info('Storing report', { type: report.type, id: report.id });

  // Placeholder - would store to S3
  // const key = `reports/${report.type}/${report.generatedAt.toISOString()}/${report.id}.json`;
  // await s3.putObject({ Bucket: 'reports-bucket', Key: key, Body: JSON.stringify(report) });
}

// Export functions for direct invocation
export async function exportTopologyToCSV(): Promise<string> {
  const report = await generateTopologyReport();
  const devices = (report.data as { devices: Device[] }).devices;

  const headers = ['ID', 'Name', 'Type', 'Vendor', 'Purdue Level', 'Status', 'IP Address'];
  const rows = devices.map(d => [
    d.id,
    d.name,
    d.type,
    d.vendor || '',
    PURDUE_LEVEL_NAMES[d.purdueLevel] || '',
    d.status,
    d.interfaces[0]?.ipAddress || '',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export async function exportAlertsToJSON(): Promise<string> {
  // Placeholder - would fetch from database
  const alerts: Alert[] = [];
  return JSON.stringify(alerts, null, 2);
}
