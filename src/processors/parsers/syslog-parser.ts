/**
 * Syslog Parser - Security event analysis
 */

import { TelemetryData, SyslogMessage, Alert, AlertSeverity, AlertType } from '../../utils/types';
import { SYSLOG_FACILITIES, SYSLOG_SEVERITIES } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

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

export class SyslogParser {
  private readonly securityPatterns: Array<{ pattern: RegExp; type: string; severity: AlertSeverity }> = [
    { pattern: /failed\s+(password|login|auth)/i, type: 'authentication_failure', severity: AlertSeverity.MEDIUM },
    { pattern: /invalid\s+user/i, type: 'invalid_user', severity: AlertSeverity.MEDIUM },
    { pattern: /accepted\s+(password|publickey)/i, type: 'successful_login', severity: AlertSeverity.INFO },
    { pattern: /connection\s+(refused|denied|blocked)/i, type: 'connection_blocked', severity: AlertSeverity.LOW },
    { pattern: /(brute.?force|repeated.?failure)/i, type: 'brute_force', severity: AlertSeverity.HIGH },
    { pattern: /(root|admin|sudo)/i, type: 'privileged_access', severity: AlertSeverity.MEDIUM },
    { pattern: /(firewall|iptables|denied)/i, type: 'firewall_event', severity: AlertSeverity.LOW },
    { pattern: /(malware|virus|trojan|ransomware)/i, type: 'malware_detected', severity: AlertSeverity.CRITICAL },
    { pattern: /(intrusion|attack|exploit)/i, type: 'intrusion_attempt', severity: AlertSeverity.HIGH },
    { pattern: /(unauthorized|violation|breach)/i, type: 'policy_violation', severity: AlertSeverity.HIGH },
  ];

  parse(telemetry: TelemetryData): ParsedSecurityEvent[] {
    const data = telemetry.data as Record<string, unknown>;
    if (!Array.isArray(data.messages)) return [];

    return (data.messages as SyslogMessage[]).map(msg => this.parseMessage(msg));
  }

  private parseMessage(msg: SyslogMessage): ParsedSecurityEvent {
    const eventType = this.classifyEvent(msg.message);
    const extractedData = this.extractData(msg.message);
    const isSecurityRelevant = this.isSecurityRelevant(msg);

    return {
      id: generateUUID(),
      timestamp: msg.timestamp,
      hostname: msg.hostname,
      facility: SYSLOG_FACILITIES[msg.facility] || 'unknown',
      severity: SYSLOG_SEVERITIES[msg.severity] || 'unknown',
      message: msg.message,
      eventType,
      isSecurityRelevant,
      extractedData,
      riskScore: this.calculateRiskScore(msg, isSecurityRelevant),
    };
  }

  private classifyEvent(message: string): ParsedSecurityEvent['eventType'] {
    const lower = message.toLowerCase();
    if (/auth|login|password|credential/.test(lower)) return 'authentication';
    if (/denied|forbidden|unauthorized|permission/.test(lower)) return 'authorization';
    if (/connect|network|firewall|port/.test(lower)) return 'network';
    if (/attack|intrusion|malware|exploit/.test(lower)) return 'security';
    if (/system|kernel|service|daemon/.test(lower)) return 'system';
    return 'unknown';
  }

  private extractData(message: string): Record<string, string> {
    const data: Record<string, string> = {};
    const patterns: Array<[RegExp, string]> = [
      [/(?:from|src|source)[:\s]+(\d+\.\d+\.\d+\.\d+)/i, 'sourceIP'],
      [/(?:to|dst|destination)[:\s]+(\d+\.\d+\.\d+\.\d+)/i, 'destinationIP'],
      [/(?:user|username)[:\s]+(\S+)/i, 'username'],
      [/port[:\s]+(\d+)/i, 'port'],
    ];

    for (const [pattern, key] of patterns) {
      const match = message.match(pattern);
      if (match) data[key] = match[1];
    }

    return data;
  }

  private isSecurityRelevant(msg: SyslogMessage): boolean {
    if (msg.severity <= 3) return true;
    if ([4, 10, 13].includes(msg.facility)) return true;
    return this.securityPatterns.some(p => p.pattern.test(msg.message));
  }

  private calculateRiskScore(msg: SyslogMessage, isSecurityRelevant: boolean): number {
    let score = (7 - msg.severity) * 10;
    if (isSecurityRelevant) score += 20;

    for (const { pattern, severity } of this.securityPatterns) {
      if (pattern.test(msg.message)) {
        const severityScores = { critical: 40, high: 30, medium: 20, low: 10, info: 5 };
        score += severityScores[severity] || 0;
        break;
      }
    }

    return Math.min(score, 100);
  }

  toAlert(event: ParsedSecurityEvent): Alert | null {
    if (!event.isSecurityRelevant || event.riskScore < 30) return null;

    const severity = event.riskScore >= 80 ? AlertSeverity.CRITICAL :
                     event.riskScore >= 60 ? AlertSeverity.HIGH :
                     event.riskScore >= 40 ? AlertSeverity.MEDIUM : AlertSeverity.LOW;

    return {
      id: generateUUID(),
      type: AlertType.SECURITY,
      severity,
      title: `Security Event: ${event.eventType}`,
      description: event.message.substring(0, 500),
      details: { ...event.extractedData, riskScore: event.riskScore, facility: event.facility },
      acknowledged: false,
      resolved: false,
      createdAt: event.timestamp,
    };
  }
}

export const syslogParser = new SyslogParser();
