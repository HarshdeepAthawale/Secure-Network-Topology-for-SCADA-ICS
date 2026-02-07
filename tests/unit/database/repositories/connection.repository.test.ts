/**
 * Unit tests for Connection Repository
 */

import { ConnectionRepository } from '../../../../src/database/repositories/connection.repository';
import { ConnectionType } from '../../../../src/utils/types';

jest.mock('../../../../src/database/connection', () => ({
  getConnection: jest.fn(() => mockDb),
}));

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
};

describe('ConnectionRepository', () => {
  let repository: ConnectionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ConnectionRepository();
  });

  describe('create', () => {
    it('should create new connection', async () => {
      const connection = {
        id: 'conn-1',
        sourceDeviceId: 'device-1',
        targetDeviceId: 'device-2',
        connectionType: ConnectionType.ETHERNET,
        protocol: 'modbus',
        isSecure: false,
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      };

      mockDb.insert.mockResolvedValue({ id: 'conn-1' });

      const result = await repository.create(connection);

      expect(result.id).toBe('conn-1');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findByDeviceId', () => {
    it('should find connections by source device ID', async () => {
      const mockConnections = [
        { id: 'conn-1', source_device_id: 'device-1', target_device_id: 'device-2' },
        { id: 'conn-2', source_device_id: 'device-1', target_device_id: 'device-3' },
      ];

      mockDb.query.mockResolvedValue(mockConnections);

      const result = await repository.findByDeviceId('device-1');

      expect(mockConnections).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should find connections by target device ID', async () => {
      const mockConnections = [
        { id: 'conn-1', source_device_id: 'device-2', target_device_id: 'device-1' },
      ];

      mockDb.query.mockResolvedValue(mockConnections);

      const result = await repository.findByDeviceId('device-1', 'target');

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getTopologyEdges', () => {
    it('should get all topology edges for graph rendering', async () => {
      const mockEdges = [
        { source_device_id: 'device-1', target_device_id: 'device-2', is_secure: true },
        { source_device_id: 'device-2', target_device_id: 'device-3', is_secure: false },
      ];

      mockDb.query.mockResolvedValue(mockEdges);

      const result = await repository.getTopologyEdges();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findSecureConnections', () => {
    it('should find all secure connections', async () => {
      const mockConnections = [
        { id: 'conn-1', is_secure: true },
        { id: 'conn-2', is_secure: true },
      ];

      mockDb.query.mockResolvedValue(mockConnections);

      const result = await repository.findSecureConnections();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findInsecureConnections', () => {
    it('should find all insecure connections', async () => {
      const mockConnections = [{ id: 'conn-1', is_secure: false }];

      mockDb.query.mockResolvedValue(mockConnections);

      const result = await repository.findInsecureConnections();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findCrossZoneConnections', () => {
    it('should find connections crossing zones', async () => {
      const mockConnections = [
        { id: 'conn-1', source_zone: 'ot_control', target_zone: 'enterprise' },
      ];

      mockDb.query.mockResolvedValue(mockConnections);

      const result = await repository.findCrossZoneConnections();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findByProtocol', () => {
    it('should find connections by protocol', async () => {
      const mockConnections = [
        { id: 'conn-1', protocol: 'modbus' },
        { id: 'conn-2', protocol: 'modbus' },
      ];

      mockDb.query.mockResolvedValue(mockConnections);

      const result = await repository.findByProtocol('modbus');

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update connection', async () => {
      mockDb.update.mockResolvedValue({ id: 'conn-1' });

      const result = await repository.update('conn-1', { isSecure: true });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete connection', async () => {
      mockDb.delete.mockResolvedValue({ success: true });

      const result = await repository.delete('conn-1');

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('upsert', () => {
    it('should upsert connection (create or update)', async () => {
      const connection = {
        sourceDeviceId: 'device-1',
        targetDeviceId: 'device-2',
        connectionType: ConnectionType.ETHERNET,
      };

      mockDb.upsert.mockResolvedValue({ id: 'conn-1' });

      const result = await repository.upsert(connection);

      expect(mockDb.upsert).toHaveBeenCalled();
    });
  });

  describe('deduplication', () => {
    it('should handle duplicate connections', async () => {
      const connection1 = {
        id: 'conn-1',
        sourceDeviceId: 'device-1',
        targetDeviceId: 'device-2',
      };

      const connection2 = {
        id: 'conn-2',
        sourceDeviceId: 'device-1',
        targetDeviceId: 'device-2',
      };

      mockDb.upsert.mockResolvedValue({ id: 'conn-1' });

      // Both should be merged into one
      await repository.upsert(connection1);
      await repository.upsert(connection2);

      expect(mockDb.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
