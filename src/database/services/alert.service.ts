/**
 * Alert Service - Business logic for security alert management
 */

import { Alert, AlertType, AlertSeverity, Device } from '../../utils/types';
import { AlertRepository, CreateAlertDTO, getAlertRepository } from '../repositories/alert.repository';
import { DeviceRepository, getDeviceRepository } from '../repositories/device.repository';
import { ConnectionRepository, getConnectionRepository } from '../repositories/connection.repository';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

// ============================================================================
// Types
// ============================================================================

export interface AlertWithDevice extends Alert {
    device?: Device;
}

export interface AlertStatistics {
    total: number;
    unacknowledged: number;
    unresolved: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    last24Hours: number;
    last7Days: number;
}

export interface AlertRule {
    id: string;
    name: string;
    description: string;
    condition: AlertCondition;
    severity: AlertSeverity;
    enabled: boolean;
}

export interface AlertCondition {
    type: 'device_offline' | 'cross_zone' | 'insecure_connection' | 'firmware_outdated' | 'custom';
    parameters: Record<string, unknown>;
}

export interface AlertNotification {
    alertId: string;
    channel: 'email' | 'slack' | 'webhook' | 'sms';
    recipient: string;
    sentAt: Date;
    status: 'pending' | 'sent' | 'failed';
}

// ============================================================================
// Alert Service Class
// ============================================================================

export class AlertService {
    private alertRepo: AlertRepository;
    private deviceRepo: DeviceRepository;
    private connectionRepo: ConnectionRepository;

    constructor() {
        this.alertRepo = getAlertRepository();
        this.deviceRepo = getDeviceRepository();
        this.connectionRepo = getConnectionRepository();
    }

