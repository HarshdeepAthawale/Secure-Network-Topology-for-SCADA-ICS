/**
 * Topology Service - Business logic for network topology management
 */

import { Device, Connection, TopologySnapshot, SecurityZone, PurdueLevel, TelemetrySource } from '../../utils/types';
import { TopologySnapshotRepository, getTopologySnapshotRepository } from '../repositories/topology-snapshot.repository';
import { DeviceRepository, getDeviceRepository } from '../repositories/device.repository';
import { ConnectionRepository, getConnectionRepository } from '../repositories/connection.repository';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

// ============================================================================
// Types
// ============================================================================

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
    modifiedDevices: Array<{ device: Device; changes: string[] }>;
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

// ============================================================================
// Topology Service Class
// ============================================================================

export class TopologyService {
    private snapshotRepo: TopologySnapshotRepository;
    private deviceRepo: DeviceRepository;
    private connectionRepo: ConnectionRepository;

    constructor() {
        this.snapshotRepo = getTopologySnapshotRepository();
        this.deviceRepo = getDeviceRepository();
        this.connectionRepo = getConnectionRepository();
    }

    /**
     * Get current topology overview
     */
    async getOverview(): Promise<TopologyOverview> {
        const [deviceCount, connectionCount, latestSnapshot] = await Promise.all([
            this.deviceRepo.count(),
            this.connectionRepo.count(),
            this.snapshotRepo.getLatest(),
        ]);

        // Calculate health status based on alert levels and offline devices
        const offlineDevices = await this.deviceRepo.findOfflineDevices(24);
        const offlineRatio = deviceCount > 0 ? offlineDevices.length / deviceCount : 0;

        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (offlineRatio > 0.3) {
            healthStatus = 'critical';
        } else if (offlineRatio > 0.1) {
            healthStatus = 'warning';
        }

        // Get unique zones
        const devices = await this.deviceRepo.findAll({ limit: 10000, select: ['security_zone'] });
        const zones = new Set(devices.map(d => d.securityZone));

        return {
            deviceCount,
            connectionCount,
            zoneCount: zones.size,
            lastUpdated: latestSnapshot?.timestamp || null,
            healthStatus,
        };
    }

    /**
     * Get current full topology
     */
    async getCurrentTopology(): Promise<TopologySnapshot | null> {
        return this.snapshotRepo.getLatest();
    }

    /**
     * Create a new topology snapshot
     */
    async createSnapshot(): Promise<TopologySnapshot> {
        const startTime = Date.now();

        // Gather all current data
        const [devices, connections] = await Promise.all([
            this.deviceRepo.findAll({ limit: 10000 }),
            this.connectionRepo.findAll({ limit: 100000 }),
        ]);

        // Build zones from devices
        const zoneMap = new Map<SecurityZone, Device[]>();
        for (const device of devices) {
            if (!zoneMap.has(device.securityZone)) {
                zoneMap.set(device.securityZone, []);
            }
            zoneMap.get(device.securityZone)!.push(device);
        }

        const zones = Array.from(zoneMap.entries()).map(([zone, zoneDevices]) => ({
            id: zone,
            name: this.formatZoneName(zone),
            purdueLevel: this.getZonePurdueLevel(zone),
            securityZone: zone,
            subnets: [] as string[],
            devices: zoneDevices.map(d => d.id),
        }));

        const collectionDuration = Date.now() - startTime;

        const snapshot = await this.snapshotRepo.createSnapshot({
            id: generateUUID(),
            timestamp: new Date(),
            devices,
            connections,
            zones,
            metadata: {
                deviceCount: devices.length,
                connectionCount: connections.length,
                collectionDuration,
                sources: [TelemetrySource.SNMP, TelemetrySource.NETFLOW, TelemetrySource.ARP],
            },
        });

        logger.info('Topology snapshot created', {
            id: snapshot.id,
            devices: devices.length,
            connections: connections.length,
            duration: collectionDuration,
        });

        return snapshot;
    }

