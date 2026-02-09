/**
 * Syslog Collector - Security event collection (RFC 5424)
 */
import { BaseCollector, CollectorTarget } from './base-collector';
import { TelemetryData, CollectorConfig } from '../utils/types';
export declare class SyslogCollector extends BaseCollector {
    private udpServer;
    private tcpServer;
    private readonly port;
    private readonly protocol;
    private messageBuffer;
    private readonly maxBufferSize;
    constructor(collectorConfig?: Partial<CollectorConfig>);
    protected initialize(): Promise<void>;
    protected cleanup(): Promise<void>;
    private startUDPServer;
    private startTCPServer;
    protected collect(_target: CollectorTarget): Promise<TelemetryData[]>;
    /**
     * Handle incoming syslog message
     */
    private handleMessage;
    /**
     * Parse syslog message (RFC 5424 and RFC 3164)
     */
    private parseMessage;
    /**
     * Parse RFC 5424 syslog message
     * Format: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
     */
    private parseRFC5424;
    /**
     * Parse RFC 3164 (BSD) syslog message
     * Format: <PRI>TIMESTAMP HOSTNAME TAG: MSG
     */
    private parseRFC3164;
    /**
     * Parse timestamp from various formats
     */
    private parseTimestamp;
    /**
     * Parse structured data element
     */
    private parseStructuredData;
    private addToBuffer;
    /**
     * Group messages by severity
     */
    private groupBySeverity;
    /**
     * Check if message is security-relevant
     */
    private isSecurityRelevant;
    /**
     * Get top hosts by message count
     */
    private getTopHosts;
    /**
     * Get facility name
     */
    getFacilityName(facility: number): string;
    /**
     * Get severity name
     */
    getSeverityName(severity: number): string;
    /**
     * Get buffer statistics
     */
    getBufferStats(): {
        messageCount: number;
        oldestMessage?: Date;
        newestMessage?: Date;
        severityBreakdown: Record<string, number>;
    };
}
export declare function createSyslogCollector(config?: Partial<CollectorConfig>): SyslogCollector;
//# sourceMappingURL=syslog-collector.d.ts.map