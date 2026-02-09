"use strict";
/**
 * Data validation schemas using Zod for SCADA Topology Discovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectorConfigSchema = exports.snmpTargetSchema = exports.riskAssessmentSchema = exports.riskFactorSchema = exports.topologySnapshotSchema = exports.zoneDefinitionSchema = exports.createAlertSchema = exports.alertSchema = exports.syslogMessageSchema = exports.netFlowRecordSchema = exports.macTableEntrySchema = exports.arpEntrySchema = exports.snmpNeighborSchema = exports.snmpInterfaceSchema = exports.telemetryDataSchema = exports.connectionSchema = exports.updateDeviceSchema = exports.createDeviceSchema = exports.deviceSchema = exports.deviceLocationSchema = exports.networkInterfaceSchema = exports.hostnameSchema = exports.uuidSchema = exports.vlanIdSchema = exports.portSchema = exports.cidrSchema = exports.ipAddressSchema = exports.ipv6Schema = exports.ipv4Schema = exports.macAddressSchema = void 0;
exports.validate = validate;
exports.safeValidate = safeValidate;
exports.formatValidationErrors = formatValidationErrors;
const zod_1 = require("zod");
const types_1 = require("./types");
// ============================================================================
// Common Validators
// ============================================================================
// MAC Address: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
exports.macAddressSchema = zod_1.z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format');
// IPv4 Address
exports.ipv4Schema = zod_1.z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IPv4 address');
// IPv6 Address (simplified)
exports.ipv6Schema = zod_1.z.string().regex(/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/, 'Invalid IPv6 address');
// IP Address (v4 or v6)
exports.ipAddressSchema = zod_1.z.union([exports.ipv4Schema, exports.ipv6Schema]);
// Subnet in CIDR notation
exports.cidrSchema = zod_1.z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:3[0-2]|[12]?[0-9])$/, 'Invalid CIDR notation');
// Port number
exports.portSchema = zod_1.z.number().int().min(1).max(65535);
// VLAN ID
exports.vlanIdSchema = zod_1.z.number().int().min(1).max(4094);
// UUID
exports.uuidSchema = zod_1.z.string().uuid();
// Hostname
exports.hostnameSchema = zod_1.z.string().regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/, 'Invalid hostname');
// ============================================================================
// Network Interface Schema
// ============================================================================
exports.networkInterfaceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    macAddress: exports.macAddressSchema,
    ipAddress: exports.ipv4Schema.optional(),
    subnetMask: exports.ipv4Schema.optional(),
    gateway: exports.ipv4Schema.optional(),
    vlanId: exports.vlanIdSchema.optional(),
    speed: zod_1.z.number().positive().optional(),
    duplex: zod_1.z.enum(['full', 'half', 'auto']).optional(),
    status: zod_1.z.enum(['up', 'down', 'unknown']),
});
// ============================================================================
// Device Location Schema
// ============================================================================
exports.deviceLocationSchema = zod_1.z.object({
    site: zod_1.z.string().optional(),
    building: zod_1.z.string().optional(),
    floor: zod_1.z.string().optional(),
    room: zod_1.z.string().optional(),
    rack: zod_1.z.string().optional(),
    coordinates: zod_1.z.object({
        latitude: zod_1.z.number().min(-90).max(90),
        longitude: zod_1.z.number().min(-180).max(180),
    }).optional(),
});
// ============================================================================
// Device Schema
// ============================================================================
exports.deviceSchema = zod_1.z.object({
    id: exports.uuidSchema,
    name: zod_1.z.string().min(1).max(255),
    hostname: exports.hostnameSchema.optional(),
    type: zod_1.z.nativeEnum(types_1.DeviceType),
    vendor: zod_1.z.string().max(100).optional(),
    model: zod_1.z.string().max(100).optional(),
    firmwareVersion: zod_1.z.string().max(50).optional(),
    serialNumber: zod_1.z.string().max(100).optional(),
    purdueLevel: zod_1.z.nativeEnum(types_1.PurdueLevel),
    securityZone: zod_1.z.nativeEnum(types_1.SecurityZone),
    status: zod_1.z.nativeEnum(types_1.DeviceStatus),
    interfaces: zod_1.z.array(exports.networkInterfaceSchema),
    location: exports.deviceLocationSchema.optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()),
    discoveredAt: zod_1.z.date(),
    lastSeenAt: zod_1.z.date(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.createDeviceSchema = exports.deviceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.updateDeviceSchema = exports.deviceSchema.partial().omit({
    id: true,
    createdAt: true,
});
// ============================================================================
// Connection Schema
// ============================================================================
exports.connectionSchema = zod_1.z.object({
    id: exports.uuidSchema,
    sourceDeviceId: exports.uuidSchema,
    targetDeviceId: exports.uuidSchema,
    sourceInterface: zod_1.z.string().optional(),
    targetInterface: zod_1.z.string().optional(),
    connectionType: zod_1.z.nativeEnum(types_1.ConnectionType),
    protocol: zod_1.z.string().optional(),
    port: exports.portSchema.optional(),
    vlanId: exports.vlanIdSchema.optional(),
    bandwidth: zod_1.z.number().positive().optional(),
    latency: zod_1.z.number().positive().optional(),
    isSecure: zod_1.z.boolean(),
    encryptionType: zod_1.z.string().optional(),
    discoveredAt: zod_1.z.date(),
    lastSeenAt: zod_1.z.date(),
    metadata: zod_1.z.record(zod_1.z.unknown()),
});
// ============================================================================
// Telemetry Data Schemas
// ============================================================================
exports.telemetryDataSchema = zod_1.z.object({
    id: exports.uuidSchema,
    source: zod_1.z.nativeEnum(types_1.TelemetrySource),
    deviceId: exports.uuidSchema.optional(),
    timestamp: zod_1.z.date(),
    data: zod_1.z.record(zod_1.z.unknown()),
    raw: zod_1.z.string().optional(),
    processed: zod_1.z.boolean(),
    metadata: zod_1.z.record(zod_1.z.unknown()),
});
exports.snmpInterfaceSchema = zod_1.z.object({
    index: zod_1.z.number().int().nonnegative(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    type: zod_1.z.number().int(),
    speed: zod_1.z.number().nonnegative(),
    physAddress: exports.macAddressSchema,
    adminStatus: zod_1.z.number().int().min(1).max(3),
    operStatus: zod_1.z.number().int().min(1).max(7),
    inOctets: zod_1.z.number().nonnegative(),
    outOctets: zod_1.z.number().nonnegative(),
});
exports.snmpNeighborSchema = zod_1.z.object({
    localInterface: zod_1.z.string(),
    remoteDeviceId: zod_1.z.string(),
    remoteInterface: zod_1.z.string().optional(),
    protocol: zod_1.z.enum(['lldp', 'cdp', 'snmp']),
});
exports.arpEntrySchema = zod_1.z.object({
    ipAddress: exports.ipv4Schema,
    macAddress: exports.macAddressSchema,
    interface: zod_1.z.string(),
    vlanId: exports.vlanIdSchema.optional(),
    type: zod_1.z.enum(['dynamic', 'static']),
    age: zod_1.z.number().nonnegative().optional(),
});
exports.macTableEntrySchema = zod_1.z.object({
    macAddress: exports.macAddressSchema,
    vlanId: exports.vlanIdSchema,
    port: zod_1.z.string(),
    type: zod_1.z.enum(['dynamic', 'static']),
});
exports.netFlowRecordSchema = zod_1.z.object({
    srcAddress: exports.ipv4Schema,
    dstAddress: exports.ipv4Schema,
    srcPort: exports.portSchema,
    dstPort: exports.portSchema,
    protocol: zod_1.z.number().int().min(0).max(255),
    bytes: zod_1.z.number().nonnegative(),
    packets: zod_1.z.number().nonnegative(),
    startTime: zod_1.z.date(),
    endTime: zod_1.z.date(),
    tcpFlags: zod_1.z.number().int().nonnegative().optional(),
    tos: zod_1.z.number().int().min(0).max(255).optional(),
});
exports.syslogMessageSchema = zod_1.z.object({
    facility: zod_1.z.number().int().min(0).max(23),
    severity: zod_1.z.number().int().min(0).max(7),
    timestamp: zod_1.z.date(),
    hostname: zod_1.z.string(),
    appName: zod_1.z.string().optional(),
    procId: zod_1.z.string().optional(),
    msgId: zod_1.z.string().optional(),
    message: zod_1.z.string(),
    structuredData: zod_1.z.record(zod_1.z.string()).optional(),
});
// ============================================================================
// Alert Schema
// ============================================================================
exports.alertSchema = zod_1.z.object({
    id: exports.uuidSchema,
    type: zod_1.z.nativeEnum(types_1.AlertType),
    severity: zod_1.z.nativeEnum(types_1.AlertSeverity),
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(2000),
    deviceId: exports.uuidSchema.optional(),
    connectionId: exports.uuidSchema.optional(),
    details: zod_1.z.record(zod_1.z.unknown()),
    remediation: zod_1.z.string().max(2000).optional(),
    acknowledged: zod_1.z.boolean(),
    acknowledgedBy: zod_1.z.string().optional(),
    acknowledgedAt: zod_1.z.date().optional(),
    resolved: zod_1.z.boolean(),
    resolvedAt: zod_1.z.date().optional(),
    createdAt: zod_1.z.date(),
});
exports.createAlertSchema = exports.alertSchema.omit({
    id: true,
    acknowledged: true,
    acknowledgedBy: true,
    acknowledgedAt: true,
    resolved: true,
    resolvedAt: true,
    createdAt: true,
}).extend({
    acknowledged: zod_1.z.boolean().optional().default(false),
    resolved: zod_1.z.boolean().optional().default(false),
});
// ============================================================================
// Zone Definition Schema
// ============================================================================
exports.zoneDefinitionSchema = zod_1.z.object({
    id: exports.uuidSchema,
    name: zod_1.z.string().min(1).max(100),
    purdueLevel: zod_1.z.nativeEnum(types_1.PurdueLevel),
    securityZone: zod_1.z.nativeEnum(types_1.SecurityZone),
    description: zod_1.z.string().max(500).optional(),
    subnets: zod_1.z.array(exports.cidrSchema),
    firewallRules: zod_1.z.array(zod_1.z.object({
        id: exports.uuidSchema,
        sourceZone: zod_1.z.string(),
        destinationZone: zod_1.z.string(),
        protocol: zod_1.z.string(),
        port: exports.portSchema.optional(),
        action: zod_1.z.enum(['allow', 'deny']),
        description: zod_1.z.string().optional(),
    })).optional(),
});
// ============================================================================
// Topology Snapshot Schema
// ============================================================================
exports.topologySnapshotSchema = zod_1.z.object({
    id: exports.uuidSchema,
    timestamp: zod_1.z.date(),
    devices: zod_1.z.array(exports.deviceSchema),
    connections: zod_1.z.array(exports.connectionSchema),
    zones: zod_1.z.array(exports.zoneDefinitionSchema),
    metadata: zod_1.z.object({
        deviceCount: zod_1.z.number().nonnegative(),
        connectionCount: zod_1.z.number().nonnegative(),
        collectionDuration: zod_1.z.number().nonnegative(),
        sources: zod_1.z.array(zod_1.z.nativeEnum(types_1.TelemetrySource)),
    }),
});
// ============================================================================
// Risk Assessment Schema
// ============================================================================
exports.riskFactorSchema = zod_1.z.object({
    name: zod_1.z.string(),
    category: zod_1.z.enum(['vulnerability', 'configuration', 'exposure', 'compliance']),
    score: zod_1.z.number().min(0).max(100),
    weight: zod_1.z.number().min(0).max(1),
    description: zod_1.z.string(),
    details: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.riskAssessmentSchema = zod_1.z.object({
    deviceId: exports.uuidSchema,
    overallScore: zod_1.z.number().min(0).max(100),
    factors: zod_1.z.array(exports.riskFactorSchema),
    recommendations: zod_1.z.array(zod_1.z.string()),
    lastAssessedAt: zod_1.z.date(),
});
// ============================================================================
// Configuration Schemas
// ============================================================================
exports.snmpTargetSchema = zod_1.z.object({
    host: exports.ipv4Schema,
    port: exports.portSchema.optional().default(161),
    version: zod_1.z.literal(3),
    securityName: zod_1.z.string(),
    securityLevel: zod_1.z.enum(['noAuthNoPriv', 'authNoPriv', 'authPriv']),
    authProtocol: zod_1.z.enum(['MD5', 'SHA', 'SHA256', 'SHA512']).optional(),
    authKey: zod_1.z.string().min(8).optional(),
    privProtocol: zod_1.z.enum(['DES', 'AES', 'AES256']).optional(),
    privKey: zod_1.z.string().min(8).optional(),
});
exports.collectorConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    pollInterval: zod_1.z.number().min(1000).max(3600000),
    timeout: zod_1.z.number().min(1000).max(60000),
    retries: zod_1.z.number().min(0).max(10),
    batchSize: zod_1.z.number().min(1).max(1000),
    maxConcurrent: zod_1.z.number().min(1).max(100),
});
// ============================================================================
// Validation Helper Functions
// ============================================================================
/**
 * Validate and parse data against a schema
 */
function validate(schema, data) {
    return schema.parse(data);
}
/**
 * Safely validate data and return result
 */
function safeValidate(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
}
/**
 * Format validation errors for logging/display
 */
function formatValidationErrors(errors) {
    return errors.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
    });
}
//# sourceMappingURL=validators.js.map