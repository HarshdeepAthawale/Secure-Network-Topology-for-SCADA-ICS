/**
 * Purdue Classifier tests
 */

import { PurdueClassifier } from '../../../src/processors/classification/purdue-classifier';
import { Device, DeviceType, DeviceStatus, PurdueLevel, SecurityZone } from '../../../src/utils/types';

describe('PurdueClassifier', () => {
  let classifier: PurdueClassifier;

  beforeEach(() => {
    classifier = new PurdueClassifier();
  });

  const createDevice = (overrides: Partial<Device> = {}): Device => ({
    id: 'test-device-1',
    name: 'Test Device',
    type: DeviceType.UNKNOWN,
    purdueLevel: PurdueLevel.LEVEL_5,
    securityZone: SecurityZone.ENTERPRISE,
    status: DeviceStatus.ONLINE,
    interfaces: [],
    metadata: {},
    discoveredAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('classify by device type', () => {
    it('should classify PLC as Level 1', () => {
      const device = createDevice({ type: DeviceType.PLC });
      const result = classifier.classify(device);
      expect(result.assignedLevel).toBe(PurdueLevel.LEVEL_1);
      expect(result.assignedZone).toBe(SecurityZone.CONTROL);
    });

    it('should classify HMI as Level 2', () => {
      const device = createDevice({ type: DeviceType.HMI });
      const result = classifier.classify(device);
      expect(result.assignedLevel).toBe(PurdueLevel.LEVEL_2);
    });

    it('should classify SCADA as Level 2', () => {
      const device = createDevice({ type: DeviceType.SCADA_SERVER });
      const result = classifier.classify(device);
      expect(result.assignedLevel).toBe(PurdueLevel.LEVEL_2);
    });

    it('should classify Historian as Level 3', () => {
      const device = createDevice({ type: DeviceType.HISTORIAN });
      const result = classifier.classify(device);
      expect(result.assignedLevel).toBe(PurdueLevel.LEVEL_3);
    });

    it('should classify Firewall as DMZ', () => {
      const device = createDevice({ type: DeviceType.FIREWALL });
      const result = classifier.classify(device);
      expect(result.assignedLevel).toBe(PurdueLevel.DMZ);
    });
  });

  describe('classify by name patterns', () => {
    it('should detect PLC from name', () => {
      const device = createDevice({ name: 'FACTORY-PLC-01', type: DeviceType.UNKNOWN });
      const result = classifier.classify(device);
      expect(result.assignedLevel).toBe(PurdueLevel.LEVEL_1);
    });

    it('should detect SCADA from name', () => {
      const device = createDevice({ name: 'SCADA-SERVER-MAIN', type: DeviceType.UNKNOWN });
      const result = classifier.classify(device);
      expect(result.assignedLevel).toBe(PurdueLevel.LEVEL_2);
    });

    it('should detect Siemens S7 from name', () => {
      const device = createDevice({ name: 'S7-1500', type: DeviceType.UNKNOWN });
      const result = classifier.classify(device);
      expect(result.assignedLevel).toBe(PurdueLevel.LEVEL_1);
    });
  });

  describe('classify by vendor', () => {
    it('should associate Siemens with control level', () => {
      const device = createDevice({ vendor: 'Siemens', type: DeviceType.UNKNOWN });
      const result = classifier.classify(device);
      expect(result.suggestedLevels.some(s => s.level === PurdueLevel.LEVEL_1)).toBe(true);
    });

    it('should associate Cisco with network infrastructure', () => {
      const device = createDevice({ vendor: 'Cisco', type: DeviceType.UNKNOWN });
      const result = classifier.classify(device);
      expect(result.suggestedLevels.some(s => s.level === PurdueLevel.DMZ)).toBe(true);
    });
  });

  describe('confidence scoring', () => {
    it('should have higher confidence for known device types', () => {
      const knownDevice = createDevice({ type: DeviceType.PLC });
      const unknownDevice = createDevice({ type: DeviceType.UNKNOWN });

      const knownResult = classifier.classify(knownDevice);
      const unknownResult = classifier.classify(unknownDevice);

      expect(knownResult.confidence).toBeGreaterThan(unknownResult.confidence);
    });

    it('should provide classification reasons', () => {
      const device = createDevice({ type: DeviceType.PLC, name: 'PLC-01' });
      const result = classifier.classify(device);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('batch classification', () => {
    it('should classify multiple devices', () => {
      const devices = [
        createDevice({ id: '1', type: DeviceType.PLC }),
        createDevice({ id: '2', type: DeviceType.HMI }),
        createDevice({ id: '3', type: DeviceType.HISTORIAN }),
      ];

      const results = classifier.classifyBatch(devices);
      expect(results).toHaveLength(3);
      expect(results[0].assignedLevel).toBe(PurdueLevel.LEVEL_1);
      expect(results[1].assignedLevel).toBe(PurdueLevel.LEVEL_2);
      expect(results[2].assignedLevel).toBe(PurdueLevel.LEVEL_3);
    });
  });
});
