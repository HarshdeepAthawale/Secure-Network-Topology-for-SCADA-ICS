"use strict";
/**
 * Alert Service - Business logic for security alert management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
exports.getAlertService = getAlertService;
const types_1 = require("../../utils/types");
const alert_repository_1 = require("../repositories/alert.repository");
const device_repository_1 = require("../repositories/device.repository");
const connection_repository_1 = require("../repositories/connection.repository");
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
// ============================================================================
// Alert Service Class
// ============================================================================
class AlertService {
    alertRepo;
    deviceRepo;
    connectionRepo;
    constructor() {
        this.alertRepo = (0, alert_repository_1.getAlertRepository)();
        this.deviceRepo = (0, device_repository_1.getDeviceRepository)();
        this.connectionRepo = (0, connection_repository_1.getConnectionRepository)();
    }
    /**
     * Create a new alert
     */
    async createAlert(data) {
        const alert = await this.alertRepo.create({
            id: (0, crypto_1.generateUUID)(),
            ...data,
        });
        logger_1.logger.info('Alert created', {
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
        });
        return alert;
    }
    /**
     * Create alert for offline device
     */
    async createDeviceOfflineAlert(device) {
        return this.createAlert({
            type: types_1.AlertType.DEVICE_OFFLINE,
            severity: types_1.AlertSeverity.HIGH,
            title: `Device Offline: ${device.name}`,
            description: `Device ${device.name} (${device.hostname || device.id}) has gone offline. Last seen: ${device.lastSeenAt?.toISOString()}`,
            deviceId: device.id,
            details: {
                deviceName: device.name,
                deviceType: device.type,
                purdueLevel: device.purdueLevel,
                securityZone: device.securityZone,
                lastSeenAt: device.lastSeenAt,
            },
            remediation: 'Verify network connectivity, check device power supply, and review device logs.',
        });
    }
    /**
     * Create alert for cross-zone connection
     */
    async createCrossZoneAlert(sourceDevice, targetDevice, connectionId) {
        return this.createAlert({
            type: types_1.AlertType.SECURITY_VIOLATION,
            severity: this.calculateCrossZoneSeverity(sourceDevice, targetDevice),
            title: `Cross-Zone Connection Detected`,
            description: `Connection detected between ${sourceDevice.name} (${sourceDevice.securityZone}) and ${targetDevice.name} (${targetDevice.securityZone})`,
            connectionId,
            details: {
                sourceDevice: {
                    id: sourceDevice.id,
                    name: sourceDevice.name,
                    zone: sourceDevice.securityZone,
                    purdueLevel: sourceDevice.purdueLevel,
                },
                targetDevice: {
                    id: targetDevice.id,
                    name: targetDevice.name,
                    zone: targetDevice.securityZone,
                    purdueLevel: targetDevice.purdueLevel,
                },
            },
            remediation: 'Review network segmentation policies. Ensure this connection is authorized and properly secured.',
        });
    }
    /**
     * Create alert for insecure connection
     */
    async createInsecureConnectionAlert(connectionId, protocol, sourceDevice, targetDevice) {
        return this.createAlert({
            type: types_1.AlertType.INSECURE_PROTOCOL,
            severity: types_1.AlertSeverity.MEDIUM,
            title: `Insecure Protocol in Use: ${protocol}`,
            description: `Unencrypted connection using ${protocol} detected between ${sourceDevice.name} and ${targetDevice.name}`,
            connectionId,
            details: {
                protocol,
                sourceDevice: sourceDevice.name,
                targetDevice: targetDevice.name,
            },
            remediation: `Consider upgrading to secure version of ${protocol} or implementing TLS encryption.`,
        });
    }
    /**
     * Create alert for new device
     */
    async createNewDeviceAlert(device) {
        return this.createAlert({
            type: types_1.AlertType.NEW_DEVICE,
            severity: types_1.AlertSeverity.LOW,
            title: `New Device Discovered: ${device.name}`,
            description: `A new device has been discovered on the network: ${device.name} (${device.type})`,
            deviceId: device.id,
            details: {
                deviceName: device.name,
                deviceType: device.type,
                vendor: device.vendor,
                purdueLevel: device.purdueLevel,
                securityZone: device.securityZone,
                discoveredAt: device.discoveredAt,
            },
            remediation: 'Verify this device is authorized. Update asset inventory if needed.',
        });
    }
    /**
     * Create alert for configuration change
     */
    async createConfigurationChangeAlert(device, changes) {
        return this.createAlert({
            type: types_1.AlertType.CONFIGURATION_CHANGE,
            severity: types_1.AlertSeverity.MEDIUM,
            title: `Configuration Change: ${device.name}`,
            description: `Configuration changes detected on ${device.name}: ${changes.join(', ')}`,
            deviceId: device.id,
            details: {
                deviceName: device.name,
                changes,
                detectedAt: new Date(),
            },
            remediation: 'Review configuration changes and verify they are authorized.',
        });
    }
    /**
     * Get alert by ID with device info
     */
    async getAlertById(id) {
        const alert = await this.alertRepo.findById(id);
        if (!alert)
            return null;
        let device;
        if (alert.deviceId) {
            device = (await this.deviceRepo.findById(alert.deviceId)) || undefined;
        }
        return { ...alert, device };
    }
    /**
     * Get unacknowledged alerts
     */
    async getUnacknowledgedAlerts(limit = 100) {
        return this.alertRepo.findUnacknowledged(limit);
    }
    /**
     * Get unresolved alerts
     */
    async getUnresolvedAlerts(limit = 100) {
        return this.alertRepo.findUnresolved(limit);
    }
    /**
     * Get critical alerts
     */
    async getCriticalAlerts(limit = 100) {
        return this.alertRepo.findBySeverity(types_1.AlertSeverity.CRITICAL, limit);
    }
    /**
     * Acknowledge alert
     */
    async acknowledgeAlert(id, acknowledgedBy, notes) {
        const alert = await this.alertRepo.acknowledge(id, acknowledgedBy, notes);
        if (alert) {
            logger_1.logger.info('Alert acknowledged', { id, acknowledgedBy });
        }
        return alert;
    }
    /**
     * Resolve alert
     */
    async resolveAlert(id, resolvedBy, resolution) {
        const alert = await this.alertRepo.resolve(id, resolvedBy, resolution);
        if (alert) {
            logger_1.logger.info('Alert resolved', { id, resolvedBy });
        }
        return alert;
    }
    /**
     * Bulk acknowledge alerts
     */
    async bulkAcknowledge(ids, acknowledgedBy) {
        let count = 0;
        for (const id of ids) {
            const result = await this.alertRepo.acknowledge(id, acknowledgedBy);
            if (result)
                count++;
        }
        logger_1.logger.info('Bulk acknowledge completed', { count, total: ids.length, acknowledgedBy });
        return count;
    }
    /**
     * Bulk resolve alerts
     */
    async bulkResolve(ids, resolvedBy) {
        let count = 0;
        for (const id of ids) {
            const result = await this.alertRepo.resolve(id, resolvedBy);
            if (result)
                count++;
        }
        logger_1.logger.info('Bulk resolve completed', { count, total: ids.length, resolvedBy });
        return count;
    }
    /**
     * Get alert statistics
     */
    async getStatistics() {
        const stats = await this.alertRepo.getAlertStats();
        const last24Hours = await this.getAlertsInTimeRange(24);
        const last7Days = await this.getAlertsInTimeRange(24 * 7);
        return {
            ...stats,
            last24Hours: last24Hours.length,
            last7Days: last7Days.length,
        };
    }
    /**
     * Get alerts in time range
     */
    async getAlertsInTimeRange(hours) {
        const fromDate = new Date();
        fromDate.setHours(fromDate.getHours() - hours);
        const result = await this.alertRepo.search({
            fromDate,
        });
        return result.data;
    }
    /**
     * Search alerts
     */
    async searchAlerts(criteria, page = 1, limit = 50) {
        return this.alertRepo.search(criteria, page, limit);
    }
    /**
     * Get alerts by device
     */
    async getDeviceAlerts(deviceId, includeResolved = false) {
        const alerts = await this.alertRepo.findByDeviceId(deviceId);
        if (includeResolved) {
            return alerts;
        }
        return alerts.filter(a => !a.resolved);
    }
    /**
     * Run automated alert checks
     */
    async runAutomatedChecks() {
        const newAlerts = [];
        // Check for offline devices
        const offlineDevices = await this.deviceRepo.findOfflineDevices(1);
        for (const device of offlineDevices) {
            // Check if alert already exists
            const existingAlerts = await this.alertRepo.findByDeviceId(device.id);
            const hasOfflineAlert = existingAlerts.some(a => a.type === types_1.AlertType.DEVICE_OFFLINE && !a.resolved);
            if (!hasOfflineAlert) {
                const alert = await this.createDeviceOfflineAlert(device);
                newAlerts.push(alert);
            }
        }
        // Check for insecure connections
        const insecureConnections = await this.connectionRepo.findInsecureConnections();
        for (const conn of insecureConnections.slice(0, 10)) { // Limit to 10
            const [source, target] = await Promise.all([
                this.deviceRepo.findById(conn.sourceDeviceId),
                this.deviceRepo.findById(conn.targetDeviceId),
            ]);
            if (source && target) {
                const existingAlerts = await this.alertRepo.search({
                    type: types_1.AlertType.INSECURE_PROTOCOL,
                    resolved: false,
                });
                const hasAlert = existingAlerts.data.some(a => a.connectionId === conn.id);
                if (!hasAlert) {
                    const alert = await this.createInsecureConnectionAlert(conn.id, conn.protocol || 'unknown', source, target);
                    newAlerts.push(alert);
                }
            }
        }
        // Check for cross-zone connections
        const crossZoneConnections = await this.connectionRepo.findCrossZoneConnections();
        for (const crossZone of crossZoneConnections.slice(0, 10)) { // Limit to 10
            const conn = crossZone.connection;
            const [source, target] = await Promise.all([
                this.deviceRepo.findById(conn.sourceDeviceId),
                this.deviceRepo.findById(conn.targetDeviceId),
            ]);
            if (source && target) {
                const existingAlerts = await this.alertRepo.search({
                    type: types_1.AlertType.SECURITY_VIOLATION,
                    resolved: false,
                });
                const hasAlert = existingAlerts.data.some(a => a.connectionId === conn.id);
                if (!hasAlert) {
                    const alert = await this.createCrossZoneAlert(source, target, conn.id);
                    newAlerts.push(alert);
                }
            }
        }
        logger_1.logger.info('Automated alert check completed', { newAlerts: newAlerts.length });
        return newAlerts;
    }
    /**
     * Calculate severity for cross-zone connections
     */
    calculateCrossZoneSeverity(source, target) {
        const levelDiff = Math.abs(source.purdueLevel - target.purdueLevel);
        // Critical if crossing major boundaries
        if (levelDiff >= 3) {
            return types_1.AlertSeverity.CRITICAL;
        }
        if (levelDiff >= 2) {
            return types_1.AlertSeverity.HIGH;
        }
        if (levelDiff >= 1) {
            return types_1.AlertSeverity.MEDIUM;
        }
        return types_1.AlertSeverity.LOW;
    }
    /**
     * Delete alert
     */
    async deleteAlert(id) {
        return this.alertRepo.delete(id);
    }
    /**
     * Delete old resolved alerts
     */
    async cleanupOldAlerts(daysOld = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await this.alertRepo.search({
            resolved: true,
            toDate: cutoffDate,
        }, 1, 1000);
        let deleted = 0;
        for (const alert of result.data) {
            if (await this.alertRepo.delete(alert.id)) {
                deleted++;
            }
        }
        logger_1.logger.info('Old alerts cleanup completed', { deleted, daysOld });
        return deleted;
    }
}
exports.AlertService = AlertService;
// ============================================================================
// Singleton Instance
// ============================================================================
let alertServiceInstance = null;
function getAlertService() {
    if (!alertServiceInstance) {
        alertServiceInstance = new AlertService();
    }
    return alertServiceInstance;
}
//# sourceMappingURL=alert.service.js.map