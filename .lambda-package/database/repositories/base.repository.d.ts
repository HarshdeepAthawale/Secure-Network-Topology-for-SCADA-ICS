/**
 * Base Repository - Abstract class for all database repositories
 */
import { PoolClient } from 'pg';
import { DatabaseConnection } from '../connection';
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
export declare abstract class BaseRepository<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
    protected readonly tableName: string;
    protected readonly db: DatabaseConnection;
    protected readonly primaryKey: string;
    constructor(tableName: string, primaryKey?: string);
    /**
     * Find all records with optional filtering
     */
    findAll(options?: FindOptions): Promise<T[]>;
    /**
     * Find records with pagination
     */
    findPaginated(page: number, limit: number, options?: Omit<FindOptions, 'limit' | 'offset'>): Promise<PaginatedResult<T>>;
    /**
     * Find by primary key
     */
    findById(id: string): Promise<T | null>;
    /**
     * Find one record by conditions
     */
    findOne(where: Record<string, unknown>): Promise<T | null>;
    /**
     * Find by multiple IDs
     */
    findByIds(ids: string[]): Promise<T[]>;
    /**
     * Create a new record
     */
    create(data: CreateDTO): Promise<T>;
    /**
     * Create multiple records
     */
    createMany(dataArray: CreateDTO[]): Promise<T[]>;
    /**
     * Update a record by ID
     */
    update(id: string, data: UpdateDTO): Promise<T | null>;
    /**
     * Update multiple records
     */
    updateMany(where: Record<string, unknown>, data: UpdateDTO): Promise<T[]>;
    /**
     * Upsert a record
     */
    upsert(data: CreateDTO, conflictColumns: string[], updateColumns?: string[]): Promise<T>;
    /**
     * Delete by ID
     */
    delete(id: string): Promise<boolean>;
    /**
     * Delete by conditions
     */
    deleteMany(where: Record<string, unknown>): Promise<number>;
    /**
     * Check if record exists
     */
    exists(where: Record<string, unknown>): Promise<boolean>;
    /**
     * Count records
     */
    count(where?: Record<string, unknown>): Promise<number>;
    /**
     * Execute raw query
     */
    rawQuery<R = T>(sql: string, params?: unknown[]): Promise<R[]>;
    /**
     * Execute in transaction
     */
    transaction<R>(callback: (client: PoolClient) => Promise<R>): Promise<R>;
    /**
     * Process data before create - Override in subclass if needed
     */
    protected processCreateData(data: CreateDTO): Record<string, unknown>;
    /**
     * Process data before update - Override in subclass if needed
     */
    protected processUpdateData(data: UpdateDTO): Record<string, unknown>;
}
//# sourceMappingURL=base.repository.d.ts.map