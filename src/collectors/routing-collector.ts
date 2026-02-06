/**
 * Routing Collector - Layer 3 topology discovery
 */

import { BaseCollector, CollectorTarget } from './base-collector';
import {
  TelemetryData,
  TelemetrySource,
  CollectorConfig,
} from '../utils/types';
import { logger } from '../utils/logger';
import { CollectorError } from '../utils/error-handler';
import { config } from '../utils/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface RouteEntry {
  destination: string;
  netmask: string;
  gateway: string;
  interface: string;
  metric: number;
  protocol: 'connected' | 'static' | 'ospf' | 'bgp' | 'rip' | 'other';
  flags?: string;
}

export interface RoutingNeighbor {
  protocol: 'ospf' | 'bgp' | 'rip';
  neighborId: string;
  neighborAddress: string;
  state: string;
  interface: string;
  uptime?: string;
}

export interface RoutingTarget extends CollectorTarget {
  collectRoutes: boolean;
  collectNeighbors: boolean;
  routingProtocols: Array<'ospf' | 'bgp' | 'rip'>;
}

// ============================================================================
// Routing Collector Class
// ============================================================================

export class RoutingCollector extends BaseCollector {
  constructor(collectorConfig?: Partial<CollectorConfig>) {
    const mergedConfig = {
      ...config.collector,
      ...collectorConfig,
    };

    super('RoutingCollector', TelemetrySource.ROUTING, mergedConfig);
  }

  // ============================================================================
  // Lifecycle Implementation
  // ============================================================================

  protected async initialize(): Promise<void> {
    logger.info('Initializing Routing collector');
    // No persistent connections needed
  }

  protected async cleanup(): Promise<void> {
    logger.info('Cleaning up Routing collector');
    // No cleanup needed
  }

  // ============================================================================
  // Collection Implementation
  // ============================================================================

  protected async collect(target: CollectorTarget): Promise<TelemetryData[]> {
    const routingTarget = target as RoutingTarget;
    const telemetryData: TelemetryData[] = [];

    try {
      // Collect routing table
      if (routingTarget.collectRoutes) {
        const routes = await this.collectRoutingTable(routingTarget);
        if (routes.length > 0) {
          telemetryData.push(this.createTelemetryData(
            { type: 'routes', entries: routes },
            undefined
          ));
        }
      }

      // Collect routing protocol neighbors
      if (routingTarget.collectNeighbors) {
        for (const protocol of routingTarget.routingProtocols || []) {
          const neighbors = await this.collectNeighbors(routingTarget, protocol);
          if (neighbors.length > 0) {
            telemetryData.push(this.createTelemetryData(
              { type: 'neighbors', protocol, entries: neighbors },
              undefined
            ));
          }
        }
      }

      logger.debug(`Routing collection completed for ${routingTarget.host}`, {
        dataPoints: telemetryData.length,
      });

    } catch (error) {
      throw new CollectorError(
        'routing',
        `Failed to collect from ${routingTarget.host}: ${(error as Error).message}`,
        routingTarget.host
      );
    }

    return telemetryData;
  }

  // ============================================================================
  // Routing Table Collection
  // ============================================================================

  /**
   * Collect local routing table
   */
  private async collectRoutingTable(target: RoutingTarget): Promise<RouteEntry[]> {
    const routes: RouteEntry[] = [];

    try {
      const platform = process.platform;
      let command: string;

      switch (platform) {
        case 'linux':
          command = 'ip route show';
          break;
        case 'darwin':
          command = 'netstat -rn';
          break;
        case 'win32':
          command = 'route print';
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      const { stdout } = await execAsync(command);
      const parsedRoutes = this.parseRoutingOutput(stdout, platform);

      routes.push(...parsedRoutes);
    } catch (error) {
      logger.warn('Failed to collect routing table', {
        error: (error as Error).message,
      });
    }

    return routes;
  }

  /**
   * Parse routing table output based on platform
   */
  private parseRoutingOutput(output: string, platform: string): RouteEntry[] {
    const routes: RouteEntry[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        let route: RouteEntry | null = null;

        switch (platform) {
          case 'linux':
            route = this.parseLinuxRoute(line);
            break;
          case 'darwin':
            route = this.parseDarwinRoute(line);
            break;
          case 'win32':
            route = this.parseWindowsRoute(line);
            break;
        }

        if (route) {
          routes.push(route);
        }
      } catch {
        // Skip unparseable lines
      }
    }

    return routes;
  }

