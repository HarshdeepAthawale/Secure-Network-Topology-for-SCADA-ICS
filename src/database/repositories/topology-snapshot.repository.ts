/**
 * Topology Snapshot Repository - Database operations for topology snapshots
 */

import { BaseRepository, PaginatedResult } from './base.repository';
import { TopologySnapshot, TelemetrySource } from '../../utils/types';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface CreateTopologySnapshotDTO {
    id?: string;
    deviceCount: number;
    connectionCount: number;
    collectionDuration: number;
    sources: TelemetrySource[];
    snapshotData: unknown; // Full topology JSON
}

interface DBTopologySnapshot {
    id: string;
    device_count: number;
    connection_count: number;
    collection_duration: number;
    sources: string[];
    snapshot_data: unknown;
    created_at: Date;
}

// ============================================================================
// Topology Snapshot Repository Class
// ============================================================================

export class TopologySnapshotRepository extends BaseRepository<TopologySnapshot, CreateTopologySnapshotDTO, Partial<CreateTopologySnapshotDTO>> {
    constructor() {
        super('topology_snapshots');
    }

    /**
     * Convert database row to TopologySnapshot entity
     */
    private toEntity(row: DBTopologySnapshot): TopologySnapshot {
        const snapshotData = row.snapshot_data as Record<string, unknown>;

        return {
            id: row.id,
            timestamp: new Date(row.created_at),
            devices: (snapshotData.devices || []) as TopologySnapshot['devices'],
            connections: (snapshotData.connections || []) as TopologySnapshot['connections'],
            zones: (snapshotData.zones || []) as TopologySnapshot['zones'],
            metadata: {
                deviceCount: row.device_count,
                connectionCount: row.connection_count,
                collectionDuration: row.collection_duration,
                sources: row.sources as TelemetrySource[],
            },
        };
    }

    /**
     * Convert create DTO to database columns
     */
    protected processCreateData(data: CreateTopologySnapshotDTO): Record<string, unknown> {
        return {
            id: data.id,
            device_count: data.deviceCount,
            connection_count: data.connectionCount,
            collection_duration: data.collectionDuration,
            sources: data.sources,
            snapshot_data: JSON.stringify(data.snapshotData),
        };
    }

    /**
     * Override findById to convert DB row to entity
     */
    async findById(id: string): Promise<TopologySnapshot | null> {
        const row = await this.db.queryOne<DBTopologySnapshot>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
        return row ? this.toEntity(row) : null;
    }

    /**
     * Create snapshot from current topology
     */
    async createSnapshot(snapshot: TopologySnapshot): Promise<TopologySnapshot> {
        const data: CreateTopologySnapshotDTO = {
            id: snapshot.id,
            deviceCount: snapshot.metadata.deviceCount,
            connectionCount: snapshot.metadata.connectionCount,
            collectionDuration: snapshot.metadata.collectionDuration,
            sources: snapshot.metadata.sources,
            snapshotData: {
                devices: snapshot.devices,
                connections: snapshot.connections,
                zones: snapshot.zones,
            },
        };

        const processedData = this.processCreateData(data);
        const row = await this.db.insert<DBTopologySnapshot>(this.tableName, processedData);

        logger.info('Topology snapshot created', {
            id: row.id,
            devices: row.device_count,
            connections: row.connection_count,
        });

        return this.toEntity(row);
    }

    /**
     * Get the latest snapshot
     */
    async getLatest(): Promise<TopologySnapshot | null> {
        const row = await this.db.queryOne<DBTopologySnapshot>(`
      SELECT * FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT 1
    `);

        return row ? this.toEntity(row) : null;
    }

    /**
     * Get snapshots for a time range
     */
    async findByTimeRange(from: Date, to: Date): Promise<TopologySnapshot[]> {
        const rows = await this.db.query<DBTopologySnapshot>(`
      SELECT * FROM ${this.tableName}
      WHERE created_at >= $1 AND created_at <= $2
      ORDER BY created_at DESC
    `, [from, to]);

        return rows.map(row => this.toEntity(row));
    }

    /**
     * Get snapshot history with pagination (lightweight - no full data)
     */
    async getHistory(page = 1, limit = 20): Promise<PaginatedResult<{
        id: string;
        timestamp: Date;
        deviceCount: number;
        connectionCount: number;
    }>> {
        const offset = (page - 1) * limit;

        const total = await this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName}`);

        const rows = await this.db.query<{
            id: string;
            created_at: Date;
            device_count: number;
            connection_count: number;
        }>(`
      SELECT id, created_at, device_count, connection_count
      FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

        const totalPages = Math.ceil(total / limit);

        return {
            data: rows.map(row => ({
                id: row.id,
                timestamp: new Date(row.created_at),
                deviceCount: row.device_count,
                connectionCount: row.connection_count,
            })),
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
     * Compare two snapshots
     */
    async compareSnapshots(snapshotAId: string, snapshotBId: string): Promise<{
        addedDevices: string[];
        removedDevices: string[];
        addedConnections: string[];
        removedConnections: string[];
    } | null> {
        const [snapshotA, snapshotB] = await Promise.all([
            this.findById(snapshotAId),
            this.findById(snapshotBId),
        ]);

        if (!snapshotA || !snapshotB) {
            return null;
        }

        const deviceIdsA = new Set(snapshotA.devices.map(d => d.id));
        const deviceIdsB = new Set(snapshotB.devices.map(d => d.id));
        const connectionIdsA = new Set(snapshotA.connections.map(c => c.id));
        const connectionIdsB = new Set(snapshotB.connections.map(c => c.id));

        return {
            addedDevices: [...deviceIdsB].filter(id => !deviceIdsA.has(id)),
            removedDevices: [...deviceIdsA].filter(id => !deviceIdsB.has(id)),
            addedConnections: [...connectionIdsB].filter(id => !connectionIdsA.has(id)),
            removedConnections: [...connectionIdsA].filter(id => !connectionIdsB.has(id)),
        };
    }

    /**
     * Get topology growth trend
     */
    async getGrowthTrend(days = 30): Promise<Array<{
        date: Date;
        deviceCount: number;
        connectionCount: number;
    }>> {
        const rows = await this.db.query<{
            date: Date;
            device_count: number;
            connection_count: number;
        }>(`
      SELECT 
        date_trunc('day', created_at) as date,
        MAX(device_count) as device_count,
        MAX(connection_count) as connection_count
      FROM ${this.tableName}
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY 1
      ORDER BY 1
    `);

        return rows.map(row => ({
            date: new Date(row.date),
            deviceCount: row.device_count,
            connectionCount: row.connection_count,
        }));
    }

    /**
     * Delete old snapshots (keep last N)
     */
    async purgeOldSnapshots(keepLast: number): Promise<number> {
        const result = await this.db.query<{ id: string }>(`
      DELETE FROM ${this.tableName}
      WHERE id NOT IN (
        SELECT id FROM ${this.tableName}
        ORDER BY created_at DESC
        LIMIT ${keepLast}
      )
      RETURNING id
    `);

        const deleted = result.length;
        if (deleted > 0) {
            logger.info('Purged old topology snapshots', { deleted, kept: keepLast });
        }
        return deleted;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let topologySnapshotRepositoryInstance: TopologySnapshotRepository | null = null;

export function getTopologySnapshotRepository(): TopologySnapshotRepository {
    if (!topologySnapshotRepositoryInstance) {
        topologySnapshotRepositoryInstance = new TopologySnapshotRepository();
    }
    return topologySnapshotRepositoryInstance;
}
