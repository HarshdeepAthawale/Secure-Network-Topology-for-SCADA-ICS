/**
 * Core TypeScript types and interfaces for SCADA Topology Discovery
 */

// ============================================================================
// Purdue Model Types
// ============================================================================

export enum PurdueLevel {
  LEVEL_0 = 0, // Process - Sensors, Actuators
  LEVEL_1 = 1, // Basic Control - PLCs, RTUs
  LEVEL_2 = 2, // Area Supervisory - SCADA, HMI
  LEVEL_3 = 3, // Site Operations - MES, Historians
  LEVEL_4 = 4, // Site Business - ERP, Business
  LEVEL_5 = 5, // Enterprise - Corporate IT
  DMZ = 99, // Industrial DMZ
}

export enum SecurityZone {
  PROCESS = 'process',
  CONTROL = 'control',
  SUPERVISORY = 'supervisory',
  OPERATIONS = 'operations',
  ENTERPRISE = 'enterprise',
  DMZ = 'dmz',
  UNTRUSTED = 'untrusted',
}

// ============================================================================
// Device Types
// ============================================================================

export enum DeviceType {
  // Level 0 - Field Devices
  SENSOR = 'sensor',
  ACTUATOR = 'actuator',
  DRIVE = 'variable_drive',
  INSTRUMENT = 'instrument',

  // Level 1 - Control Devices
  PLC = 'plc',
  RTU = 'rtu',
  DCS = 'dcs',
  CONTROLLER = 'controller',

  // Level 2 - Supervisory
  SCADA_SERVER = 'scada_server',
  HMI = 'hmi',
  ALARM_SERVER = 'alarm_server',
  DATA_LOGGER = 'data_logger',

  // Level 3 - Operations
  MES = 'mes',
  HISTORIAN = 'historian',
  ENGINEERING_WORKSTATION = 'engineering_workstation',
  ASSET_MANAGEMENT = 'asset_management',

  // Level 4/5 - Enterprise
  ERP = 'erp',
  EMAIL_SERVER = 'email_server',
  WEB_SERVER = 'web_server',
  DATABASE_SERVER = 'database_server',

  // Network Infrastructure
  SWITCH = 'switch',
  ROUTER = 'router',
  FIREWALL = 'firewall',
  GATEWAY = 'gateway',
  DATA_DIODE = 'data_diode',
  JUMP_SERVER = 'jump_server',

  // Unknown
  UNKNOWN = 'unknown',
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
  MAINTENANCE = 'maintenance',
  UNKNOWN = 'unknown',
}

export enum ConnectionType {
  ETHERNET = 'ethernet',
  SERIAL = 'serial',
  MODBUS = 'modbus',
  PROFINET = 'profinet',
  PROFIBUS = 'profibus',
  FIELDBUS = 'fieldbus',
  WIRELESS = 'wireless',
  FIBER = 'fiber',
  UNKNOWN = 'unknown',
}

// ============================================================================
// Device Interfaces
// ============================================================================

export interface NetworkInterface {
  name: string;
  macAddress: string;
  ipAddress?: string;
  subnetMask?: string;
  gateway?: string;
  vlanId?: number;
  speed?: number; // Mbps
  duplex?: 'full' | 'half' | 'auto';
  status: 'up' | 'down' | 'unknown';
}