  /**
   * Parse Linux 'ip route' output
   * Format: default via 192.168.1.1 dev eth0 proto static
   *         192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100
   */
  private parseLinuxRoute(line: string): RouteEntry | null {
    // Default route
    const defaultRegex = /^default\s+via\s+(\S+)\s+dev\s+(\S+)(?:\s+proto\s+(\S+))?/;
    const defaultMatch = line.match(defaultRegex);

    if (defaultMatch) {
      return {
        destination: '0.0.0.0',
        netmask: '0.0.0.0',
        gateway: defaultMatch[1],
        interface: defaultMatch[2],
        metric: 0,
        protocol: this.mapProtocol(defaultMatch[3] || 'static'),
      };
    }

    // Network route
    const networkRegex = /^(\S+)\s+(?:via\s+(\S+)\s+)?dev\s+(\S+)(?:\s+proto\s+(\S+))?/;
    const networkMatch = line.match(networkRegex);

    if (networkMatch) {
      const [dest, mask] = this.parseNetworkCIDR(networkMatch[1]);
      return {
        destination: dest,
        netmask: mask,
        gateway: networkMatch[2] || '0.0.0.0',
        interface: networkMatch[3],
        metric: 0,
        protocol: this.mapProtocol(networkMatch[4] || 'connected'),
      };
    }

    return null;
  }

  /**
   * Parse macOS 'netstat -rn' output
   * Format: default           192.168.1.1      UGS      en0
   */
  private parseDarwinRoute(line: string): RouteEntry | null {
    // Skip header lines
    if (line.includes('Destination') || line.includes('Internet') || line.includes('Routing')) {
      return null;
    }

    const regex = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/;
    const match = line.match(regex);

    if (!match) return null;

    const destination = match[1];
    const gateway = match[2];
    const flags = match[3];
    const iface = match[4];

    // Parse destination
    let dest = destination;
    let mask = '255.255.255.255';

    if (destination === 'default') {
      dest = '0.0.0.0';
      mask = '0.0.0.0';
    } else if (destination.includes('/')) {
      [dest, mask] = this.parseNetworkCIDR(destination);
    }

    return {
      destination: dest,
      netmask: mask,
      gateway: gateway === 'link#' ? '0.0.0.0' : gateway.replace(/%.*$/, ''),
      interface: iface,
      metric: 0,
      protocol: flags.includes('S') ? 'static' : 'connected',
      flags,
    };
  }

  /**
   * Parse Windows 'route print' output
   * Format: 0.0.0.0    0.0.0.0    192.168.1.1    192.168.1.100    25
   */
  private parseWindowsRoute(line: string): RouteEntry | null {
    // Skip header and non-route lines
    if (!line.match(/^\s*\d+/)) return null;

    const regex = /^\s*(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)/;
    const match = line.match(regex);

    if (!match) return null;

    return {
      destination: match[1],
      netmask: match[2],
      gateway: match[3],
      interface: match[4],
      metric: parseInt(match[5], 10),
      protocol: match[1] === '0.0.0.0' ? 'static' : 'connected',
    };
  }

  // ============================================================================
  // Neighbor Collection
  // ============================================================================

  /**
   * Collect routing protocol neighbors
   */
  private async collectNeighbors(
    target: RoutingTarget,
    protocol: 'ospf' | 'bgp' | 'rip'
  ): Promise<RoutingNeighbor[]> {
    const neighbors: RoutingNeighbor[] = [];

    try {
      // This would typically use SNMP or SSH to collect neighbor info
      // For now, we'll try to get info from local routing daemons if available

      switch (protocol) {
        case 'ospf':
          neighbors.push(...await this.collectOSPFNeighbors());
          break;
        case 'bgp':
          neighbors.push(...await this.collectBGPNeighbors());
          break;
        case 'rip':
          // RIP neighbor collection
          break;
      }
    } catch (error) {
      logger.debug(`Failed to collect ${protocol} neighbors`, {
        error: (error as Error).message,
      });
    }

    return neighbors;
  }

  /**
   * Collect OSPF neighbors
   */
  private async collectOSPFNeighbors(): Promise<RoutingNeighbor[]> {
    const neighbors: RoutingNeighbor[] = [];

    try {
      // Try vtysh (FRRouting/Quagga)
      const { stdout } = await execAsync('vtysh -c "show ip ospf neighbor"');
      neighbors.push(...this.parseOSPFOutput(stdout));
    } catch {
      // vtysh not available or no OSPF configured
    }

    return neighbors;
  }

