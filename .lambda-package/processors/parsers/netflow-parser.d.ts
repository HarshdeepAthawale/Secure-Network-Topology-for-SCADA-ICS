/**
 * NetFlow Data Parser - Normalizes flow data for topology analysis
 */
import { TelemetryData, Connection } from '../../utils/types';
export interface ParsedFlow {
    id: string;
    srcAddress: string;
    dstAddress: string;
    srcPort: number;
    dstPort: number;
    protocol: string;
    protocolNumber: number;
    bytes: number;
    packets: number;
    startTime: Date;
    endTime: Date;
    duration: number;
    bytesPerSecond: number;
    isIndustrial: boolean;
    industrialProtocol?: string;
    tcpFlags?: number;
}
export interface FlowSummary {
    totalFlows: number;
    totalBytes: number;
    totalPackets: number;
    uniqueSources: number;
    uniqueDestinations: number;
    topTalkers: Array<{
        address: string;
        bytes: number;
    }>;
    topProtocols: Array<{
        protocol: string;
        bytes: number;
    }>;
    industrialFlows: number;
}
export declare class NetFlowParser {
    parse(telemetry: TelemetryData): ParsedFlow[];
    private parseFlow;
    private detectIndustrialProtocol;
    summarize(flows: ParsedFlow[]): FlowSummary;
    toConnection(flow: ParsedFlow, sourceDeviceId: string, targetDeviceId: string): Connection;
}
export declare const netflowParser: NetFlowParser;
//# sourceMappingURL=netflow-parser.d.ts.map