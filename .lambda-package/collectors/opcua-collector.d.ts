/**
 * OPC-UA Collector - Industrial protocol data collection
 * Collects data from OPC-UA servers typically used in SCADA/ICS environments
 *
 * NOTE: Requires 'node-opcua' package to be installed for full functionality.
 * This implementation provides the interface and mock functionality when the
 * package is not available.
 */
import { BaseCollector, CollectorTarget } from './base-collector';
import { TelemetryData, CollectorConfig } from '../utils/types';
export interface OPCUATarget extends CollectorTarget {
    endpointUrl: string;
    securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy?: string;
    username?: string;
    password?: string;
    certificatePath?: string;
    privateKeyPath?: string;
    browseRootNode?: string;
    monitoredNodes?: string[];
    samplingInterval?: number;
}
export interface OPCUANode {
    nodeId: string;
    browseName: string;
    displayName: string;
    nodeClass: string;
    dataType?: string;
    value?: unknown;
    children?: OPCUANode[];
}
export interface OPCUAServerInfo {
    applicationName: string;
    applicationUri: string;
    productUri: string;
    manufacturerName?: string;
    softwareVersion?: string;
    buildNumber?: string;
    endpoints: Array<{
        endpointUrl: string;
        securityMode: string;
        securityPolicy: string;
    }>;
}
export declare class OPCUACollector extends BaseCollector {
    private connections;
    private opcuaAvailable;
    constructor(collectorConfig?: Partial<CollectorConfig>);
    /**
     * Check if node-opcua is available
     */
    private checkOPCUAAvailability;
    /**
     * Initialize the OPC-UA collector
     */
    initialize(): Promise<void>;
    /**
     * Collect data from a single target
     */
    collect(target: CollectorTarget): Promise<TelemetryData[]>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    /**
     * Create server info telemetry
     */
    private createServerInfoTelemetry;
    /**
     * Create mock server info telemetry
     */
    private createMockServerInfoTelemetry;
    /**
     * Create nodes telemetry
     */
    private createNodesTelemetry;
    /**
     * Create mock nodes telemetry
     */
    private createMockNodesTelemetry;
    /**
     * Create values telemetry
     */
    private createValuesTelemetry;
    /**
     * Count all nodes recursively
     */
    private countNodes;
    /**
     * Get connection status for a target
     */
    getConnectionStatus(targetId: string): {
        connected: boolean;
        lastContact?: Date;
    };
    /**
     * Add OPC-UA target
     */
    addOPCUATarget(target: Omit<OPCUATarget, 'id'>): string;
}
export declare function getOPCUACollector(): OPCUACollector;
export declare function createOPCUACollector(config?: Partial<CollectorConfig>): OPCUACollector;
//# sourceMappingURL=opcua-collector.d.ts.map