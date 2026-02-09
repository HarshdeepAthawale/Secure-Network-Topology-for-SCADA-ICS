/**
 * PostgreSQL Database Connection Pool
 * Provides secure connection management for SCADA topology data
 */
import { PoolClient } from 'pg';
export interface QueryOptions {
    timeout?: number;
    name?: string;
}
export interface TransactionCallback<T> {
    (client: PoolClient): Promise<T>;
}
export declare class DatabaseConnection {
    private pool;
    private isConnected;
    private connectionAttempts;
    private readonly maxRetries;
    private readonly retryDelay;
    /**
     * Initialize the connection pool
     */
    connect(): Promise<void>;
    /**
     * Test the database connection
     */
    private testConnection;
    /**
     * Close the connection pool
     */
    close(): Promise<void>;
    /**
     * Execute a query with parameters
     */
    query<T = Record<string, unknown>>(sql: string, params?: unknown[], options?: QueryOptions): Promise<T[]>;
    /**
     * Execute a query and return single result
     */
    queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[], options?: QueryOptions): Promise<T | null>;
    /**
     * Execute a query and return count
     */
    queryCount(sql: string, params?: unknown[]): Promise<number>;
    /**
     * Execute an INSERT and return the inserted row
     */
    insert<T = Record<string, unknown>>(table: string, data: Record<string, unknown>, returning?: string): Promise<T>;
    /**
     * Execute an UPDATE and return affected rows
     */
    update<T = Record<string, unknown>>(table: string, data: Record<string, unknown>, whereClause: string, whereParams: unknown[], returning?: string): Promise<T[]>;
    /**
     * Execute a DELETE and return affected count
     */
    delete(table: string, whereClause: string, whereParams: unknown[]): Promise<number>;
    /**
     * Execute multiple operations in a transaction
     */
    transaction<T>(callback: TransactionCallback<T>): Promise<T>;
    /**
     * Bulk insert multiple rows
     */
    bulkInsert<T = Record<string, unknown>>(table: string, dataArray: Record<string, unknown>[], returning?: string): Promise<T[]>;
    /**
     * Upsert (INSERT ... ON CONFLICT UPDATE)
     */
    upsert<T = Record<string, unknown>>(table: string, data: Record<string, unknown>, conflictColumns: string[], updateColumns?: string[], returning?: string): Promise<T>;
    /**
     * Check if connected
     */
    get connected(): boolean;
    /**
     * Get pool statistics
     */
    getPoolStats(): {
        total: number;
        idle: number;
        waiting: number;
    } | null;
}
export declare function getConnection(): DatabaseConnection;
export declare function initializeDatabase(): Promise<DatabaseConnection>;
export declare function closeDatabase(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map