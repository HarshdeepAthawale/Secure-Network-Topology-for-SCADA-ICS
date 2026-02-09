"use strict";
/**
 * PostgreSQL Database Connection Pool
 * Provides secure connection management for SCADA topology data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnection = void 0;
exports.getConnection = getConnection;
exports.initializeDatabase = initializeDatabase;
exports.closeDatabase = closeDatabase;
const pg_1 = require("pg");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
// ============================================================================
// Database Connection Class
// ============================================================================
class DatabaseConnection {
    pool = null;
    isConnected = false;
    connectionAttempts = 0;
    maxRetries = 3;
    retryDelay = 2000;
    /**
     * Initialize the connection pool
     */
    async connect() {
        if (this.isConnected && this.pool) {
            logger_1.logger.debug('Database already connected');
            return;
        }
        const dbConfig = config_1.config.database;
        const poolConfig = {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password,
            ssl: dbConfig.ssl ? { rejectUnauthorized: true } : false,
            max: dbConfig.poolSize,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            statement_timeout: 60000,
        };
        try {
            this.pool = new pg_1.Pool(poolConfig);
            // Add error handler for the pool
            this.pool.on('error', (err) => {
                logger_1.logger.error('Unexpected database pool error', { error: err.message });
            });
            // Test the connection
            await this.testConnection();
            this.isConnected = true;
            this.connectionAttempts = 0;
            logger_1.logger.info('Database connection pool established', {
                host: dbConfig.host,
                database: dbConfig.database,
                poolSize: dbConfig.poolSize,
            });
        }
        catch (error) {
            this.connectionAttempts++;
            logger_1.logger.error('Failed to connect to database', {
                error: error.message,
                attempt: this.connectionAttempts,
            });
            if (this.connectionAttempts < this.maxRetries) {
                logger_1.logger.info(`Retrying connection in ${this.retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.connect();
            }
            throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
        }
    }
    /**
     * Test the database connection
     */
    async testConnection() {
        if (!this.pool)
            throw new Error('Pool not initialized');
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT NOW() as current_time, current_database() as database');
            logger_1.logger.debug('Database connection test successful', {
                time: result.rows[0].current_time,
                database: result.rows[0].database,
            });
        }
        finally {
            client.release();
        }
    }
    /**
     * Close the connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.isConnected = false;
            logger_1.logger.info('Database connection pool closed');
        }
    }
    /**
     * Execute a query with parameters
     */
    async query(sql, params, options) {
        if (!this.pool || !this.isConnected) {
            await this.connect();
        }
        const startTime = Date.now();
        try {
            const result = await this.pool.query({
                text: sql,
                values: params,
                name: options?.name,
            });
            const duration = Date.now() - startTime;
            logger_1.logger.debug('Query executed', {
                sql: sql.substring(0, 100),
                params: params?.length || 0,
                rows: result.rowCount,
                duration: `${duration}ms`,
            });
            return result.rows;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            logger_1.logger.error('Query failed', {
                sql: sql.substring(0, 100),
                error: error.message,
                duration: `${duration}ms`,
            });
            throw error;
        }
    }
    /**
     * Execute a query and return single result
     */
    async queryOne(sql, params, options) {
        const results = await this.query(sql, params, options);
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Execute a query and return count
     */
    async queryCount(sql, params) {
        const result = await this.queryOne(sql, params);
        return result ? parseInt(result.count, 10) : 0;
    }
    /**
     * Execute an INSERT and return the inserted row
     */
    async insert(table, data, returning = '*') {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`);
        const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING ${returning}
    `;
        const result = await this.query(sql, values);
        return result[0];
    }
    /**
     * Execute an UPDATE and return affected rows
     */
    async update(table, data, whereClause, whereParams, returning = '*') {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        const adjustedWhereParams = whereParams.map((_, i) => `$${columns.length + i + 1}`);
        const sql = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause.replace(/\$(\d+)/g, (_, num) => `$${parseInt(num) + columns.length}`)}
      RETURNING ${returning}
    `;
        return this.query(sql, [...values, ...whereParams]);
    }
    /**
     * Execute a DELETE and return affected count
     */
    async delete(table, whereClause, whereParams) {
        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        const result = await this.query(sql, whereParams);
        // pg returns rows affected in a different way, we'll use the direct query result
        const deleteResult = await this.pool.query(sql, whereParams);
        return deleteResult.rowCount || 0;
    }
    /**
     * Execute multiple operations in a transaction
     */
    async transaction(callback) {
        if (!this.pool || !this.isConnected) {
            await this.connect();
        }
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            logger_1.logger.debug('Transaction committed successfully');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('Transaction rolled back', { error: error.message });
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Bulk insert multiple rows
     */
    async bulkInsert(table, dataArray, returning = '*') {
        if (dataArray.length === 0)
            return [];
        const columns = Object.keys(dataArray[0]);
        const allValues = [];
        const valueGroups = [];
        dataArray.forEach((data, rowIndex) => {
            const placeholders = columns.map((_, colIndex) => {
                const paramIndex = rowIndex * columns.length + colIndex + 1;
                allValues.push(data[columns[colIndex]]);
                return `$${paramIndex}`;
            });
            valueGroups.push(`(${placeholders.join(', ')})`);
        });
        const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${valueGroups.join(', ')}
      RETURNING ${returning}
    `;
        return this.query(sql, allValues);
    }
    /**
     * Upsert (INSERT ... ON CONFLICT UPDATE)
     */
    async upsert(table, data, conflictColumns, updateColumns, returning = '*') {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`);
        const columnsToUpdate = updateColumns || columns.filter(c => !conflictColumns.includes(c));
        const updateClause = columnsToUpdate
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(', ');
        const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (${conflictColumns.join(', ')})
      DO UPDATE SET ${updateClause}, updated_at = CURRENT_TIMESTAMP
      RETURNING ${returning}
    `;
        const result = await this.query(sql, values);
        return result[0];
    }
    /**
     * Check if connected
     */
    get connected() {
        return this.isConnected;
    }
    /**
     * Get pool statistics
     */
    getPoolStats() {
        if (!this.pool)
            return null;
        return {
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount,
        };
    }
}
exports.DatabaseConnection = DatabaseConnection;
// ============================================================================
// Singleton Instance
// ============================================================================
let dbInstance = null;
function getConnection() {
    if (!dbInstance) {
        dbInstance = new DatabaseConnection();
    }
    return dbInstance;
}
async function initializeDatabase() {
    const db = getConnection();
    await db.connect();
    return db;
}
async function closeDatabase() {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
    }
}
//# sourceMappingURL=connection.js.map