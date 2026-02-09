/**
 * NetFlow Collector - Traffic flow analysis
 */
import { BaseCollector, CollectorTarget } from './base-collector';
import { TelemetryData, CollectorConfig } from '../utils/types';
export declare class NetFlowCollector extends BaseCollector {
    private server;
    private readonly port;
    private readonly version;
    private templates;
    private flowBuffer;
    private readonly maxBufferSize;
    constructor(collectorConfig?: Partial<CollectorConfig>);
    protected initialize(): Promise<void>;
    protected cleanup(): Promise<void>;
    protected collect(_target: CollectorTarget): Promise<TelemetryData[]>;
    /**
     * Handle incoming NetFlow packet
     */
    private handlePacket;
    /**
     * Parse NetFlow v5 packet
     */
    private parseNetFlowV5;
    /**
     * Parse NetFlow v5 header
     */
    private parseV5Header;
    /**
     * Parse NetFlow v5 record
     */
    private parseV5Record;
    /**
     * Parse NetFlow v9 packet
     */
    private parseNetFlowV9;
    /**
     * Parse NetFlow v9 header
     */
    private parseV9Header;
    /**
     * Parse NetFlow v9 template
     */
    private parseV9Template;
    /**
     * Parse NetFlow v9 data
     */
    private parseV9Data;
    /**
     * Parse NetFlow v9 record based on template
     */
    private parseV9Record;
    /**
     * Aggregate flows by source/destination/port/protocol
     */
    private aggregateFlows;
    /**
     * Add flows to buffer
     */
    private addToBuffer;
    /**
     * Convert integer to IP address string
     */
    private intToIP;
    /**
     * Get protocol name from number
     */
    getProtocolName(protocol: number): string;
    /**
     * Get current buffer statistics
     */
    getBufferStats(): {
        flowCount: number;
        templateCount: number;
        oldestFlow?: Date;
        newestFlow?: Date;
    };
}
export declare function createNetFlowCollector(config?: Partial<CollectorConfig>): NetFlowCollector;
//# sourceMappingURL=netflow-collector.d.ts.map