    /**
     * Get topology by security zone
     */
    async getZoneTopology(zone: SecurityZone): Promise<ZoneTopology> {
        const devices = await this.deviceRepo.findBySecurityZone(zone);
        const deviceIds = new Set(devices.map(d => d.id));

        // Get all connections involving zone devices
        const allConnections: Connection[] = [];
        for (const device of devices) {
            const deviceConnections = await this.connectionRepo.findByDeviceId(device.id);
            allConnections.push(...deviceConnections);
        }

        // Deduplicate connections
        const connectionMap = new Map<string, Connection>();
        for (const conn of allConnections) {
            connectionMap.set(conn.id, conn);
        }
        const connections = Array.from(connectionMap.values());

        // Separate internal and external connections
        const internalConnections = connections.filter(
            c => deviceIds.has(c.sourceDeviceId) && deviceIds.has(c.targetDeviceId)
        );
        const externalConnections = connections.filter(
            c => !deviceIds.has(c.sourceDeviceId) || !deviceIds.has(c.targetDeviceId)
        );

        return {
            zone,
            devices,
            internalConnections,
            externalConnections,
        };
    }

    /**
     * Get cross-zone connections (potential security risks)
     */
    async getCrossZoneConnections(): Promise<Connection[]> {
        const results = await this.connectionRepo.findCrossZoneConnections();
        return results.map(r => r.connection);
    }

    /**
     * Compare two snapshots
     */
    async compareSnapshots(snapshotAId: string, snapshotBId: string): Promise<TopologyDiff | null> {
        const comparison = await this.snapshotRepo.compareSnapshots(snapshotAId, snapshotBId);
        if (!comparison) return null;

        const [snapshotA, snapshotB] = await Promise.all([
            this.snapshotRepo.findById(snapshotAId),
            this.snapshotRepo.findById(snapshotBId),
        ]);

        if (!snapshotA || !snapshotB) return null;

        // Get device details for added/removed
        const addedDevices = snapshotB.devices.filter(d => comparison.addedDevices.includes(d.id));
        const removedDevices = snapshotA.devices.filter(d => comparison.removedDevices.includes(d.id));
        const addedConnections = snapshotB.connections.filter(c => comparison.addedConnections.includes(c.id));
        const removedConnections = snapshotA.connections.filter(c => comparison.removedConnections.includes(c.id));

        // Find modified devices (same ID but different properties)
        const modifiedDevices: Array<{ device: Device; changes: string[] }> = [];
        const deviceAMap = new Map(snapshotA.devices.map(d => [d.id, d]));
        const deviceBMap = new Map(snapshotB.devices.map(d => [d.id, d]));

        for (const [id, deviceB] of deviceBMap) {
            const deviceA = deviceAMap.get(id);
            if (deviceA) {
                const changes = this.detectDeviceChanges(deviceA, deviceB);
                if (changes.length > 0) {
                    modifiedDevices.push({ device: deviceB, changes });
                }
            }
        }

        return {
            addedDevices,
            removedDevices,
            addedConnections,
            removedConnections,
            modifiedDevices,
        };
    }

    /**
     * Get topology history
     */
    async getHistory(days = 30): Promise<Array<{ date: Date; deviceCount: number; connectionCount: number }>> {
        return this.snapshotRepo.getGrowthTrend(days);
    }

    /**
     * Analyze path between two devices
     */
    async analyzePath(sourceId: string, targetId: string): Promise<PathAnalysis | null> {
        const [source, target] = await Promise.all([
            this.deviceRepo.findById(sourceId),
            this.deviceRepo.findById(targetId),
        ]);

        if (!source || !target) return null;

        // Build adjacency map
        const connections = await this.connectionRepo.findAll({ limit: 100000 });
        const adjacency = new Map<string, Array<{ deviceId: string; connection: Connection }>>();

        for (const conn of connections) {
            if (!adjacency.has(conn.sourceDeviceId)) {
                adjacency.set(conn.sourceDeviceId, []);
            }
            adjacency.get(conn.sourceDeviceId)!.push({
                deviceId: conn.targetDeviceId,
                connection: conn,
            });

            // Bidirectional
            if (!adjacency.has(conn.targetDeviceId)) {
                adjacency.set(conn.targetDeviceId, []);
            }
            adjacency.get(conn.targetDeviceId)!.push({
                deviceId: conn.sourceDeviceId,
                connection: conn,
            });
        }

        // BFS to find paths
        const paths = await this.findAllPaths(sourceId, targetId, adjacency, 5);

        // Build detailed path info
        const detailedPaths = await Promise.all(
            paths.map(async path => {
                const hops: Device[] = [];
                const pathConnections: Connection[] = [];
                let totalLatency = 0;
                let isSecure = true;
                let crossesZones = false;
                let prevZone: SecurityZone | null = null;

                for (let i = 0; i < path.deviceIds.length; i++) {
                    const device = await this.deviceRepo.findById(path.deviceIds[i]);
                    if (device) {
                        hops.push(device);
                        if (prevZone && prevZone !== device.securityZone) {
                            crossesZones = true;
                        }
                        prevZone = device.securityZone;
                    }
                }

                for (const conn of path.connections) {
                    pathConnections.push(conn);
                    totalLatency += conn.latency || 0;
                    if (!conn.isSecure) {
                        isSecure = false;
                    }
                }

                return { hops, connections: pathConnections, totalLatency, isSecure, crossesZones };
            })
        );

        const shortestPath = detailedPaths.length > 0 ? Math.min(...detailedPaths.map(p => p.hops.length)) : 0;
        const securePathExists = detailedPaths.some(p => p.isSecure);

        return {
            source,
            target,
            paths: detailedPaths,
            shortestPath,
            securePathExists,
        };
    }

