/**
 * Alert Repository - Database operations for security alerts
 */

import { BaseRepository, PaginatedResult } from './base.repository';
import { Alert, AlertSeverity, AlertType } from '../../utils/types';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

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

interface DBAlert {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    device_id: string | null;
    connection_id: string | null;
    details: Record<string, unknown>;
    remediation: string | null;
    acknowledged: boolean;
    acknowledged_by: string | null;
    acknowledged_at: Date | null;
    resolved: boolean;
    resolved_at: Date | null;
    created_at: Date;
}

// ============================================================================
// Alert Repository Class
// ============================================================================

export class AlertRepository extends BaseRepository<Alert, CreateAlertDTO, UpdateAlertDTO> {
    constructor() {
        super('alerts');
    }

    /**
     * Convert database row to Alert entity
     */
    private toEntity(row: DBAlert): Alert {
        return {
            id: row.id,
            type: row.type as AlertType,
            severity: row.severity as AlertSeverity,
            title: row.title,
            description: row.description,
            deviceId: row.device_id || undefined,
            connectionId: row.connection_id || undefined,
            details: row.details || {},
            remediation: row.remediation || undefined,
            acknowledged: row.acknowledged,
            acknowledgedBy: row.acknowledged_by || undefined,
            acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
            resolved: row.resolved,
            resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
            createdAt: new Date(row.created_at),
        };
    }

    /**
     * Convert create DTO to database columns
     */
    protected processCreateData(data: CreateAlertDTO): Record<string, unknown> {
        return {
            id: data.id || uuidv4(),
            type: data.type,
            severity: data.severity,
            title: data.title,
            description: data.description,
            device_id: data.deviceId,
            connection_id: data.connectionId,
            details: JSON.stringify(data.details || {}),
            remediation: data.remediation,
            acknowledged: false,
            resolved: false,
        };
    }

    /**
     * Convert update DTO to database columns
     */
    protected processUpdateData(data: UpdateAlertDTO): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        if (data.acknowledged !== undefined) result.acknowledged = data.acknowledged;
        if (data.acknowledgedBy !== undefined) result.acknowledged_by = data.acknowledgedBy;
        if (data.acknowledgedAt !== undefined) result.acknowledged_at = data.acknowledgedAt;
        if (data.resolved !== undefined) result.resolved = data.resolved;
        if (data.resolvedAt !== undefined) result.resolved_at = data.resolvedAt;

