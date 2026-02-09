/**
 * Topology Snapshot Repository - Database operations for topology snapshots
 */
import { BaseRepository, PaginatedResult } from './base.repository';
import { TopologySnapshot, TelemetrySource } from '../../utils/types';
export interface CreateTopologySnapshotDTO {
    id?: string;
    deviceCount: number;
    connectionCount: number;
    collectionDuration: number;
    sources: TelemetrySource[];
    snapshotData: unknown;
}
export declare class TopologySnapshotRepository extends BaseRepository<TopologySnapshot, CreateTopologySnapshotDTO, Partial<CreateTopologySnapshotDTO>> {
    constructor();
    /**
     * Convert database row to TopologySnapshot entity
     */
    private toEntity;
    /**
     * Convert create DTO to database columns
     */
    protected processCreateData(data: CreateTopologySnapshotDTO): Record<string, unknown>;
    /**
     * Override findById to convert DB row to entity
     */
    findById(id: string): Promise<TopologySnapshot | null>;
    /**
     * Create snapshot from current topology
     */
    createSnapshot(snapshot: TopologySnapshot): Promise<TopologySnapshot>;
    /**
     * Get the latest snapshot
     */
    getLatest(): Promise<TopologySnapshot | null>;
    /**
     * Get snapshots for a time range
     */
    findByTimeRange(from: Date, to: Date): Promise<TopologySnapshot[]>;
    /**
     * Get snapshot history with pagination (lightweight - no full data)
     */
    getHistory(page?: number, limit?: number): Promise<PaginatedResult<{
        id: string;
        timestamp: Date;
        deviceCount: number;
        connectionCount: number;
    }>>;
    /**
     * Compare two snapshots
     */
    compareSnapshots(snapshotAId: string, snapshotBId: string): Promise<{
        addedDevices: string[];
        removedDevices: string[];
        addedConnections: string[];
        removedConnections: string[];
    } | null>;
    /**
     * Get topology growth trend
     */
    getGrowthTrend(days?: number): Promise<Array<{
        date: Date;
        deviceCount: number;
        connectionCount: number;
    }>>;
    /**
     * Delete old snapshots (keep last N)
     */
    purgeOldSnapshots(keepLast: number): Promise<number>;
}
export declare function getTopologySnapshotRepository(): TopologySnapshotRepository;
//# sourceMappingURL=topology-snapshot.repository.d.ts.map