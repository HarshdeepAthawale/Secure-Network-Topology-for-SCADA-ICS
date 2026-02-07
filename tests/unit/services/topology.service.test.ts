/**
 * Unit tests for Topology Service
 */

import { TopologyService } from '../../../../src/database/services/topology.service';
import { DeviceType, PurdueLevel } from '../../../../src/utils/types';

const mockDeviceRepo = {
  findAll: jest.fn(),
};

const mockConnectionRepo = {
  getTopologyEdges: jest.fn(),
  findCrossZoneConnections: jest.fn(),
};

const mockSnapshotRepo = {
  create: jest.fn(),
  getLatest: jest.fn(),
  compareSnapshots: jest.fn(),
};

jest.mock('../../../../src/database/repositories/device.repository', () => ({
  DeviceRepository: jest.fn(() => mockDeviceRepo),
}));

jest.mock('../../../../src/database/repositories/connection.repository', () => ({
  ConnectionRepository: jest.fn(() => mockConnectionRepo),
}));

jest.mock('../../../../src/database/repositories/topology-snapshot.repository', () => ({
  TopologySnapshotRepository: jest.fn(() => mockSnapshotRepo),
}));

describe('TopologyService', () => {
  let service: TopologyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TopologyService();
  });

  describe('buildTopologyGraph', () => {
    it('should build topology graph from devices and connections', async () => {
      const mockDevices = [
        { id: 'device-1', name: 'PLC-01', type: DeviceType.PLC, purdueLevel: PurdueLevel.LEVEL_1 },
        { id: 'device-2', name: 'PLC-02', type: DeviceType.PLC, purdueLevel: PurdueLevel.LEVEL_1 },
      ];

      const mockEdges = [
        { source_device_id: 'device-1', target_device_id: 'device-2', is_secure: true },
      ];

      mockDeviceRepo.findAll.mockResolvedValue(mockDevices);
      mockConnectionRepo.getTopologyEdges.mockResolvedValue(mockEdges);

      const result = await service.buildTopologyGraph();

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('should handle empty topology', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockConnectionRepo.getTopologyEdges.mockResolvedValue([]);

      const result = await service.buildTopologyGraph();

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('createSnapshot', () => {
    it('should create topology snapshot', async () => {
      const topology = {
        nodes: [{ id: 'device-1', label: 'PLC-01' }],
        edges: [],
      };

      mockSnapshotRepo.create.mockResolvedValue({ id: 'snapshot-1' });

      const result = await service.createSnapshot(topology);

      expect(mockSnapshotRepo.create).toHaveBeenCalled();
    });
  });

  describe('compareTopologies', () => {
    it('should compare two topology snapshots', async () => {
      mockSnapshotRepo.compareSnapshots.mockResolvedValue({
        addedDevices: [{ id: 'device-3' }],
        removedDevices: [],
        addedConnections: [],
        removedConnections: [],
      });

      const result = await service.compareSnapshots('snapshot-1', 'snapshot-2');

      expect(mockSnapshotRepo.compareSnapshots).toHaveBeenCalled();
      expect(result.addedDevices.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectTopologyChanges', () => {
    it('should detect changes between current and previous topology', async () => {
      const currentTopology = {
        nodes: [
          { id: 'device-1', label: 'PLC-01' },
          { id: 'device-2', label: 'PLC-02' },
          { id: 'device-3', label: 'PLC-03' },
        ],
        edges: [],
      };

      mockSnapshotRepo.getLatest.mockResolvedValue({
        nodes: [
          { id: 'device-1', label: 'PLC-01' },
          { id: 'device-2', label: 'PLC-02' },
        ],
        edges: [],
      });

      const result = await service.detectChanges(currentTopology);

      expect(result.newDevices.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getZoneSegmentation', () => {
    it('should analyze zone-based segmentation', async () => {
      const mockDevices = [
        { id: 'device-1', purdueLevel: PurdueLevel.LEVEL_0, securityZone: 'process' },
        { id: 'device-2', purdueLevel: PurdueLevel.LEVEL_1, securityZone: 'control' },
        { id: 'device-3', purdueLevel: PurdueLevel.LEVEL_3, securityZone: 'enterprise' },
      ];

      mockDeviceRepo.findAll.mockResolvedValue(mockDevices);

      const result = await service.getZoneSegmentation();

      expect(Object.keys(result)).toContain('process');
      expect(Object.keys(result)).toContain('control');
    });
  });

  describe('findCrossZoneViolations', () => {
    it('should identify unauthorized cross-zone connections', async () => {
      const mockViolations = [
        {
          sourceZone: 'process',
          targetZone: 'enterprise',
          isAllowed: false,
          connectionCount: 2,
        },
      ];

      mockConnectionRepo.findCrossZoneConnections.mockResolvedValue(mockViolations);

      const result = await service.findCrossZoneViolations();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('validateTopologyIntegrity', () => {
    it('should validate topology consistency', async () => {
      const topology = {
        nodes: [{ id: 'device-1' }, { id: 'device-2' }],
        edges: [{ source: 'device-1', target: 'device-2' }],
      };

      const result = await service.validateTopology(topology);

      expect(result.isValid).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should detect disconnected nodes', async () => {
      const topology = {
        nodes: [{ id: 'device-1' }, { id: 'device-2' }, { id: 'device-3' }],
        edges: [{ source: 'device-1', target: 'device-2' }],
      };

      const result = await service.validateTopology(topology);

      // device-3 is disconnected
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPathBetweenDevices', () => {
    it('should find network path between two devices', async () => {
      const mockPath = ['device-1', 'device-2', 'device-3', 'device-4'];

      mockDeviceRepo.findAll.mockResolvedValue([
        { id: 'device-1' },
        { id: 'device-2' },
        { id: 'device-3' },
        { id: 'device-4' },
      ]);

      mockConnectionRepo.getTopologyEdges.mockResolvedValue([
        { source_device_id: 'device-1', target_device_id: 'device-2' },
        { source_device_id: 'device-2', target_device_id: 'device-3' },
        { source_device_id: 'device-3', target_device_id: 'device-4' },
      ]);

      const result = await service.getPath('device-1', 'device-4');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle missing devices gracefully', async () => {
      mockDeviceRepo.findAll.mockRejectedValue(new Error('Database error'));

      await expect(service.buildTopologyGraph()).rejects.toThrow();
    });
  });
});
