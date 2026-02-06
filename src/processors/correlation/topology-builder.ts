/**
 * Topology Builder - Constructs network topology graph
 */

import { Device, Connection, ConnectionType, TopologySnapshot, ZoneDefinition, TelemetrySource, PurdueLevel, SecurityZone } from '../../utils/types';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

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

export class TopologyBuilder {
  private devices: Map<string, Device> = new Map();
  private connections: Map<string, Connection> = new Map();
  private deviceConnections: Map<string, Set<string>> = new Map();

  addDevice(device: Device): void {
    this.devices.set(device.id, device);
    if (!this.deviceConnections.has(device.id)) {
      this.deviceConnections.set(device.id, new Set());
    }
    logger.debug('Device added to topology', { deviceId: device.id, name: device.name });
  }

  addConnection(connection: Connection): void {
    const key = this.getConnectionKey(connection.sourceDeviceId, connection.targetDeviceId);
    const existing = this.connections.get(key);

    if (existing) {
      // Update existing connection
      existing.lastSeenAt = connection.lastSeenAt;
      if (connection.bandwidth) existing.bandwidth = connection.bandwidth;
    } else {
      this.connections.set(key, connection);
      this.deviceConnections.get(connection.sourceDeviceId)?.add(connection.targetDeviceId);
      this.deviceConnections.get(connection.targetDeviceId)?.add(connection.sourceDeviceId);
    }
  }

  addConnectionFromFlow(sourceDeviceId: string, targetDeviceId: string, protocol?: string, port?: number, isSecure?: boolean): void {
    const connection: Connection = {
      id: generateUUID(),
      sourceDeviceId,
      targetDeviceId,
      connectionType: ConnectionType.ETHERNET,
      protocol,
      port,
      isSecure: isSecure || false,
      discoveredAt: new Date(),
      lastSeenAt: new Date(),
      metadata: {},
    };

    this.addConnection(connection);
  }

  buildGraph(): TopologyGraph {
    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];
    const zones = new Map<PurdueLevel, TopologyNode[]>();

    // Create nodes
    for (const device of this.devices.values()) {
      const node: TopologyNode = {
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
      const edge: TopologyEdge = {
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

  private layoutNodes(nodes: TopologyNode[], zones: Map<PurdueLevel, TopologyNode[]>): void {
    const levelOrder = [
      PurdueLevel.LEVEL_0,
      PurdueLevel.LEVEL_1,
      PurdueLevel.LEVEL_2,
      PurdueLevel.LEVEL_3,
      PurdueLevel.DMZ,
      PurdueLevel.LEVEL_4,
      PurdueLevel.LEVEL_5,
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

  createSnapshot(): TopologySnapshot {
    const devices = Array.from(this.devices.values());
    const connections = Array.from(this.connections.values());
    const zones = this.buildZoneDefinitions(devices);

    return {
      id: generateUUID(),
      timestamp: new Date(),
      devices,
      connections,
      zones,
      metadata: {
        deviceCount: devices.length,
        connectionCount: connections.length,
        collectionDuration: 0,
        sources: [TelemetrySource.SNMP, TelemetrySource.ARP, TelemetrySource.NETFLOW],
      },
    };
  }

  private buildZoneDefinitions(devices: Device[]): ZoneDefinition[] {
    const zoneMap = new Map<PurdueLevel, ZoneDefinition>();

    for (const device of devices) {
      if (!zoneMap.has(device.purdueLevel)) {
        zoneMap.set(device.purdueLevel, {
          id: generateUUID(),
          name: `Level ${device.purdueLevel}`,
          purdueLevel: device.purdueLevel,
          securityZone: device.securityZone,
          subnets: [],
        });
      }

      // Add subnets from device interfaces
      const zone = zoneMap.get(device.purdueLevel)!;
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

  private calculateSubnet(ip: string, mask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    const networkParts = ipParts.map((part, i) => part & maskParts[i]);
    const prefix = maskParts.reduce((sum, part) => sum + (part.toString(2).match(/1/g) || []).length, 0);
    return `${networkParts.join('.')}/${prefix}`;
  }

  findPath(sourceId: string, targetId: string): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (id === targetId) return path;
      if (visited.has(id)) continue;
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

  getDeviceConnections(deviceId: string): Connection[] {
    return Array.from(this.connections.values()).filter(
      c => c.sourceDeviceId === deviceId || c.targetDeviceId === deviceId
    );
  }

  getDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  getDevicesByLevel(level: PurdueLevel): Device[] {
    return Array.from(this.devices.values()).filter(d => d.purdueLevel === level);
  }

  getStatistics(): { deviceCount: number; connectionCount: number; byLevel: Record<number, number> } {
    const byLevel: Record<number, number> = {};
    for (const device of this.devices.values()) {
      byLevel[device.purdueLevel] = (byLevel[device.purdueLevel] || 0) + 1;
    }

    return {
      deviceCount: this.devices.size,
      connectionCount: this.connections.size,
      byLevel,
    };
  }

  private getConnectionKey(source: string, target: string): string {
    return [source, target].sort().join('-');
  }

  clear(): void {
    this.devices.clear();
    this.connections.clear();
    this.deviceConnections.clear();
  }
}

export const topologyBuilder = new TopologyBuilder();
