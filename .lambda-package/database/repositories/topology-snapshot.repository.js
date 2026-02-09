"use strict";
/**
 * Topology Snapshot Repository - Database operations for topology snapshots
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopologySnapshotRepository = void 0;
exports.getTopologySnapshotRepository = getTopologySnapshotRepository;
const base_repository_1 = require("./base.repository");
const logger_1 = require("../../utils/logger");
// ============================================================================
// Topology Snapshot Repository Class
// ============================================================================
class TopologySnapshotRepository extends base_repository_1.BaseRepository {
    constructor() {
        super('topology_snapshots');
    }
    /**
     * Convert database row to TopologySnapshot entity
     */
    toEntity(row) {
        const snapshotData = row.snapshot_data;
        return {
            id: row.id,
            timestamp: new Date(row.created_at),
            devices: (snapshotData.devices || []),
            connections: (snapshotData.connections || []),
            zones: (snapshotData.zones || []),
            metadata: {
                deviceCount: row.device_count,
                connectionCount: row.connection_count,
                collectionDuration: row.collection_duration,
                sources: row.sources,
            },
        };
    }
    /**
     * Convert create DTO to database columns
     */
    processCreateData(data) {
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
    async findById(id) {
        const row = await this.db.queryOne(`SELECT * FROM ${this.tableName} WHERE id = $1`, [id]);
        return row ? this.toEntity(row) : null;
    }
    /**
     * Create snapshot from current topology
     */
    async createSnapshot(snapshot) {
        const data = {
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
        const row = await this.db.insert(this.tableName, processedData);
        logger_1.logger.info('Topology snapshot created', {
            id: row.id,
            devices: row.device_count,
            connections: row.connection_count,
        });
        return this.toEntity(row);
    }
    /**
     * Get the latest snapshot
     */
    async getLatest() {
        const row = await this.db.queryOne(`
      SELECT * FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT 1
    `);
        return row ? this.toEntity(row) : null;
    }
    /**
     * Get snapshots for a time range
     */
    async findByTimeRange(from, to) {
        const rows = await this.db.query(`
      SELECT * FROM ${this.tableName}
      WHERE created_at >= $1 AND created_at <= $2
      ORDER BY created_at DESC
    `, [from, to]);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Get snapshot history with pagination (lightweight - no full data)
     */
    async getHistory(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const total = await this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName}`);
        const rows = await this.db.query(`
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
    async compareSnapshots(snapshotAId, snapshotBId) {
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
    async getGrowthTrend(days = 30) {
        const rows = await this.db.query(`
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
    async purgeOldSnapshots(keepLast) {
        const result = await this.db.query(`
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
            logger_1.logger.info('Purged old topology snapshots', { deleted, kept: keepLast });
        }
        return deleted;
    }
}
exports.TopologySnapshotRepository = TopologySnapshotRepository;
// ============================================================================
// Singleton Instance
// ============================================================================
let topologySnapshotRepositoryInstance = null;
function getTopologySnapshotRepository() {
    if (!topologySnapshotRepositoryInstance) {
        topologySnapshotRepositoryInstance = new TopologySnapshotRepository();
    }
    return topologySnapshotRepositoryInstance;
}
//# sourceMappingURL=topology-snapshot.repository.js.map