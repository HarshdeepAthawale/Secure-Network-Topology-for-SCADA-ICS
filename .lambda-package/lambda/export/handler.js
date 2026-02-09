"use strict";
/**
 * Export Lambda - Report generation and data export
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
exports.exportTopologyToCSV = exportTopologyToCSV;
exports.exportAlertsToJSON = exportAlertsToJSON;
const types_1 = require("../../utils/types");
const constants_1 = require("../../utils/constants");
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
const handler = async (event) => {
    const requestId = (0, crypto_1.generateUUID)();
    logger_1.logger.setContext({ requestId, function: 'export' });
    logger_1.logger.info('Starting scheduled export');
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
        logger_1.logger.info('Export complete', {
            reports: ['topology', 'compliance', 'risk'],
        });
    }
    catch (error) {
        logger_1.logger.exception(error, 'Export failed');
        throw error;
    }
};
exports.handler = handler;
async function generateTopologyReport() {
    logger_1.logger.info('Generating topology report');
    // Placeholder - would fetch from database
    const devices = [];
    const connections = [];
    const byLevel = {};
    for (const device of devices) {
        const levelName = constants_1.PURDUE_LEVEL_NAMES[device.purdueLevel] || 'Unknown';
        byLevel[levelName] = (byLevel[levelName] || 0) + 1;
    }
    return {
        id: (0, crypto_1.generateUUID)(),
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
async function generateComplianceReport() {
    logger_1.logger.info('Generating compliance report');
    const iec62443Report = {
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
        id: (0, crypto_1.generateUUID)(),
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
async function generateRiskReport() {
    logger_1.logger.info('Generating risk report');
    // Placeholder - would calculate from actual data
    return {
        id: (0, crypto_1.generateUUID)(),
        type: 'risk',
        generatedAt: new Date(),
        format: 'json',
        data: {
            overallRiskScore: 45,
            riskByLevel: {
                [types_1.PurdueLevel.LEVEL_0]: 35,
                [types_1.PurdueLevel.LEVEL_1]: 50,
                [types_1.PurdueLevel.LEVEL_2]: 40,
                [types_1.PurdueLevel.LEVEL_3]: 30,
                [types_1.PurdueLevel.DMZ]: 55,
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
async function storeReport(report) {
    logger_1.logger.info('Storing report', { type: report.type, id: report.id });
    // Placeholder - would store to S3
    // const key = `reports/${report.type}/${report.generatedAt.toISOString()}/${report.id}.json`;
    // await s3.putObject({ Bucket: 'reports-bucket', Key: key, Body: JSON.stringify(report) });
}
// Export functions for direct invocation
async function exportTopologyToCSV() {
    const report = await generateTopologyReport();
    const devices = report.data.devices;
    const headers = ['ID', 'Name', 'Type', 'Vendor', 'Purdue Level', 'Status', 'IP Address'];
    const rows = devices.map(d => [
        d.id,
        d.name,
        d.type,
        d.vendor || '',
        constants_1.PURDUE_LEVEL_NAMES[d.purdueLevel] || '',
        d.status,
        d.interfaces[0]?.ipAddress || '',
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
async function exportAlertsToJSON() {
    // Placeholder - would fetch from database
    const alerts = [];
    return JSON.stringify(alerts, null, 2);
}
//# sourceMappingURL=handler.js.map