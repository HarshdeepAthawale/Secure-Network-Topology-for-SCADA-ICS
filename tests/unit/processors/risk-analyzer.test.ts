/**
 * Unit tests for Risk Analyzer
 */

import { riskAnalyzer } from '../../../src/processors/risk/risk-analyzer';
import { Device, Connection, DeviceType, DeviceStatus, PurdueLevel, SecurityZone, ConnectionType } from '../../../src/utils/types';

// Mock device factory
function createMockDevice(overrides: Partial<Device> = {}): Device {
    return {
        id: 'device-123',
        name: 'Test Device',
        type: DeviceType.PLC,
        purdueLevel: PurdueLevel.LEVEL_1,
        securityZone: SecurityZone.CONTROL,
        status: DeviceStatus.ONLINE,
        interfaces: [],
        metadata: {},
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

// Mock connection factory
function createMockConnection(overrides: Partial<Connection> = {}): Connection {
    return {
        id: 'conn-123',
        sourceDeviceId: 'device-1',
        targetDeviceId: 'device-2',
        connectionType: ConnectionType.ETHERNET,
        protocol: 'modbus',
        isSecure: false,
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
        ...overrides,
    };
}

describe('RiskAnalyzer', () => {
    describe('analyzeDevice', () => {
        it('should assign higher risk to Level 0 devices', () => {
            const level0Device = createMockDevice({
                purdueLevel: PurdueLevel.LEVEL_0,
                securityZone: SecurityZone.PROCESS,
                type: DeviceType.SENSOR,
            });

            const level4Device = createMockDevice({
                purdueLevel: PurdueLevel.LEVEL_4,
                securityZone: SecurityZone.ENTERPRISE,
                type: DeviceType.SERVER,
            });

            const level0Risk = riskAnalyzer.analyzeDevice(level0Device, []);
            const level4Risk = riskAnalyzer.analyzeDevice(level4Device, []);

            expect(level0Risk.score).toBeGreaterThan(level4Risk.score);
        });

        it('should increase risk for offline devices', () => {
            const onlineDevice = createMockDevice({ status: DeviceStatus.ONLINE });
            const offlineDevice = createMockDevice({ status: DeviceStatus.OFFLINE });

            const onlineRisk = riskAnalyzer.analyzeDevice(onlineDevice, []);
            const offlineRisk = riskAnalyzer.analyzeDevice(offlineDevice, []);

            expect(offlineRisk.score).toBeGreaterThan(onlineRisk.score);
        });

        it('should increase risk for devices with unknown type', () => {
            const knownDevice = createMockDevice({ type: DeviceType.PLC });
            const unknownDevice = createMockDevice({ type: DeviceType.UNKNOWN });

            const knownRisk = riskAnalyzer.analyzeDevice(knownDevice, []);
            const unknownRisk = riskAnalyzer.analyzeDevice(unknownDevice, []);

            expect(unknownRisk.score).toBeGreaterThan(knownRisk.score);
        });

        it('should increase risk for devices with insecure connections', () => {
            const device = createMockDevice({ id: 'device-1' });
            const secureConnections = [
                createMockConnection({ sourceDeviceId: 'device-1', isSecure: true }),
            ];
            const insecureConnections = [
                createMockConnection({ sourceDeviceId: 'device-1', isSecure: false }),
            ];

            const secureRisk = riskAnalyzer.analyzeDevice(device, secureConnections);
            const insecureRisk = riskAnalyzer.analyzeDevice(device, insecureConnections);

            expect(insecureRisk.score).toBeGreaterThan(secureRisk.score);
        });

        it('should include risk factors in analysis', () => {
            const device = createMockDevice({
                status: DeviceStatus.OFFLINE,
                type: DeviceType.UNKNOWN,
                purdueLevel: PurdueLevel.LEVEL_0,
            });

            const result = riskAnalyzer.analyzeDevice(device, []);

            expect(result.factors).toBeDefined();
            expect(result.factors.length).toBeGreaterThan(0);
        });
    });

    describe('analyzeConnection', () => {
        it('should flag insecure protocols', () => {
            const sourceDevice = createMockDevice({ id: 'source' });
            const targetDevice = createMockDevice({ id: 'target' });

            const insecureConnection = createMockConnection({
                protocol: 'telnet',
                isSecure: false,
            });

            const result = riskAnalyzer.analyzeConnection(insecureConnection, sourceDevice, targetDevice);

            expect(result.factors.some(f => f.type === 'insecure_protocol')).toBe(true);
        });

        it('should flag cross-zone connections', () => {
            const sourceDevice = createMockDevice({
                id: 'source',
                securityZone: SecurityZone.CONTROL,
                purdueLevel: PurdueLevel.LEVEL_1,
            });
            const targetDevice = createMockDevice({
                id: 'target',
                securityZone: SecurityZone.ENTERPRISE,
                purdueLevel: PurdueLevel.LEVEL_4,
            });

            const connection = createMockConnection({
                sourceDeviceId: 'source',
                targetDeviceId: 'target',
            });

            const result = riskAnalyzer.analyzeConnection(connection, sourceDevice, targetDevice);

            expect(result.score).toBeGreaterThan(50);
        });

        it('should assign higher risk to connections spanning multiple Purdue levels', () => {
            const level1Device = createMockDevice({ purdueLevel: PurdueLevel.LEVEL_1 });
            const level2Device = createMockDevice({ purdueLevel: PurdueLevel.LEVEL_2 });
            const level4Device = createMockDevice({ purdueLevel: PurdueLevel.LEVEL_4 });

            const smallSpan = createMockConnection();
            const largeSpan = createMockConnection();

            const smallSpanRisk = riskAnalyzer.analyzeConnection(smallSpan, level1Device, level2Device);
            const largeSpanRisk = riskAnalyzer.analyzeConnection(largeSpan, level1Device, level4Device);

            expect(largeSpanRisk.score).toBeGreaterThan(smallSpanRisk.score);
        });
    });

    describe('analyzeTopology', () => {
        it('should calculate overall network risk', () => {
            const devices = [
                createMockDevice({ id: 'd1', purdueLevel: PurdueLevel.LEVEL_0 }),
                createMockDevice({ id: 'd2', purdueLevel: PurdueLevel.LEVEL_1 }),
                createMockDevice({ id: 'd3', purdueLevel: PurdueLevel.LEVEL_2 }),
            ];

            const connections = [
                createMockConnection({ sourceDeviceId: 'd1', targetDeviceId: 'd2' }),
                createMockConnection({ sourceDeviceId: 'd2', targetDeviceId: 'd3' }),
            ];

            const result = riskAnalyzer.analyzeTopology(devices, connections);

            expect(result.overallScore).toBeDefined();
            expect(result.overallScore).toBeGreaterThanOrEqual(0);
            expect(result.overallScore).toBeLessThanOrEqual(100);
        });

        it('should identify high-risk devices', () => {
            const devices = [
                createMockDevice({
                    id: 'high-risk',
                    purdueLevel: PurdueLevel.LEVEL_0,
                    type: DeviceType.UNKNOWN,
                    status: DeviceStatus.OFFLINE,
                }),
                createMockDevice({
                    id: 'low-risk',
                    purdueLevel: PurdueLevel.LEVEL_4,
                    type: DeviceType.SERVER,
                    status: DeviceStatus.ONLINE,
                }),
            ];

            const result = riskAnalyzer.analyzeTopology(devices, []);

            expect(result.highRiskDevices.length).toBeGreaterThan(0);
            expect(result.highRiskDevices[0].id).toBe('high-risk');
        });

        it('should identify high-risk connections', () => {
            const devices = [
                createMockDevice({
                    id: 'd1',
                    purdueLevel: PurdueLevel.LEVEL_0,
                    securityZone: SecurityZone.PROCESS,
                }),
                createMockDevice({
                    id: 'd2',
                    purdueLevel: PurdueLevel.LEVEL_4,
                    securityZone: SecurityZone.ENTERPRISE,
                }),
            ];

            const connections = [
                createMockConnection({
                    sourceDeviceId: 'd1',
                    targetDeviceId: 'd2',
                    isSecure: false,
                }),
            ];

            const result = riskAnalyzer.analyzeTopology(devices, connections);

            expect(result.highRiskConnections.length).toBeGreaterThan(0);
        });

        it('should provide recommendations', () => {
            const devices = [
                createMockDevice({
                    id: 'd1',
                    type: DeviceType.UNKNOWN,
                    status: DeviceStatus.OFFLINE,
                }),
            ];

            const result = riskAnalyzer.analyzeTopology(devices, []);

            expect(result.recommendations).toBeDefined();
            expect(result.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('calculateRiskScore', () => {
        it('should return score between 0 and 100', () => {
            const device = createMockDevice();
            const result = riskAnalyzer.analyzeDevice(device, []);

            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });

        it('should weight critical factors more heavily', () => {
            const criticalDevice = createMockDevice({
                purdueLevel: PurdueLevel.LEVEL_0,
                type: DeviceType.PLC,
                securityZone: SecurityZone.PROCESS,
            });

            const result = riskAnalyzer.analyzeDevice(criticalDevice, []);

            // Level 0 PLCs should have elevated base risk
            expect(result.score).toBeGreaterThan(30);
        });
    });

    describe('risk levels', () => {
        it('should categorize risk levels correctly', () => {
            const result = riskAnalyzer.getRiskLevel(85);
            expect(result).toBe('critical');

            const result2 = riskAnalyzer.getRiskLevel(65);
            expect(result2).toBe('high');

            const result3 = riskAnalyzer.getRiskLevel(45);
            expect(result3).toBe('medium');

            const result4 = riskAnalyzer.getRiskLevel(20);
            expect(result4).toBe('low');
        });
    });
});