    /**
     * Create a new alert
     */
    async createAlert(data: {
        type: AlertType;
        severity: AlertSeverity;
        title: string;
        description: string;
        deviceId?: string;
        connectionId?: string;
        details?: Record<string, unknown>;
        remediation?: string;
    }): Promise<Alert> {
        const alert = await this.alertRepo.create({
            id: generateUUID(),
            ...data,
        });

        logger.info('Alert created', {
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
    async createDeviceOfflineAlert(device: Device): Promise<Alert> {
        return this.createAlert({
            type: AlertType.DEVICE_OFFLINE,
            severity: AlertSeverity.HIGH,
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
    async createCrossZoneAlert(sourceDevice: Device, targetDevice: Device, connectionId: string): Promise<Alert> {
        return this.createAlert({
            type: AlertType.SECURITY_VIOLATION,
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
    async createInsecureConnectionAlert(connectionId: string, protocol: string, sourceDevice: Device, targetDevice: Device): Promise<Alert> {
        return this.createAlert({
            type: AlertType.INSECURE_PROTOCOL,
            severity: AlertSeverity.MEDIUM,
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
    async createNewDeviceAlert(device: Device): Promise<Alert> {
        return this.createAlert({
            type: AlertType.NEW_DEVICE,
            severity: AlertSeverity.LOW,
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
    async createConfigurationChangeAlert(device: Device, changes: string[]): Promise<Alert> {
        return this.createAlert({
            type: AlertType.CONFIGURATION_CHANGE,
            severity: AlertSeverity.MEDIUM,
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
    async getAlertById(id: string): Promise<AlertWithDevice | null> {
        const alert = await this.alertRepo.findById(id);
        if (!alert) return null;

        let device: Device | undefined;
        if (alert.deviceId) {
            device = (await this.deviceRepo.findById(alert.deviceId)) || undefined;
        }

        return { ...alert, device };
    }

    /**
     * Get unacknowledged alerts
     */
    async getUnacknowledgedAlerts(limit = 100): Promise<Alert[]> {
        return this.alertRepo.findUnacknowledged(limit);
    }

    /**
     * Get unresolved alerts
     */
    async getUnresolvedAlerts(limit = 100): Promise<Alert[]> {
        return this.alertRepo.findUnresolved(limit);
    }

    /**
     * Get critical alerts
     */
    async getCriticalAlerts(limit = 100): Promise<Alert[]> {
        return this.alertRepo.findBySeverity(AlertSeverity.CRITICAL, limit);
    }

    /**
     * Acknowledge alert
     */
    async acknowledgeAlert(id: string, acknowledgedBy: string, notes?: string): Promise<Alert | null> {
        const alert = await this.alertRepo.acknowledge(id, acknowledgedBy, notes);
        if (alert) {
            logger.info('Alert acknowledged', { id, acknowledgedBy });
        }
        return alert;
    }

    /**
     * Resolve alert
     */
    async resolveAlert(id: string, resolvedBy: string, resolution?: string): Promise<Alert | null> {
        const alert = await this.alertRepo.resolve(id, resolvedBy, resolution);
        if (alert) {
            logger.info('Alert resolved', { id, resolvedBy });
        }
        return alert;
    }

    /**
     * Bulk acknowledge alerts
     */
    async bulkAcknowledge(ids: string[], acknowledgedBy: string): Promise<number> {
        let count = 0;
        for (const id of ids) {
            const result = await this.alertRepo.acknowledge(id, acknowledgedBy);
            if (result) count++;
        }
        logger.info('Bulk acknowledge completed', { count, total: ids.length, acknowledgedBy });
        return count;
    }

    /**
     * Bulk resolve alerts
     */
    async bulkResolve(ids: string[], resolvedBy: string): Promise<number> {
        let count = 0;
        for (const id of ids) {
            const result = await this.alertRepo.resolve(id, resolvedBy);
            if (result) count++;
        }
        logger.info('Bulk resolve completed', { count, total: ids.length, resolvedBy });
        return count;
    }

    /**
     * Get alert statistics
     */
    async getStatistics(): Promise<AlertStatistics> {
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
    async getAlertsInTimeRange(hours: number): Promise<Alert[]> {
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
    async searchAlerts(criteria: {
        type?: AlertType;
        severity?: AlertSeverity;
        deviceId?: string;
        acknowledged?: boolean;
        resolved?: boolean;
        fromDate?: Date;
        toDate?: Date;
    }, page = 1, limit = 50) {
        return this.alertRepo.search(criteria, page, limit);
    }

    /**
     * Get alerts by device
     */
    async getDeviceAlerts(deviceId: string, includeResolved = false): Promise<Alert[]> {
        const alerts = await this.alertRepo.findByDeviceId(deviceId);
        if (includeResolved) {
            return alerts;
        }
        return alerts.filter(a => !a.resolved);
    }

    /**
     * Run automated alert checks
     */
    async runAutomatedChecks(): Promise<Alert[]> {
        const newAlerts: Alert[] = [];

        // Check for offline devices
        const offlineDevices = await this.deviceRepo.findOfflineDevices(1);
        for (const device of offlineDevices) {
            // Check if alert already exists
            const existingAlerts = await this.alertRepo.findByDeviceId(device.id);
            const hasOfflineAlert = existingAlerts.some(
                a => a.type === AlertType.DEVICE_OFFLINE && !a.resolved
            );

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
                    type: AlertType.INSECURE_PROTOCOL,
                    resolved: false,
                });

                const hasAlert = existingAlerts.data.some(
                    a => a.connectionId === conn.id
                );

                if (!hasAlert) {
                    const alert = await this.createInsecureConnectionAlert(
                        conn.id,
                        conn.protocol || 'unknown',
                        source,
                        target
                    );
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
                    type: AlertType.SECURITY_VIOLATION,
                    resolved: false,
                });

                const hasAlert = existingAlerts.data.some(
                    a => a.connectionId === conn.id
                );

                if (!hasAlert) {
                    const alert = await this.createCrossZoneAlert(source, target, conn.id);
                    newAlerts.push(alert);
                }
            }
        }

        logger.info('Automated alert check completed', { newAlerts: newAlerts.length });
        return newAlerts;
    }

    /**
     * Calculate severity for cross-zone connections
     */
    private calculateCrossZoneSeverity(source: Device, target: Device): AlertSeverity {
        const levelDiff = Math.abs(source.purdueLevel - target.purdueLevel);

        // Critical if crossing major boundaries
        if (levelDiff >= 3) {
            return AlertSeverity.CRITICAL;
        }
        if (levelDiff >= 2) {
            return AlertSeverity.HIGH;
        }
        if (levelDiff >= 1) {
            return AlertSeverity.MEDIUM;
        }
        return AlertSeverity.LOW;
    }

    /**
     * Delete alert
     */
    async deleteAlert(id: string): Promise<boolean> {
        return this.alertRepo.delete(id);
    }

    /**
     * Delete old resolved alerts
     */
    async cleanupOldAlerts(daysOld = 90): Promise<number> {
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

        logger.info('Old alerts cleanup completed', { deleted, daysOld });
        return deleted;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let alertServiceInstance: AlertService | null = null;

export function getAlertService(): AlertService {
    if (!alertServiceInstance) {
        alertServiceInstance = new AlertService();
    }
    return alertServiceInstance;
}
