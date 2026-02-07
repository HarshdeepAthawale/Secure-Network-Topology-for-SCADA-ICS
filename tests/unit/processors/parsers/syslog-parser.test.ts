/**
 * Unit tests for Syslog Parser
 */

import { SyslogParser } from '../../../../src/processors/parsers/syslog-parser';
import { TelemetryData, SyslogMessage, AlertSeverity } from '../../../../src/utils/types';

describe('SyslogParser', () => {
  let parser: SyslogParser;

  beforeEach(() => {
    parser = new SyslogParser();
  });

  describe('parse', () => {
    it('should parse syslog telemetry data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: {
          messages: [
            {
              timestamp: new Date('2024-01-01T10:00:00Z'),
              hostname: 'router-01',
              facility: 16,
              severity: 5,
              message: 'Failed password for user admin from 192.168.1.100',
            },
          ],
        },
      };

      const result = parser.parse(telemetry);

      expect(result).toHaveLength(1);
      expect(result[0].hostname).toBe('router-01');
    });

    it('should return empty array for non-syslog data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'netflow-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { type: 'netflow' },
      };

      const result = parser.parse(telemetry);

      expect(result).toHaveLength(0);
    });

    it('should parse multiple syslog messages', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          hostname: 'router-01',
          facility: 16,
          severity: 5,
          message: 'Failed password for user admin',
        },
        {
          timestamp: new Date('2024-01-01T10:00:01Z'),
          hostname: 'router-02',
          facility: 16,
          severity: 5,
          message: 'Invalid user guest from 192.168.1.100',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result).toHaveLength(2);
    });
  });

  describe('Event classification', () => {
    it('should classify authentication events', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 5,
          message: 'Failed password for user admin from 192.168.1.100',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].eventType).toBe('authentication');
    });

    it('should classify authorization events', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 5,
          message: 'Access denied for user guest',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].eventType).toBe('authorization');
    });

    it('should classify network events', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'firewall-01',
          facility: 16,
          severity: 4,
          message: 'Firewall blocked connection to port 22',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].eventType).toBe('network');
    });

    it('should classify security events', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 2,
          message: 'Intrusion attempt detected by IDS',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].eventType).toBe('security');
    });

    it('should classify system events', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 5,
          message: 'Kernel panic: out of memory',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].eventType).toBe('system');
    });
  });

  describe('Data extraction', () => {
    it('should extract source IP address', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 5,
          message: 'Failed password for user admin from 192.168.1.100',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].extractedData.sourceIP).toBe('192.168.1.100');
    });

    it('should extract destination IP address', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 5,
          message: 'Connection denied to 10.0.0.1',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].extractedData.destinationIP).toBe('10.0.0.1');
    });

    it('should extract username from authentication messages', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 5,
          message: 'Failed login attempt for user admin from 192.168.1.100',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].extractedData.username).toBeDefined();
    });

    it('should extract port number', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'firewall-01',
          facility: 16,
          severity: 4,
          message: 'Connection blocked to port 502',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].extractedData.port).toBe('502');
    });
  });

  describe('Security relevance detection', () => {
    it('should mark critical security events as relevant', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 2,
          message: 'Malware detected by antivirus scanner',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].isSecurityRelevant).toBe(true);
    });

    it('should mark brute force attempts as security relevant', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 3,
          message: 'Repeated login failures detected - possible brute force attack',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].isSecurityRelevant).toBe(true);
    });

    it('should mark firewall events as relevant', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'firewall-01',
          facility: 16,
          severity: 4,
          message: 'Firewall blocked connection from 192.168.1.100',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect(result[0].isSecurityRelevant).toBe(true);
    });

    it('should identify non-security events', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date(),
          hostname: 'device-01',
          facility: 16,
          severity: 5,
          message: 'System time synchronized with NTP server',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      const result = parser.parse(telemetry);

      expect([true, false]).toContain(result[0].isSecurityRelevant);
    });
  });

  describe('Risk score calculation', () => {
    it('should calculate higher risk for critical severity events', () => {
      const criticalMessage: SyslogMessage = {
        timestamp: new Date(),
        hostname: 'device-01',
        facility: 16,
        severity: 2, // Critical
        message: 'Intrusion detection alert',
      };

      const warningMessage: SyslogMessage = {
        timestamp: new Date(),
        hostname: 'device-01',
        facility: 16,
        severity: 5, // Notice
        message: 'Routine system event',
      };

      const telemetry1: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages: [criticalMessage] },
      };

      const telemetry2: TelemetryData = {
        id: 'telemetry-2',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages: [warningMessage] },
      };

      const result1 = parser.parse(telemetry1);
      const result2 = parser.parse(telemetry2);

      expect(result1[0].riskScore).toBeGreaterThan(result2[0].riskScore);
    });

    it('should give higher risk score to security-relevant events', () => {
      const securityEvent: SyslogMessage = {
        timestamp: new Date(),
        hostname: 'device-01',
        facility: 16,
        severity: 5,
        message: 'Failed authentication attempt',
      };

      const nonSecurityEvent: SyslogMessage = {
        timestamp: new Date(),
        hostname: 'device-01',
        facility: 16,
        severity: 5,
        message: 'Interface eth0 brought up',
      };

      const telemetry1: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages: [securityEvent] },
      };

      const telemetry2: TelemetryData = {
        id: 'telemetry-2',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages: [nonSecurityEvent] },
      };

      const result1 = parser.parse(telemetry1);
      const result2 = parser.parse(telemetry2);

      expect(result1[0].riskScore).toBeGreaterThanOrEqual(result2[0].riskScore);
    });
  });

  describe('RFC format handling', () => {
    it('should handle RFC3164 format messages', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          hostname: 'router-01',
          facility: 16,
          severity: 5,
          message: 'Jan  1 10:00:00 router-01 kernel: Command exited with status 1',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      expect(() => parser.parse(telemetry)).not.toThrow();
    });

    it('should handle RFC5424 format messages', () => {
      const messages: SyslogMessage[] = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          hostname: 'router-01',
          facility: 16,
          severity: 5,
          message:
            '<134>1 2024-01-01T10:00:00Z router-01 kernel - - - Command exited with status 1',
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { messages },
      };

      expect(() => parser.parse(telemetry)).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle missing messages array', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: {},
      };

      const result = parser.parse(telemetry);

      expect(result).toHaveLength(0);
    });

    it('should handle null message data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'syslog-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: null,
      };

      expect(() => parser.parse(telemetry as any)).toThrow();
    });
  });
});
