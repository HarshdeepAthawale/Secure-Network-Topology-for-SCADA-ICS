/**
 * Connection Repository - Database operations for network connections
 */

import { BaseRepository, PaginatedResult } from './base.repository';
import { Connection, ConnectionType } from '../../utils/types';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface CreateConnectionDTO {
    id?: string;
    sourceDeviceId: string;
    targetDeviceId: string;
    sourceInterface?: string;
    targetInterface?: string;
    connectionType: ConnectionType;
    protocol?: string;
    port?: number;
    vlanId?: number;
    bandwidth?: number;
    latency?: number;
    isSecure?: boolean;
    encryptionType?: string;
    discoveredAt: Date;
    lastSeenAt: Date;
    metadata?: Record<string, unknown>;
}

export interface UpdateConnectionDTO {
    bandwidth?: number;
    latency?: number;
    isSecure?: boolean;
    encryptionType?: string;
    lastSeenAt?: Date;
    metadata?: Record<string, unknown>;
}

export interface ConnectionSearchCriteria {
    sourceDeviceId?: string;
    targetDeviceId?: string;
    connectionType?: ConnectionType;
    protocol?: string;
    isSecure?: boolean;
}

interface DBConnection {
    id: string;
    source_device_id: string;
    target_device_id: string;
    source_interface: string | null;
    target_interface: string | null;
    connection_type: string;
    protocol: string | null;
    port: number | null;
    vlan_id: number | null;
    bandwidth: number | null;
    latency: number | null;
    is_secure: boolean;
    encryption_type: string | null;
    discovered_at: Date;
    last_seen_at: Date;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
}

// ============================================================================
// Connection Repository Class
// ============================================================================

export class ConnectionRepository extends BaseRepository<Connection, CreateConnectionDTO, UpdateConnectionDTO> {
    constructor() {
        super('connections');
    }

    /**
     * Convert database row to Connection entity
     */
    private toEntity(row: DBConnection): Connection {
        return {
            id: row.id,
            sourceDeviceId: row.source_device_id,
            targetDeviceId: row.target_device_id,
            sourceInterface: row.source_interface || undefined,
            targetInterface: row.target_interface || undefined,
            connectionType: row.connection_type as ConnectionType,
            protocol: row.protocol || undefined,
            port: row.port || undefined,
            vlanId: row.vlan_id || undefined,
            bandwidth: row.bandwidth || undefined,
            latency: row.latency || undefined,
            isSecure: row.is_secure,
            encryptionType: row.encryption_type || undefined,
            discoveredAt: new Date(row.discovered_at),
            lastSeenAt: new Date(row.last_seen_at),
            metadata: row.metadata || {},
        };
    }

    /**
     * Convert create DTO to database columns
     */
    protected processCreateData(data: CreateConnectionDTO): Record<string, unknown> {
        return {
            id: data.id,
            source_device_id: data.sourceDeviceId,
            target_device_id: data.targetDeviceId,
            source_interface: data.sourceInterface,
            target_interface: data.targetInterface,
            connection_type: data.connectionType,
            protocol: data.protocol,
            port: data.port,
            vlan_id: data.vlanId,
            bandwidth: data.bandwidth,
            latency: data.latency,
            is_secure: data.isSecure ?? false,
            encryption_type: data.encryptionType,
            discovered_at: data.discoveredAt,
            last_seen_at: data.lastSeenAt,
            metadata: JSON.stringify(data.metadata || {}),
        };
    }

    /**
     * Convert update DTO to database columns
     */
    protected processUpdateData(data: UpdateConnectionDTO): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        if (data.bandwidth !== undefined) result.bandwidth = data.bandwidth;
        if (data.latency !== undefined) result.latency = data.latency;
        if (data.isSecure !== undefined) result.is_secure = data.isSecure;
        if (data.encryptionType !== undefined) result.encryption_type = data.encryptionType;
        if (data.lastSeenAt !== undefined) result.last_seen_at = data.lastSeenAt;
        if (data.metadata !== undefined) result.metadata = JSON.stringify(data.metadata);

