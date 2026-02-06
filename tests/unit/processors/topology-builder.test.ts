/**
 * Unit tests for Topology Builder
 */

import { topologyBuilder, TopologyNode } from '../../../src/processors/correlation/topology-builder';
import { Device, Connection, DeviceType, DeviceStatus, PurdueLevel, SecurityZone, ConnectionType } from '../../../src/utils/types';

// Mock device factory
function createMockDevice(id: string, overrides: Partial<Device> = {}): Device {
    return {
        id,
        name: `Device ${id}`,
        type: DeviceType.PLC,
        purdueLevel: PurdueLevel.LEVEL_1,
        securityZone: SecurityZone.CONTROL,
        status: DeviceStatus.ONLINE,
        interfaces: [],
        metadata: {},
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

// Mock connection factory
function createMockConnection(sourceId: string, targetId: string, overrides: Partial<Connection> = {}): Connection {
    return {
        id: `conn-${sourceId}-${targetId}`,
        sourceDeviceId: sourceId,
        targetDeviceId: targetId,
        connectionType: ConnectionType.ETHERNET,
        protocol: 'modbus',
        isSecure: true,
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
        ...overrides,
    };
}

describe('TopologyBuilder', () => {
    describe('build', () => {
        it('should create nodes for all devices', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
                createMockDevice('d3'),
            ];
            const connections: Connection[] = [];

            const topology = topologyBuilder.build(devices, connections);

            expect(topology.nodes.size).toBe(3);
            expect(topology.nodes.has('d1')).toBe(true);
            expect(topology.nodes.has('d2')).toBe(true);
            expect(topology.nodes.has('d3')).toBe(true);
        });

        it('should create edges for all connections', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
            ];

            const topology = topologyBuilder.build(devices, connections);

            expect(topology.edges.length).toBe(1);
            expect(topology.edges[0].source).toBe('d1');
            expect(topology.edges[0].target).toBe('d2');
        });

        it('should organize devices into zones', () => {
            const devices = [
                createMockDevice('d1', { securityZone: SecurityZone.PROCESS }),
                createMockDevice('d2', { securityZone: SecurityZone.CONTROL }),
                createMockDevice('d3', { securityZone: SecurityZone.CONTROL }),
            ];

            const topology = topologyBuilder.build(devices, []);

            expect(topology.zones.has(SecurityZone.PROCESS)).toBe(true);
            expect(topology.zones.has(SecurityZone.CONTROL)).toBe(true);
            expect(topology.zones.get(SecurityZone.CONTROL)?.length).toBe(2);
        });

        it('should organize devices by Purdue level', () => {
            const devices = [
                createMockDevice('d1', { purdueLevel: PurdueLevel.LEVEL_0 }),
                createMockDevice('d2', { purdueLevel: PurdueLevel.LEVEL_1 }),
                createMockDevice('d3', { purdueLevel: PurdueLevel.LEVEL_2 }),
            ];

            const topology = topologyBuilder.build(devices, []);

            expect(topology.levels.has(PurdueLevel.LEVEL_0)).toBe(true);
            expect(topology.levels.has(PurdueLevel.LEVEL_1)).toBe(true);
            expect(topology.levels.has(PurdueLevel.LEVEL_2)).toBe(true);
        });
    });

    describe('findPath', () => {
        it('should find direct path between connected devices', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
            ];

            const topology = topologyBuilder.build(devices, connections);
            const path = topologyBuilder.findPath(topology, 'd1', 'd2');

            expect(path).not.toBeNull();
            expect(path?.length).toBe(2);
            expect(path?.[0]).toBe('d1');
            expect(path?.[1]).toBe('d2');
        });

        it('should find multi-hop path', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
                createMockDevice('d3'),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
                createMockConnection('d2', 'd3'),
            ];

            const topology = topologyBuilder.build(devices, connections);
            const path = topologyBuilder.findPath(topology, 'd1', 'd3');

            expect(path).not.toBeNull();
            expect(path?.length).toBe(3);
            expect(path).toEqual(['d1', 'd2', 'd3']);
        });

        it('should return null for disconnected devices', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
                createMockDevice('d3'),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
                // d3 is not connected
            ];

            const topology = topologyBuilder.build(devices, connections);
            const path = topologyBuilder.findPath(topology, 'd1', 'd3');

            expect(path).toBeNull();
        });

        it('should return path with single node when source equals target', () => {
            const devices = [createMockDevice('d1')];
            const connections: Connection[] = [];

            const topology = topologyBuilder.build(devices, connections);
            const path = topologyBuilder.findPath(topology, 'd1', 'd1');

            expect(path).toEqual(['d1']);
        });
    });

    describe('getNeighbors', () => {
        it('should return all directly connected devices', () => {
            const devices = [
                createMockDevice('center'),
                createMockDevice('neighbor1'),
                createMockDevice('neighbor2'),
                createMockDevice('isolated'),
            ];
            const connections = [
                createMockConnection('center', 'neighbor1'),
                createMockConnection('center', 'neighbor2'),
            ];

            const topology = topologyBuilder.build(devices, connections);
            const neighbors = topologyBuilder.getNeighbors(topology, 'center');

            expect(neighbors.length).toBe(2);
            expect(neighbors).toContain('neighbor1');
            expect(neighbors).toContain('neighbor2');
            expect(neighbors).not.toContain('isolated');
        });

        it('should include incoming connections', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
            ];
            const connections = [
                createMockConnection('d1', 'd2'), // d1 -> d2
            ];

            const topology = topologyBuilder.build(devices, connections);
            const neighborsOfD2 = topologyBuilder.getNeighbors(topology, 'd2');

            expect(neighborsOfD2).toContain('d1');
        });
    });

    describe('detectCycles', () => {
        it('should detect simple cycle', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
                createMockDevice('d3'),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
                createMockConnection('d2', 'd3'),
                createMockConnection('d3', 'd1'), // Creates cycle
            ];

            const topology = topologyBuilder.build(devices, connections);
            const cycles = topologyBuilder.detectCycles(topology);

            expect(cycles.length).toBeGreaterThan(0);
        });

        it('should return empty array for acyclic graph', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
                createMockDevice('d3'),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
                createMockConnection('d2', 'd3'),
            ];

            const topology = topologyBuilder.build(devices, connections);
            const cycles = topologyBuilder.detectCycles(topology);

            expect(cycles.length).toBe(0);
        });
    });

    describe('getCrossZoneConnections', () => {
        it('should identify connections between different zones', () => {
            const devices = [
                createMockDevice('d1', { securityZone: SecurityZone.CONTROL }),
                createMockDevice('d2', { securityZone: SecurityZone.ENTERPRISE }),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
            ];

            const topology = topologyBuilder.build(devices, connections);
            const crossZone = topologyBuilder.getCrossZoneConnections(topology);

            expect(crossZone.length).toBe(1);
        });

        it('should not include connections within same zone', () => {
            const devices = [
                createMockDevice('d1', { securityZone: SecurityZone.CONTROL }),
                createMockDevice('d2', { securityZone: SecurityZone.CONTROL }),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
            ];

            const topology = topologyBuilder.build(devices, connections);
            const crossZone = topologyBuilder.getCrossZoneConnections(topology);

            expect(crossZone.length).toBe(0);
        });
    });

    describe('getConnectedComponents', () => {
        it('should identify separate network segments', () => {
            const devices = [
                createMockDevice('a1'),
                createMockDevice('a2'),
                createMockDevice('b1'),
                createMockDevice('b2'),
            ];
            const connections = [
                createMockConnection('a1', 'a2'), // Segment A
                createMockConnection('b1', 'b2'), // Segment B (disconnected)
            ];

            const topology = topologyBuilder.build(devices, connections);
            const components = topologyBuilder.getConnectedComponents(topology);

            expect(components.length).toBe(2);
        });

        it('should return single component for fully connected graph', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
                createMockDevice('d3'),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
                createMockConnection('d2', 'd3'),
            ];

            const topology = topologyBuilder.build(devices, connections);
            const components = topologyBuilder.getConnectedComponents(topology);

            expect(components.length).toBe(1);
            expect(components[0].length).toBe(3);
        });
    });

    describe('getTopologyStats', () => {
        it('should calculate correct statistics', () => {
            const devices = [
                createMockDevice('d1', { status: DeviceStatus.ONLINE }),
                createMockDevice('d2', { status: DeviceStatus.ONLINE }),
                createMockDevice('d3', { status: DeviceStatus.OFFLINE }),
            ];
            const connections = [
                createMockConnection('d1', 'd2'),
                createMockConnection('d2', 'd3'),
            ];

            const topology = topologyBuilder.build(devices, connections);
            const stats = topologyBuilder.getStats(topology);

            expect(stats.nodeCount).toBe(3);
            expect(stats.edgeCount).toBe(2);
            expect(stats.onlineCount).toBe(2);
            expect(stats.offlineCount).toBe(1);
        });
    });

    describe('edge cases', () => {
        it('should handle empty device list', () => {
            const topology = topologyBuilder.build([], []);

            expect(topology.nodes.size).toBe(0);
            expect(topology.edges.length).toBe(0);
        });

        it('should handle devices without connections', () => {
            const devices = [
                createMockDevice('d1'),
                createMockDevice('d2'),
            ];

            const topology = topologyBuilder.build(devices, []);

            expect(topology.nodes.size).toBe(2);
            expect(topology.edges.length).toBe(0);
        });

        it('should handle self-referencing connections', () => {
            const devices = [createMockDevice('d1')];
            const connections = [
                createMockConnection('d1', 'd1'), // Self-loop
            ];

            const topology = topologyBuilder.build(devices, connections);

            expect(topology.nodes.size).toBe(1);
            expect(topology.edges.length).toBe(1);
        });
    });
});
