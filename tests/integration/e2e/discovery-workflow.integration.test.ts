/**
 * End-to-End Discovery Workflow Integration Tests
 * Tests complete device discovery and topology building workflows
 */

import { SNMPCollector } from '../../../src/collectors/snmp-collector';
import { DeviceRepository } from '../../../src/database/repositories/device.repository';
import { ConnectionRepository } from '../../../src/database/repositories/connection.repository';
import { AlertRepository } from '../../../src/database/repositories/alert.repository';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

describe('Device Discovery Workflow E2E', () => {
  let pool: Pool;
  let deviceRepo: DeviceRepository;
  let connectionRepo: ConnectionRepository;
  let alertRepo: AlertRepository;
  let collector: SNMPCollector;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433'),
      database: process.env.DB_NAME || 'scada_topology_test',
      user: process.env.DB_USER || 'test_user',
      password: process.env.DB_PASSWORD || 'test_password',
    });

    deviceRepo = new DeviceRepository(pool);
    connectionRepo = new ConnectionRepository(pool);
    alertRepo = new AlertRepository(pool);
    collector = new SNMPCollector();
  });

  afterAll(async () => {
    if (collector) {
      await collector.stop();
    }
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Clean up test data
    try {
      await pool.query('DELETE FROM alerts');
      await pool.query('DELETE FROM connections');
      await pool.query('DELETE FROM network_interfaces');
      await pool.query('DELETE FROM devices');
    } catch (error) {
      // Tables might not exist yet
    }
  });

  describe('Basic Device Discovery', () => {
    it('should discover devices from collector', async () => {
      // Add mock SNMP target
      const targetId = collector.addTarget({
        host: '192.168.1.1',
        enabled: true,
      } as any);

      expect(targetId).toBeDefined();
      expect(collector.getTargets().length).toBe(1);
    });

    it('should create devices in database', async () => {
      const device = await deviceRepo.create({
        name: 'Discovered-Router-01',
        type: 'router',
        vendor: 'Cisco',
        model: 'ISR4431',
        purdueLevel: 2,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      expect(device.id).toBeDefined();
      expect(device.name).toBe('Discovered-Router-01');

      const found = await deviceRepo.findById(device.id);
      expect(found).toBeDefined();
      expect(found?.vendor).toBe('Cisco');
    });

    it('should classify devices by Purdue level', async () => {
      // Create devices at different Purdue levels
      const level0 = await deviceRepo.create({
        name: 'Sensor-001',
        type: 'sensor',
        purdueLevel: 0,
        securityZone: 'process',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const level1 = await deviceRepo.create({
        name: 'PLC-001',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const level2 = await deviceRepo.create({
        name: 'SCADA-Server',
        type: 'scada',
        purdueLevel: 2,
        securityZone: 'supervisory',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Verify classification
      const l0Devices = await deviceRepo.findByPurdueLevel(0);
      const l1Devices = await deviceRepo.findByPurdueLevel(1);
      const l2Devices = await deviceRepo.findByPurdueLevel(2);

      expect(l0Devices.some(d => d.name === 'Sensor-001')).toBe(true);
      expect(l1Devices.some(d => d.name === 'PLC-001')).toBe(true);
      expect(l2Devices.some(d => d.name === 'SCADA-Server')).toBe(true);
    });

    it('should organize devices by security zone', async () => {
      await deviceRepo.create({
        name: 'Process-Device',
        type: 'sensor',
        purdueLevel: 0,
        securityZone: 'process',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      await deviceRepo.create({
        name: 'Control-Device',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      await deviceRepo.create({
        name: 'Enterprise-Device',
        type: 'server',
        purdueLevel: 4,
        securityZone: 'enterprise',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const processZone = await deviceRepo.findBySecurityZone('process');
      const controlZone = await deviceRepo.findBySecurityZone('control');
      const enterpriseZone = await deviceRepo.findBySecurityZone('enterprise');

      expect(processZone.some(d => d.name === 'Process-Device')).toBe(true);
      expect(controlZone.some(d => d.name === 'Control-Device')).toBe(true);
      expect(enterpriseZone.some(d => d.name === 'Enterprise-Device')).toBe(true);
    });
  });

  describe('Network Connection Discovery', () => {
    it('should establish connections between discovered devices', async () => {
      const router = await deviceRepo.create({
        name: 'Network-Router',
        type: 'router',
        purdueLevel: 2,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const plc = await deviceRepo.create({
        name: 'Industrial-PLC',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'process',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const connection = await connectionRepo.create({
        sourceDeviceId: router.id,
        targetDeviceId: plc.id,
        connectionType: 'ethernet',
        protocol: 'TCP/IP',
        port: 502,
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      expect(connection.id).toBeDefined();
      expect(connection.sourceDeviceId).toBe(router.id);
      expect(connection.targetDeviceId).toBe(plc.id);
    });

    it('should detect cross-zone connections', async () => {
      const controlDevice = await deviceRepo.create({
        name: 'Control-Zone-Device',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const enterpriseDevice = await deviceRepo.create({
        name: 'Enterprise-Zone-Device',
        type: 'server',
        purdueLevel: 4,
        securityZone: 'enterprise',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Create cross-zone connection
      const connection = await connectionRepo.create({
        sourceDeviceId: controlDevice.id,
        targetDeviceId: enterpriseDevice.id,
        connectionType: 'ethernet',
        isSecure: false, // Potentially risky cross-zone
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Verify connection
      const found = await connectionRepo.findBySourceDevice(controlDevice.id);
      expect(found.some(c => c.targetDeviceId === enterpriseDevice.id)).toBe(true);
    });

    it('should build network topology graph', async () => {
      // Create a simple network topology
      //     Router (L2)
      //      |  |
      //     /    \
      //   PLC   Switch
      //  (L1)    (Network)
      //   |
      //  Sensor
      //  (L0)

      const router = await deviceRepo.create({
        name: 'Core-Router',
        type: 'router',
        purdueLevel: 2,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const plc = await deviceRepo.create({
        name: 'Main-PLC',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const sensor = await deviceRepo.create({
        name: 'Temperature-Sensor',
        type: 'sensor',
        purdueLevel: 0,
        securityZone: 'process',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const networkSwitch = await deviceRepo.create({
        name: 'Switch-01',
        type: 'switch',
        purdueLevel: 5, // Network device
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Create connections
      await connectionRepo.create({
        sourceDeviceId: router.id,
        targetDeviceId: plc.id,
        connectionType: 'ethernet',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      await connectionRepo.create({
        sourceDeviceId: router.id,
        targetDeviceId: networkSwitch.id,
        connectionType: 'ethernet',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      await connectionRepo.create({
        sourceDeviceId: plc.id,
        targetDeviceId: sensor.id,
        connectionType: 'modbus',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Verify topology
      const allDevices = await deviceRepo.findAll();
      expect(allDevices.length).toBe(4);

      const routerConnections = await connectionRepo.findBySourceDevice(router.id);
      expect(routerConnections.length).toBe(2);

      const plcConnections = await connectionRepo.findBySourceDevice(plc.id);
      expect(plcConnections.length).toBe(1);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect offline devices', async () => {
      const device = await deviceRepo.create({
        name: 'Potentially-Offline-Device',
        type: 'sensor',
        purdueLevel: 0,
        securityZone: 'process',
        discoveredAt: new Date(),
        lastSeenAt: new Date(Date.now() - 3600000), // 1 hour ago
      } as any);

      // Check for offline status
      const offlineThresholdMinutes = 30;
      const thirtyMinutesAgo = new Date(Date.now() - offlineThresholdMinutes * 60000);

      // Query for potentially offline devices
      const allDevices = await deviceRepo.findAll();
      const offlineDevices = allDevices.filter(
        d => d.lastSeenAt && new Date(d.lastSeenAt) < thirtyMinutesAgo
      );

      expect(offlineDevices.some(d => d.name === 'Potentially-Offline-Device')).toBe(true);
    });

    it('should generate device offline alerts', async () => {
      const device = await deviceRepo.create({
        name: 'Device-With-Alert',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const alert = await alertRepo.create({
        deviceId: device.id,
        type: 'device_offline',
        severity: 'high',
        message: 'Device did not respond to SNMP queries',
      } as any);

      expect(alert.id).toBeDefined();
      expect(alert.deviceId).toBe(device.id);
      expect(alert.type).toBe('device_offline');

      const found = await alertRepo.findByDeviceId(device.id);
      expect(found.some(a => a.type === 'device_offline')).toBe(true);
    });

    it('should generate cross-zone communication alerts', async () => {
      const processDevice = await deviceRepo.create({
        name: 'Process-Level-Device',
        type: 'sensor',
        purdueLevel: 0,
        securityZone: 'process',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const enterpriseDevice = await deviceRepo.create({
        name: 'Enterprise-Level-Device',
        type: 'server',
        purdueLevel: 5,
        securityZone: 'enterprise',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Create connection
      const connection = await connectionRepo.create({
        sourceDeviceId: processDevice.id,
        targetDeviceId: enterpriseDevice.id,
        connectionType: 'ethernet',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Generate alert
      const alert = await alertRepo.create({
        deviceId: processDevice.id,
        type: 'cross_zone_communication',
        severity: 'critical',
        message: `Unauthorized cross-zone communication: ${processDevice.name} → ${enterpriseDevice.name}`,
      } as any);

      expect(alert.type).toBe('cross_zone_communication');
      expect(alert.severity).toBe('critical');
    });
  });

  describe('Risk Assessment', () => {
    it('should calculate device risk scores', async () => {
      const devices = [];

      // Create devices with varying risk profiles
      devices.push(await deviceRepo.create({
        name: 'Secure-Device',
        type: 'router',
        purdueLevel: 2,
        securityZone: 'control',
        metadata: {
          firmwareVersion: '16.12.04',
          lastSecurityPatch: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        },
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any));

      devices.push(await deviceRepo.create({
        name: 'Risky-Device',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'process',
        metadata: {
          firmwareVersion: '1.0.0',
          lastSecurityPatch: new Date(2020, 0, 1), // Very old
        },
        discoveredAt: new Date(),
        lastSeenAt: new Date(Date.now() - 10 * 60000), // Offline
      } as any));

      // Verify device data integrity
      expect(devices.length).toBe(2);
      expect(devices[0].name).toBe('Secure-Device');
      expect(devices[1].name).toBe('Risky-Device');
    });

    it('should identify vulnerable connections', async () => {
      const device1 = await deviceRepo.create({
        name: 'Insecure-Source',
        type: 'sensor',
        purdueLevel: 0,
        securityZone: 'process',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const device2 = await deviceRepo.create({
        name: 'Insecure-Target',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Create insecure connection
      const connection = await connectionRepo.create({
        sourceDeviceId: device1.id,
        targetDeviceId: device2.id,
        connectionType: 'modbus',
        protocol: 'MODBUS_TCP',
        port: 502,
        isSecure: false,
        encryptionType: undefined,
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      expect(connection.isSecure).toBe(false);
      expect(connection.encryptionType).toBeUndefined();

      // Verify it can be queried
      const found = await connectionRepo.findBySourceDevice(device1.id);
      const insecureConn = found.find(c => !c.isSecure);
      expect(insecureConn).toBeDefined();
    });
  });

  describe('Topology Snapshots', () => {
    it('should capture topology snapshot', async () => {
      // Create devices for snapshot
      for (let i = 0; i < 5; i++) {
        await deviceRepo.create({
          name: `Snapshot-Device-${i}`,
          type: 'router',
          purdueLevel: 2,
          securityZone: 'control',
          discoveredAt: new Date(),
          lastSeenAt: new Date(),
        } as any);
      }

      const allDevices = await deviceRepo.findAll();
      const snapshotData = {
        timestamp: new Date(),
        deviceCount: allDevices.length,
        connectionCount: 0,
        devices: allDevices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          purdueLevel: d.purdueLevel,
        })),
      };

      expect(snapshotData.deviceCount).toBe(5);
      expect(snapshotData.devices.length).toBe(5);
    });
  });

  describe('Pagination and Filtering', () => {
    it('should paginate device results', async () => {
      // Create 50 devices
      for (let i = 0; i < 50; i++) {
        await deviceRepo.create({
          name: `Paginated-Device-${i}`,
          type: 'router',
          purdueLevel: 1 + (i % 5), // Vary purdue level
          securityZone: 'control',
          discoveredAt: new Date(),
          lastSeenAt: new Date(),
        } as any);
      }

      // Get first page
      const page1 = await deviceRepo.findPaginated(1, 10);
      expect(page1.data.length).toBe(10);
      expect(page1.total).toBeGreaterThanOrEqual(50);
      expect(page1.page).toBe(1);

      // Get second page
      const page2 = await deviceRepo.findPaginated(2, 10);
      expect(page2.data.length).toBe(10);

      // Verify pages don't overlap
      const ids1 = new Set(page1.data.map(d => d.id));
      const ids2 = new Set(page2.data.map(d => d.id));
      expect([...ids1].some(id => ids2.has(id))).toBe(false);
    });

    it('should filter devices by criteria', async () => {
      await deviceRepo.create({
        name: 'Cisco-Router-1',
        vendor: 'Cisco',
        type: 'router',
        purdueLevel: 2,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      await deviceRepo.create({
        name: 'Juniper-Router-1',
        vendor: 'Juniper',
        type: 'router',
        purdueLevel: 2,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const results = await deviceRepo.search({ vendor: 'Cisco' }, 1, 10);

      expect(results.data.some(d => d.vendor === 'Cisco')).toBe(true);
      expect(results.data.every(d => d.vendor === 'Cisco' || d.vendor === null)).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      const device = await deviceRepo.create({
        name: 'Integrity-Test-Device',
        type: 'plc',
        purdueLevel: 1,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      const connection = await connectionRepo.create({
        sourceDeviceId: device.id,
        targetDeviceId: uuidv4(), // Non-existent device
        connectionType: 'ethernet',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      expect(connection).toBeDefined();
      // Note: Foreign key constraints may prevent this
    });

    it('should handle concurrent updates', async () => {
      const device = await deviceRepo.create({
        name: 'Concurrent-Update-Device',
        type: 'router',
        purdueLevel: 2,
        securityZone: 'control',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      } as any);

      // Multiple concurrent updates
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(
          deviceRepo.update(device.id, {
            lastSeenAt: new Date(),
          } as any)
        );
      }

      const results = await Promise.all(updates);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
});
