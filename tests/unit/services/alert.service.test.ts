/**
 * Unit tests for Alert Service
 */

import { AlertService } from '../../../src/database/services/alert.service';
import { Device, DeviceType, DeviceStatus, PurdueLevel, SecurityZone, AlertSeverity, AlertType } from '../../../src/utils/types';

// Mock repositories
const mockAlertRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findUnacknowledged: jest.fn(),
    findUnresolved: jest.fn(),
    findBySeverity: jest.fn(),
    findByDeviceId: jest.fn(),
    acknowledge: jest.fn(),
    resolve: jest.fn(),
    search: jest.fn(),
    delete: jest.fn(),
    getAlertStats: jest.fn(),
};

const mockDeviceRepo = {
    findById: jest.fn(),
    findOfflineDevices: jest.fn(),
};

const mockConnectionRepo = {
    findInsecureConnections: jest.fn(),
    findCrossZoneConnections: jest.fn(),
};

jest.mock('../../../src/database/repositories/alert.repository', () => ({
    getAlertRepository: () => mockAlertRepo,
    AlertRepository: jest.fn(() => mockAlertRepo),
}));

jest.mock('../../../src/database/repositories/device.repository', () => ({
    getDeviceRepository: () => mockDeviceRepo,
    DeviceRepository: jest.fn(() => mockDeviceRepo),
}));

jest.mock('../../../src/database/repositories/connection.repository', () => ({
    getConnectionRepository: () => mockConnectionRepo,
    ConnectionRepository: jest.fn(() => mockConnectionRepo),
}));

