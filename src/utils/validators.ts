/**
 * Data validation schemas using Zod for SCADA Topology Discovery
 */

import { z } from 'zod';
import {
  PurdueLevel,
  SecurityZone,
  DeviceType,
  DeviceStatus,
  ConnectionType,
  TelemetrySource,
  AlertSeverity,
  AlertType,
} from './types';

// ============================================================================
// Common Validators
// ============================================================================

// MAC Address: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
export const macAddressSchema = z.string().regex(
  /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
  'Invalid MAC address format'
);

// IPv4 Address
export const ipv4Schema = z.string().regex(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  'Invalid IPv4 address'
);

// IPv6 Address (simplified)
export const ipv6Schema = z.string().regex(
  /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/,
  'Invalid IPv6 address'
);

// IP Address (v4 or v6)
export const ipAddressSchema = z.union([ipv4Schema, ipv6Schema]);

// Subnet in CIDR notation
export const cidrSchema = z.string().regex(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:3[0-2]|[12]?[0-9])$/,
  'Invalid CIDR notation'
);

// Port number
export const portSchema = z.number().int().min(1).max(65535);

// VLAN ID
export const vlanIdSchema = z.number().int().min(1).max(4094);

// UUID
export const uuidSchema = z.string().uuid();

// Hostname
export const hostnameSchema = z.string().regex(
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  'Invalid hostname'
);

// ============================================================================
// Network Interface Schema
// ============================================================================

export const networkInterfaceSchema = z.object({
  name: z.string().min(1),
  macAddress: macAddressSchema,
  ipAddress: ipv4Schema.optional(),
  subnetMask: ipv4Schema.optional(),
  gateway: ipv4Schema.optional(),
  vlanId: vlanIdSchema.optional(),
  speed: z.number().positive().optional(),
  duplex: z.enum(['full', 'half', 'auto']).optional(),
  status: z.enum(['up', 'down', 'unknown']),
});

// ============================================================================
// Device Location Schema
// ============================================================================

export const deviceLocationSchema = z.object({
  site: z.string().optional(),
  building: z.string().optional(),
  floor: z.string().optional(),
  room: z.string().optional(),
  rack: z.string().optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

// ============================================================================
// Device Schema
// ============================================================================

export const deviceSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(255),
  hostname: hostnameSchema.optional(),
  type: z.nativeEnum(DeviceType),
  vendor: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  firmwareVersion: z.string().max(50).optional(),
  serialNumber: z.string().max(100).optional(),
  purdueLevel: z.nativeEnum(PurdueLevel),
  securityZone: z.nativeEnum(SecurityZone),
  status: z.nativeEnum(DeviceStatus),
  interfaces: z.array(networkInterfaceSchema),
  location: deviceLocationSchema.optional(),
  metadata: z.record(z.unknown()),
  discoveredAt: z.date(),
  lastSeenAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createDeviceSchema = deviceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDeviceSchema = deviceSchema.partial().omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// Connection Schema
// ============================================================================

export const connectionSchema = z.object({
  id: uuidSchema,
  sourceDeviceId: uuidSchema,
  targetDeviceId: uuidSchema,
  sourceInterface: z.string().optional(),
  targetInterface: z.string().optional(),
  connectionType: z.nativeEnum(ConnectionType),
  protocol: z.string().optional(),
  port: portSchema.optional(),
  vlanId: vlanIdSchema.optional(),
  bandwidth: z.number().positive().optional(),
  latency: z.number().positive().optional(),
  isSecure: z.boolean(),
  encryptionType: z.string().optional(),
  discoveredAt: z.date(),
  lastSeenAt: z.date(),
  metadata: z.record(z.unknown()),
});

// ============================================================================
// Telemetry Data Schemas
// ============================================================================

export const telemetryDataSchema = z.object({
  id: uuidSchema,
  source: z.nativeEnum(TelemetrySource),
  deviceId: uuidSchema.optional(),
  timestamp: z.date(),
  data: z.record(z.unknown()),
  raw: z.string().optional(),
  processed: z.boolean(),
  metadata: z.record(z.unknown()),
});

export const snmpInterfaceSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string(),
  description: z.string().optional(),
  type: z.number().int(),
  speed: z.number().nonnegative(),
  physAddress: macAddressSchema,
  adminStatus: z.number().int().min(1).max(3),
  operStatus: z.number().int().min(1).max(7),
  inOctets: z.number().nonnegative(),
  outOctets: z.number().nonnegative(),
});

export const snmpNeighborSchema = z.object({
  localInterface: z.string(),
  remoteDeviceId: z.string(),
  remoteInterface: z.string().optional(),
  protocol: z.enum(['lldp', 'cdp', 'snmp']),
});

export const arpEntrySchema = z.object({
  ipAddress: ipv4Schema,
  macAddress: macAddressSchema,
  interface: z.string(),
  vlanId: vlanIdSchema.optional(),
  type: z.enum(['dynamic', 'static']),
  age: z.number().nonnegative().optional(),
});

export const macTableEntrySchema = z.object({
  macAddress: macAddressSchema,
  vlanId: vlanIdSchema,
  port: z.string(),
  type: z.enum(['dynamic', 'static']),
});

