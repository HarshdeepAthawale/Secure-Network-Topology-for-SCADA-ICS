"use strict";
/**
 * Base Repository - Abstract class for all database repositories
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const connection_1 = require("../connection");
// ============================================================================
// Base Repository Class
// ============================================================================
class BaseRepository {
    tableName;
    db;
    primaryKey;
    constructor(tableName, primaryKey = 'id') {
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.db = (0, connection_1.getConnection)();
    }
    /**
     * Find all records with optional filtering
     */
    async findAll(options = {}) {
        const { where, orderBy, order = 'ASC', limit, offset, select } = options;
        const columns = select?.join(', ') || '*';
        let sql = `SELECT ${columns} FROM ${this.tableName}`;
        const params = [];
        // Build WHERE clause
        if (where && Object.keys(where).length > 0) {
            const conditions = Object.entries(where).map(([key, value], index) => {
                params.push(value);
                return `${key} = $${index + 1}`;
            });
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        // Add ORDER BY
        if (orderBy) {
            sql += ` ORDER BY ${orderBy} ${order}`;
        }
        // Add pagination
        if (limit) {
            sql += ` LIMIT ${limit}`;
        }
        if (offset) {
            sql += ` OFFSET ${offset}`;
        }
        return this.db.query(sql, params);
    }
    /**
     * Find records with pagination
     */
    async findPaginated(page, limit, options = {}) {
        const offset = (page - 1) * limit;
        // Get total count
        let countSql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const countParams = [];
        if (options.where && Object.keys(options.where).length > 0) {
            const conditions = Object.entries(options.where).map(([key, value], index) => {
                countParams.push(value);
                return `${key} = $${index + 1}`;
            });
            countSql += ` WHERE ${conditions.join(' AND ')}`;
        }
        const total = await this.db.queryCount(countSql, countParams);
        const totalPages = Math.ceil(total / limit);
        // Get data
        const data = await this.findAll({ ...options, limit, offset });
        return {
            data,
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
     * Find by primary key
     */
    async findById(id) {
        const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
        return this.db.queryOne(sql, [id]);
    }
    /**
     * Find one record by conditions
     */
    async findOne(where) {
        const results = await this.findAll({ where, limit: 1 });
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Find by multiple IDs
     */
    async findByIds(ids) {
        if (ids.length === 0)
            return [];
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} IN (${placeholders})`;
        return this.db.query(sql, ids);
    }
    /**
     * Create a new record
     */
    async create(data) {
        const processedData = this.processCreateData(data);
        return this.db.insert(this.tableName, processedData);
    }
    /**
     * Create multiple records
     */
    async createMany(dataArray) {
        if (dataArray.length === 0)
            return [];
        const processedData = dataArray.map(d => this.processCreateData(d));
        return this.db.bulkInsert(this.tableName, processedData);
    }
    /**
     * Update a record by ID
     */
    async update(id, data) {
        const processedData = this.processUpdateData(data);
        const results = await this.db.update(this.tableName, processedData, `${this.primaryKey} = $1`, [id]);
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Update multiple records
     */
    async updateMany(where, data) {
        const processedData = this.processUpdateData(data);
        const conditions = Object.entries(where).map(([key], index) => {
            return `${key} = $${Object.keys(processedData).length + index + 1}`;
        });
        return this.db.update(this.tableName, processedData, conditions.join(' AND '), Object.values(where));
    }
    /**
     * Upsert a record
     */
    async upsert(data, conflictColumns, updateColumns) {
        const processedData = this.processCreateData(data);
        return this.db.upsert(this.tableName, processedData, conflictColumns, updateColumns);
    }
    /**
     * Delete by ID
     */
    async delete(id) {
        const count = await this.db.delete(this.tableName, `${this.primaryKey} = $1`, [id]);
        return count > 0;
    }
    /**
     * Delete by conditions
     */
    async deleteMany(where) {
        const conditions = Object.entries(where).map(([key], index) => {
            return `${key} = $${index + 1}`;
        });
        return this.db.delete(this.tableName, conditions.join(' AND '), Object.values(where));
    }
    /**
     * Check if record exists
     */
    async exists(where) {
        const conditions = Object.entries(where).map(([key], index) => {
            return `${key} = $${index + 1}`;
        });
        const sql = `SELECT 1 FROM ${this.tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`;
        const result = await this.db.queryOne(sql, Object.values(where));
        return result !== null;
    }
    /**
     * Count records
     */
    async count(where) {
        let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const params = [];
        if (where && Object.keys(where).length > 0) {
            const conditions = Object.entries(where).map(([key, value], index) => {
                params.push(value);
                return `${key} = $${index + 1}`;
            });
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        return this.db.queryCount(sql, params);
    }
    /**
     * Execute raw query
     */
    async rawQuery(sql, params) {
        return this.db.query(sql, params);
    }
    /**
     * Execute in transaction
     */
    async transaction(callback) {
        return this.db.transaction(callback);
    }
    /**
     * Process data before create - Override in subclass if needed
     */
    processCreateData(data) {
        return data;
    }
    /**
     * Process data before update - Override in subclass if needed
     */
    processUpdateData(data) {
        const processed = data;
        // Remove undefined values
        Object.keys(processed).forEach(key => {
            if (processed[key] === undefined) {
                delete processed[key];
            }
        });
        return processed;
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=base.repository.js.map