export interface Device {
  id: string;
  name: string;
  hostname?: string;
  type: DeviceType;
  vendor?: string;
  model?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  purdueLevel: PurdueLevel;
  securityZone: SecurityZone;
  status: DeviceStatus;
  interfaces: NetworkInterface[];
  location?: DeviceLocation;
  metadata: Record<string, unknown>;
  discoveredAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceLocation {
  site?: string;
  building?: string;
  floor?: string;
  room?: string;
  rack?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// ============================================================================
// Connection Interfaces
// ============================================================================

export interface Connection {
  id: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  sourceInterface?: string;
  targetInterface?: string;
  connectionType: ConnectionType;
  protocol?: string;
  port?: number;
  vlanId?: number;
  bandwidth?: number; // Mbps
  latency?: number; // ms
  isSecure: boolean;
  encryptionType?: string;
  discoveredAt: Date;
  lastSeenAt: Date;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Telemetry Types
// ============================================================================

export enum TelemetrySource {
  SNMP = 'snmp',
  ARP = 'arp',
  MAC_TABLE = 'mac_table',
  NETFLOW = 'netflow',
  SYSLOG = 'syslog',
  ROUTING = 'routing',
  OPCUA = 'opcua',
  MODBUS = 'modbus',
  MANUAL = 'manual',
}

export interface TelemetryData {
  id: string;
  source: TelemetrySource;
  deviceId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
  raw?: string;
  processed: boolean;
  metadata: Record<string, unknown>;
}

export interface SNMPTelemetry extends TelemetryData {
  source: TelemetrySource.SNMP;
  data: {
    sysName?: string;
    sysDescr?: string;
    sysLocation?: string;
    sysContact?: string;
    sysUpTime?: number;
    interfaces?: SNMPInterface[];
    neighbors?: SNMPNeighbor[];
  };
}

export interface SNMPInterface {
  index: number;
  name: string;
  description?: string;
  type: number;
  speed: number;
  physAddress: string;
  adminStatus: number;
  operStatus: number;
  inOctets: number;
  outOctets: number;
}

export interface SNMPNeighbor {
  localInterface: string;
  remoteDeviceId: string;
  remoteInterface?: string;
  protocol: 'lldp' | 'cdp' | 'snmp';
}

export interface ARPEntry {
  ipAddress: string;
  macAddress: string;
  interface: string;
  vlanId?: number;
  type: 'dynamic' | 'static';
  age?: number;
}

export interface MACTableEntry {
  macAddress: string;
  vlanId: number;
  port: string;
  type: 'dynamic' | 'static';
}

export interface NetFlowRecord {
  srcAddress: string;
  dstAddress: string;
  srcPort: number;
  dstPort: number;
  protocol: number;
  bytes: number;
  packets: number;
  startTime: Date;
  endTime: Date;
  tcpFlags?: number;
  tos?: number;
}

export interface SyslogMessage {
  facility: number;
  severity: number;
  timestamp: Date;
  hostname: string;
  appName?: string;
  procId?: string;
  msgId?: string;
  message: string;
  structuredData?: Record<string, string>;
}

// ============================================================================
// Topology Types
// ============================================================================

export interface TopologySnapshot {
  id: string;
  timestamp: Date;
  devices: Device[];
  connections: Connection[];
  zones: ZoneDefinition[];
  metadata: {
    deviceCount: number;
    connectionCount: number;
    collectionDuration: number;
    sources: TelemetrySource[];
  };
}

export interface ZoneDefinition {
  id: string;
  name: string;
  purdueLevel: PurdueLevel;
  securityZone: SecurityZone;
  description?: string;
  subnets: string[];
  firewallRules?: FirewallRule[];
}

export interface FirewallRule {
  id: string;
  sourceZone: string;
  destinationZone: string;
  protocol: string;
  port?: number;
  action: 'allow' | 'deny';
  description?: string;
}

// ============================================================================
// Alert Types
// ============================================================================

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum AlertType {
  SECURITY = 'security',
  CONNECTIVITY = 'connectivity',
  COMPLIANCE = 'compliance',
  PERFORMANCE = 'performance',
  CONFIGURATION = 'configuration',
  // Additional specific alert types
  DEVICE_OFFLINE = 'device_offline',
  SECURITY_VIOLATION = 'security_violation',
  INSECURE_PROTOCOL = 'insecure_protocol',
  NEW_DEVICE = 'new_device',
  CONFIGURATION_CHANGE = 'configuration_change',
  CROSS_ZONE_CONNECTION = 'cross_zone_connection',
  FIRMWARE_OUTDATED = 'firmware_outdated',
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  deviceId?: string;
  connectionId?: string;
  details: Record<string, unknown>;
  remediation?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// Risk Assessment Types
// ============================================================================

export interface RiskAssessment {
  deviceId: string;
  overallScore: number; // 0-100
  factors: RiskFactor[];
  recommendations: string[];
  lastAssessedAt: Date;
}

export interface RiskFactor {
  name: string;
  category: 'vulnerability' | 'configuration' | 'exposure' | 'compliance';
  score: number; // 0-100
  weight: number;
  description: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface CollectorConfig {
  enabled: boolean;
  pollInterval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  batchSize: number;
  maxConcurrent: number;
}

export interface SNMPConfig extends CollectorConfig {
  version: 1 | 2 | 3;
  community?: string;
  securityLevel?: 'noAuthNoPriv' | 'authNoPriv' | 'authPriv';
  authProtocol?: 'MD5' | 'SHA' | 'SHA256' | 'SHA512';
  privProtocol?: 'DES' | 'AES' | 'AES256';
  username?: string;
  authKey?: string;
  privKey?: string;
}

export interface MQTTConfig {
  endpoint: string;
  clientId: string;
  topics: {
    telemetry: string;
    alerts: string;
    commands: string;
  };
  tls: {
    certPath: string;
    keyPath: string;
    caPath: string;
    minVersion: string;
  };
  keepalive: number;
  reconnectPeriod: number;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  /** When ssl is true, if false allows RDS/self-signed certs (e.g. in private VPC). Default true. */
  sslRejectUnauthorized?: boolean;
  poolSize: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata?: {
    timestamp: Date;
    requestId: string;
    duration: number;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ============================================================================
// Audit Types
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
}