        return result;
    }

    /**
     * Override findById to convert DB row to entity
     */
    async findById(id: string): Promise<Alert | null> {
        const row = await this.db.queryOne<DBAlert>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
        return row ? this.toEntity(row) : null;
    }

    /**
     * Override create to convert database row to entity
     */
    async create(data: CreateAlertDTO): Promise<Alert> {
        const processedData = this.processCreateData(data);
        const row = await this.db.insert<DBAlert>(this.tableName, processedData);
        return this.toEntity(row);
    }

    /**
     * Find active (unresolved) alerts
     */
    async findActive(): Promise<Alert[]> {
        const rows = await this.db.query<DBAlert>(`
      SELECT * FROM ${this.tableName}
      WHERE resolved = false
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        created_at DESC
    `);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Find alerts by severity
     */
    async findBySeverity(severity: AlertSeverity, limit = 100): Promise<Alert[]> {
        const rows = await this.db.query<DBAlert>(`
      SELECT * FROM ${this.tableName}
      WHERE severity = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [severity, limit]);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Find unacknowledged alerts
     */
    async findUnacknowledged(limit = 100): Promise<Alert[]> {
        const rows = await this.db.query<DBAlert>(`
      SELECT * FROM ${this.tableName}
      WHERE acknowledged = false
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        created_at DESC
      LIMIT $1
    `, [limit]);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Find unresolved alerts
     */
    async findUnresolved(limit = 100): Promise<Alert[]> {
        const rows = await this.db.query<DBAlert>(`
      SELECT * FROM ${this.tableName}
      WHERE resolved = false
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        created_at DESC
      LIMIT $1
    `, [limit]);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Get alert statistics
     */
    async getAlertStats(): Promise<{
        total: number;
        unacknowledged: number;
        unresolved: number;
        bySeverity: Record<string, number>;
        byType: Record<string, number>;
    }> {
        const [total, unacknowledged, unresolved, bySeverity, byType] = await Promise.all([
            this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName}`),
            this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE acknowledged = false`),
            this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE resolved = false`),
            this.countBySeverity(false),
            this.countByType(false),
        ]);

        return {
            total,
            unacknowledged,
            unresolved,
            bySeverity,
            byType,
        };
    }

    /**
     * Find alerts for a specific device
     */
    async findByDeviceId(deviceId: string): Promise<Alert[]> {
        const rows = await this.db.query<DBAlert>(`
      SELECT * FROM ${this.tableName}
      WHERE device_id = $1
      ORDER BY created_at DESC
    `, [deviceId]);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Search alerts with criteria
     */
    async search(criteria: AlertSearchCriteria, page = 1, limit = 50): Promise<PaginatedResult<Alert>> {
        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (criteria.type) {
            conditions.push(`type = $${paramIndex++}`);
            params.push(criteria.type);
        }

        if (criteria.severity) {
            conditions.push(`severity = $${paramIndex++}`);
            params.push(criteria.severity);
        }

        if (criteria.deviceId) {
            conditions.push(`device_id = $${paramIndex++}`);
            params.push(criteria.deviceId);
        }

        if (criteria.acknowledged !== undefined) {
            conditions.push(`acknowledged = $${paramIndex++}`);
            params.push(criteria.acknowledged);
        }

        if (criteria.resolved !== undefined) {
            conditions.push(`resolved = $${paramIndex++}`);
            params.push(criteria.resolved);
        }

        if (criteria.fromDate) {
            conditions.push(`created_at >= $${paramIndex++}`);
            params.push(criteria.fromDate);
        }

        if (criteria.toDate) {
            conditions.push(`created_at <= $${paramIndex++}`);
            params.push(criteria.toDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (page - 1) * limit;

        // Count total
        const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
        const total = await this.db.queryCount(countSql, params);

        // Get data
        const dataSql = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
        const rows = await this.db.query<DBAlert>(dataSql, params);

        const totalPages = Math.ceil(total / limit);

        return {
            data: rows.map(row => this.toEntity(row)),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1,
            },
        };
    }

    /**
     * Acknowledge an alert
     */
    async acknowledge(id: string, userId: string, notes?: string): Promise<Alert | null> {
        const updated = await this.update(id, {
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: new Date(),
        });

        if (updated) {
            logger.info('Alert acknowledged', { alertId: id, userId, notes });
        }

        return updated;
    }

    /**
     * Resolve an alert
     */
    async resolve(id: string, resolvedBy?: string, resolution?: string): Promise<Alert | null> {
        const updated = await this.update(id, {
            resolved: true,
            resolvedAt: new Date(),
        });

        if (updated) {
            logger.info('Alert resolved', { alertId: id, resolvedBy, resolution });
        }

        return updated;
    }

    /**
     * Bulk acknowledge alerts
     */
    async bulkAcknowledge(ids: string[], userId: string): Promise<number> {
        if (ids.length === 0) return 0;

        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const result = await this.db.query<{ id: string }>(`
      UPDATE ${this.tableName}
      SET acknowledged = true, acknowledged_by = $${ids.length + 1}, acknowledged_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders}) AND acknowledged = false
      RETURNING id
    `, [...ids, userId]);

        logger.info('Bulk alerts acknowledged', { count: result.length, userId });
        return result.length;
    }

    /**
     * Get alert count by severity
     */
    async countBySeverity(onlyActive = true): Promise<Record<string, number>> {
        const whereClause = onlyActive ? 'WHERE resolved = false' : '';
        const rows = await this.db.query<{ severity: string; count: string }>(`
      SELECT severity, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY severity
    `);

        const result: Record<string, number> = {};
        rows.forEach(row => {
            result[row.severity] = parseInt(row.count);
        });
        return result;
    }

    /**
     * Get alert count by type
     */
    async countByType(onlyActive = true): Promise<Record<string, number>> {
        const whereClause = onlyActive ? 'WHERE resolved = false' : '';
        const rows = await this.db.query<{ type: string; count: string }>(`
      SELECT type, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY type
    `);

        const result: Record<string, number> = {};
        rows.forEach(row => {
            result[row.type] = parseInt(row.count);
        });
        return result;
    }

    /**
     * Get recent alert statistics
     */
    async getRecentStats(hours = 24): Promise<{
        total: number;
        bySeverity: Record<string, number>;
        byType: Record<string, number>;
        acknowledged: number;
        resolved: number;
    }> {
        const timeFilter = `WHERE created_at > NOW() - INTERVAL '${hours} hours'`;

        const [total, bySeverity, byType, acknowledged, resolved] = await Promise.all([
            this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName} ${timeFilter}`),
            this.db.query<{ severity: string; count: string }>(`
        SELECT severity, COUNT(*) as count FROM ${this.tableName} ${timeFilter} GROUP BY severity
      `),
            this.db.query<{ type: string; count: string }>(`
        SELECT type, COUNT(*) as count FROM ${this.tableName} ${timeFilter} GROUP BY type
      `),
            this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName} ${timeFilter} AND acknowledged = true`),
            this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName} ${timeFilter} AND resolved = true`),
        ]);

        const severityMap: Record<string, number> = {};
        bySeverity.forEach(row => { severityMap[row.severity] = parseInt(row.count); });

        const typeMap: Record<string, number> = {};
        byType.forEach(row => { typeMap[row.type] = parseInt(row.count); });

        return {
            total,
            bySeverity: severityMap,
            byType: typeMap,
            acknowledged,
            resolved,
        };
    }

    /**
     * Get critical and high alerts for dashboard
     */
    async getCriticalAlerts(limit = 10): Promise<Alert[]> {
        const rows = await this.db.query<DBAlert>(`
      SELECT * FROM ${this.tableName}
      WHERE resolved = false AND severity IN ('critical', 'high')
      ORDER BY 
        CASE severity WHEN 'critical' THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT ${limit}
    `);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Delete old resolved alerts
     */
    async purgeOldAlerts(days: number): Promise<number> {
        return this.db.delete(
            this.tableName,
            `resolved = true AND resolved_at < NOW() - INTERVAL '${days} days'`,
            []
        );
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let alertRepositoryInstance: AlertRepository | null = null;

export function getAlertRepository(): AlertRepository {
    if (!alertRepositoryInstance) {
        alertRepositoryInstance = new AlertRepository();
    }
    return alertRepositoryInstance;
}
