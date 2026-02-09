"use strict";
/**
 * Export Service - Report generation and data export
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportService = void 0;
exports.getExportService = getExportService;
const types_1 = require("../../utils/types");
const topology_snapshot_repository_1 = require("../repositories/topology-snapshot.repository");
const device_repository_1 = require("../repositories/device.repository");
const connection_repository_1 = require("../repositories/connection.repository");
const alert_repository_1 = require("../repositories/alert.repository");
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
// ============================================================================
// Export Service Class
// ============================================================================
class ExportService {
    snapshotRepo;
    deviceRepo;
    connectionRepo;
    alertRepo;
    constructor() {
        this.snapshotRepo = (0, topology_snapshot_repository_1.getTopologySnapshotRepository)();
        this.deviceRepo = (0, device_repository_1.getDeviceRepository)();
        this.connectionRepo = (0, connection_repository_1.getConnectionRepository)();
        this.alertRepo = (0, alert_repository_1.getAlertRepository)();
    }
    /**
     * Export topology data
     */
    async exportTopology(options) {
        const data = await this.gatherExportData(options);
        switch (options.format) {
            case 'json':
                return this.toJSON(data);
            case 'csv':
                return this.toCSV(data);
            case 'xml':
                return this.toXML(data);
            case 'html':
                return this.toHTML(data);
            default:
                return this.toJSON(data);
        }
    }
    /**
     * Generate compliance report
     */
    async generateComplianceReport(framework) {
        const [devices, connections, alerts] = await Promise.all([
            this.deviceRepo.findAll({ limit: 10000 }),
            this.connectionRepo.findAll({ limit: 100000 }),
            this.alertRepo.findUnresolved(1000),
        ]);
        const findings = [];
        const recommendations = [];
        // Check network segmentation (IEC 62443, NIST)
        const crossZoneConnections = await this.connectionRepo.findCrossZoneConnections();
        if (crossZoneConnections.length > 0) {
            findings.push({
                id: (0, crypto_1.generateUUID)(),
                control: framework === 'IEC62443' ? 'SR 5.1' : 'SC-7',
                description: 'Cross-zone connections detected without proper segmentation',
                severity: types_1.AlertSeverity.HIGH,
                affectedDevices: [...new Set(crossZoneConnections.flatMap(c => [c.connection.sourceDeviceId, c.connection.targetDeviceId]))],
                status: 'non-compliant',
                evidence: `${crossZoneConnections.length} cross-zone connections detected`,
            });
            recommendations.push('Implement proper network segmentation between OT and IT zones');
        }
        // Check insecure protocols
        const insecureConnections = await this.connectionRepo.findInsecureConnections();
        if (insecureConnections.length > 0) {
            findings.push({
                id: (0, crypto_1.generateUUID)(),
                control: framework === 'IEC62443' ? 'SR 4.1' : 'SC-8',
                description: 'Insecure protocols in use for critical communications',
                severity: types_1.AlertSeverity.MEDIUM,
                affectedDevices: [...new Set(insecureConnections.flatMap(c => [c.sourceDeviceId, c.targetDeviceId]))],
                status: 'non-compliant',
                evidence: `${insecureConnections.length} connections using unencrypted protocols`,
            });
            recommendations.push('Upgrade to secure protocols (TLS, SNMPv3) for all communications');
        }
        // Check device inventory completeness
        const unknownDevices = devices.filter((d) => d.type === 'unknown');
        if (unknownDevices.length > 0) {
            findings.push({
                id: (0, crypto_1.generateUUID)(),
                control: framework === 'NERC-CIP' ? 'CIP-002' : 'CM-8',
                description: 'Incomplete asset inventory - unidentified devices present',
                severity: types_1.AlertSeverity.MEDIUM,
                affectedDevices: unknownDevices.map((d) => d.id),
                status: 'partial',
                evidence: `${unknownDevices.length} devices with unknown type`,
            });
            recommendations.push('Complete asset identification and classification for all network devices');
        }
        // Check offline devices
        const offlineDevices = devices.filter((d) => d.status === 'offline');
        if (offlineDevices.length > 0) {
            findings.push({
                id: (0, crypto_1.generateUUID)(),
                control: framework === 'IEC62443' ? 'SR 7.1' : 'SI-4',
                description: 'Devices offline - potential availability issues',
                severity: offlineDevices.length > 5 ? types_1.AlertSeverity.HIGH : types_1.AlertSeverity.LOW,
                affectedDevices: offlineDevices.map((d) => d.id),
                status: 'non-compliant',
                evidence: `${offlineDevices.length} devices currently offline`,
            });
            recommendations.push('Investigate offline devices and establish monitoring for device health');
        }
        // Calculate compliance score
        const totalControls = findings.length + 5; // Base controls that passed
        const passingControls = findings.filter(f => f.status === 'compliant').length + 5;
        const complianceScore = Math.round((passingControls / totalControls) * 100);
        const summary = {
            totalFindings: findings.length,
            criticalFindings: findings.filter(f => f.severity === types_1.AlertSeverity.CRITICAL).length,
            highFindings: findings.filter(f => f.severity === types_1.AlertSeverity.HIGH).length,
            mediumFindings: findings.filter(f => f.severity === types_1.AlertSeverity.MEDIUM).length,
            lowFindings: findings.filter(f => f.severity === types_1.AlertSeverity.LOW).length,
            complianceScore,
        };
        logger_1.logger.info('Compliance report generated', { framework, score: complianceScore, findings: findings.length });
        return {
            id: (0, crypto_1.generateUUID)(),
            generatedAt: new Date(),
            framework,
            summary,
            findings,
            recommendations,
        };
    }
    /**
     * Generate network diagram data
     */
    async generateNetworkDiagram() {
        const [devices, connections] = await Promise.all([
            this.deviceRepo.findAll({ limit: 10000 }),
            this.connectionRepo.findAll({ limit: 100000 }),
        ]);
        // Organize by Purdue level
        const levelColors = {
            0: '#FF6B6B', // Red - Process
            1: '#FF9F43', // Orange - Control
            2: '#FECA57', // Yellow - Supervisory
            3: '#48DBFB', // Cyan - Site Operations
            3.5: '#9B59B6', // Purple - DMZ
            4: '#54A0FF', // Blue - Enterprise
            5: '#1DD1A1', // Green - External
        };
        const zoneConfigs = {
            ot_process: { name: 'OT Process (L0)', level: 0, color: levelColors[0] },
            ot_control: { name: 'OT Control (L1)', level: 1, color: levelColors[1] },
            ot_supervisory: { name: 'OT Supervisory (L2)', level: 2, color: levelColors[2] },
            ot_site_operations: { name: 'Site Operations (L3)', level: 3, color: levelColors[3] },
            dmz: { name: 'DMZ (L3.5)', level: 3.5, color: levelColors[3.5] },
            it_enterprise: { name: 'IT Enterprise (L4)', level: 4, color: levelColors[4] },
            external: { name: 'External (L5)', level: 5, color: levelColors[5] },
        };
        const nodes = devices.map(device => ({
            id: device.id,
            label: device.name,
            group: device.securityZone,
            level: device.purdueLevel,
            color: levelColors[device.purdueLevel] || '#999999',
            shape: this.getDeviceShape(device.type),
        }));
        const edges = connections.map(conn => ({
            from: conn.sourceDeviceId,
            to: conn.targetDeviceId,
            label: conn.protocol,
            color: conn.isSecure ? '#2ECC71' : '#E74C3C',
            dashes: !conn.isSecure,
            width: conn.bandwidth ? Math.log10(conn.bandwidth) : 1,
        }));
        // Build zones
        const zoneDevices = new Map();
        for (const device of devices) {
            if (!zoneDevices.has(device.securityZone)) {
                zoneDevices.set(device.securityZone, []);
            }
            zoneDevices.get(device.securityZone).push(device.id);
        }
        const zones = Array.from(zoneDevices.entries()).map(([zone, deviceIds]) => ({
            id: zone,
            name: zoneConfigs[zone]?.name || zone,
            level: zoneConfigs[zone]?.level || 3,
            color: zoneConfigs[zone]?.color || '#999999',
            devices: deviceIds,
        }));
        return { nodes, edges, zones };
    }
    /**
     * Export device inventory
     */
    async exportDeviceInventory(format = 'csv') {
        const devices = await this.deviceRepo.findAll({ limit: 10000 });
        if (format === 'csv') {
            const headers = [
                'ID', 'Name', 'Hostname', 'Type', 'Vendor', 'Model',
                'Firmware Version', 'Serial Number', 'Purdue Level',
                'Security Zone', 'Status', 'Discovered At', 'Last Seen At'
            ];
            const rows = devices.map(d => [
                d.id,
                d.name,
                d.hostname || '',
                d.type,
                d.vendor || '',
                d.model || '',
                d.firmwareVersion || '',
                d.serialNumber || '',
                d.purdueLevel.toString(),
                d.securityZone,
                d.status,
                d.discoveredAt?.toISOString() || '',
                d.lastSeenAt?.toISOString() || '',
            ].join(','));
            return [headers.join(','), ...rows].join('\n');
        }
        return JSON.stringify(devices, null, 2);
    }
    /**
     * Export alert history
     */
    async exportAlertHistory(days = 30, format = 'csv') {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        const result = await this.alertRepo.search({
            fromDate,
        }, 1, 10000);
        if (format === 'csv') {
            const headers = [
                'ID', 'Type', 'Severity', 'Title', 'Description',
                'Device ID', 'Acknowledged', 'Resolved', 'Created At', 'Resolved At'
            ];
            const rows = result.data.map(a => [
                a.id,
                a.type,
                a.severity,
                `"${a.title.replace(/"/g, '""')}"`,
                `"${a.description.replace(/"/g, '""')}"`,
                a.deviceId || '',
                a.acknowledged ? 'Yes' : 'No',
                a.resolved ? 'Yes' : 'No',
                a.createdAt?.toISOString() || '',
                a.resolvedAt?.toISOString() || '',
            ].join(','));
            return [headers.join(','), ...rows].join('\n');
        }
        return JSON.stringify(result.data, null, 2);
    }
    /**
     * Gather export data based on options
     */
    async gatherExportData(options) {
        const data = {
            generatedAt: new Date(),
        };
        if (options.includeDevices !== false) {
            data.devices = await this.deviceRepo.findAll({ limit: 10000 });
        }
        if (options.includeConnections !== false) {
            data.connections = await this.connectionRepo.findAll({ limit: 100000 });
        }
        if (options.includeAlerts) {
            const result = await this.alertRepo.search({
                fromDate: options.dateRange?.from,
                toDate: options.dateRange?.to,
            }, 1, 10000);
            data.alerts = result.data;
        }
        if (options.includeMetadata !== false) {
            data.metadata = {
                exportedAt: new Date().toISOString(),
                deviceCount: data.devices?.length || 0,
                connectionCount: data.connections?.length || 0,
                alertCount: data.alerts?.length || 0,
            };
        }
        return data;
    }
    /**
     * Convert to JSON
     */
    toJSON(data) {
        return JSON.stringify(data, null, 2);
    }
    /**
     * Convert to CSV (simplified - devices only)
     */
    toCSV(data) {
        if (!data.devices)
            return '';
        const headers = ['id', 'name', 'type', 'vendor', 'model', 'purdueLevel', 'securityZone', 'status'];
        const rows = data.devices.map(d => headers.map(h => d[h] || '').join(','));
        return [headers.join(','), ...rows].join('\n');
    }
    /**
     * Convert to XML
     */
    toXML(data) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<topology>\n';
        if (data.devices) {
            xml += '  <devices>\n';
            for (const device of data.devices) {
                xml += `    <device id="${device.id}">\n`;
                xml += `      <name>${this.escapeXML(device.name)}</name>\n`;
                xml += `      <type>${device.type}</type>\n`;
                xml += `      <purdueLevel>${device.purdueLevel}</purdueLevel>\n`;
                xml += `      <securityZone>${device.securityZone}</securityZone>\n`;
                xml += `      <status>${device.status}</status>\n`;
                xml += '    </device>\n';
            }
            xml += '  </devices>\n';
        }
        if (data.connections) {
            xml += '  <connections>\n';
            for (const conn of data.connections) {
                xml += `    <connection id="${conn.id}">\n`;
                xml += `      <source>${conn.sourceDeviceId}</source>\n`;
                xml += `      <target>${conn.targetDeviceId}</target>\n`;
                xml += `      <protocol>${conn.protocol}</protocol>\n`;
                xml += `      <isSecure>${conn.isSecure}</isSecure>\n`;
                xml += '    </connection>\n';
            }
            xml += '  </connections>\n';
        }
        xml += '</topology>';
        return xml;
    }
    /**
     * Convert to HTML report
     */
    toHTML(data) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SCADA Network Topology Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; background: #f5f5f5; }
    h1 { color: #2c3e50; }
    h2 { color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #3498db; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    .summary { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px; }
    .stat { display: inline-block; margin-right: 40px; }
    .stat-value { font-size: 2em; font-weight: bold; color: #3498db; }
    .stat-label { color: #666; }
    .status-online { color: #27ae60; }
    .status-offline { color: #e74c3c; }
    .level-0, .level-1 { background: #ffe6e6; }
    .level-2 { background: #fff0e6; }
    .level-3 { background: #e6f3ff; }
  </style>
</head>
<body>
  <h1>🔒 SCADA Network Topology Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  <div class="summary">
    <div class="stat">
      <div class="stat-value">${data.devices?.length || 0}</div>
      <div class="stat-label">Devices</div>
    </div>
    <div class="stat">
      <div class="stat-value">${data.connections?.length || 0}</div>
      <div class="stat-label">Connections</div>
    </div>
  </div>

  <h2>Devices</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Vendor</th>
        <th>Purdue Level</th>
        <th>Security Zone</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${(data.devices || []).map(d => `
        <tr class="level-${d.purdueLevel}">
          <td><strong>${this.escapeXML(d.name)}</strong></td>
          <td>${d.type}</td>
          <td>${d.vendor || '-'}</td>
          <td>Level ${d.purdueLevel}</td>
          <td>${d.securityZone}</td>
          <td class="status-${d.status}">${d.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Network Connections</h2>
  <table>
    <thead>
      <tr>
        <th>Source</th>
        <th>Target</th>
        <th>Protocol</th>
        <th>Secure</th>
      </tr>
    </thead>
    <tbody>
      ${(data.connections || []).slice(0, 100).map(c => `
        <tr>
          <td>${c.sourceDeviceId}</td>
          <td>${c.targetDeviceId}</td>
          <td>${c.protocol}</td>
          <td>${c.isSecure ? '✅ Yes' : '⚠️ No'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
    `;
    }
    /**
     * Escape XML special characters
     */
    escapeXML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    /**
     * Get device shape for diagram
     */
    getDeviceShape(type) {
        const shapes = {
            plc: 'box',
            rtu: 'box',
            hmi: 'ellipse',
            scada_server: 'database',
            historian: 'database',
            workstation: 'dot',
            server: 'database',
            switch: 'diamond',
            router: 'triangle',
            firewall: 'star',
            sensor: 'triangleDown',
            actuator: 'square',
        };
        return shapes[type] || 'dot';
    }
}
exports.ExportService = ExportService;
// ============================================================================
// Singleton Instance
// ============================================================================
let exportServiceInstance = null;
function getExportService() {
    if (!exportServiceInstance) {
        exportServiceInstance = new ExportService();
    }
    return exportServiceInstance;
}
//# sourceMappingURL=export.service.js.map