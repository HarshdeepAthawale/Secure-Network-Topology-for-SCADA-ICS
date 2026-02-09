/**
 * Connection Repository - Database operations for network connections
 */
import { BaseRepository, PaginatedResult } from './base.repository';
import { Connection, ConnectionType } from '../../utils/types';
export interface CreateConnectionDTO {
    id?: string;
    sourceDeviceId: string;
    targetDeviceId: string;
    sourceInterface?: string;
    targetInterface?: string;
    connectionType: ConnectionType;
    protocol?: string;
    port?: number;
    vlanId?: number;
    bandwidth?: number;
    latency?: number;
    isSecure?: boolean;
    encryptionType?: string;
    discoveredAt: Date;
    lastSeenAt: Date;
    metadata?: Record<string, unknown>;
}
export interface UpdateConnectionDTO {
    bandwidth?: number;
    latency?: number;
    isSecure?: boolean;
    encryptionType?: string;
    lastSeenAt?: Date;
    metadata?: Record<string, unknown>;
}
export interface ConnectionSearchCriteria {
    sourceDeviceId?: string;
    targetDeviceId?: string;
    connectionType?: ConnectionType;
    protocol?: string;
    isSecure?: boolean;
}
export declare class ConnectionRepository extends BaseRepository<Connection, CreateConnectionDTO, UpdateConnectionDTO> {
    constructor();
    /**
     * Convert database row to Connection entity
     */
    private toEntity;
    /**
     * Override create to convert database row to entity
     */
    create(data: CreateConnectionDTO): Promise<Connection>;
    /**
     * Convert create DTO to database columns
     */
    protected processCreateData(data: CreateConnectionDTO): Record<string, unknown>;
    /**
     * Convert update DTO to database columns
     */
    protected processUpdateData(data: UpdateConnectionDTO): Record<string, unknown>;
    /**
     * Override findById to convert DB row to entity
     */
    findById(id: string): Promise<Connection | null>;
    /**
     * Find all connections for a device (as source or target)
     */
    findByDeviceId(deviceId: string): Promise<Connection[]>;
    /**
     * Find connection between two devices
     */
    findBetweenDevices(deviceA: string, deviceB: string): Promise<Connection | null>;
    /**
     * Search connections with criteria
     */
    search(criteria: ConnectionSearchCriteria, page?: number, limit?: number): Promise<PaginatedResult<Connection>>;
    /**
     * Find insecure connections
     */
    findInsecureConnections(): Promise<Connection[]>;
    /**
     * Find connections by protocol
     */
    findByProtocol(protocol: string): Promise<Connection[]>;
    /**
     * Get connection count by type
     */
    countByType(): Promise<Record<string, number>>;
    /**
     * Get secure vs insecure connection stats
     */
    getSecurityStats(): Promise<{
        secure: number;
        insecure: number;
    }>;
    /**
     * Upsert connection (insert or update if exists between devices)
     */
    upsertConnection(data: CreateConnectionDTO): Promise<Connection>;
    /**
     * Find connections crossing zones (potential security violations)
     */
    findCrossZoneConnections(): Promise<Array<{
        connection: Connection;
        sourcePurdue: number;
        targetPurdue: number;
    }>>;
    /**
     * Get network topology edges for visualization
     */
    getTopologyEdges(): Promise<Array<{
        source: string;
        target: string;
        type: string;
        isSecure: boolean;
    }>>;
    /**
     * Update last seen for connection
     */
    updateLastSeen(id: string): Promise<void>;
    /**
     * Delete stale connections (not seen in specified hours)
     */
    deleteStaleConnections(hours: number): Promise<number>;
}
export declare function getConnectionRepository(): ConnectionRepository;
//# sourceMappingURL=connection.repository.d.ts.map