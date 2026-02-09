/**
 * Syslog Parser - Security event analysis
 */
import { TelemetryData, Alert } from '../../utils/types';
export interface ParsedSecurityEvent {
    id: string;
    timestamp: Date;
    hostname: string;
    facility: string;
    severity: string;
    message: string;
    eventType: 'authentication' | 'authorization' | 'network' | 'system' | 'security' | 'unknown';
    isSecurityRelevant: boolean;
    extractedData: Record<string, string>;
    riskScore: number;
}
export declare class SyslogParser {
    private readonly securityPatterns;
    parse(telemetry: TelemetryData): ParsedSecurityEvent[];
    private parseMessage;
    private classifyEvent;
    private extractData;
    private isSecurityRelevant;
    private calculateRiskScore;
    toAlert(event: ParsedSecurityEvent): Alert | null;
}
export declare const syslogParser: SyslogParser;
//# sourceMappingURL=syslog-parser.d.ts.map