export const netFlowRecordSchema = z.object({
  srcAddress: ipv4Schema,
  dstAddress: ipv4Schema,
  srcPort: portSchema,
  dstPort: portSchema,
  protocol: z.number().int().min(0).max(255),
  bytes: z.number().nonnegative(),
  packets: z.number().nonnegative(),
  startTime: z.date(),
  endTime: z.date(),
  tcpFlags: z.number().int().nonnegative().optional(),
  tos: z.number().int().min(0).max(255).optional(),
});

export const syslogMessageSchema = z.object({
  facility: z.number().int().min(0).max(23),
  severity: z.number().int().min(0).max(7),
  timestamp: z.date(),
  hostname: z.string(),
  appName: z.string().optional(),
  procId: z.string().optional(),
  msgId: z.string().optional(),
  message: z.string(),
  structuredData: z.record(z.string()).optional(),
});

// ============================================================================
// Alert Schema
// ============================================================================

export const alertSchema = z.object({
  id: uuidSchema,
  type: z.nativeEnum(AlertType),
  severity: z.nativeEnum(AlertSeverity),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  deviceId: uuidSchema.optional(),
  connectionId: uuidSchema.optional(),
  details: z.record(z.unknown()),
  remediation: z.string().max(2000).optional(),
  acknowledged: z.boolean(),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.date().optional(),
  resolved: z.boolean(),
  resolvedAt: z.date().optional(),
  createdAt: z.date(),
});

export const createAlertSchema = alertSchema.omit({
  id: true,
  acknowledged: true,
  acknowledgedBy: true,
  acknowledgedAt: true,
  resolved: true,
  resolvedAt: true,
  createdAt: true,
}).extend({
  acknowledged: z.boolean().optional().default(false),
  resolved: z.boolean().optional().default(false),
});

// ============================================================================
// Zone Definition Schema
// ============================================================================

export const zoneDefinitionSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  purdueLevel: z.nativeEnum(PurdueLevel),
  securityZone: z.nativeEnum(SecurityZone),
  description: z.string().max(500).optional(),
  subnets: z.array(cidrSchema),
  firewallRules: z.array(z.object({
    id: uuidSchema,
    sourceZone: z.string(),
    destinationZone: z.string(),
    protocol: z.string(),
    port: portSchema.optional(),
    action: z.enum(['allow', 'deny']),
    description: z.string().optional(),
  })).optional(),
});

// ============================================================================
// Topology Snapshot Schema
// ============================================================================

export const topologySnapshotSchema = z.object({
  id: uuidSchema,
  timestamp: z.date(),
  devices: z.array(deviceSchema),
  connections: z.array(connectionSchema),
  zones: z.array(zoneDefinitionSchema),
  metadata: z.object({
    deviceCount: z.number().nonnegative(),
    connectionCount: z.number().nonnegative(),
    collectionDuration: z.number().nonnegative(),
    sources: z.array(z.nativeEnum(TelemetrySource)),
  }),
});

// ============================================================================
// Risk Assessment Schema
// ============================================================================

export const riskFactorSchema = z.object({
  name: z.string(),
  category: z.enum(['vulnerability', 'configuration', 'exposure', 'compliance']),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  description: z.string(),
  details: z.record(z.unknown()).optional(),
});

export const riskAssessmentSchema = z.object({
  deviceId: uuidSchema,
  overallScore: z.number().min(0).max(100),
  factors: z.array(riskFactorSchema),
  recommendations: z.array(z.string()),
  lastAssessedAt: z.date(),
});

// ============================================================================
// Configuration Schemas
// ============================================================================

export const snmpTargetSchema = z.object({
  host: ipv4Schema,
  port: portSchema.optional().default(161),
  version: z.literal(3),
  securityName: z.string(),
  securityLevel: z.enum(['noAuthNoPriv', 'authNoPriv', 'authPriv']),
  authProtocol: z.enum(['MD5', 'SHA', 'SHA256', 'SHA512']).optional(),
  authKey: z.string().min(8).optional(),
  privProtocol: z.enum(['DES', 'AES', 'AES256']).optional(),
  privKey: z.string().min(8).optional(),
});

export const collectorConfigSchema = z.object({
  enabled: z.boolean(),
  pollInterval: z.number().min(1000).max(3600000),
  timeout: z.number().min(1000).max(60000),
  retries: z.number().min(0).max(10),
  batchSize: z.number().min(1).max(1000),
  maxConcurrent: z.number().min(1).max(100),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate and parse data against a schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate data and return result
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
} {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Format validation errors for logging/display
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map(err => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

// ============================================================================
// Type Exports from Schemas
// ============================================================================

export type ValidatedDevice = z.infer<typeof deviceSchema>;
export type ValidatedConnection = z.infer<typeof connectionSchema>;
export type ValidatedTelemetryData = z.infer<typeof telemetryDataSchema>;
export type ValidatedAlert = z.infer<typeof alertSchema>;
export type ValidatedZoneDefinition = z.infer<typeof zoneDefinitionSchema>;
export type ValidatedTopologySnapshot = z.infer<typeof topologySnapshotSchema>;
export type ValidatedRiskAssessment = z.infer<typeof riskAssessmentSchema>;
export type ValidatedSNMPTarget = z.infer<typeof snmpTargetSchema>;
