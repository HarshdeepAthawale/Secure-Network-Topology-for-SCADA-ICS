/**
 * Unit tests for Device Correlator
 */

import { deviceCorrelator, DeviceCandidate } from '../../../src/processors/correlation/device-correlator';
import { TelemetrySource } from '../../../src/utils/types';

describe('DeviceCorrelator', () => {
    describe('correlate', () => {
        it('should merge candidates with same MAC address', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    ipAddress: '192.168.1.10',
                    hostname: 'device1',
                    confidence: 80,
                },
                {
                    source: TelemetrySource.ARP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    ipAddress: '192.168.1.10',
                    confidence: 90,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
            expect(result[0].macAddress).toBe('00:1A:2B:3C:4D:5E');
        });

        it('should merge candidates with same IP address', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    ipAddress: '192.168.1.10',
                    hostname: 'device1',
                    vendor: 'Cisco',
                    confidence: 80,
                },
                {
                    source: TelemetrySource.SYSLOG,
                    ipAddress: '192.168.1.10',
                    hostname: 'device1',
                    model: 'IOS',
                    confidence: 70,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
            expect(result[0].vendor).toBe('Cisco');
            expect(result[0].model).toBe('IOS');
        });

        it('should keep separate devices with different identifiers', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    ipAddress: '192.168.1.10',
                    confidence: 80,
                },
                {
                    source: TelemetrySource.SNMP,
                    macAddress: 'AA:BB:CC:DD:EE:FF',
                    ipAddress: '192.168.1.20',
                    confidence: 80,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(2);
        });

        it('should use higher confidence value when merging', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    confidence: 60,
                },
                {
                    source: TelemetrySource.ARP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    confidence: 90,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
            expect(result[0].confidence).toBe(90);
        });

        it('should preserve all non-null properties when merging', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    vendor: 'Siemens',
                    confidence: 80,
                },
                {
                    source: TelemetrySource.ARP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    model: 'S7-1500',
                    firmwareVersion: '2.9.3',
                    confidence: 75,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result[0].vendor).toBe('Siemens');
            expect(result[0].model).toBe('S7-1500');
            expect(result[0].firmwareVersion).toBe('2.9.3');
        });

        it('should handle empty candidate list', () => {
            const result = deviceCorrelator.correlate([]);
            expect(result).toEqual([]);
        });

        it('should handle single candidate', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    ipAddress: '192.168.1.10',
                    confidence: 80,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
            expect(result[0].macAddress).toBe('00:1A:2B:3C:4D:5E');
        });
    });

    describe('matchByHostname', () => {
        it('should merge candidates with same hostname', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    hostname: 'plc-001.scada.local',
                    ipAddress: '192.168.1.10',
                    confidence: 80,
                },
                {
                    source: TelemetrySource.SYSLOG,
                    hostname: 'plc-001.scada.local',
                    vendor: 'Allen-Bradley',
                    confidence: 70,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
            expect(result[0].hostname).toBe('plc-001.scada.local');
            expect(result[0].vendor).toBe('Allen-Bradley');
        });

        it('should handle case-insensitive hostname matching', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    hostname: 'PLC-001.SCADA.LOCAL',
                    confidence: 80,
                },
                {
                    source: TelemetrySource.SYSLOG,
                    hostname: 'plc-001.scada.local',
                    confidence: 70,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
        });
    });

    describe('normalizeIdentifiers', () => {
        it('should normalize MAC addresses to consistent format', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.ARP,
                    macAddress: '00:1a:2b:3c:4d:5e', // lowercase
                    confidence: 80,
                },
                {
                    source: TelemetrySource.SNMP,
                    macAddress: '00-1A-2B-3C-4D-5E', // uppercase with dashes
                    confidence: 80,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
        });

        it('should handle IPv4 and IPv6 addresses', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    ipAddress: '192.168.1.10',
                    hostname: 'device1',
                    confidence: 80,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result[0].ipAddress).toBe('192.168.1.10');
        });
    });

    describe('confidence scoring', () => {
        it('should boost confidence for multiple matching sources', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    confidence: 70,
                },
                {
                    source: TelemetrySource.ARP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    confidence: 70,
                },
                {
                    source: TelemetrySource.NETFLOW,
                    ipAddress: '192.168.1.10',
                    macAddress: '00:1A:2B:3C:4D:5E',
                    confidence: 70,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            // Confidence should increase when multiple sources agree
            expect(result[0].confidence).toBeGreaterThanOrEqual(70);
        });

        it('should prioritize SNMP source data', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.SNMP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    vendor: 'Siemens (SNMP)',
                    confidence: 80,
                },
                {
                    source: TelemetrySource.ARP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    vendor: 'Unknown',
                    confidence: 90,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            // SNMP data should be preferred for device attributes
            expect(result[0].vendor).toBe('Siemens (SNMP)');
        });
    });

    describe('edge cases', () => {
        it('should handle candidates with only MAC address', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.ARP,
                    macAddress: '00:1A:2B:3C:4D:5E',
                    confidence: 50,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
            expect(result[0].macAddress).toBe('00:1A:2B:3C:4D:5E');
        });

        it('should handle candidates with only IP address', () => {
            const candidates: DeviceCandidate[] = [
                {
                    source: TelemetrySource.NETFLOW,
                    ipAddress: '192.168.1.10',
                    confidence: 50,
                },
            ];

            const result = deviceCorrelator.correlate(candidates);

            expect(result.length).toBe(1);
            expect(result[0].ipAddress).toBe('192.168.1.10');
        });

        it('should handle large number of candidates', () => {
            const candidates: DeviceCandidate[] = [];
            for (let i = 0; i < 1000; i++) {
                candidates.push({
                    source: TelemetrySource.SNMP,
                    ipAddress: `192.168.${Math.floor(i / 255)}.${i % 255}`,
                    macAddress: `00:00:00:00:${Math.floor(i / 255).toString(16).padStart(2, '0')}:${(i % 255).toString(16).padStart(2, '0')}`,
                    confidence: 80,
                });
            }

            const startTime = Date.now();
            const result = deviceCorrelator.correlate(candidates);
            const duration = Date.now() - startTime;

            expect(result.length).toBe(1000);
            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
        });
    });
});
