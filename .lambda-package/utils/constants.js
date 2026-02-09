"use strict";
/**
 * Application constants for SCADA Topology Discovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPLIANCE_STANDARDS = exports.VENDOR_OUI_PREFIXES = exports.BATCH_SIZES = exports.INTERVALS = exports.TIMEOUTS = exports.RISK_WEIGHTS = exports.RISK_THRESHOLDS = exports.INDUSTRIAL_PORTS = exports.IP_PROTOCOLS = exports.SYSLOG_SEVERITIES = exports.SYSLOG_FACILITIES = exports.SNMP_OIDS = exports.DEVICE_TYPE_PURDUE_LEVEL = exports.ZONE_TRUST_LEVELS = exports.PURDUE_TO_ZONE = exports.PURDUE_LEVEL_NAMES = exports.PURDUE_LEVEL_DESCRIPTIONS = exports.APP_VERSION = exports.APP_NAME = void 0;
const types_1 = require("./types");
// ============================================================================
// Application Constants
// ============================================================================
exports.APP_NAME = 'scada-topology-discovery';
exports.APP_VERSION = '1.0.0';
// ============================================================================
// Purdue Model Level Descriptions
// ============================================================================
exports.PURDUE_LEVEL_DESCRIPTIONS = {
    [types_1.PurdueLevel.LEVEL_0]: 'Process - Field devices including sensors, actuators, and variable drives',
    [types_1.PurdueLevel.LEVEL_1]: 'Basic Control - PLCs, RTUs, and DCS controllers',
    [types_1.PurdueLevel.LEVEL_2]: 'Area Supervisory - SCADA servers, HMI systems, and alarm servers',
    [types_1.PurdueLevel.LEVEL_3]: 'Site Operations - MES, historians, and engineering workstations',
    [types_1.PurdueLevel.LEVEL_4]: 'Site Business Planning - ERP integration and business systems',
    [types_1.PurdueLevel.LEVEL_5]: 'Enterprise Network - Corporate IT and external connections',
    [types_1.PurdueLevel.DMZ]: 'Industrial DMZ - Data diodes, proxies, and jump servers',
};
exports.PURDUE_LEVEL_NAMES = {
    [types_1.PurdueLevel.LEVEL_0]: 'Level 0 - Process',
    [types_1.PurdueLevel.LEVEL_1]: 'Level 1 - Basic Control',
    [types_1.PurdueLevel.LEVEL_2]: 'Level 2 - Area Supervisory',
    [types_1.PurdueLevel.LEVEL_3]: 'Level 3 - Site Operations',
    [types_1.PurdueLevel.LEVEL_4]: 'Level 4 - Site Business',
    [types_1.PurdueLevel.LEVEL_5]: 'Level 5 - Enterprise',
    [types_1.PurdueLevel.DMZ]: 'Industrial DMZ',
};
// ============================================================================
// Security Zone Mappings
// ============================================================================
exports.PURDUE_TO_ZONE = {
    [types_1.PurdueLevel.LEVEL_0]: types_1.SecurityZone.PROCESS,
    [types_1.PurdueLevel.LEVEL_1]: types_1.SecurityZone.CONTROL,
    [types_1.PurdueLevel.LEVEL_2]: types_1.SecurityZone.SUPERVISORY,
    [types_1.PurdueLevel.LEVEL_3]: types_1.SecurityZone.OPERATIONS,
    [types_1.PurdueLevel.LEVEL_4]: types_1.SecurityZone.ENTERPRISE,
    [types_1.PurdueLevel.LEVEL_5]: types_1.SecurityZone.ENTERPRISE,
    [types_1.PurdueLevel.DMZ]: types_1.SecurityZone.DMZ,
};
exports.ZONE_TRUST_LEVELS = {
    [types_1.SecurityZone.PROCESS]: 1,
    [types_1.SecurityZone.CONTROL]: 2,
    [types_1.SecurityZone.SUPERVISORY]: 3,
    [types_1.SecurityZone.OPERATIONS]: 4,
    [types_1.SecurityZone.DMZ]: 5,
    [types_1.SecurityZone.ENTERPRISE]: 6,
    [types_1.SecurityZone.UNTRUSTED]: 0,
};
// ============================================================================
// Device Type to Purdue Level Mappings
// ============================================================================
exports.DEVICE_TYPE_PURDUE_LEVEL = {
    // Level 0 - Field Devices
    [types_1.DeviceType.SENSOR]: types_1.PurdueLevel.LEVEL_0,
    [types_1.DeviceType.ACTUATOR]: types_1.PurdueLevel.LEVEL_0,
    [types_1.DeviceType.DRIVE]: types_1.PurdueLevel.LEVEL_0,
    [types_1.DeviceType.INSTRUMENT]: types_1.PurdueLevel.LEVEL_0,
    // Level 1 - Control Devices
    [types_1.DeviceType.PLC]: types_1.PurdueLevel.LEVEL_1,
    [types_1.DeviceType.RTU]: types_1.PurdueLevel.LEVEL_1,
    [types_1.DeviceType.DCS]: types_1.PurdueLevel.LEVEL_1,
    [types_1.DeviceType.CONTROLLER]: types_1.PurdueLevel.LEVEL_1,
    // Level 2 - Supervisory
    [types_1.DeviceType.SCADA_SERVER]: types_1.PurdueLevel.LEVEL_2,
    [types_1.DeviceType.HMI]: types_1.PurdueLevel.LEVEL_2,
    [types_1.DeviceType.ALARM_SERVER]: types_1.PurdueLevel.LEVEL_2,
    [types_1.DeviceType.DATA_LOGGER]: types_1.PurdueLevel.LEVEL_2,
    // Level 3 - Operations
    [types_1.DeviceType.MES]: types_1.PurdueLevel.LEVEL_3,
    [types_1.DeviceType.HISTORIAN]: types_1.PurdueLevel.LEVEL_3,
    [types_1.DeviceType.ENGINEERING_WORKSTATION]: types_1.PurdueLevel.LEVEL_3,
    [types_1.DeviceType.ASSET_MANAGEMENT]: types_1.PurdueLevel.LEVEL_3,
    // Level 4/5 - Enterprise
    [types_1.DeviceType.ERP]: types_1.PurdueLevel.LEVEL_4,
    [types_1.DeviceType.EMAIL_SERVER]: types_1.PurdueLevel.LEVEL_5,
    [types_1.DeviceType.WEB_SERVER]: types_1.PurdueLevel.LEVEL_5,
    [types_1.DeviceType.DATABASE_SERVER]: types_1.PurdueLevel.LEVEL_4,
    // Network Infrastructure - varies by placement
    [types_1.DeviceType.SWITCH]: types_1.PurdueLevel.LEVEL_2,
    [types_1.DeviceType.ROUTER]: types_1.PurdueLevel.LEVEL_3,
    [types_1.DeviceType.FIREWALL]: types_1.PurdueLevel.DMZ,
    [types_1.DeviceType.GATEWAY]: types_1.PurdueLevel.DMZ,
    [types_1.DeviceType.DATA_DIODE]: types_1.PurdueLevel.DMZ,
    [types_1.DeviceType.JUMP_SERVER]: types_1.PurdueLevel.DMZ,
    // Unknown
    [types_1.DeviceType.UNKNOWN]: types_1.PurdueLevel.LEVEL_5,
};
// ============================================================================
// SNMP OIDs
// ============================================================================
exports.SNMP_OIDS = {
    // System MIB
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysObjectID: '1.3.6.1.2.1.1.2.0',
    sysUpTime: '1.3.6.1.2.1.1.3.0',
    sysContact: '1.3.6.1.2.1.1.4.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    sysLocation: '1.3.6.1.2.1.1.6.0',
    sysServices: '1.3.6.1.2.1.1.7.0',
    // Interface MIB
    ifNumber: '1.3.6.1.2.1.2.1.0',
    ifTable: '1.3.6.1.2.1.2.2',
    ifIndex: '1.3.6.1.2.1.2.2.1.1',
    ifDescr: '1.3.6.1.2.1.2.2.1.2',
    ifType: '1.3.6.1.2.1.2.2.1.3',
    ifMtu: '1.3.6.1.2.1.2.2.1.4',
    ifSpeed: '1.3.6.1.2.1.2.2.1.5',
    ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',
    ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
    ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
    ifInOctets: '1.3.6.1.2.1.2.2.1.10',
    ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
    // IP MIB
    ipAddrTable: '1.3.6.1.2.1.4.20',
    ipNetToMediaTable: '1.3.6.1.2.1.4.22', // ARP table
    // Bridge MIB (MAC table)
    dot1dTpFdbTable: '1.3.6.1.2.1.17.4.3',
    // LLDP MIB
    lldpRemTable: '1.0.8802.1.1.2.1.4.1',
    lldpRemChassisId: '1.0.8802.1.1.2.1.4.1.1.5',
    lldpRemPortId: '1.0.8802.1.1.2.1.4.1.1.7',
    lldpRemSysName: '1.0.8802.1.1.2.1.4.1.1.9',
    // Entity MIB
    entPhysicalTable: '1.3.6.1.2.1.47.1.1.1',
    entPhysicalDescr: '1.3.6.1.2.1.47.1.1.1.1.2',
    entPhysicalSerialNum: '1.3.6.1.2.1.47.1.1.1.1.11',
    entPhysicalMfgName: '1.3.6.1.2.1.47.1.1.1.1.12',
    entPhysicalModelName: '1.3.6.1.2.1.47.1.1.1.1.13',
};
// ============================================================================
// Syslog Facilities and Severities
// ============================================================================
exports.SYSLOG_FACILITIES = {
    0: 'kern',
    1: 'user',
    2: 'mail',
    3: 'daemon',
    4: 'auth',
    5: 'syslog',
    6: 'lpr',
    7: 'news',
    8: 'uucp',
    9: 'cron',
    10: 'authpriv',
    11: 'ftp',
    12: 'ntp',
    13: 'security',
    14: 'console',
    15: 'solaris-cron',
    16: 'local0',
    17: 'local1',
    18: 'local2',
    19: 'local3',
    20: 'local4',
    21: 'local5',
    22: 'local6',
    23: 'local7',
};
exports.SYSLOG_SEVERITIES = {
    0: 'emergency',
    1: 'alert',
    2: 'critical',
    3: 'error',
    4: 'warning',
    5: 'notice',
    6: 'informational',
    7: 'debug',
};
// ============================================================================
// NetFlow Protocol Numbers
// ============================================================================
exports.IP_PROTOCOLS = {
    1: 'ICMP',
    6: 'TCP',
    17: 'UDP',
    47: 'GRE',
    50: 'ESP',
    51: 'AH',
    58: 'ICMPv6',
    89: 'OSPF',
    132: 'SCTP',
};
// ============================================================================
// Industrial Protocol Ports
// ============================================================================
exports.INDUSTRIAL_PORTS = {
    102: { protocol: 'S7comm', description: 'Siemens S7 Communication' },
    502: { protocol: 'Modbus', description: 'Modbus TCP' },
    2222: { protocol: 'EtherNet/IP', description: 'EtherNet/IP Explicit' },
    2404: { protocol: 'IEC 60870-5-104', description: 'IEC 104 SCADA' },
    4840: { protocol: 'OPC UA', description: 'OPC Unified Architecture' },
    18245: { protocol: 'GE-SRTP', description: 'GE Service Request Transport Protocol' },
    20000: { protocol: 'DNP3', description: 'Distributed Network Protocol' },
    34962: { protocol: 'Profinet', description: 'PROFINET IO RT' },
    34963: { protocol: 'Profinet', description: 'PROFINET IO RT' },
    34964: { protocol: 'Profinet', description: 'PROFINET IO Context Manager' },
    44818: { protocol: 'EtherNet/IP', description: 'EtherNet/IP Implicit I/O' },
    47808: { protocol: 'BACnet', description: 'Building Automation and Control' },
    55000: { protocol: 'FL-net', description: 'Factory Automation Network' },
    55001: { protocol: 'FL-net', description: 'Factory Automation Network' },
    55002: { protocol: 'FL-net', description: 'Factory Automation Network' },
    55003: { protocol: 'FL-net', description: 'Factory Automation Network' },
};
// ============================================================================
// Risk Scoring Thresholds
// ============================================================================
exports.RISK_THRESHOLDS = {
    CRITICAL: 90,
    HIGH: 70,
    MEDIUM: 40,
    LOW: 20,
};
exports.RISK_WEIGHTS = {
    vulnerability: 0.35,
    configuration: 0.25,
    exposure: 0.25,
    compliance: 0.15,
};
// ============================================================================
// Timeouts and Intervals
// ============================================================================
exports.TIMEOUTS = {
    SNMP_DEFAULT: 5000, // 5 seconds
    SNMP_BULK: 10000, // 10 seconds
    MQTT_CONNECT: 30000, // 30 seconds
    MQTT_PUBLISH: 5000, // 5 seconds
    DATABASE_QUERY: 30000, // 30 seconds
    HTTP_REQUEST: 10000, // 10 seconds
};
exports.INTERVALS = {
    COLLECTOR_POLL: 60000, // 1 minute
    TOPOLOGY_SNAPSHOT: 300000, // 5 minutes
    HEALTH_CHECK: 30000, // 30 seconds
    METRICS_REPORT: 60000, // 1 minute
    RISK_ASSESSMENT: 3600000, // 1 hour
};
// ============================================================================
// Batch Sizes
// ============================================================================
exports.BATCH_SIZES = {
    SNMP_WALK: 50,
    DATABASE_INSERT: 100,
    MQTT_PUBLISH: 50,
    ALERT_PROCESS: 25,
};
// ============================================================================
// Vendor OUI Prefixes (for device identification)
// ============================================================================
exports.VENDOR_OUI_PREFIXES = {
    '00:00:5E': 'IANA',
    '00:0A:E6': 'Elitegroup',
    '00:0C:29': 'VMware',
    '00:1A:4B': 'Siemens',
    '00:1C:06': 'Siemens',
    '00:30:6E': 'Hewlett-Packard',
    '00:50:56': 'VMware',
    '00:60:35': 'Dallas Semiconductor',
    '00:80:F4': 'Telemecanique',
    '00:A0:F8': 'Zebra Technologies',
    '08:00:06': 'Siemens',
    '08:00:27': 'Oracle VirtualBox',
    '08:00:2B': 'DEC',
    '28:63:36': 'Siemens',
    '2C:A8:35': 'Rockwell Automation',
    '34:64:A9': 'Hewlett-Packard',
    '40:61:86': 'Micro Innovations',
    '58:8D:09': 'Cisco',
    '64:00:6A': 'Dell',
    '68:DD:B7': 'Honeywell',
    '70:B3:D5': 'IEEE Registration Authority',
    '74:DA:EA': 'Texas Instruments',
    '80:00:0B': 'Intel',
    '84:2B:2B': 'Dell',
    '8C:DC:D4': 'Cisco',
    '90:B1:1C': 'Dell',
    '98:5A:EB': 'Texas Instruments',
    'A4:BF:01': 'Intel',
    'A8:B9:B3': 'Essys',
    'AC:1F:6B': 'Super Micro',
    'B4:99:BA': 'Hewlett-Packard',
    'B8:27:EB': 'Raspberry Pi',
    'BC:30:5B': 'Dell',
    'C4:65:16': 'Hewlett-Packard',
    'C8:1F:66': 'Cisco',
    'D4:BE:D9': 'Dell',
    'D8:9E:F3': 'Dell',
    'DC:A6:32': 'Raspberry Pi',
    'E4:11:5B': 'Hewlett-Packard',
    'EC:F4:BB': 'Dell',
    'F0:1F:AF': 'Dell',
    'F4:03:21': 'Belden',
    'F8:B1:56': 'Dell',
};
// ============================================================================
// Compliance Standards References
// ============================================================================
exports.COMPLIANCE_STANDARDS = {
    NERC_CIP: {
        name: 'NERC CIP',
        fullName: 'North American Electric Reliability Corporation Critical Infrastructure Protection',
        relevantControls: [
            'CIP-002: BES Cyber System Categorization',
            'CIP-003: Security Management Controls',
            'CIP-005: Electronic Security Perimeter',
            'CIP-007: System Security Management',
            'CIP-010: Configuration Change Management',
        ],
    },
    IEC_62443: {
        name: 'IEC 62443',
        fullName: 'Industrial Automation and Control Systems Security',
        relevantControls: [
            'SR 1.1: Human user identification and authentication',
            'SR 2.1: Authorization enforcement',
            'SR 3.1: Communication integrity',
            'SR 5.1: Network segmentation',
            'SR 7.1: Denial of service protection',
        ],
    },
    NIST_CSF: {
        name: 'NIST CSF',
        fullName: 'NIST Cybersecurity Framework',
        relevantControls: [
            'ID.AM: Asset Management',
            'PR.AC: Access Control',
            'PR.DS: Data Security',
            'DE.AE: Anomalies and Events',
            'RS.AN: Analysis',
        ],
    },
};
//# sourceMappingURL=constants.js.map