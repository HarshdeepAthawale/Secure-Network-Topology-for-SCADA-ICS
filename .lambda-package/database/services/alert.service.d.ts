/**
 * Alert Service - Business logic for security alert management
 */
import { Alert, AlertType, AlertSeverity, Device } from '../../utils/types';
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
export declare class AlertService {
    private alertRepo;
    private deviceRepo;
    private connectionRepo;
    constructor();
    /**
     * Create a new alert
     */
    createAlert(data: {
        type: AlertType;
        severity: AlertSeverity;
        title: string;
        description: string;
        deviceId?: string;
        connectionId?: string;
        details?: Record<string, unknown>;
        remediation?: string;
    }): Promise<Alert>;
    /**
     * Create alert for offline device
     */
    createDeviceOfflineAlert(device: Device): Promise<Alert>;
    /**
     * Create alert for cross-zone connection
     */
    createCrossZoneAlert(sourceDevice: Device, targetDevice: Device, connectionId: string): Promise<Alert>;
    /**
     * Create alert for insecure connection
     */
    createInsecureConnectionAlert(connectionId: string, protocol: string, sourceDevice: Device, targetDevice: Device): Promise<Alert>;
    /**
     * Create alert for new device
     */
    createNewDeviceAlert(device: Device): Promise<Alert>;
    /**
     * Create alert for configuration change
     */
    createConfigurationChangeAlert(device: Device, changes: string[]): Promise<Alert>;
    /**
     * Get alert by ID with device info
     */
    getAlertById(id: string): Promise<AlertWithDevice | null>;
    /**
     * Get unacknowledged alerts
     */
    getUnacknowledgedAlerts(limit?: number): Promise<Alert[]>;
    /**
     * Get unresolved alerts
     */
    getUnresolvedAlerts(limit?: number): Promise<Alert[]>;
    /**
     * Get critical alerts
     */
    getCriticalAlerts(limit?: number): Promise<Alert[]>;
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(id: string, acknowledgedBy: string, notes?: string): Promise<Alert | null>;
    /**
     * Resolve alert
     */
    resolveAlert(id: string, resolvedBy: string, resolution?: string): Promise<Alert | null>;
    /**
     * Bulk acknowledge alerts
     */
    bulkAcknowledge(ids: string[], acknowledgedBy: string): Promise<number>;
    /**
     * Bulk resolve alerts
     */
    bulkResolve(ids: string[], resolvedBy: string): Promise<number>;
    /**
     * Get alert statistics
     */
    getStatistics(): Promise<AlertStatistics>;
    /**
     * Get alerts in time range
     */
    getAlertsInTimeRange(hours: number): Promise<Alert[]>;
    /**
     * Search alerts
     */
    searchAlerts(criteria: {
        type?: AlertType;
        severity?: AlertSeverity;
        deviceId?: string;
        acknowledged?: boolean;
        resolved?: boolean;
        fromDate?: Date;
        toDate?: Date;
    }, page?: number, limit?: number): Promise<import("..").PaginatedResult<Alert>>;
    /**
     * Get alerts by device
     */
    getDeviceAlerts(deviceId: string, includeResolved?: boolean): Promise<Alert[]>;
    /**
     * Run automated alert checks
     */
    runAutomatedChecks(): Promise<Alert[]>;
    /**
     * Calculate severity for cross-zone connections
     */
    private calculateCrossZoneSeverity;
    /**
     * Delete alert
     */
    deleteAlert(id: string): Promise<boolean>;
    /**
     * Delete old resolved alerts
     */
    cleanupOldAlerts(daysOld?: number): Promise<number>;
}
export declare function getAlertService(): AlertService;
//# sourceMappingURL=alert.service.d.ts.map