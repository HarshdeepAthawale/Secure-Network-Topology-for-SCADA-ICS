/**
 * Base Repository - Abstract class for all database repositories
 */

import { PoolClient } from 'pg';
import { DatabaseConnection, getConnection } from '../connection';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface FindOptions {
    where?: Record<string, unknown>;
    orderBy?: string;
    order?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
    select?: string[];
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
}

// ============================================================================
// Base Repository Class
// ============================================================================

export abstract class BaseRepository<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
    protected readonly tableName: string;
    protected readonly db: DatabaseConnection;
    protected readonly primaryKey: string;

    constructor(tableName: string, primaryKey = 'id') {
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.db = getConnection();
    }

    /**
     * Find all records with optional filtering
     */
    async findAll(options: FindOptions = {}): Promise<T[]> {
        const { where, orderBy, order = 'ASC', limit, offset, select } = options;

        const columns = select?.join(', ') || '*';
        let sql = `SELECT ${columns} FROM ${this.tableName}`;
        const params: unknown[] = [];

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

        return this.db.query<T>(sql, params);
    }

    /**
     * Find records with pagination
     */
    async findPaginated(
        page: number,
        limit: number,
        options: Omit<FindOptions, 'limit' | 'offset'> = {}
    ): Promise<PaginatedResult<T>> {
        const offset = (page - 1) * limit;

        // Get total count
        let countSql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const countParams: unknown[] = [];

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
    async findById(id: string): Promise<T | null> {
        const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
        return this.db.queryOne<T>(sql, [id]);
    }

    /**
     * Find one record by conditions
     */
    async findOne(where: Record<string, unknown>): Promise<T | null> {
        const results = await this.findAll({ where, limit: 1 });
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Find by multiple IDs
     */
    async findByIds(ids: string[]): Promise<T[]> {
        if (ids.length === 0) return [];

        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} IN (${placeholders})`;

        return this.db.query<T>(sql, ids);
    }

    /**
     * Create a new record
     */
    async create(data: CreateDTO): Promise<T> {
        const processedData = this.processCreateData(data);
        return this.db.insert<T>(this.tableName, processedData);
    }

    /**
     * Create multiple records
     */
    async createMany(dataArray: CreateDTO[]): Promise<T[]> {
        if (dataArray.length === 0) return [];

        const processedData = dataArray.map(d => this.processCreateData(d));
        return this.db.bulkInsert<T>(this.tableName, processedData);
    }

    /**
     * Update a record by ID
     */
    async update(id: string, data: UpdateDTO): Promise<T | null> {
        const processedData = this.processUpdateData(data);
        const results = await this.db.update<T>(
            this.tableName,
            processedData,
            `${this.primaryKey} = $1`,
            [id]
        );
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Update multiple records
     */
    async updateMany(
        where: Record<string, unknown>,
        data: UpdateDTO
    ): Promise<T[]> {
        const processedData = this.processUpdateData(data);
        const conditions = Object.entries(where).map(([key], index) => {
            return `${key} = $${Object.keys(processedData).length + index + 1}`;
        });

        return this.db.update<T>(
            this.tableName,
            processedData,
            conditions.join(' AND '),
            Object.values(where)
        );
    }

    /**
     * Upsert a record
     */
    async upsert(
        data: CreateDTO,
        conflictColumns: string[],
        updateColumns?: string[]
    ): Promise<T> {
        const processedData = this.processCreateData(data);
        return this.db.upsert<T>(this.tableName, processedData, conflictColumns, updateColumns);
    }

    /**
     * Delete by ID
     */
    async delete(id: string): Promise<boolean> {
        const count = await this.db.delete(
            this.tableName,
            `${this.primaryKey} = $1`,
            [id]
        );
        return count > 0;
    }

    /**
     * Delete by conditions
     */
    async deleteMany(where: Record<string, unknown>): Promise<number> {
        const conditions = Object.entries(where).map(([key], index) => {
            return `${key} = $${index + 1}`;
        });

        return this.db.delete(
            this.tableName,
            conditions.join(' AND '),
            Object.values(where)
        );
    }

    /**
     * Check if record exists
     */
    async exists(where: Record<string, unknown>): Promise<boolean> {
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
    async count(where?: Record<string, unknown>): Promise<number> {
        let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const params: unknown[] = [];

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
    async rawQuery<R = T>(sql: string, params?: unknown[]): Promise<R[]> {
        return this.db.query<R>(sql, params);
    }

    /**
     * Execute in transaction
     */
    async transaction<R>(callback: (client: PoolClient) => Promise<R>): Promise<R> {
        return this.db.transaction(callback);
    }

    /**
     * Process data before create - Override in subclass if needed
     */
    protected processCreateData(data: CreateDTO): Record<string, unknown> {
        return data as Record<string, unknown>;
    }

    /**
     * Process data before update - Override in subclass if needed
     */
    protected processUpdateData(data: UpdateDTO): Record<string, unknown> {
        const processed = data as Record<string, unknown>;
        // Remove undefined values
        Object.keys(processed).forEach(key => {
            if (processed[key] === undefined) {
                delete processed[key];
            }
        });
        return processed;
    }
}
