/**
 * Routing Collector - Layer 3 topology discovery
 */
import { BaseCollector, CollectorTarget } from './base-collector';
import { TelemetryData, CollectorConfig } from '../utils/types';
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
export declare class RoutingCollector extends BaseCollector {
    constructor(collectorConfig?: Partial<CollectorConfig>);
    protected initialize(): Promise<void>;
    protected cleanup(): Promise<void>;
    protected collect(target: CollectorTarget): Promise<TelemetryData[]>;
    /**
     * Collect local routing table
     */
    private collectRoutingTable;
    /**
     * Parse routing table output based on platform
     */
    private parseRoutingOutput;
    /**
     * Parse Linux 'ip route' output
     * Format: default via 192.168.1.1 dev eth0 proto static
     *         192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100
     */
    private parseLinuxRoute;
    /**
     * Parse macOS 'netstat -rn' output
     * Format: default           192.168.1.1      UGS      en0
     */
    private parseDarwinRoute;
    /**
     * Parse Windows 'route print' output
     * Format: 0.0.0.0    0.0.0.0    192.168.1.1    192.168.1.100    25
     */
    private parseWindowsRoute;
    /**
     * Collect routing protocol neighbors
     */
    private collectNeighbors;
    /**
     * Collect OSPF neighbors
     */
    private collectOSPFNeighbors;
    /**
     * Parse OSPF neighbor output
     */
    private parseOSPFOutput;
    /**
     * Collect BGP neighbors
     */
    private collectBGPNeighbors;
    /**
     * Parse BGP summary output
     */
    private parseBGPOutput;
    /**
     * Parse CIDR notation to destination and netmask
     */
    private parseNetworkCIDR;
    /**
     * Map protocol string to enum value
     */
    private mapProtocol;
    /**
     * Add a local routing target
     */
    addLocalTarget(options?: {
        collectRoutes?: boolean;
        collectNeighbors?: boolean;
        routingProtocols?: Array<'ospf' | 'bgp' | 'rip'>;
    }): string;
    /**
     * Add a remote routing target (for SNMP-based collection)
     */
    addRemoteTarget(host: string, options?: {
        port?: number;
        collectRoutes?: boolean;
        collectNeighbors?: boolean;
        routingProtocols?: Array<'ospf' | 'bgp' | 'rip'>;
    }): string;
}
export declare function createRoutingCollector(config?: Partial<CollectorConfig>): RoutingCollector;
//# sourceMappingURL=routing-collector.d.ts.map