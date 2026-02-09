/**
 * SNMP Data Parser - Normalizes SNMP telemetry data
 */
import { TelemetryData, Device, DeviceType, NetworkInterface } from '../../utils/types';
export interface ParsedSNMPDevice {
    id: string;
    sysName: string;
    sysDescr: string;
    sysLocation: string;
    sysContact: string;
    sysUpTime: number;
    sysObjectID: string;
    vendor?: string;
    model?: string;
    deviceType: DeviceType;
    interfaces: NetworkInterface[];
    neighbors: Array<{
        localInterface: string;
        remoteDeviceId: string;
        remoteInterface?: string;
    }>;
    arpEntries: Array<{
        ip: string;
        mac: string;
    }>;
}
export declare class SNMPParser {
    parse(telemetry: TelemetryData): ParsedSNMPDevice | null;
    private parseSystemData;
    private detectVendor;
    private extractModel;
    private detectDeviceType;
    parseInterfaces(data: Record<string, unknown>): NetworkInterface[];
    getVendorFromMac(mac: string): string | undefined;
    toDevice(parsed: ParsedSNMPDevice): Device;
    private normalizeMac;
}
export declare const snmpParser: SNMPParser;
//# sourceMappingURL=snmp-parser.d.ts.map