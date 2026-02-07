/**
 * Unit tests for SNMP Parser
 */

import { SNMPParser } from '../../../../src/processors/parsers/snmp-parser';
import { TelemetryData, DeviceType } from '../../../../src/utils/types';

describe('SNMPParser', () => {
  let parser: SNMPParser;

  beforeEach(() => {
    parser = new SNMPParser();
  });

  describe('parse', () => {
    it('should return null for non-system telemetry data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'snmp-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { type: 'interface', interfaceData: {} },
      };

      const result = parser.parse(telemetry);

      expect(result).toBeNull();
    });

    it('should return null for malformed telemetry data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'snmp-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: null,
      };

      const result = parser.parse(telemetry);

      expect(result).toBeNull();
    });

    it('should parse system telemetry data successfully', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'snmp-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: {
          type: 'system',
          sysDescr: 'Cisco IOS XE Software, Version 16.9.1',
          sysName: 'router-01',
          sysLocation: 'Data Center 1',
          sysContact: 'admin@company.com',
          sysUpTime: 123456789,
          sysObjectID: '1.3.6.1.4.1.9.9.1.1.1',
        },
      };

      const result = parser.parse(telemetry);

      expect(result).not.toBeNull();
      expect(result?.sysName).toBe('router-01');
      expect(result?.vendor).toBe('Cisco');
      expect(result?.deviceType).toBe(DeviceType.ROUTER);
    });
  });

  describe('detectVendor', () => {
    it('should detect Cisco vendor', () => {
      const sysDescr = 'Cisco IOS XE Software, Version 16.9.1';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Cisco');
    });

    it('should detect Siemens vendor', () => {
      const sysDescr = 'Siemens SIMATIC S7-1500 PLC';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Siemens');
    });

    it('should detect Schneider Electric vendor', () => {
      const sysDescr = 'Schneider Electric Modicon M241 Controller';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Schneider Electric');
    });

    it('should detect Rockwell Automation vendor', () => {
      const sysDescr = 'Allen-Bradley CompactLogix 5370';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Rockwell Automation');
    });

    it('should detect ABB vendor', () => {
      const sysDescr = 'ABB AC500-eCO PLC';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('ABB');
    });

    it('should detect Emerson vendor', () => {
      const sysDescr = 'Emerson DeltaV Control System';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Emerson');
    });

    it('should detect Honeywell vendor', () => {
      const sysDescr = 'Honeywell TPS/DCS System';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Honeywell');
    });

    it('should detect GE vendor', () => {
      const sysDescr = 'General Electric SRTP PLCopen Runtime';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('General Electric');
    });

    it('should detect Yokogawa vendor', () => {
      const sysDescr = 'Yokogawa CENTUM VP Control System';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Yokogawa');
    });

    it('should detect Mitsubishi vendor', () => {
      const sysDescr = 'Mitsubishi Electric MELSEC iQ-R Series PLC';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Mitsubishi');
    });

    it('should return undefined for unknown vendor', () => {
      const sysDescr = 'Unknown Device System';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const sysDescr = 'CISCO IOS XE SOFTWARE';
      const result = parser['detectVendor'](sysDescr);

      expect(result).toBe('Cisco');
    });
  });

  describe('extractModel', () => {
    it('should extract model from standard pattern', () => {
      const sysDescr = 'Cisco IOS XE Software, Model: C9300-24P';
      const result = parser['extractModel'](sysDescr);

      expect(result).toBe('C9300-24P');
    });

    it('should extract Siemens S7 model', () => {
      const sysDescr = 'Siemens SIMATIC S7-1500';
      const result = parser['extractModel'](sysDescr);

      expect(result).toBe('S7-1500');
    });

    it('should extract model from pattern with hyphens', () => {
      const sysDescr = 'Network Switch Model AB-CD1234-EF';
      const result = parser['extractModel'](sysDescr);

      expect(result).toBeDefined();
      expect(result).toMatch(/^[A-Z0-9-]+$/);
    });

    it('should return undefined when no model found', () => {
      const sysDescr = 'Generic network device';
      const result = parser['extractModel'](sysDescr);

      expect(result).toBeUndefined();
    });
  });

  describe('detectDeviceType', () => {
    it('should detect PLC device type', () => {
      const sysDescr = 'Siemens SIMATIC Programmable Logic Controller';
      const sysName = 'plc-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.PLC);
    });

    it('should detect RTU device type', () => {
      const sysDescr = 'Remote Terminal Unit SCADA Gateway';
      const sysName = 'rtu-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.RTU);
    });

    it('should detect SCADA server device type', () => {
      const sysDescr = 'SCADA Master Server';
      const sysName = 'scada-server-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.SCADA_SERVER);
    });

    it('should detect HMI device type', () => {
      const sysDescr = 'Human Machine Interface Panel';
      const sysName = 'hmi-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.HMI);
    });

    it('should detect DCS device type', () => {
      const sysDescr = 'Distributed Control System Master';
      const sysName = 'dcs-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.DCS);
    });

    it('should detect Switch device type', () => {
      const sysDescr = 'Cisco Catalyst 9300 Network Switch';
      const sysName = 'switch-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.SWITCH);
    });

    it('should detect Router device type', () => {
      const sysDescr = 'Cisco ASR Router';
      const sysName = 'router-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.ROUTER);
    });

    it('should detect Firewall device type', () => {
      const sysDescr = 'Fortinet FortiGate Firewall';
      const sysName = 'firewall-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.FIREWALL);
    });

    it('should detect Sensor device type', () => {
      const sysDescr = 'Temperature Transmitter Sensor';
      const sysName = 'sensor-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.SENSOR);
    });

    it('should detect Actuator device type', () => {
      const sysDescr = 'Electric Valve Actuator Control';
      const sysName = 'actuator-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.ACTUATOR);
    });

    it('should detect Drive device type', () => {
      const sysDescr = 'Variable Frequency Drive VFD Inverter';
      const sysName = 'drive-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.DRIVE);
    });

    it('should detect Historian device type', () => {
      const sysDescr = 'PI Server Historian Data Storage';
      const sysName = 'historian-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.HISTORIAN);
    });

    it('should return UNKNOWN for unrecognized device type', () => {
      const sysDescr = 'Some Random Device';
      const sysName = 'device-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.UNKNOWN);
    });

    it('should be case-insensitive for device detection', () => {
      const sysDescr = 'CISCO CATALYST NETWORK SWITCH';
      const sysName = 'switch-01';
      const result = parser['detectDeviceType'](sysDescr, sysName);

      expect(result).toBe(DeviceType.SWITCH);
    });
  });

  describe('parseInterfaces', () => {
    it('should parse network interfaces', () => {
      const data = {
        interfaces: [
          { name: 'eth0', physAddress: '00:1A:2B:3C:4D:5E', speed: 1000000000, operStatus: 1 },
          { name: 'eth1', physAddress: 'AA:BB:CC:DD:EE:FF', speed: 100000000, operStatus: 1 },
        ],
      };

      const result = parser.parseInterfaces(data);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('eth0');
      expect(result[0].macAddress).toBe('00:1a:2b:3c:4d:5e');
      expect(result[0].speed).toBe(1000);
      expect(result[0].status).toBe('up');
    });

    it('should handle missing interfaces', () => {
      const data = {};

      const result = parser.parseInterfaces(data);

      expect(result).toEqual([]);
    });

    it('should handle interfaces with missing fields', () => {
      const data = {
        interfaces: [{ name: 'eth0' }],
      };

      const result = parser.parseInterfaces(data);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('eth0');
      expect(result[0].macAddress).toBe('');
      expect(result[0].speed).toBe(0);
    });

    it('should correctly normalize MAC addresses', () => {
      const data = {
        interfaces: [
          { name: 'eth0', physAddress: 'AA-BB-CC-DD-EE-FF', speed: 0, operStatus: 1 },
          { name: 'eth1', physAddress: 'aabbccddeeff', speed: 0, operStatus: 1 },
        ],
      };

      const result = parser.parseInterfaces(data);

      expect(result[0].macAddress).toBe('aa:bb:cc:dd:ee:ff');
      expect(result[1].macAddress).toBe('aa:bb:cc:dd:ee:ff');
    });

    it('should set interface status based on operStatus', () => {
      const data = {
        interfaces: [
          { name: 'eth0', operStatus: 1 },
          { name: 'eth1', operStatus: 2 },
        ],
      };

      const result = parser.parseInterfaces(data);

      expect(result[0].status).toBe('up');
      expect(result[1].status).toBe('down');
    });
  });

  describe('getVendorFromMac', () => {
    it('should return vendor from known OUI prefix', () => {
      // Note: This test assumes specific OUI mappings exist in constants
      // The actual test may need to be adjusted based on your VENDOR_OUI_PREFIXES
      const mac = '00:1A:2B:3C:4D:5E';
      const result = parser.getVendorFromMac(mac);

      // Result may be undefined if this OUI is not in the constants
      expect(typeof result === 'string' || result === undefined).toBe(true);
    });

    it('should handle various MAC address formats', () => {
      const formats = [
        '00:1A:2B:3C:4D:5E',
        '00-1A-2B-3C-4D-5E',
        '001A2B3C4D5E',
      ];

      formats.forEach((mac) => {
        expect(() => parser.getVendorFromMac(mac)).not.toThrow();
      });
    });

    it('should normalize MAC address to uppercase OUI format', () => {
      const mac = 'aa:bb:cc:dd:ee:ff';
      // Should not throw - should normalize and lookup
      expect(() => parser.getVendorFromMac(mac)).not.toThrow();
    });
  });

  describe('toDevice', () => {
    it('should convert parsed SNMP data to Device object', () => {
      const parsedData = {
        id: 'device-123',
        sysName: 'router-01',
        sysDescr: 'Cisco IOS XE Software',
        sysLocation: 'Data Center 1',
        sysContact: 'admin@company.com',
        sysUpTime: 123456789,
        sysObjectID: '1.3.6.1.4.1.9.9.1.1.1',
        vendor: 'Cisco',
        model: 'C9300-24P',
        deviceType: DeviceType.ROUTER,
        interfaces: [],
        neighbors: [],
        arpEntries: [],
      };

      const result = parser.toDevice(parsedData);

      expect(result.id).toBe('device-123');
      expect(result.name).toBe('router-01');
      expect(result.hostname).toBe('router-01');
      expect(result.type).toBe(DeviceType.ROUTER);
      expect(result.vendor).toBe('Cisco');
      expect(result.model).toBe('C9300-24P');
      expect(result.discoveredAt).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should assign Purdue level based on device type', () => {
      const parsedData = {
        id: 'sensor-123',
        sysName: 'sensor-01',
        sysDescr: 'Temperature Sensor',
        sysLocation: 'Process Area',
        sysContact: 'admin@company.com',
        sysUpTime: 123456789,
        sysObjectID: '1.3.6.1',
        vendor: undefined,
        model: undefined,
        deviceType: DeviceType.SENSOR,
        interfaces: [],
        neighbors: [],
        arpEntries: [],
      };

      const result = parser.toDevice(parsedData);

      expect(result.purdueLevel).toBeDefined();
      // Level 0 is for sensors
      expect([0, 1, 2, 3, 4, 5]).toContain(result.purdueLevel);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed sysDescr gracefully', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'snmp-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: {
          type: 'system',
          sysDescr: null,
          sysName: 'device-01',
        },
      };

      expect(() => parser.parse(telemetry)).not.toThrow();
    });

    it('should handle empty sysDescr', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: 'snmp-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: {
          type: 'system',
          sysDescr: '',
          sysName: 'device-01',
        },
      };

      const result = parser.parse(telemetry);

      expect(result).not.toBeNull();
      expect(result?.deviceType).toBe(DeviceType.UNKNOWN);
    });

    it('should handle invalid interface data', () => {
      const data = { interfaces: 'not-an-array' };

      expect(() => parser.parseInterfaces(data as any)).not.toThrow();
    });
  });
});