  /**
   * Parse OSPF neighbor output
   */
  private parseOSPFOutput(output: string): RoutingNeighbor[] {
    const neighbors: RoutingNeighbor[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Skip header
      if (line.includes('Neighbor ID') || line.includes('---')) continue;

      const regex = /(\d+\.\d+\.\d+\.\d+)\s+\d+\s+(\S+)\s+\S+\s+(\S+)\s+(\S+)/;
      const match = line.match(regex);

      if (match) {
        neighbors.push({
          protocol: 'ospf',
          neighborId: match[1],
          neighborAddress: match[4],
          state: match[2],
          interface: match[3],
        });
      }
    }

    return neighbors;
  }

  /**
   * Collect BGP neighbors
   */
  private async collectBGPNeighbors(): Promise<RoutingNeighbor[]> {
    const neighbors: RoutingNeighbor[] = [];

    try {
      // Try vtysh (FRRouting/Quagga)
      const { stdout } = await execAsync('vtysh -c "show ip bgp summary"');
      neighbors.push(...this.parseBGPOutput(stdout));
    } catch {
      // vtysh not available or no BGP configured
    }

    return neighbors;
  }

  /**
   * Parse BGP summary output
   */
  private parseBGPOutput(output: string): RoutingNeighbor[] {
    const neighbors: RoutingNeighbor[] = [];
    const lines = output.split('\n').filter(line => line.trim());
    let inNeighborSection = false;

    for (const line of lines) {
      if (line.includes('Neighbor')) {
        inNeighborSection = true;
        continue;
      }

      if (!inNeighborSection) continue;

      const regex = /^(\d+\.\d+\.\d+\.\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\S+)\s+(\S+)/;
      const match = line.match(regex);

      if (match) {
        neighbors.push({
          protocol: 'bgp',
          neighborId: match[1],
          neighborAddress: match[1],
          state: match[2],
          interface: 'bgp',
          uptime: match[3],
        });
      }
    }

    return neighbors;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Parse CIDR notation to destination and netmask
   */
  private parseNetworkCIDR(cidr: string): [string, string] {
    if (!cidr.includes('/')) {
      return [cidr, '255.255.255.255'];
    }

    const [network, prefix] = cidr.split('/');
    const prefixNum = parseInt(prefix, 10);
    const mask = prefixNum === 0 ? 0 : ~((1 << (32 - prefixNum)) - 1) >>> 0;

    const maskStr = [
      (mask >>> 24) & 0xff,
      (mask >>> 16) & 0xff,
      (mask >>> 8) & 0xff,
      mask & 0xff,
    ].join('.');

    return [network, maskStr];
  }

  /**
   * Map protocol string to enum value
   */
  private mapProtocol(proto: string): RouteEntry['protocol'] {
    const protoLower = proto.toLowerCase();

    if (protoLower.includes('kernel') || protoLower.includes('connected')) {
      return 'connected';
    }
    if (protoLower.includes('static')) return 'static';
    if (protoLower.includes('ospf')) return 'ospf';
    if (protoLower.includes('bgp')) return 'bgp';
    if (protoLower.includes('rip')) return 'rip';

    return 'other';
  }

  // ============================================================================
  // Target Management
  // ============================================================================

  /**
   * Add a local routing target
   */
  addLocalTarget(options: {
    collectRoutes?: boolean;
    collectNeighbors?: boolean;
    routingProtocols?: Array<'ospf' | 'bgp' | 'rip'>;
  } = {}): string {
    const target: Omit<RoutingTarget, 'id'> = {
      host: 'localhost',
      enabled: true,
      collectRoutes: options.collectRoutes ?? true,
      collectNeighbors: options.collectNeighbors ?? false,
      routingProtocols: options.routingProtocols || [],
    };

    return this.addTarget(target);
  }

  /**
   * Add a remote routing target (for SNMP-based collection)
   */
  addRemoteTarget(
    host: string,
    options: {
      port?: number;
      collectRoutes?: boolean;
      collectNeighbors?: boolean;
      routingProtocols?: Array<'ospf' | 'bgp' | 'rip'>;
    } = {}
  ): string {
    const target: Omit<RoutingTarget, 'id'> = {
      host,
      port: options.port,
      enabled: true,
      collectRoutes: options.collectRoutes ?? true,
      collectNeighbors: options.collectNeighbors ?? false,
      routingProtocols: options.routingProtocols || [],
    };

    return this.addTarget(target);
  }
}

// ============================================================================
// Export
// ============================================================================

export function createRoutingCollector(config?: Partial<CollectorConfig>): RoutingCollector {
  return new RoutingCollector(config);
}
