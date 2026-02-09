/**
 * SNMPv3 Collector - Secure device discovery and monitoring
 */
import * as snmp from 'net-snmp';
import { BaseCollector, CollectorTarget } from './base-collector';
import { TelemetryData, SNMPConfig } from '../utils/types';
export interface SNMPTarget extends CollectorTarget {
    version: 3;
    securityName: string;
    securityLevel: snmp.SecurityLevel;
    authProtocol?: snmp.AuthProtocols;
    authKey?: string;
    privProtocol?: snmp.PrivProtocols;
    privKey?: string;
}
export declare class SNMPCollector extends BaseCollector {
    private sessions;
    constructor(snmpConfig?: Partial<SNMPConfig>);
    protected initialize(): Promise<void>;
    protected cleanup(): Promise<void>;
    protected collect(target: CollectorTarget): Promise<TelemetryData[]>;
    private getSession;
    private createSession;
    /**
     * Get system information from device
     */
    private getSystemInfo;
    /**
     * Get interface information
     */
    private getInterfaces;
    /**
     * Get LLDP neighbor information
     */
    private getLLDPNeighbors;
    /**
     * Get ARP table
     */
    private getARPTable;
    private get;
    private walk;
    private extractString;
    private extractNumber;
    private formatMacAddress;
    private isValidIP;
    /**
     * Add an SNMPv3 target
     */
    addSNMPTarget(host: string, securityName: string, options?: {
        port?: number;
        securityLevel?: snmp.SecurityLevel;
        authProtocol?: snmp.AuthProtocols;
        authKey?: string;
        privProtocol?: snmp.PrivProtocols;
        privKey?: string;
    }): string;
}
export declare function createSNMPCollector(config?: Partial<SNMPConfig>): SNMPCollector;
//# sourceMappingURL=snmp-collector.d.ts.map