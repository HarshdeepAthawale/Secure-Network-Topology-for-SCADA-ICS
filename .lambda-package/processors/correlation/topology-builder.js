"use strict";
/**
 * Topology Builder - Constructs network topology graph
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.topologyBuilder = exports.TopologyBuilder = void 0;
const types_1 = require("../../utils/types");
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
class TopologyBuilder {
    devices = new Map();
    connections = new Map();
    deviceConnections = new Map();
    addDevice(device) {
        this.devices.set(device.id, device);
        if (!this.deviceConnections.has(device.id)) {
            this.deviceConnections.set(device.id, new Set());
        }
        logger_1.logger.debug('Device added to topology', { deviceId: device.id, name: device.name });
    }
    addConnection(connection) {
        const key = this.getConnectionKey(connection.sourceDeviceId, connection.targetDeviceId);
        const existing = this.connections.get(key);
        if (existing) {
            // Update existing connection
            existing.lastSeenAt = connection.lastSeenAt;
            if (connection.bandwidth)
                existing.bandwidth = connection.bandwidth;
        }
        else {
            this.connections.set(key, connection);
            this.deviceConnections.get(connection.sourceDeviceId)?.add(connection.targetDeviceId);
            this.deviceConnections.get(connection.targetDeviceId)?.add(connection.sourceDeviceId);
        }
    }
    addConnectionFromFlow(sourceDeviceId, targetDeviceId, protocol, port, isSecure) {
        const connection = {
            id: (0, crypto_1.generateUUID)(),
            sourceDeviceId,
            targetDeviceId,
            connectionType: types_1.ConnectionType.ETHERNET,
            protocol,
            port,
            isSecure: isSecure || false,
            discoveredAt: new Date(),
            lastSeenAt: new Date(),
            metadata: {},
        };
        this.addConnection(connection);
    }
    buildGraph() {
        const nodes = [];
        const edges = [];
        const zones = new Map();
        // Create nodes
        for (const device of this.devices.values()) {
            const node = {
                id: device.id,
                deviceId: device.id,
                label: device.name,
                type: device.type,
                purdueLevel: device.purdueLevel,
                zone: device.securityZone,
            };
            nodes.push(node);
            // Group by zone
            const zoneNodes = zones.get(device.purdueLevel) || [];
            zoneNodes.push(node);
            zones.set(device.purdueLevel, zoneNodes);
        }
        // Create edges
        for (const connection of this.connections.values()) {
            const edge = {
                id: connection.id,
                source: connection.sourceDeviceId,
                target: connection.targetDeviceId,
                connectionType: connection.connectionType,
                protocol: connection.protocol,
                bandwidth: connection.bandwidth,
                isSecure: connection.isSecure,
            };
            edges.push(edge);
        }
        // Layout nodes by Purdue level
        this.layoutNodes(nodes, zones);
        return { nodes, edges, zones };
    }
    layoutNodes(nodes, zones) {
        const levelOrder = [
            types_1.PurdueLevel.LEVEL_0,
            types_1.PurdueLevel.LEVEL_1,
            types_1.PurdueLevel.LEVEL_2,
            types_1.PurdueLevel.LEVEL_3,
            types_1.PurdueLevel.DMZ,
            types_1.PurdueLevel.LEVEL_4,
            types_1.PurdueLevel.LEVEL_5,
        ];
        const ySpacing = 150;
        const xSpacing = 200;
        for (let levelIdx = 0; levelIdx < levelOrder.length; levelIdx++) {
            const level = levelOrder[levelIdx];
            const zoneNodes = zones.get(level) || [];
            const y = levelIdx * ySpacing;
            for (let i = 0; i < zoneNodes.length; i++) {
                const node = zoneNodes[i];
                node.x = (i - (zoneNodes.length - 1) / 2) * xSpacing;
                node.y = y;
            }
        }
    }
    createSnapshot() {
        const devices = Array.from(this.devices.values());
        const connections = Array.from(this.connections.values());
        const zones = this.buildZoneDefinitions(devices);
        return {
            id: (0, crypto_1.generateUUID)(),
            timestamp: new Date(),
            devices,
            connections,
            zones,
            metadata: {
                deviceCount: devices.length,
                connectionCount: connections.length,
                collectionDuration: 0,
                sources: [types_1.TelemetrySource.SNMP, types_1.TelemetrySource.ARP, types_1.TelemetrySource.NETFLOW],
            },
        };
    }
    buildZoneDefinitions(devices) {
        const zoneMap = new Map();
        for (const device of devices) {
            if (!zoneMap.has(device.purdueLevel)) {
                zoneMap.set(device.purdueLevel, {
                    id: (0, crypto_1.generateUUID)(),
                    name: `Level ${device.purdueLevel}`,
                    purdueLevel: device.purdueLevel,
                    securityZone: device.securityZone,
                    subnets: [],
                });
            }
            // Add subnets from device interfaces
            const zone = zoneMap.get(device.purdueLevel);
            for (const iface of device.interfaces) {
                if (iface.ipAddress && iface.subnetMask) {
                    const subnet = this.calculateSubnet(iface.ipAddress, iface.subnetMask);
                    if (!zone.subnets.includes(subnet)) {
                        zone.subnets.push(subnet);
                    }
                }
            }
        }
        return Array.from(zoneMap.values());
    }
    calculateSubnet(ip, mask) {
        const ipParts = ip.split('.').map(Number);
        const maskParts = mask.split('.').map(Number);
        const networkParts = ipParts.map((part, i) => part & maskParts[i]);
        const prefix = maskParts.reduce((sum, part) => sum + (part.toString(2).match(/1/g) || []).length, 0);
        return `${networkParts.join('.')}/${prefix}`;
    }
    findPath(sourceId, targetId) {
        const visited = new Set();
        const queue = [{ id: sourceId, path: [sourceId] }];
        while (queue.length > 0) {
            const { id, path } = queue.shift();
            if (id === targetId)
                return path;
            if (visited.has(id))
                continue;
            visited.add(id);
            const neighbors = this.deviceConnections.get(id) || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push({ id: neighbor, path: [...path, neighbor] });
                }
            }
        }
        return null;
    }
    getDeviceConnections(deviceId) {
        return Array.from(this.connections.values()).filter(c => c.sourceDeviceId === deviceId || c.targetDeviceId === deviceId);
    }
    getDevice(deviceId) {
        return this.devices.get(deviceId);
    }
    getDevicesByLevel(level) {
        return Array.from(this.devices.values()).filter(d => d.purdueLevel === level);
    }
    getStatistics() {
        const byLevel = {};
        for (const device of this.devices.values()) {
            byLevel[device.purdueLevel] = (byLevel[device.purdueLevel] || 0) + 1;
        }
        return {
            deviceCount: this.devices.size,
            connectionCount: this.connections.size,
            byLevel,
        };
    }
    getConnectionKey(source, target) {
        return [source, target].sort().join('-');
    }
    clear() {
        this.devices.clear();
        this.connections.clear();
        this.deviceConnections.clear();
    }
}
exports.TopologyBuilder = TopologyBuilder;
exports.topologyBuilder = new TopologyBuilder();
//# sourceMappingURL=topology-builder.js.map