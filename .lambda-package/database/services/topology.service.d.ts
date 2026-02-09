/**
 * Topology Service - Business logic for network topology management
 */
import { Device, Connection, TopologySnapshot, SecurityZone } from '../../utils/types';
export interface TopologyOverview {
    deviceCount: number;
    connectionCount: number;
    zoneCount: number;
    lastUpdated: Date | null;
    healthStatus: 'healthy' | 'warning' | 'critical';
}
export interface ZoneTopology {
    zone: SecurityZone;
    devices: Device[];
    internalConnections: Connection[];
    externalConnections: Connection[];
}
export interface TopologyDiff {
    addedDevices: Device[];
    removedDevices: Device[];
    addedConnections: Connection[];
    removedConnections: Connection[];
    modifiedDevices: Array<{
        device: Device;
        changes: string[];
    }>;
}
export interface PathAnalysis {
    source: Device;
    target: Device;
    paths: Array<{
        hops: Device[];
        connections: Connection[];
        totalLatency: number;
        isSecure: boolean;
        crossesZones: boolean;
    }>;
    shortestPath: number;
    securePathExists: boolean;
}
export declare class TopologyService {
    private snapshotRepo;
    private deviceRepo;
    private connectionRepo;
    constructor();
    /**
     * Get current topology overview
     */
    getOverview(): Promise<TopologyOverview>;
    /**
     * Get current full topology
     */
    getCurrentTopology(): Promise<TopologySnapshot | null>;
    /**
     * Create a new topology snapshot
     */
    createSnapshot(): Promise<TopologySnapshot>;
    /**
     * Get topology by security zone
     */
    getZoneTopology(zone: SecurityZone): Promise<ZoneTopology>;
    /**
     * Get cross-zone connections (potential security risks)
     */
    getCrossZoneConnections(): Promise<Connection[]>;
    /**
     * Compare two snapshots
     */
    compareSnapshots(snapshotAId: string, snapshotBId: string): Promise<TopologyDiff | null>;
    /**
     * Get topology history
     */
    getHistory(days?: number): Promise<Array<{
        date: Date;
        deviceCount: number;
        connectionCount: number;
    }>>;
    /**
     * Analyze path between two devices
     */
    analyzePath(sourceId: string, targetId: string): Promise<PathAnalysis | null>;
    /**
     * Find all paths between two devices (BFS with max depth)
     */
    private findAllPaths;
    /**
     * Detect changes between two device versions
     */
    private detectDeviceChanges;
    /**
     * Format zone name for display
     */
    private formatZoneName;
    /**
     * Get primary Purdue level for a zone
     */
    private getZonePurdueLevel;
}
export declare function getTopologyService(): TopologyService;
//# sourceMappingURL=topology.service.d.ts.map