        return result;
    }

    /**
     * Override findById to convert DB row to entity
     */
    async findById(id: string): Promise<Connection | null> {
        const row = await this.db.queryOne<DBConnection>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
        return row ? this.toEntity(row) : null;
    }

    /**
     * Find all connections for a device (as source or target)
     */
    async findByDeviceId(deviceId: string): Promise<Connection[]> {
        const rows = await this.db.query<DBConnection>(`
      SELECT * FROM ${this.tableName}
      WHERE source_device_id = $1 OR target_device_id = $1
      ORDER BY last_seen_at DESC
    `, [deviceId]);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Find connection between two devices
     */
    async findBetweenDevices(deviceA: string, deviceB: string): Promise<Connection | null> {
        const row = await this.db.queryOne<DBConnection>(`
      SELECT * FROM ${this.tableName}
      WHERE (source_device_id = $1 AND target_device_id = $2)
         OR (source_device_id = $2 AND target_device_id = $1)
      LIMIT 1
    `, [deviceA, deviceB]);

        return row ? this.toEntity(row) : null;
    }

    /**
     * Search connections with criteria
     */
    async search(criteria: ConnectionSearchCriteria, page = 1, limit = 100): Promise<PaginatedResult<Connection>> {
        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (criteria.sourceDeviceId) {
            conditions.push(`source_device_id = $${paramIndex++}`);
            params.push(criteria.sourceDeviceId);
        }

        if (criteria.targetDeviceId) {
            conditions.push(`target_device_id = $${paramIndex++}`);
            params.push(criteria.targetDeviceId);
        }

        if (criteria.connectionType) {
            conditions.push(`connection_type = $${paramIndex++}`);
            params.push(criteria.connectionType);
        }

        if (criteria.protocol) {
            conditions.push(`protocol = $${paramIndex++}`);
            params.push(criteria.protocol);
        }

        if (criteria.isSecure !== undefined) {
            conditions.push(`is_secure = $${paramIndex++}`);
            params.push(criteria.isSecure);
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
      ORDER BY last_seen_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
        const rows = await this.db.query<DBConnection>(dataSql, params);

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
     * Find insecure connections
     */
    async findInsecureConnections(): Promise<Connection[]> {
        const rows = await this.db.query<DBConnection>(`
      SELECT * FROM ${this.tableName}
      WHERE is_secure = false
      ORDER BY last_seen_at DESC
    `);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Find connections by protocol
     */
    async findByProtocol(protocol: string): Promise<Connection[]> {
        const rows = await this.db.query<DBConnection>(`
      SELECT * FROM ${this.tableName}
      WHERE protocol ILIKE $1
      ORDER BY last_seen_at DESC
    `, [`%${protocol}%`]);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Get connection count by type
     */
    async countByType(): Promise<Record<string, number>> {
        const rows = await this.db.query<{ connection_type: string; count: string }>(`
      SELECT connection_type, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY connection_type
    `);

        const result: Record<string, number> = {};
        rows.forEach(row => {
            result[row.connection_type] = parseInt(row.count);
        });
        return result;
    }

    /**
     * Get secure vs insecure connection stats
     */
    async getSecurityStats(): Promise<{ secure: number; insecure: number }> {
        const rows = await this.db.query<{ is_secure: boolean; count: string }>(`
      SELECT is_secure, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY is_secure
    `);

        const stats = { secure: 0, insecure: 0 };
        rows.forEach(row => {
            if (row.is_secure) {
                stats.secure = parseInt(row.count);
            } else {
                stats.insecure = parseInt(row.count);
            }
        });
        return stats;
    }

    /**
     * Upsert connection (insert or update if exists between devices)
     */
    async upsertConnection(data: CreateConnectionDTO): Promise<Connection> {
        // First check if connection exists
        const existing = await this.findBetweenDevices(data.sourceDeviceId, data.targetDeviceId);

        if (existing) {
            const updated = await this.update(existing.id, {
                bandwidth: data.bandwidth,
                latency: data.latency,
                isSecure: data.isSecure,
                lastSeenAt: data.lastSeenAt,
                metadata: data.metadata,
            });
            return updated || existing;
        }

        return this.create(data);
    }

    /**
     * Find connections crossing zones (potential security violations)
     */
    async findCrossZoneConnections(): Promise<Array<{ connection: Connection; sourcePurdue: number; targetPurdue: number }>> {
        const rows = await this.db.query<DBConnection & { source_purdue: string; target_purdue: string }>(`
      SELECT c.*, 
             sd.purdue_level as source_purdue,
             td.purdue_level as target_purdue
      FROM ${this.tableName} c
      INNER JOIN devices sd ON sd.id = c.source_device_id
      INNER JOIN devices td ON td.id = c.target_device_id
      WHERE sd.purdue_level != td.purdue_level
      ORDER BY c.last_seen_at DESC
    `);

        return rows.map(row => ({
            connection: this.toEntity(row),
            sourcePurdue: parseInt(row.source_purdue),
            targetPurdue: parseInt(row.target_purdue),
        }));
    }

    /**
     * Get network topology edges for visualization
     */
    async getTopologyEdges(): Promise<Array<{ source: string; target: string; type: string; isSecure: boolean }>> {
        const rows = await this.db.query<{ source_device_id: string; target_device_id: string; connection_type: string; is_secure: boolean }>(`
      SELECT source_device_id, target_device_id, connection_type, is_secure
      FROM ${this.tableName}
    `);

        return rows.map(row => ({
            source: row.source_device_id,
            target: row.target_device_id,
            type: row.connection_type,
            isSecure: row.is_secure,
        }));
    }

    /**
     * Update last seen for connection
     */
    async updateLastSeen(id: string): Promise<void> {
        await this.db.query(
            `UPDATE ${this.tableName} SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id]
        );
    }

    /**
     * Delete stale connections (not seen in specified hours)
     */
    async deleteStaleConnections(hours: number): Promise<number> {
        return this.db.delete(
            this.tableName,
            `last_seen_at < NOW() - INTERVAL '${hours} hours'`,
            []
        );
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let connectionRepositoryInstance: ConnectionRepository | null = null;

export function getConnectionRepository(): ConnectionRepository {
    if (!connectionRepositoryInstance) {
        connectionRepositoryInstance = new ConnectionRepository();
    }
    return connectionRepositoryInstance;
}
