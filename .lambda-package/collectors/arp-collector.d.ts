/**
 * ARP/MAC Table Collector - Layer 2 connectivity discovery
 */
import { BaseCollector, CollectorTarget } from './base-collector';
import { TelemetryData, CollectorConfig, ARPEntry } from '../utils/types';
export interface ARPTarget extends CollectorTarget {
    interface?: string;
    collectType: 'arp' | 'mac' | 'both';
}
export declare class ARPCollector extends BaseCollector {
    constructor(collectorConfig?: Partial<CollectorConfig>);
    protected initialize(): Promise<void>;
    protected cleanup(): Promise<void>;
    protected collect(target: CollectorTarget): Promise<TelemetryData[]>;
    /**
     * Collect ARP table from the system
     */
    private collectARPTable;
    /**
     * Parse ARP command output based on platform
     */
    private parseARPOutput;
    /**
     * Parse Linux 'ip neigh' output
     * Format: 192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE
     */
    private parseLinuxARP;
    /**
     * Parse macOS 'arp -an' output
     * Format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
     */
    private parseDarwinARP;
    /**
     * Parse Windows 'arp -a' output
     * Format: 192.168.1.1    aa-bb-cc-dd-ee-ff     dynamic
     */
    private parseWindowsARP;
    /**
     * Collect MAC address table (typically from switches via SNMP or CLI)
     */
    private collectMACTable;
    /**
     * Discover devices on a subnet using ARP scanning
     * Note: This is an active scan - use with caution in OT environments
     */
    discoverSubnet(subnet: string, options?: {
        passive?: boolean;
        timeout?: number;
    }): Promise<ARPEntry[]>;
    /**
     * Parse subnet in CIDR notation
     */
    private parseSubnet;
    /**
     * Check if IP is in subnet
     */
    private isInSubnet;
    /**
     * Add a local ARP collection target
     */
    addLocalTarget(options?: {
        interface?: string;
        collectType?: 'arp' | 'mac' | 'both';
    }): string;
    /**
     * Add a remote target for MAC table collection
     */
    addRemoteTarget(host: string, options?: {
        port?: number;
        collectType?: 'mac' | 'both';
    }): string;
}
export declare function createARPCollector(config?: Partial<CollectorConfig>): ARPCollector;
//# sourceMappingURL=arp-collector.d.ts.map