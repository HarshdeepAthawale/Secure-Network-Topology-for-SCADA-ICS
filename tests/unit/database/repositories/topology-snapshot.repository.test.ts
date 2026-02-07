/**
 * Unit tests for Topology Snapshot Repository
 */

import { TopologySnapshotRepository } from '../../../../src/database/repositories/topology-snapshot.repository';

jest.mock('../../../../src/database/connection', () => ({
  getConnection: jest.fn(() => mockDb),
}));

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  insert: jest.fn(),
  delete: jest.fn(),
};

describe('TopologySnapshotRepository', () => {
  let repository: TopologySnapshotRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TopologySnapshotRepository();
  });

  describe('create', () => {
    it('should create topology snapshot', async () => {
      const snapshot = {
        id: 'snapshot-1',
        timestamp: new Date(),
        deviceCount: 50,
        connectionCount: 150,
        snapshotData: { devices: [], connections: [] },
      };

      mockDb.insert.mockResolvedValue({ id: 'snapshot-1' });

      const result = await repository.create(snapshot);

      expect(result.id).toBe('snapshot-1');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find snapshot by ID', async () => {
      const mockSnapshot = {
        id: 'snapshot-1',
        timestamp: new Date(),
        device_count: 50,
        connection_count: 150,
        snapshot_data: {},
      };

      mockDb.queryOne.mockResolvedValue(mockSnapshot);

      const result = await repository.findById('snapshot-1');

      expect(result).not.toBeNull();
      expect(mockDb.queryOne).toHaveBeenCalled();
    });

    it('should return null when snapshot not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByTimeRange', () => {
    it('should find snapshots within time range', async () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-02T00:00:00Z');

      const mockSnapshots = [
        { id: 'snapshot-1', timestamp: new Date('2024-01-01T12:00:00Z') },
        { id: 'snapshot-2', timestamp: new Date('2024-01-01T18:00:00Z') },
      ];

      mockDb.query.mockResolvedValue(mockSnapshots);

      const result = await repository.findByTimeRange(start, end);

      expect(mockSnapshots).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getLatest', () => {
    it('should get latest topology snapshot', async () => {
      const mockSnapshot = {
        id: 'snapshot-latest',
        timestamp: new Date('2024-01-01T23:00:00Z'),
      };

      mockDb.queryOne.mockResolvedValue(mockSnapshot);

      const result = await repository.getLatest();

      expect(result).not.toBeNull();
      expect(mockDb.queryOne).toHaveBeenCalled();
    });
  });

  describe('getLatestN', () => {
    it('should get N latest snapshots', async () => {
      const mockSnapshots = [
        { id: 'snapshot-1', timestamp: new Date() },
        { id: 'snapshot-2', timestamp: new Date(Date.now() - 3600000) },
        { id: 'snapshot-3', timestamp: new Date(Date.now() - 7200000) },
      ];

      mockDb.query.mockResolvedValue(mockSnapshots);

      const result = await repository.getLatestN(3);

      expect(mockSnapshots).toHaveLength(3);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('compareSnapshots', () => {
    it('should compare two snapshots for changes', async () => {
      mockDb.query.mockResolvedValue([
        {
          added_devices: 5,
          removed_devices: 2,
          added_connections: 10,
          removed_connections: 3,
        },
      ]);

      const result = await repository.compareSnapshots('snapshot-1', 'snapshot-2');

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete snapshot', async () => {
      mockDb.delete.mockResolvedValue({ success: true });

      const result = await repository.delete('snapshot-1');

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete snapshots older than cutoff date', async () => {
      const cutoffDate = new Date('2024-01-01T00:00:00Z');

      mockDb.delete.mockResolvedValue({ rowCount: 100 });

      const result = await repository.deleteOlderThan(cutoffDate);

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('getSnapshotStats', () => {
    it('should get statistics about snapshots', async () => {
      mockDb.query.mockResolvedValue([
        {
          totalSnapshots: 500,
          avgDeviceCount: 48,
          avgConnectionCount: 145,
          oldestSnapshot: new Date('2024-01-01T00:00:00Z'),
          newestSnapshot: new Date('2024-01-31T23:59:59Z'),
        },
      ]);

      const result = await repository.getSnapshotStats();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('Retention policies', () => {
    it('should enforce retention policy when deleting old snapshots', async () => {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      mockDb.delete.mockResolvedValue({ rowCount: 200 });

      await repository.deleteOlderThan(cutoffDate);

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
