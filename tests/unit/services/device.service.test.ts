/**
 * Unit tests for Device Service
 */

import { DeviceService } from '../../../../src/database/services/device.service';
import { DeviceType, DeviceStatus, PurdueLevel, SecurityZone } from '../../../../src/utils/types';

const mockDeviceRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  update: jest.fn(),
  findOfflineDevices: jest.fn(),
  getStatistics: jest.fn(),
  search: jest.fn(),
  findByPurdueLevel: jest.fn(),
};

jest.mock('../../../../src/database/repositories/device.repository', () => ({
  DeviceRepository: jest.fn(() => mockDeviceRepo),
}));

describe('DeviceService', () => {
  let service: DeviceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeviceService();
  });

  describe('processDiscoveredDevice', () => {
    it('should create new device when not found', async () => {
      const deviceData = {
        hostname: 'plc-01',
        type: DeviceType.PLC,
        vendor: 'Siemens',
        model: 'S7-1500',
      };

      mockDeviceRepo.findByName.mockResolvedValue(null);
      mockDeviceRepo.create.mockResolvedValue({ id: 'device-1', ...deviceData });

      const result = await service.processDiscoveredDevice(deviceData);

      expect(mockDeviceRepo.create).toHaveBeenCalled();
    });

    it('should update existing device', async () => {
      const deviceData = {
        hostname: 'plc-01',
        type: DeviceType.PLC,
      };

      mockDeviceRepo.findByName.mockResolvedValue({ id: 'device-1', hostname: 'plc-01' });
      mockDeviceRepo.update.mockResolvedValue({ id: 'device-1', ...deviceData });

      const result = await service.processDiscoveredDevice(deviceData);

      expect(mockDeviceRepo.update).toHaveBeenCalled();
    });
  });

  describe('getDeviceById', () => {
    it('should retrieve device with relations', async () => {
      const mockDevice = {
        id: 'device-1',
        name: 'PLC-01',
        type: DeviceType.PLC,
        interfaces: [],
        connections: [],
      };

      mockDeviceRepo.findById.mockResolvedValue(mockDevice);

      const result = await service.getDeviceById('device-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('device-1');
    });

    it('should return null for non-existent device', async () => {
      mockDeviceRepo.findById.mockResolvedValue(null);

      const result = await service.getDeviceById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateDeviceStatuses', () => {
    it('should mark offline devices', async () => {
      const offlineDevices = [{ id: 'device-1' }, { id: 'device-2' }];

      mockDeviceRepo.findOfflineDevices.mockResolvedValue(offlineDevices);
      mockDeviceRepo.update.mockResolvedValue({});

      await service.updateDeviceStatuses();

      expect(mockDeviceRepo.update).toHaveBeenCalled();
    });

    it('should set lastSeenAt timestamp', async () => {
      const device = { id: 'device-1', name: 'PLC-01' };

      mockDeviceRepo.findById.mockResolvedValue(device);
      mockDeviceRepo.update.mockResolvedValue(device);

      await service.updateDeviceStatus('device-1', DeviceStatus.ONLINE);

      expect(mockDeviceRepo.update).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return device statistics', async () => {
      const mockStats = {
        totalDevices: 100,
        onlineDevices: 98,
        offlineDevices: 2,
        devicesByType: { PLC: 30, RTU: 20, SWITCH: 50 },
        devicesByPurdueLevel: {
          '0': 10,
          '1': 30,
          '2': 40,
          '3': 20,
          '4': 0,
          '5': 0,
        },
      };

      mockDeviceRepo.getStatistics.mockResolvedValue(mockStats);

      const result = await service.getStatistics();

      expect(result.totalDevices).toBe(100);
      expect(result.onlineDevices).toBe(98);
    });
  });

  describe('searchDevices', () => {
    it('should search devices by multiple criteria', async () => {
      const mockDevices = [
        {
          id: 'device-1',
          name: 'PLC-01',
          type: DeviceType.PLC,
          vendor: 'Siemens',
        },
      ];

      mockDeviceRepo.search.mockResolvedValue(mockDevices);

      const result = await service.searchDevices({
        type: DeviceType.PLC,
        vendor: 'Siemens',
      });

      expect(mockDeviceRepo.search).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('findByPurdueLevel', () => {
    it('should find devices by Purdue level', async () => {
      const mockDevices = [{ id: 'device-1', purdueLevel: PurdueLevel.LEVEL_1 }];

      mockDeviceRepo.findByPurdueLevel.mockResolvedValue(mockDevices);

      const result = await service.findByPurdueLevel(PurdueLevel.LEVEL_1);

      expect(mockDeviceRepo.findByPurdueLevel).toHaveBeenCalled();
    });
  });

  describe('assignSecurityZone', () => {
    it('should assign security zone based on Purdue level', async () => {
      const device = { id: 'device-1', purdueLevel: PurdueLevel.LEVEL_1 };

      mockDeviceRepo.findById.mockResolvedValue(device);
      mockDeviceRepo.update.mockResolvedValue({ ...device, securityZone: SecurityZone.CONTROL });

      const result = await service.assignSecurityZone('device-1');

      expect(mockDeviceRepo.update).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle device not found', async () => {
      mockDeviceRepo.findById.mockRejectedValue(new Error('Device not found'));

      await expect(service.getDeviceById('nonexistent')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockDeviceRepo.search.mockRejectedValue(new Error('Database error'));

      await expect(service.searchDevices({})).rejects.toThrow();
    });
  });
});
