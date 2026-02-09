"use strict";
/**
 * Telemetry Repository - Database operations for telemetry data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryRepository = void 0;
exports.getTelemetryRepository = getTelemetryRepository;
const base_repository_1 = require("./base.repository");
const logger_1 = require("../../utils/logger");
// ============================================================================
// Telemetry Repository Class
// ============================================================================
class TelemetryRepository extends base_repository_1.BaseRepository {
    constructor() {
        super('telemetry');
    }
    /**
     * Convert database row to TelemetryData entity
     */
    toEntity(row) {
        return {
            id: row.id,
            source: row.source,
            deviceId: row.device_id || undefined,
            timestamp: new Date(row.timestamp),
            data: row.data || {},
            raw: row.raw || undefined,
            processed: row.processed,
            metadata: row.metadata || {},
        };
    }
    /**
     * Convert create DTO to database columns
     */
    processCreateData(data) {
        return {
            id: data.id,
            source: data.source,
            device_id: data.deviceId,
            timestamp: data.timestamp,
            data: JSON.stringify(data.data || {}),
            raw_data: data.raw,
            processed: data.processed ?? false,
            metadata: JSON.stringify(data.metadata || {}),
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
     * Insert telemetry data (optimized for high volume)
     */
    async insertTelemetry(data) {
        const processedData = this.processCreateData(data);
        const row = await this.db.insert(this.tableName, processedData);
        return this.toEntity(row);
    }
    /**
     * Bulk insert telemetry data
     */
    async bulkInsertTelemetry(dataArray) {
        if (dataArray.length === 0)
            return 0;
        const processedData = dataArray.map(d => this.processCreateData(d));
        await this.db.bulkInsert(this.tableName, processedData);
        logger_1.logger.debug('Bulk telemetry inserted', { count: dataArray.length });
        return dataArray.length;
    }
    /**
     * Find unprocessed telemetry
     */
    async findUnprocessed(limit = 100) {
        const rows = await this.db.query(`
      SELECT * FROM ${this.tableName}
      WHERE processed = false
      ORDER BY timestamp ASC
      LIMIT ${limit}
    `);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Mark telemetry as processed
     */
    async markProcessed(id) {
        await this.db.query(`UPDATE ${this.tableName} SET processed = true WHERE id = $1`, [id]);
    }
    /**
     * Mark multiple telemetry records as processed
     */
    async markManyProcessed(ids) {
        if (ids.length === 0)
            return;
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        await this.db.query(`UPDATE ${this.tableName} SET processed = true WHERE id IN (${placeholders})`, ids);
    }
    /**
     * Find telemetry by source
     */
    async findBySource(source, limit = 100) {
        const rows = await this.db.query(`
      SELECT * FROM ${this.tableName}
      WHERE source = $1
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `, [source]);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Find telemetry by device
     */
    async findByDeviceId(deviceId, limit = 100) {
        const rows = await this.db.query(`
      SELECT * FROM ${this.tableName}
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `, [deviceId]);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Search telemetry with criteria
     */
    async search(criteria, page = 1, limit = 100) {
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        if (criteria.source) {
            conditions.push(`source = $${paramIndex++}`);
            params.push(criteria.source);
        }
        if (criteria.deviceId) {
            conditions.push(`device_id = $${paramIndex++}`);
            params.push(criteria.deviceId);
        }
        if (criteria.processed !== undefined) {
            conditions.push(`processed = $${paramIndex++}`);
            params.push(criteria.processed);
        }
        if (criteria.fromDate) {
            conditions.push(`timestamp >= $${paramIndex++}`);
            params.push(criteria.fromDate);
        }
        if (criteria.toDate) {
            conditions.push(`timestamp <= $${paramIndex++}`);
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
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
        const rows = await this.db.query(dataSql, params);
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
     * Get telemetry count by source
     */
    async countBySource() {
        const rows = await this.db.query(`
      SELECT source, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY source
    `);
        const result = {};
        rows.forEach(row => {
            result[row.source] = parseInt(row.count);
        });
        return result;
    }
    /**
     * Get telemetry rate (records per minute) for last hour
     */
    async getTelemetryRate() {
        const rows = await this.db.query(`
      SELECT 
        date_trunc('minute', timestamp) as minute,
        source,
        COUNT(*) as count
      FROM ${this.tableName}
      WHERE timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY 1, 2
      ORDER BY 1 DESC
    `);
        return rows.map(row => ({
            minute: new Date(row.minute),
            count: parseInt(row.count),
            source: row.source,
        }));
    }
    /**
     * Get recent telemetry for dashboard
     */
    async getRecentTelemetry(minutes = 5, limit = 100) {
        const rows = await this.db.query(`
      SELECT * FROM ${this.tableName}
      WHERE timestamp > NOW() - INTERVAL '${minutes} minutes'
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Delete old telemetry data (partition maintenance)
     */
    async purgeOldTelemetry(days) {
        const deleted = await this.db.delete(this.tableName, `timestamp < NOW() - INTERVAL '${days} days'`, []);
        logger_1.logger.info('Purged old telemetry', { days, deleted });
        return deleted;
    }
    /**
     * Get storage statistics
     */
    async getStorageStats() {
        const [total, processed, bySource, dates] = await Promise.all([
            this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName}`),
            this.db.queryCount(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE processed = true`),
            this.countBySource(),
            this.db.queryOne(`
        SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM ${this.tableName}
      `),
        ]);
        return {
            totalRecords: total,
            processedRecords: processed,
            unprocessedRecords: total - processed,
            bySource,
            oldestRecord: dates?.oldest || null,
            newestRecord: dates?.newest || null,
        };
    }
}
exports.TelemetryRepository = TelemetryRepository;
// ============================================================================
// Singleton Instance
// ============================================================================
let telemetryRepositoryInstance = null;
function getTelemetryRepository() {
    if (!telemetryRepositoryInstance) {
        telemetryRepositoryInstance = new TelemetryRepository();
    }
    return telemetryRepositoryInstance;
}
//# sourceMappingURL=telemetry.repository.js.map