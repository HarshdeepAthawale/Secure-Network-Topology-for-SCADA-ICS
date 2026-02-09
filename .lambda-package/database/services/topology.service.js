"use strict";
/**
 * Topology Service - Business logic for network topology management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopologyService = void 0;
exports.getTopologyService = getTopologyService;
const types_1 = require("../../utils/types");
const topology_snapshot_repository_1 = require("../repositories/topology-snapshot.repository");
const device_repository_1 = require("../repositories/device.repository");
const connection_repository_1 = require("../repositories/connection.repository");
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
// ============================================================================
// Topology Service Class
// ============================================================================
class TopologyService {
    snapshotRepo;
    deviceRepo;
    connectionRepo;
    constructor() {
        this.snapshotRepo = (0, topology_snapshot_repository_1.getTopologySnapshotRepository)();
        this.deviceRepo = (0, device_repository_1.getDeviceRepository)();
        this.connectionRepo = (0, connection_repository_1.getConnectionRepository)();
    }
    /**
     * Get current topology overview
     */
    async getOverview() {
        const [deviceCount, connectionCount, latestSnapshot] = await Promise.all([
            this.deviceRepo.count(),
            this.connectionRepo.count(),
            this.snapshotRepo.getLatest(),
        ]);
        // Calculate health status based on alert levels and offline devices
        const offlineDevices = await this.deviceRepo.findOfflineDevices(24);
        const offlineRatio = deviceCount > 0 ? offlineDevices.length / deviceCount : 0;
        let healthStatus = 'healthy';
        if (offlineRatio > 0.3) {
            healthStatus = 'critical';
        }
        else if (offlineRatio > 0.1) {
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
    async getCurrentTopology() {
        return this.snapshotRepo.getLatest();
    }
    /**
     * Create a new topology snapshot
     */
    async createSnapshot() {
        const startTime = Date.now();
        // Gather all current data
        const [devices, connections] = await Promise.all([
            this.deviceRepo.findAll({ limit: 10000 }),
            this.connectionRepo.findAll({ limit: 100000 }),
        ]);
        // Build zones from devices
        const zoneMap = new Map();
        for (const device of devices) {
            if (!zoneMap.has(device.securityZone)) {
                zoneMap.set(device.securityZone, []);
            }
            zoneMap.get(device.securityZone).push(device);
        }
        const zones = Array.from(zoneMap.entries()).map(([zone, zoneDevices]) => ({
            id: zone,
            name: this.formatZoneName(zone),
            purdueLevel: this.getZonePurdueLevel(zone),
            securityZone: zone,
            subnets: [],
            devices: zoneDevices.map(d => d.id),
        }));
        const collectionDuration = Date.now() - startTime;
        const snapshot = await this.snapshotRepo.createSnapshot({
            id: (0, crypto_1.generateUUID)(),
            timestamp: new Date(),
            devices,
            connections,
            zones,
            metadata: {
                deviceCount: devices.length,
                connectionCount: connections.length,
                collectionDuration,
                sources: [types_1.TelemetrySource.SNMP, types_1.TelemetrySource.NETFLOW, types_1.TelemetrySource.ARP],
            },
        });
        logger_1.logger.info('Topology snapshot created', {
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
    async getZoneTopology(zone) {
        const devices = await this.deviceRepo.findBySecurityZone(zone);
        const deviceIds = new Set(devices.map(d => d.id));
        // Get all connections involving zone devices
        const allConnections = [];
        for (const device of devices) {
            const deviceConnections = await this.connectionRepo.findByDeviceId(device.id);
            allConnections.push(...deviceConnections);
        }
        // Deduplicate connections
        const connectionMap = new Map();
        for (const conn of allConnections) {
            connectionMap.set(conn.id, conn);
        }
        const connections = Array.from(connectionMap.values());
        // Separate internal and external connections
        const internalConnections = connections.filter(c => deviceIds.has(c.sourceDeviceId) && deviceIds.has(c.targetDeviceId));
        const externalConnections = connections.filter(c => !deviceIds.has(c.sourceDeviceId) || !deviceIds.has(c.targetDeviceId));
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
    async getCrossZoneConnections() {
        const results = await this.connectionRepo.findCrossZoneConnections();
        return results.map(r => r.connection);
    }
    /**
     * Compare two snapshots
     */
    async compareSnapshots(snapshotAId, snapshotBId) {
        const comparison = await this.snapshotRepo.compareSnapshots(snapshotAId, snapshotBId);
        if (!comparison)
            return null;
        const [snapshotA, snapshotB] = await Promise.all([
            this.snapshotRepo.findById(snapshotAId),
            this.snapshotRepo.findById(snapshotBId),
        ]);
        if (!snapshotA || !snapshotB)
            return null;
        // Get device details for added/removed
        const addedDevices = snapshotB.devices.filter(d => comparison.addedDevices.includes(d.id));
        const removedDevices = snapshotA.devices.filter(d => comparison.removedDevices.includes(d.id));
        const addedConnections = snapshotB.connections.filter(c => comparison.addedConnections.includes(c.id));
        const removedConnections = snapshotA.connections.filter(c => comparison.removedConnections.includes(c.id));
        // Find modified devices (same ID but different properties)
        const modifiedDevices = [];
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
    async getHistory(days = 30) {
        return this.snapshotRepo.getGrowthTrend(days);
    }
    /**
     * Analyze path between two devices
     */
    async analyzePath(sourceId, targetId) {
        const [source, target] = await Promise.all([
            this.deviceRepo.findById(sourceId),
            this.deviceRepo.findById(targetId),
        ]);
        if (!source || !target)
            return null;
        // Build adjacency map
        const connections = await this.connectionRepo.findAll({ limit: 100000 });
        const adjacency = new Map();
        for (const conn of connections) {
            if (!adjacency.has(conn.sourceDeviceId)) {
                adjacency.set(conn.sourceDeviceId, []);
            }
            adjacency.get(conn.sourceDeviceId).push({
                deviceId: conn.targetDeviceId,
                connection: conn,
            });
            // Bidirectional
            if (!adjacency.has(conn.targetDeviceId)) {
                adjacency.set(conn.targetDeviceId, []);
            }
            adjacency.get(conn.targetDeviceId).push({
                deviceId: conn.sourceDeviceId,
                connection: conn,
            });
        }
        // BFS to find paths
        const paths = await this.findAllPaths(sourceId, targetId, adjacency, 5);
        // Build detailed path info
        const detailedPaths = await Promise.all(paths.map(async (path) => {
            const hops = [];
            const pathConnections = [];
            let totalLatency = 0;
            let isSecure = true;
            let crossesZones = false;
            let prevZone = null;
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
        }));
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
    async findAllPaths(sourceId, targetId, adjacency, maxDepth) {
        const paths = [];
        const queue = [
            { deviceIds: [sourceId], connections: [] }
        ];
        while (queue.length > 0) {
            const current = queue.shift();
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
    detectDeviceChanges(deviceA, deviceB) {
        const changes = [];
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
    formatZoneName(zone) {
        return zone
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    /**
     * Get primary Purdue level for a zone
     */
    getZonePurdueLevel(zone) {
        switch (zone) {
            case types_1.SecurityZone.PROCESS:
                return types_1.PurdueLevel.LEVEL_0;
            case types_1.SecurityZone.CONTROL:
                return types_1.PurdueLevel.LEVEL_1;
            case types_1.SecurityZone.SUPERVISORY:
                return types_1.PurdueLevel.LEVEL_2;
            case types_1.SecurityZone.OPERATIONS:
                return types_1.PurdueLevel.LEVEL_3;
            case types_1.SecurityZone.DMZ:
                return types_1.PurdueLevel.LEVEL_3;
            case types_1.SecurityZone.ENTERPRISE:
                return types_1.PurdueLevel.LEVEL_4;
            case types_1.SecurityZone.UNTRUSTED:
                return types_1.PurdueLevel.LEVEL_5;
            default:
                return types_1.PurdueLevel.LEVEL_3;
        }
    }
}
exports.TopologyService = TopologyService;
// ============================================================================
// Singleton Instance
// ============================================================================
let topologyServiceInstance = null;
function getTopologyService() {
    if (!topologyServiceInstance) {
        topologyServiceInstance = new TopologyService();
    }
    return topologyServiceInstance;
}
//# sourceMappingURL=topology.service.js.map