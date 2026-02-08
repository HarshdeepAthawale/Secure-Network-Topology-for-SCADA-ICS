/**
 * Integration tests for Database Repositories
 */

import { Pool } from 'pg';
import { DeviceRepository } from '../../../src/database/repositories/device.repository';
import { ConnectionRepository } from '../../../src/database/repositories/connection.repository';
import { AlertRepository } from '../../../src/database/repositories/alert.repository';
import { DeviceType, DeviceStatus, PurdueLevel, SecurityZone, AlertType, AlertSeverity, ConnectionType } from '../../../src/utils/types';

// Skip if no database connection available
const describeIfDb = process.env.DATABASE_HOST ? describe : describe.skip;

describeIfDb('Database Repositories Integration', () => {
    let pool: Pool;
    let deviceRepo: DeviceRepository;
    let connectionRepo: ConnectionRepository;
    let alertRepo: AlertRepository;

    beforeAll(async () => {
        // Connect to test database
        pool = new Pool({
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME || 'scada_test',
            user: process.env.DATABASE_USER || 'test_user',
            password: process.env.DATABASE_PASSWORD || 'test_password',
        });

        // Initialize repositories (they get connection via getConnection())
        deviceRepo = new DeviceRepository();
        connectionRepo = new ConnectionRepository();
        alertRepo = new AlertRepository();
    });

    afterAll(async () => {
        // Cleanup test data
        await pool.query('DELETE FROM alerts WHERE title LIKE \'Test%\'');
        await pool.query('DELETE FROM connections WHERE id LIKE \'test-%\'');
        await pool.query('DELETE FROM devices WHERE name LIKE \'Test%\'');
        await pool.end();
    });

    describe('DeviceRepository', () => {
        let testDeviceId: string;

        it('should create a device', async () => {
            const device = await deviceRepo.create({
                name: 'Test PLC 001',
                type: DeviceType.PLC,
                vendor: 'Siemens',
                model: 'S7-1500',
                purdueLevel: PurdueLevel.LEVEL_1,
                securityZone: SecurityZone.CONTROL,
                status: DeviceStatus.ONLINE,
                discoveredAt: new Date(),
                lastSeenAt: new Date(),
            });

            expect(device).toBeDefined();
            expect(device.id).toBeDefined();
            expect(device.name).toBe('Test PLC 001');
            testDeviceId = device.id;
        });

        it('should find device by ID', async () => {
            const device = await deviceRepo.findById(testDeviceId);

            expect(device).not.toBeNull();
            expect(device?.name).toBe('Test PLC 001');
        });

        it('should update device', async () => {
            const updated = await deviceRepo.update(testDeviceId, {
                status: DeviceStatus.OFFLINE,
                firmwareVersion: '2.9.4',
            });

            expect(updated).not.toBeNull();
            expect(updated?.status).toBe(DeviceStatus.OFFLINE);
            expect(updated?.firmwareVersion).toBe('2.9.4');
        });

        it('should search devices by Purdue level', async () => {
            const result = await deviceRepo.search({
                purdueLevel: PurdueLevel.LEVEL_1,
            });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.every(d => d.purdueLevel === PurdueLevel.LEVEL_1)).toBe(true);
        });

        it('should count by Purdue level', async () => {
            const counts = await deviceRepo.countByPurdueLevel();

            expect(counts[PurdueLevel.LEVEL_1]).toBeGreaterThan(0);
        });

        it('should delete device', async () => {
            const deleted = await deviceRepo.delete(testDeviceId);

            expect(deleted).toBe(true);

            const found = await deviceRepo.findById(testDeviceId);
            expect(found).toBeNull();
        });
    });

    describe('ConnectionRepository', () => {
        let sourceDeviceId: string;
        let targetDeviceId: string;
        let testConnectionId: string;

        beforeAll(async () => {
            // Create test devices for connections
            const source = await deviceRepo.create({
                name: 'Test Source Device',
                type: DeviceType.PLC,
                purdueLevel: PurdueLevel.LEVEL_1,
                securityZone: SecurityZone.CONTROL,
                status: DeviceStatus.ONLINE,
                discoveredAt: new Date(),
                lastSeenAt: new Date(),
            });
            sourceDeviceId = source.id;

            const target = await deviceRepo.create({
                name: 'Test Target Device',
                type: DeviceType.HMI,
                purdueLevel: PurdueLevel.LEVEL_2,
                securityZone: SecurityZone.SUPERVISORY,
                status: DeviceStatus.ONLINE,
                discoveredAt: new Date(),
                lastSeenAt: new Date(),
            });
            targetDeviceId = target.id;
        });

        afterAll(async () => {
            // Cleanup
            await deviceRepo.delete(sourceDeviceId);
            await deviceRepo.delete(targetDeviceId);
        });

        it('should create a connection', async () => {
            const connection = await connectionRepo.create({
                id: 'test-conn-001',
                sourceDeviceId,
                targetDeviceId,
                connectionType: ConnectionType.ETHERNET,
                protocol: 'modbus',
                port: 502,
                isSecure: false,
                discoveredAt: new Date(),
                lastSeenAt: new Date(),
            });

            expect(connection).toBeDefined();
            expect(connection.sourceDeviceId).toBe(sourceDeviceId);
            testConnectionId = connection.id;
        });

        it('should find connections by device ID', async () => {
            const connections = await connectionRepo.findByDeviceId(sourceDeviceId);

            expect(connections.length).toBeGreaterThan(0);
            expect(connections[0].sourceDeviceId).toBe(sourceDeviceId);
        });

        it('should detect cross-zone connections', async () => {
            const crossZone = await connectionRepo.findCrossZoneConnections();

            // Our test connection is cross-zone (L1 to L2)
            expect(crossZone.length).toBeGreaterThan(0);
        });

        it('should find insecure connections', async () => {
            const insecure = await connectionRepo.findInsecureConnections();

            // Our test connection is insecure
            expect(insecure.some(c => c.id === testConnectionId)).toBe(true);
        });

        it('should delete connection', async () => {
            const deleted = await connectionRepo.delete(testConnectionId);

            expect(deleted).toBe(true);
        });
    });

    describe('AlertRepository', () => {
        let testAlertId: string;
        let testDeviceId: string;

        beforeAll(async () => {
            // Create test device for alerts
            const device = await deviceRepo.create({
                name: 'Test Alert Device',
                type: DeviceType.DATABASE_SERVER,
                purdueLevel: PurdueLevel.LEVEL_3,
                securityZone: SecurityZone.OPERATIONS,
                status: DeviceStatus.ONLINE,
                discoveredAt: new Date(),
                lastSeenAt: new Date(),
            });
            testDeviceId = device.id;
        });

        afterAll(async () => {
            await deviceRepo.delete(testDeviceId);
        });

        it('should create an alert', async () => {
            const alert = await alertRepo.create({
                type: AlertType.DEVICE_OFFLINE,
                severity: AlertSeverity.HIGH,
                title: 'Test Alert - Device Offline',
                description: 'Test device is not responding',
                deviceId: testDeviceId,
            });

            expect(alert).toBeDefined();
            expect(alert.id).toBeDefined();
            expect(alert.type).toBe(AlertType.DEVICE_OFFLINE);
            testAlertId = alert.id;
        });

        it('should find unacknowledged alerts', async () => {
            const unack = await alertRepo.findUnacknowledged();

            expect(unack.some(a => a.id === testAlertId)).toBe(true);
        });

        it('should acknowledge alert', async () => {
            const acknowledged = await alertRepo.acknowledge(testAlertId, 'test-user', 'Investigating');

            expect(acknowledged).not.toBeNull();
            expect(acknowledged?.acknowledged).toBe(true);
            expect(acknowledged?.acknowledgedBy).toBe('test-user');
        });

        it('should resolve alert', async () => {
            const resolved = await alertRepo.resolve(testAlertId, 'test-user', 'Issue fixed');

            expect(resolved).not.toBeNull();
            expect(resolved?.resolved).toBe(true);
            expect(resolved?.resolvedBy).toBe('test-user');
        });

        it('should get alert statistics', async () => {
            const stats = await alertRepo.getAlertStats();

            expect(stats.total).toBeGreaterThan(0);
            expect(stats.bySeverity).toBeDefined();
            expect(stats.byType).toBeDefined();
        });

        it('should delete alert', async () => {
            const deleted = await alertRepo.delete(testAlertId);

            expect(deleted).toBe(true);
        });
    });

    describe('Transaction Support', () => {
        it('should rollback on error', async () => {
            const deviceCountBefore = await deviceRepo.count();

            try {
                // This should fail and rollback
                await deviceRepo.create({
                    name: 'Transaction Test Device',
                    type: DeviceType.PLC,
                    purdueLevel: 999 as any, // Invalid
                    securityZone: SecurityZone.CONTROL,
                    status: DeviceStatus.ONLINE,
                    discoveredAt: new Date(),
                    lastSeenAt: new Date(),
                });
            } catch (error) {
                // Expected to fail
            }

            const deviceCountAfter = await deviceRepo.count();

            expect(deviceCountAfter).toBe(deviceCountBefore);
        });
    });
});
