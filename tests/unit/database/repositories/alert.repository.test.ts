/**
 * Unit tests for Alert Repository
 */

import { AlertRepository } from '../../../../src/database/repositories/alert.repository';
import { AlertSeverity, AlertType } from '../../../../src/utils/types';

jest.mock('../../../../src/database/connection', () => ({
  getConnection: jest.fn(() => mockDb),
}));

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  queryCount: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  bulkInsert: jest.fn(),
};

describe('AlertRepository', () => {
  let repository: AlertRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AlertRepository();
  });

  describe('create', () => {
    it('should create new alert', async () => {
      const alert = {
        id: 'alert-1',
        type: AlertType.DEVICE_OFFLINE,
        severity: AlertSeverity.HIGH,
        title: 'Device Offline',
        description: 'Device plc-01 is offline',
        deviceId: 'device-1',
        details: {},
        acknowledged: false,
        resolved: false,
        createdAt: new Date(),
      };

      mockDb.insert.mockResolvedValue({ id: 'alert-1' });

      const result = await repository.create(alert);

      expect(result.id).toBe('alert-1');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find alert by ID', async () => {
      const mockAlert = {
        id: 'alert-1',
        type: 'device_offline',
        severity: 'high',
        title: 'Device Offline',
        device_id: 'device-1',
        status: 'open',
        created_at: new Date(),
      };

      mockDb.queryOne.mockResolvedValue(mockAlert);

      const result = await repository.findById('alert-1');

      expect(result).not.toBeNull();
      expect(mockDb.queryOne).toHaveBeenCalled();
    });

    it('should return null when alert not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByDeviceId', () => {
    it('should find alerts by device ID', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          device_id: 'device-1',
          type: 'device_offline',
          severity: 'high',
        },
        {
          id: 'alert-2',
          device_id: 'device-1',
          type: 'high_risk',
          severity: 'medium',
        },
      ];

      mockDb.query.mockResolvedValue(mockAlerts);

      const result = await repository.findByDeviceId('device-1', 0, 10);

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findBySeverity', () => {
    it('should find alerts by severity level', async () => {
      const mockAlerts = [
        { id: 'alert-1', severity: 'critical' },
        { id: 'alert-2', severity: 'critical' },
      ];

      mockDb.query.mockResolvedValue(mockAlerts);

      const result = await repository.findBySeverity(AlertSeverity.CRITICAL);

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge alert', async () => {
      mockDb.update.mockResolvedValue({ success: true });

      const result = await repository.acknowledge('alert-1');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('should resolve alert', async () => {
      mockDb.update.mockResolvedValue({ success: true });

      const result = await repository.resolve('alert-1');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('findUnacknowledged', () => {
    it('should find unacknowledged alerts', async () => {
      const mockAlerts = [{ id: 'alert-1', status: 'open' }];

      mockDb.query.mockResolvedValue(mockAlerts);

      const result = await repository.findUnacknowledged();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findUnresolved', () => {
    it('should find unresolved alerts', async () => {
      const mockAlerts = [
        { id: 'alert-1', status: 'open' },
        { id: 'alert-2', status: 'acknowledged' },
      ];

      mockDb.query.mockResolvedValue(mockAlerts);

      const result = await repository.findUnresolved();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search alerts with criteria', async () => {
      const mockAlerts = [{ id: 'alert-1' }];

      mockDb.query.mockResolvedValue(mockAlerts);

      const result = await repository.search({
        severity: AlertSeverity.HIGH,
      });

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getAlertStats', () => {
    it('should get alert statistics', async () => {
      const mockStats = {
        total: 10,
        critical: 2,
        high: 3,
        medium: 4,
        low: 1,
        open: 7,
        acknowledged: 2,
        resolved: 1,
      };

      mockDb.query.mockResolvedValue([mockStats]);

      const result = await repository.getAlertStats();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('bulkAcknowledge', () => {
    it('should acknowledge multiple alerts', async () => {
      mockDb.update.mockResolvedValue({ rowCount: 3 });

      const result = await repository.bulkAcknowledge(['alert-1', 'alert-2', 'alert-3'], 'user-123');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
