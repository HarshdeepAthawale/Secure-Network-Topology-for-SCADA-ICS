/**
 * Alert Repository - Database operations for security alerts
 */
import { BaseRepository, PaginatedResult } from './base.repository';
import { Alert, AlertSeverity, AlertType } from '../../utils/types';
export interface CreateAlertDTO {
    id?: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string;
    deviceId?: string;
    connectionId?: string;
    details?: Record<string, unknown>;
    remediation?: string;
}
export interface UpdateAlertDTO {
    acknowledged?: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
    resolved?: boolean;
    resolvedAt?: Date;
}
export interface AlertSearchCriteria {
    type?: AlertType;
    severity?: AlertSeverity;
    deviceId?: string;
    acknowledged?: boolean;
    resolved?: boolean;
    fromDate?: Date;
    toDate?: Date;
}
export declare class AlertRepository extends BaseRepository<Alert, CreateAlertDTO, UpdateAlertDTO> {
    constructor();
    /**
     * Convert database row to Alert entity
     */
    private toEntity;
    /**
     * Convert create DTO to database columns
     */
    protected processCreateData(data: CreateAlertDTO): Record<string, unknown>;
    /**
     * Convert update DTO to database columns
     */
    protected processUpdateData(data: UpdateAlertDTO): Record<string, unknown>;
    /**
     * Override findById to convert DB row to entity
     */
    findById(id: string): Promise<Alert | null>;
    /**
     * Override create to convert database row to entity
     */
    create(data: CreateAlertDTO): Promise<Alert>;
    /**
     * Find active (unresolved) alerts
     */
    findActive(): Promise<Alert[]>;
    /**
     * Find alerts by severity
     */
    findBySeverity(severity: AlertSeverity, limit?: number): Promise<Alert[]>;
    /**
     * Find unacknowledged alerts
     */
    findUnacknowledged(limit?: number): Promise<Alert[]>;
    /**
     * Find unresolved alerts
     */
    findUnresolved(limit?: number): Promise<Alert[]>;
    /**
     * Get alert statistics
     */
    getAlertStats(): Promise<{
        total: number;
        unacknowledged: number;
        unresolved: number;
        bySeverity: Record<string, number>;
        byType: Record<string, number>;
    }>;
    /**
     * Find alerts for a specific device
     */
    findByDeviceId(deviceId: string): Promise<Alert[]>;
    /**
     * Search alerts with criteria
     */
    search(criteria: AlertSearchCriteria, page?: number, limit?: number): Promise<PaginatedResult<Alert>>;
    /**
     * Acknowledge an alert
     */
    acknowledge(id: string, userId: string, notes?: string): Promise<Alert | null>;
    /**
     * Resolve an alert
     */
    resolve(id: string, resolvedBy?: string, resolution?: string): Promise<Alert | null>;
    /**
     * Bulk acknowledge alerts
     */
    bulkAcknowledge(ids: string[], userId: string): Promise<number>;
    /**
     * Get alert count by severity
     */
    countBySeverity(onlyActive?: boolean): Promise<Record<string, number>>;
    /**
     * Get alert count by type
     */
    countByType(onlyActive?: boolean): Promise<Record<string, number>>;
    /**
     * Get recent alert statistics
     */
    getRecentStats(hours?: number): Promise<{
        total: number;
        bySeverity: Record<string, number>;
        byType: Record<string, number>;
        acknowledged: number;
        resolved: number;
    }>;
    /**
     * Get critical and high alerts for dashboard
     */
    getCriticalAlerts(limit?: number): Promise<Alert[]>;
    /**
     * Delete old resolved alerts
     */
    purgeOldAlerts(days: number): Promise<number>;
}
export declare function getAlertRepository(): AlertRepository;
//# sourceMappingURL=alert.repository.d.ts.map