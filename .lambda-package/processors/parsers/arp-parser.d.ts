/**
 * ARP/MAC Parser - Layer 2 topology analysis
 */
import { TelemetryData, ARPEntry, MACTableEntry, NetworkInterface } from '../../utils/types';
export interface ParsedL2Device {
    id: string;
    macAddress: string;
    ipAddresses: string[];
    vendor?: string;
    vlanIds: number[];
    ports: string[];
    firstSeen: Date;
    lastSeen: Date;
}
export interface L2Topology {
    devices: ParsedL2Device[];
    connections: Array<{
        sourceMac: string;
        targetMac: string;
        vlanId?: number;
        port?: string;
    }>;
}
export declare class ARPParser {
    parse(telemetry: TelemetryData): {
        arpEntries: ARPEntry[];
        macEntries: MACTableEntry[];
    };
    private parseARPEntries;
    private parseMACEntries;
    buildL2Topology(arpEntries: ARPEntry[], macEntries: MACTableEntry[]): L2Topology;
    private inferConnections;
    getVendorFromMac(mac: string): string | undefined;
    toNetworkInterface(device: ParsedL2Device): NetworkInterface;
    private normalizeMac;
}
export declare const arpParser: ARPParser;
//# sourceMappingURL=arp-parser.d.ts.map