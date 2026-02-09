/**
 * Topology Builder - Constructs network topology graph
 */
import { Device, Connection, ConnectionType, TopologySnapshot, PurdueLevel, SecurityZone } from '../../utils/types';
export interface TopologyNode {
    id: string;
    deviceId: string;
    label: string;
    type: string;
    purdueLevel: PurdueLevel;
    zone: SecurityZone;
    x?: number;
    y?: number;
}
export interface TopologyEdge {
    id: string;
    source: string;
    target: string;
    connectionType: ConnectionType;
    protocol?: string;
    bandwidth?: number;
    isSecure: boolean;
}
export interface TopologyGraph {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    zones: Map<PurdueLevel, TopologyNode[]>;
}
export declare class TopologyBuilder {
    private devices;
    private connections;
    private deviceConnections;
    addDevice(device: Device): void;
    addConnection(connection: Connection): void;
    addConnectionFromFlow(sourceDeviceId: string, targetDeviceId: string, protocol?: string, port?: number, isSecure?: boolean): void;
    buildGraph(): TopologyGraph;
    private layoutNodes;
    createSnapshot(): TopologySnapshot;
    private buildZoneDefinitions;
    private calculateSubnet;
    findPath(sourceId: string, targetId: string): string[] | null;
    getDeviceConnections(deviceId: string): Connection[];
    getDevice(deviceId: string): Device | undefined;
    getDevicesByLevel(level: PurdueLevel): Device[];
    getStatistics(): {
        deviceCount: number;
        connectionCount: number;
        byLevel: Record<number, number>;
    };
    private getConnectionKey;
    clear(): void;
}
export declare const topologyBuilder: TopologyBuilder;
//# sourceMappingURL=topology-builder.d.ts.map