/**
 * PostgreSQL Database Connection Pool
 * Provides secure connection management for SCADA topology data
 */

import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface QueryOptions {
    timeout?: number;
    name?: string; // For prepared statements
}

export interface TransactionCallback<T> {
    (client: PoolClient): Promise<T>;
}

// ============================================================================
// Database Connection Class
// ============================================================================

export class DatabaseConnection {
    private pool: Pool | null = null;
    private isConnected = false;
    private connectionAttempts = 0;
    private readonly maxRetries = 3;
    private readonly retryDelay = 2000;

    /**
     * Initialize the connection pool
     */
    async connect(): Promise<void> {
        if (this.isConnected && this.pool) {
            logger.debug('Database already connected');
            return;
        }

        const dbConfig = config.database;

        const poolConfig: PoolConfig = {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password,
            ssl: dbConfig.ssl ? { rejectUnauthorized: dbConfig.sslRejectUnauthorized !== false } : false,
            max: dbConfig.poolSize,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            statement_timeout: 60000,
        };

        try {
            this.pool = new Pool(poolConfig);

            // Add error handler for the pool
            this.pool.on('error', (err) => {
                logger.error('Unexpected database pool error', { error: err.message });
            });

            // Test the connection
            await this.testConnection();

            this.isConnected = true;
            this.connectionAttempts = 0;

            logger.info('Database connection pool established', {
                host: dbConfig.host,
                database: dbConfig.database,
                poolSize: dbConfig.poolSize,
            });
        } catch (error) {
            this.connectionAttempts++;
            logger.error('Failed to connect to database', {
                error: (error as Error).message,
                attempt: this.connectionAttempts,
            });

            if (this.connectionAttempts < this.maxRetries) {
                logger.info(`Retrying connection in ${this.retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.connect();
            }

            throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
        }
    }

    /**
     * Test the database connection
     */
    private async testConnection(): Promise<void> {
        if (!this.pool) throw new Error('Pool not initialized');

        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT NOW() as current_time, current_database() as database');
            logger.debug('Database connection test successful', {
                time: result.rows[0].current_time,
                database: result.rows[0].database,
            });
        } finally {
            client.release();
        }
    }

    /**
     * Close the connection pool
     */
    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.isConnected = false;
            logger.info('Database connection pool closed');
        }
    }

    /**
     * Execute a query with parameters
     */
    async query<T = Record<string, unknown>>(
        sql: string,
        params?: unknown[],
        options?: QueryOptions
    ): Promise<T[]> {
        if (!this.pool || !this.isConnected) {
            await this.connect();
        }

        const startTime = Date.now();

        try {
            const result = await this.pool!.query({
                text: sql,
                values: params,
                name: options?.name,
            });

            const duration = Date.now() - startTime;
            logger.debug('Query executed', {
                sql: sql.substring(0, 100),
                params: params?.length || 0,
                rows: result.rowCount,
                duration: `${duration}ms`,
            });

            return result.rows as T[];
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Query failed', {
                sql: sql.substring(0, 100),
                error: (error as Error).message,
                duration: `${duration}ms`,
            });
            throw error;
        }
    }

    /**
     * Execute a query and return single result
     */
    async queryOne<T = Record<string, unknown>>(
        sql: string,
        params?: unknown[],
        options?: QueryOptions
    ): Promise<T | null> {
        const results = await this.query<T>(sql, params, options);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Execute a query and return count
     */
    async queryCount(sql: string, params?: unknown[]): Promise<number> {
        const result = await this.queryOne<{ count: string }>(sql, params);
        return result ? parseInt(result.count, 10) : 0;
    }

    /**
     * Execute an INSERT and return the inserted row
     */
    async insert<T = Record<string, unknown>>(
        table: string,
        data: Record<string, unknown>,
        returning = '*'
    ): Promise<T> {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`);

        const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING ${returning}
    `;

        const result = await this.query<T>(sql, values);
        return result[0];
    }

    /**
     * Execute an UPDATE and return affected rows
     */
    async update<T = Record<string, unknown>>(
        table: string,
        data: Record<string, unknown>,
        whereClause: string,
        whereParams: unknown[],
        returning = '*'
    ): Promise<T[]> {
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

        return this.query<T>(sql, [...values, ...whereParams]);
    }

    /**
     * Execute a DELETE and return affected count
     */
    async delete(
        table: string,
        whereClause: string,
        whereParams: unknown[]
    ): Promise<number> {
        if (!this.pool || !this.isConnected) {
            await this.connect();
        }

        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        const result: QueryResult = await this.pool!.query({
            text: sql,
            values: whereParams,
        });
        return result.rowCount ?? 0;
    }

    /**
     * Execute multiple operations in a transaction
     */
    async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
        if (!this.pool || !this.isConnected) {
            await this.connect();
        }

        const client = await this.pool!.connect();

        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            logger.debug('Transaction committed successfully');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Transaction rolled back', { error: (error as Error).message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Bulk insert multiple rows
     */
    async bulkInsert<T = Record<string, unknown>>(
        table: string,
        dataArray: Record<string, unknown>[],
        returning = '*'
    ): Promise<T[]> {
        if (dataArray.length === 0) return [];

        const columns = Object.keys(dataArray[0]);
        const allValues: unknown[] = [];
        const valueGroups: string[] = [];

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

        return this.query<T>(sql, allValues);
    }

    /**
     * Upsert (INSERT ... ON CONFLICT UPDATE)
     */
    async upsert<T = Record<string, unknown>>(
        table: string,
        data: Record<string, unknown>,
        conflictColumns: string[],
        updateColumns?: string[],
        returning = '*'
    ): Promise<T> {
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

        const result = await this.query<T>(sql, values);
        return result[0];
    }

    /**
     * Check if connected
     */
    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Get pool statistics
     */
    getPoolStats(): { total: number; idle: number; waiting: number } | null {
        if (!this.pool) return null;
        return {
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount,
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let dbInstance: DatabaseConnection | null = null;

export function getConnection(): DatabaseConnection {
    if (!dbInstance) {
        dbInstance = new DatabaseConnection();
    }
    return dbInstance;
}

export async function initializeDatabase(): Promise<DatabaseConnection> {
    const db = getConnection();
    await db.connect();
    return db;
}

export async function closeDatabase(): Promise<void> {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
    }
}
