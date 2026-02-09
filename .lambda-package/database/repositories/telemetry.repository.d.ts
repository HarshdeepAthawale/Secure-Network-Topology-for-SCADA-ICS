/**
 * Telemetry Repository - Database operations for telemetry data
 */
import { BaseRepository, PaginatedResult } from './base.repository';
import { TelemetryData, TelemetrySource } from '../../utils/types';
export interface CreateTelemetryDTO {
    id?: string;
    source: TelemetrySource;
    deviceId?: string;
    timestamp: Date;
    data: Record<string, unknown>;
    raw?: string;
    processed?: boolean;
    metadata?: Record<string, unknown>;
}
export interface TelemetrySearchCriteria {
    source?: TelemetrySource;
    deviceId?: string;
    processed?: boolean;
    fromDate?: Date;
    toDate?: Date;
}
export declare class TelemetryRepository extends BaseRepository<TelemetryData, CreateTelemetryDTO, Partial<CreateTelemetryDTO>> {
    constructor();
    /**
     * Convert database row to TelemetryData entity
     */
    private toEntity;
    /**
     * Convert create DTO to database columns
     */
    protected processCreateData(data: CreateTelemetryDTO): Record<string, unknown>;
    /**
     * Override findById to convert DB row to entity
     */
    findById(id: string): Promise<TelemetryData | null>;
    /**
     * Insert telemetry data (optimized for high volume)
     */
    insertTelemetry(data: CreateTelemetryDTO): Promise<TelemetryData>;
    /**
     * Bulk insert telemetry data
     */
    bulkInsertTelemetry(dataArray: CreateTelemetryDTO[]): Promise<number>;
    /**
     * Find unprocessed telemetry
     */
    findUnprocessed(limit?: number): Promise<TelemetryData[]>;
    /**
     * Mark telemetry as processed
     */
    markProcessed(id: string): Promise<void>;
    /**
     * Mark multiple telemetry records as processed
     */
    markManyProcessed(ids: string[]): Promise<void>;
    /**
     * Find telemetry by source
     */
    findBySource(source: TelemetrySource, limit?: number): Promise<TelemetryData[]>;
    /**
     * Find telemetry by device
     */
    findByDeviceId(deviceId: string, limit?: number): Promise<TelemetryData[]>;
    /**
     * Search telemetry with criteria
     */
    search(criteria: TelemetrySearchCriteria, page?: number, limit?: number): Promise<PaginatedResult<TelemetryData>>;
    /**
     * Get telemetry count by source
     */
    countBySource(): Promise<Record<string, number>>;
    /**
     * Get telemetry rate (records per minute) for last hour
     */
    getTelemetryRate(): Promise<Array<{
        minute: Date;
        count: number;
        source: string;
    }>>;
    /**
     * Get recent telemetry for dashboard
     */
    getRecentTelemetry(minutes?: number, limit?: number): Promise<TelemetryData[]>;
    /**
     * Delete old telemetry data (partition maintenance)
     */
    purgeOldTelemetry(days: number): Promise<number>;
    /**
     * Get storage statistics
     */
    getStorageStats(): Promise<{
        totalRecords: number;
        processedRecords: number;
        unprocessedRecords: number;
        bySource: Record<string, number>;
        oldestRecord: Date | null;
        newestRecord: Date | null;
    }>;
}
export declare function getTelemetryRepository(): TelemetryRepository;
//# sourceMappingURL=telemetry.repository.d.ts.map