describe('AlertService', () => {
    let service: AlertService;

    const createMockDevice = (overrides: Partial<Device> = {}): Device => ({
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
    });

    beforeEach(() => {
        jest.clearAllMocks();
        service = new AlertService();
    });

    describe('createAlert', () => {
        it('should create alert with provided data', async () => {
            const alertData = {
                type: AlertType.DEVICE_OFFLINE,
                severity: AlertSeverity.HIGH,
                title: 'Test Alert',
                description: 'Test description',
            };

            mockAlertRepo.create.mockResolvedValue({
                id: 'alert-123',
                ...alertData,
                createdAt: new Date(),
            });

            const result = await service.createAlert(alertData);

            expect(result.id).toBeDefined();
            expect(result.type).toBe(AlertType.DEVICE_OFFLINE);
            expect(mockAlertRepo.create).toHaveBeenCalled();
        });
    });

    describe('createDeviceOfflineAlert', () => {
        it('should create offline alert for device', async () => {
            const device = createMockDevice({ status: DeviceStatus.OFFLINE });

            mockAlertRepo.create.mockResolvedValue({
                id: 'alert-123',
                type: AlertType.DEVICE_OFFLINE,
                severity: AlertSeverity.HIGH,
                deviceId: device.id,
                createdAt: new Date(),
            });

            const result = await service.createDeviceOfflineAlert(device);

            expect(result.type).toBe(AlertType.DEVICE_OFFLINE);
            expect(result.severity).toBe(AlertSeverity.HIGH);
        });
    });

    describe('createCrossZoneAlert', () => {
        it('should calculate severity based on Purdue level difference', async () => {
            const sourceDevice = createMockDevice({
                purdueLevel: PurdueLevel.LEVEL_0,
                securityZone: SecurityZone.PROCESS,
            });
            const targetDevice = createMockDevice({
                purdueLevel: PurdueLevel.LEVEL_4,
                securityZone: SecurityZone.ENTERPRISE,
            });

            mockAlertRepo.create.mockResolvedValue({
                id: 'alert-123',
                type: AlertType.SECURITY_VIOLATION,
                severity: AlertSeverity.CRITICAL,
                createdAt: new Date(),
            });

            const result = await service.createCrossZoneAlert(sourceDevice, targetDevice, 'conn-123');

            expect(result.type).toBe(AlertType.SECURITY_VIOLATION);
            // L0 to L4 = 4 level difference = CRITICAL
            expect(mockAlertRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: AlertSeverity.CRITICAL,
                })
            );
        });

        it('should assign lower severity for small level differences', async () => {
            const sourceDevice = createMockDevice({
                purdueLevel: PurdueLevel.LEVEL_1,
                securityZone: SecurityZone.CONTROL,
            });
            const targetDevice = createMockDevice({
                purdueLevel: PurdueLevel.LEVEL_2,
                securityZone: SecurityZone.SUPERVISORY,
            });

            mockAlertRepo.create.mockResolvedValue({
                id: 'alert-123',
                type: AlertType.SECURITY_VIOLATION,
                severity: AlertSeverity.MEDIUM,
                createdAt: new Date(),
            });

            await service.createCrossZoneAlert(sourceDevice, targetDevice, 'conn-123');

            expect(mockAlertRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: AlertSeverity.MEDIUM,
                })
            );
        });
    });

    describe('acknowledgeAlert', () => {
        it('should acknowledge alert with user info', async () => {
            const alertId = 'alert-123';
            const acknowledgedBy = 'admin';
            const notes = 'Investigating';

            mockAlertRepo.acknowledge.mockResolvedValue({
                id: alertId,
                acknowledged: true,
                acknowledgedBy,
                acknowledgedAt: new Date(),
            });

            const result = await service.acknowledgeAlert(alertId, acknowledgedBy, notes);

            expect(result?.acknowledged).toBe(true);
            expect(result?.acknowledgedBy).toBe(acknowledgedBy);
            expect(mockAlertRepo.acknowledge).toHaveBeenCalledWith(alertId, acknowledgedBy, notes);
        });
    });

    describe('resolveAlert', () => {
        it('should resolve alert with resolution notes', async () => {
            const alertId = 'alert-123';
            const resolvedBy = 'admin';
            const resolution = 'Issue fixed';

            mockAlertRepo.resolve.mockResolvedValue({
                id: alertId,
                resolved: true,
                resolvedBy,
                resolvedAt: new Date(),
            });

            const result = await service.resolveAlert(alertId, resolvedBy, resolution);

            expect(result?.resolved).toBe(true);
            expect(result?.resolvedBy).toBe(resolvedBy);
        });
    });

    describe('bulkAcknowledge', () => {
        it('should acknowledge multiple alerts', async () => {
            const alertIds = ['alert-1', 'alert-2', 'alert-3'];

            mockAlertRepo.acknowledge.mockResolvedValue({ acknowledged: true });

            const count = await service.bulkAcknowledge(alertIds, 'admin');

            expect(count).toBe(3);
            expect(mockAlertRepo.acknowledge).toHaveBeenCalledTimes(3);
        });

        it('should handle partial failures', async () => {
            const alertIds = ['alert-1', 'alert-2', 'alert-3'];

            mockAlertRepo.acknowledge
                .mockResolvedValueOnce({ acknowledged: true })
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ acknowledged: true });

            const count = await service.bulkAcknowledge(alertIds, 'admin');

            expect(count).toBe(2);
        });
    });

    describe('getStatistics', () => {
        it('should return alert statistics', async () => {
            mockAlertRepo.getAlertStats.mockResolvedValue({
                total: 100,
                unacknowledged: 20,
                unresolved: 30,
                bySeverity: { critical: 5, high: 15, medium: 30, low: 50 },
                byType: { device_offline: 25, security_violation: 10 },
            });

            mockAlertRepo.search.mockResolvedValue({
                data: new Array(10).fill({ id: '1' }),
                pagination: { total: 10 },
            });

            const stats = await service.getStatistics();

            expect(stats.total).toBe(100);
            expect(stats.unacknowledged).toBe(20);
            expect(stats.bySeverity.critical).toBe(5);
        });
    });

    describe('runAutomatedChecks', () => {
        it('should detect offline devices and create alerts', async () => {
            const offlineDevice = createMockDevice({ status: DeviceStatus.OFFLINE });

            mockDeviceRepo.findOfflineDevices.mockResolvedValue([offlineDevice]);
            mockConnectionRepo.findInsecureConnections.mockResolvedValue([]);
            mockConnectionRepo.findCrossZoneConnections.mockResolvedValue([]);
            mockAlertRepo.findByDeviceId.mockResolvedValue([]);
            mockAlertRepo.create.mockResolvedValue({
                id: 'alert-123',
                type: AlertType.DEVICE_OFFLINE,
                createdAt: new Date(),
            });

            const newAlerts = await service.runAutomatedChecks();

            expect(newAlerts.length).toBeGreaterThan(0);
        });

        it('should not create duplicate alerts', async () => {
            const offlineDevice = createMockDevice({ status: DeviceStatus.OFFLINE });

            mockDeviceRepo.findOfflineDevices.mockResolvedValue([offlineDevice]);
            mockConnectionRepo.findInsecureConnections.mockResolvedValue([]);
            mockConnectionRepo.findCrossZoneConnections.mockResolvedValue([]);
            mockAlertRepo.findByDeviceId.mockResolvedValue([
                { type: AlertType.DEVICE_OFFLINE, resolved: false },
            ]);

            const newAlerts = await service.runAutomatedChecks();

            expect(newAlerts.filter((a: { type: AlertType }) => a.type === AlertType.DEVICE_OFFLINE).length).toBe(0);
        });
    });

    describe('cleanupOldAlerts', () => {
        it('should delete old resolved alerts', async () => {
            mockAlertRepo.search.mockResolvedValue({
                data: [{ id: 'old-1' }, { id: 'old-2' }, { id: 'old-3' }],
                pagination: { total: 3 },
            });
            mockAlertRepo.delete.mockResolvedValue(true);

            const deleted = await service.cleanupOldAlerts(90);

            expect(deleted).toBe(3);
            expect(mockAlertRepo.delete).toHaveBeenCalledTimes(3);
        });
    });
});