    /**
     * Find all paths between two devices (BFS with max depth)
     */
    private async findAllPaths(
        sourceId: string,
        targetId: string,
        adjacency: Map<string, Array<{ deviceId: string; connection: Connection }>>,
        maxDepth: number
    ): Promise<Array<{ deviceIds: string[]; connections: Connection[] }>> {
        const paths: Array<{ deviceIds: string[]; connections: Connection[] }> = [];
        const queue: Array<{ deviceIds: string[]; connections: Connection[] }> = [
            { deviceIds: [sourceId], connections: [] }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const lastDevice = current.deviceIds[current.deviceIds.length - 1];

            if (lastDevice === targetId) {
                paths.push(current);
                continue;
            }

            if (current.deviceIds.length >= maxDepth) {
                continue;
            }

            const neighbors = adjacency.get(lastDevice) || [];
            for (const neighbor of neighbors) {
                if (!current.deviceIds.includes(neighbor.deviceId)) {
                    queue.push({
                        deviceIds: [...current.deviceIds, neighbor.deviceId],
                        connections: [...current.connections, neighbor.connection],
                    });
                }
            }
        }

        return paths;
    }

    /**
     * Detect changes between two device versions
     */
    private detectDeviceChanges(deviceA: Device, deviceB: Device): string[] {
        const changes: string[] = [];

        if (deviceA.status !== deviceB.status) {
            changes.push(`status: ${deviceA.status} -> ${deviceB.status}`);
        }
        if (deviceA.purdueLevel !== deviceB.purdueLevel) {
            changes.push(`purdueLevel: ${deviceA.purdueLevel} -> ${deviceB.purdueLevel}`);
        }
        if (deviceA.securityZone !== deviceB.securityZone) {
            changes.push(`securityZone: ${deviceA.securityZone} -> ${deviceB.securityZone}`);
        }
        if (deviceA.firmwareVersion !== deviceB.firmwareVersion) {
            changes.push(`firmwareVersion: ${deviceA.firmwareVersion} -> ${deviceB.firmwareVersion}`);
        }

        return changes;
    }

    /**
     * Format zone name for display
     */
    private formatZoneName(zone: SecurityZone): string {
        return zone
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Get primary Purdue level for a zone
     */
    private getZonePurdueLevel(zone: SecurityZone): PurdueLevel {
        switch (zone) {
            case SecurityZone.PROCESS:
                return PurdueLevel.LEVEL_0;
            case SecurityZone.CONTROL:
                return PurdueLevel.LEVEL_1;
            case SecurityZone.SUPERVISORY:
                return PurdueLevel.LEVEL_2;
            case SecurityZone.OPERATIONS:
                return PurdueLevel.LEVEL_3;
            case SecurityZone.DMZ:
                return PurdueLevel.LEVEL_3;
            case SecurityZone.ENTERPRISE:
                return PurdueLevel.LEVEL_4;
            case SecurityZone.UNTRUSTED:
                return PurdueLevel.LEVEL_5;
            default:
                return PurdueLevel.LEVEL_3;
        }
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let topologyServiceInstance: TopologyService | null = null;

export function getTopologyService(): TopologyService {
    if (!topologyServiceInstance) {
        topologyServiceInstance = new TopologyService();
    }
    return topologyServiceInstance;
}
