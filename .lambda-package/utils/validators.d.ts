/**
 * Data validation schemas using Zod for SCADA Topology Discovery
 */
import { z } from 'zod';
import { PurdueLevel, SecurityZone, DeviceType, DeviceStatus, ConnectionType, TelemetrySource, AlertSeverity, AlertType } from './types';
export declare const macAddressSchema: z.ZodString;
export declare const ipv4Schema: z.ZodString;
export declare const ipv6Schema: z.ZodString;
export declare const ipAddressSchema: z.ZodUnion<[z.ZodString, z.ZodString]>;
export declare const cidrSchema: z.ZodString;
export declare const portSchema: z.ZodNumber;
export declare const vlanIdSchema: z.ZodNumber;
export declare const uuidSchema: z.ZodString;
export declare const hostnameSchema: z.ZodString;
export declare const networkInterfaceSchema: z.ZodObject<{
    name: z.ZodString;
    macAddress: z.ZodString;
    ipAddress: z.ZodOptional<z.ZodString>;
    subnetMask: z.ZodOptional<z.ZodString>;
    gateway: z.ZodOptional<z.ZodString>;
    vlanId: z.ZodOptional<z.ZodNumber>;
    speed: z.ZodOptional<z.ZodNumber>;
    duplex: z.ZodOptional<z.ZodEnum<["full", "half", "auto"]>>;
    status: z.ZodEnum<["up", "down", "unknown"]>;
}, "strip", z.ZodTypeAny, {
    status: "unknown" | "up" | "down";
    name: string;
    macAddress: string;
    gateway?: string | undefined;
    ipAddress?: string | undefined;
    subnetMask?: string | undefined;
    vlanId?: number | undefined;
    speed?: number | undefined;
    duplex?: "full" | "half" | "auto" | undefined;
}, {
    status: "unknown" | "up" | "down";
    name: string;
    macAddress: string;
    gateway?: string | undefined;
    ipAddress?: string | undefined;
    subnetMask?: string | undefined;
    vlanId?: number | undefined;
    speed?: number | undefined;
    duplex?: "full" | "half" | "auto" | undefined;
}>;
export declare const deviceLocationSchema: z.ZodObject<{
    site: z.ZodOptional<z.ZodString>;
    building: z.ZodOptional<z.ZodString>;
    floor: z.ZodOptional<z.ZodString>;
    room: z.ZodOptional<z.ZodString>;
    rack: z.ZodOptional<z.ZodString>;
    coordinates: z.ZodOptional<z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
    }, {
        latitude: number;
        longitude: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    site?: string | undefined;
    building?: string | undefined;
    floor?: string | undefined;
    room?: string | undefined;
    rack?: string | undefined;
    coordinates?: {
        latitude: number;
        longitude: number;
    } | undefined;
}, {
    site?: string | undefined;
    building?: string | undefined;
    floor?: string | undefined;
    room?: string | undefined;
    rack?: string | undefined;
    coordinates?: {
        latitude: number;
        longitude: number;
    } | undefined;
}>;
export declare const deviceSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    hostname: z.ZodOptional<z.ZodString>;
    type: z.ZodNativeEnum<typeof DeviceType>;
    vendor: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    firmwareVersion: z.ZodOptional<z.ZodString>;
    serialNumber: z.ZodOptional<z.ZodString>;
    purdueLevel: z.ZodNativeEnum<typeof PurdueLevel>;
    securityZone: z.ZodNativeEnum<typeof SecurityZone>;
    status: z.ZodNativeEnum<typeof DeviceStatus>;
    interfaces: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        macAddress: z.ZodString;
        ipAddress: z.ZodOptional<z.ZodString>;
        subnetMask: z.ZodOptional<z.ZodString>;
        gateway: z.ZodOptional<z.ZodString>;
        vlanId: z.ZodOptional<z.ZodNumber>;
        speed: z.ZodOptional<z.ZodNumber>;
        duplex: z.ZodOptional<z.ZodEnum<["full", "half", "auto"]>>;
        status: z.ZodEnum<["up", "down", "unknown"]>;
    }, "strip", z.ZodTypeAny, {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }, {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }>, "many">;
    location: z.ZodOptional<z.ZodObject<{
        site: z.ZodOptional<z.ZodString>;
        building: z.ZodOptional<z.ZodString>;
        floor: z.ZodOptional<z.ZodString>;
        room: z.ZodOptional<z.ZodString>;
        rack: z.ZodOptional<z.ZodString>;
        coordinates: z.ZodOptional<z.ZodObject<{
            latitude: z.ZodNumber;
            longitude: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            latitude: number;
            longitude: number;
        }, {
            latitude: number;
            longitude: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    }, {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    }>>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    discoveredAt: z.ZodDate;
    lastSeenAt: z.ZodDate;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    interfaces: {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }[];
    type: DeviceType;
    status: DeviceStatus;
    metadata: Record<string, unknown>;
    name: string;
    id: string;
    purdueLevel: PurdueLevel;
    securityZone: SecurityZone;
    discoveredAt: Date;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
    hostname?: string | undefined;
    vendor?: string | undefined;
    model?: string | undefined;
    firmwareVersion?: string | undefined;
    serialNumber?: string | undefined;
    location?: {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    } | undefined;
}, {
    interfaces: {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }[];
    type: DeviceType;
    status: DeviceStatus;
    metadata: Record<string, unknown>;
    name: string;
    id: string;
    purdueLevel: PurdueLevel;
    securityZone: SecurityZone;
    discoveredAt: Date;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
    hostname?: string | undefined;
    vendor?: string | undefined;
    model?: string | undefined;
    firmwareVersion?: string | undefined;
    serialNumber?: string | undefined;
    location?: {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    } | undefined;
}>;
export declare const createDeviceSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    hostname: z.ZodOptional<z.ZodString>;
    type: z.ZodNativeEnum<typeof DeviceType>;
    vendor: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    firmwareVersion: z.ZodOptional<z.ZodString>;
    serialNumber: z.ZodOptional<z.ZodString>;
    purdueLevel: z.ZodNativeEnum<typeof PurdueLevel>;
    securityZone: z.ZodNativeEnum<typeof SecurityZone>;
    status: z.ZodNativeEnum<typeof DeviceStatus>;
    interfaces: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        macAddress: z.ZodString;
        ipAddress: z.ZodOptional<z.ZodString>;
        subnetMask: z.ZodOptional<z.ZodString>;
        gateway: z.ZodOptional<z.ZodString>;
        vlanId: z.ZodOptional<z.ZodNumber>;
        speed: z.ZodOptional<z.ZodNumber>;
        duplex: z.ZodOptional<z.ZodEnum<["full", "half", "auto"]>>;
        status: z.ZodEnum<["up", "down", "unknown"]>;
    }, "strip", z.ZodTypeAny, {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }, {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }>, "many">;
    location: z.ZodOptional<z.ZodObject<{
        site: z.ZodOptional<z.ZodString>;
        building: z.ZodOptional<z.ZodString>;
        floor: z.ZodOptional<z.ZodString>;
        room: z.ZodOptional<z.ZodString>;
        rack: z.ZodOptional<z.ZodString>;
        coordinates: z.ZodOptional<z.ZodObject<{
            latitude: z.ZodNumber;
            longitude: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            latitude: number;
            longitude: number;
        }, {
            latitude: number;
            longitude: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    }, {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    }>>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    discoveredAt: z.ZodDate;
    lastSeenAt: z.ZodDate;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    interfaces: {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }[];
    type: DeviceType;
    status: DeviceStatus;
    metadata: Record<string, unknown>;
    name: string;
    purdueLevel: PurdueLevel;
    securityZone: SecurityZone;
    discoveredAt: Date;
    lastSeenAt: Date;
    hostname?: string | undefined;
    vendor?: string | undefined;
    model?: string | undefined;
    firmwareVersion?: string | undefined;
    serialNumber?: string | undefined;
    location?: {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    } | undefined;
}, {
    interfaces: {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }[];
    type: DeviceType;
    status: DeviceStatus;
    metadata: Record<string, unknown>;
    name: string;
    purdueLevel: PurdueLevel;
    securityZone: SecurityZone;
    discoveredAt: Date;
    lastSeenAt: Date;
    hostname?: string | undefined;
    vendor?: string | undefined;
    model?: string | undefined;
    firmwareVersion?: string | undefined;
    serialNumber?: string | undefined;
    location?: {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    } | undefined;
}>;
export declare const updateDeviceSchema: z.ZodObject<Omit<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    hostname: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    type: z.ZodOptional<z.ZodNativeEnum<typeof DeviceType>>;
    vendor: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    model: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    firmwareVersion: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    serialNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    purdueLevel: z.ZodOptional<z.ZodNativeEnum<typeof PurdueLevel>>;
    securityZone: z.ZodOptional<z.ZodNativeEnum<typeof SecurityZone>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof DeviceStatus>>;
    interfaces: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        macAddress: z.ZodString;
        ipAddress: z.ZodOptional<z.ZodString>;
        subnetMask: z.ZodOptional<z.ZodString>;
        gateway: z.ZodOptional<z.ZodString>;
        vlanId: z.ZodOptional<z.ZodNumber>;
        speed: z.ZodOptional<z.ZodNumber>;
        duplex: z.ZodOptional<z.ZodEnum<["full", "half", "auto"]>>;
        status: z.ZodEnum<["up", "down", "unknown"]>;
    }, "strip", z.ZodTypeAny, {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }, {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }>, "many">>;
    location: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        site: z.ZodOptional<z.ZodString>;
        building: z.ZodOptional<z.ZodString>;
        floor: z.ZodOptional<z.ZodString>;
        room: z.ZodOptional<z.ZodString>;
        rack: z.ZodOptional<z.ZodString>;
        coordinates: z.ZodOptional<z.ZodObject<{
            latitude: z.ZodNumber;
            longitude: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            latitude: number;
            longitude: number;
        }, {
            latitude: number;
            longitude: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    }, {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    }>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    discoveredAt: z.ZodOptional<z.ZodDate>;
    lastSeenAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodOptional<z.ZodDate>;
}, "id" | "createdAt">, "strip", z.ZodTypeAny, {
    interfaces?: {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }[] | undefined;
    type?: DeviceType | undefined;
    status?: DeviceStatus | undefined;
    metadata?: Record<string, unknown> | undefined;
    name?: string | undefined;
    hostname?: string | undefined;
    vendor?: string | undefined;
    model?: string | undefined;
    firmwareVersion?: string | undefined;
    serialNumber?: string | undefined;
    purdueLevel?: PurdueLevel | undefined;
    securityZone?: SecurityZone | undefined;
    location?: {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    } | undefined;
    discoveredAt?: Date | undefined;
    lastSeenAt?: Date | undefined;
    updatedAt?: Date | undefined;
}, {
    interfaces?: {
        status: "unknown" | "up" | "down";
        name: string;
        macAddress: string;
        gateway?: string | undefined;
        ipAddress?: string | undefined;
        subnetMask?: string | undefined;
        vlanId?: number | undefined;
        speed?: number | undefined;
        duplex?: "full" | "half" | "auto" | undefined;
    }[] | undefined;
    type?: DeviceType | undefined;
    status?: DeviceStatus | undefined;
    metadata?: Record<string, unknown> | undefined;
    name?: string | undefined;
    hostname?: string | undefined;
    vendor?: string | undefined;
    model?: string | undefined;
    firmwareVersion?: string | undefined;
    serialNumber?: string | undefined;
    purdueLevel?: PurdueLevel | undefined;
    securityZone?: SecurityZone | undefined;
    location?: {
        site?: string | undefined;
        building?: string | undefined;
        floor?: string | undefined;
        room?: string | undefined;
        rack?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
    } | undefined;
    discoveredAt?: Date | undefined;
    lastSeenAt?: Date | undefined;
    updatedAt?: Date | undefined;
}>;
export declare const connectionSchema: z.ZodObject<{
    id: z.ZodString;
    sourceDeviceId: z.ZodString;
    targetDeviceId: z.ZodString;
    sourceInterface: z.ZodOptional<z.ZodString>;
    targetInterface: z.ZodOptional<z.ZodString>;
    connectionType: z.ZodNativeEnum<typeof ConnectionType>;
    protocol: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    vlanId: z.ZodOptional<z.ZodNumber>;
    bandwidth: z.ZodOptional<z.ZodNumber>;
    latency: z.ZodOptional<z.ZodNumber>;
    isSecure: z.ZodBoolean;
    encryptionType: z.ZodOptional<z.ZodString>;
    discoveredAt: z.ZodDate;
    lastSeenAt: z.ZodDate;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    metadata: Record<string, unknown>;
    id: string;
    discoveredAt: Date;
    lastSeenAt: Date;
    sourceDeviceId: string;
    targetDeviceId: string;
    connectionType: ConnectionType;
    isSecure: boolean;
    port?: number | undefined;
    vlanId?: number | undefined;
    sourceInterface?: string | undefined;
    targetInterface?: string | undefined;
    protocol?: string | undefined;
    bandwidth?: number | undefined;
    latency?: number | undefined;
    encryptionType?: string | undefined;
}, {
    metadata: Record<string, unknown>;
    id: string;
    discoveredAt: Date;
    lastSeenAt: Date;
    sourceDeviceId: string;
    targetDeviceId: string;
    connectionType: ConnectionType;
    isSecure: boolean;
    port?: number | undefined;
    vlanId?: number | undefined;
    sourceInterface?: string | undefined;
    targetInterface?: string | undefined;
    protocol?: string | undefined;
    bandwidth?: number | undefined;
    latency?: number | undefined;
    encryptionType?: string | undefined;
}>;
export declare const telemetryDataSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodNativeEnum<typeof TelemetrySource>;
    deviceId: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    raw: z.ZodOptional<z.ZodString>;
    processed: z.ZodBoolean;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    metadata: Record<string, unknown>;
    id: string;
    source: TelemetrySource;
    data: Record<string, unknown>;
    processed: boolean;
    deviceId?: string | undefined;
    raw?: string | undefined;
}, {
    timestamp: Date;
    metadata: Record<string, unknown>;
    id: string;
    source: TelemetrySource;
    data: Record<string, unknown>;
    processed: boolean;
    deviceId?: string | undefined;
    raw?: string | undefined;
}>;
export declare const snmpInterfaceSchema: z.ZodObject<{
    index: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodNumber;
    speed: z.ZodNumber;
    physAddress: z.ZodString;
    adminStatus: z.ZodNumber;
    operStatus: z.ZodNumber;
    inOctets: z.ZodNumber;
    outOctets: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: number;
    name: string;
    speed: number;
    index: number;
    physAddress: string;
    adminStatus: number;
    operStatus: number;
    inOctets: number;
    outOctets: number;
    description?: string | undefined;
}, {
    type: number;
    name: string;
    speed: number;
    index: number;
    physAddress: string;
    adminStatus: number;
    operStatus: number;
    inOctets: number;
    outOctets: number;
    description?: string | undefined;
}>;
export declare const snmpNeighborSchema: z.ZodObject<{
    localInterface: z.ZodString;
    remoteDeviceId: z.ZodString;
    remoteInterface: z.ZodOptional<z.ZodString>;
    protocol: z.ZodEnum<["lldp", "cdp", "snmp"]>;
}, "strip", z.ZodTypeAny, {
    protocol: "snmp" | "lldp" | "cdp";
    localInterface: string;
    remoteDeviceId: string;
    remoteInterface?: string | undefined;
}, {
    protocol: "snmp" | "lldp" | "cdp";
    localInterface: string;
    remoteDeviceId: string;
    remoteInterface?: string | undefined;
}>;
export declare const arpEntrySchema: z.ZodObject<{
    ipAddress: z.ZodString;
    macAddress: z.ZodString;
    interface: z.ZodString;
    vlanId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodEnum<["dynamic", "static"]>;
    age: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "dynamic" | "static";
    macAddress: string;
    ipAddress: string;
    interface: string;
    vlanId?: number | undefined;
    age?: number | undefined;
}, {
    type: "dynamic" | "static";
    macAddress: string;
    ipAddress: string;
    interface: string;
    vlanId?: number | undefined;
    age?: number | undefined;
}>;
export declare const macTableEntrySchema: z.ZodObject<{
    macAddress: z.ZodString;
    vlanId: z.ZodNumber;
    port: z.ZodString;
    type: z.ZodEnum<["dynamic", "static"]>;
}, "strip", z.ZodTypeAny, {
    type: "dynamic" | "static";
    port: string;
    macAddress: string;
    vlanId: number;
}, {
    type: "dynamic" | "static";
    port: string;
    macAddress: string;
    vlanId: number;
}>;
export declare const netFlowRecordSchema: z.ZodObject<{
    srcAddress: z.ZodString;
    dstAddress: z.ZodString;
    srcPort: z.ZodNumber;
    dstPort: z.ZodNumber;
    protocol: z.ZodNumber;
    bytes: z.ZodNumber;
    packets: z.ZodNumber;
    startTime: z.ZodDate;
    endTime: z.ZodDate;
    tcpFlags: z.ZodOptional<z.ZodNumber>;
    tos: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    protocol: number;
    srcAddress: string;
    dstAddress: string;
    srcPort: number;
    dstPort: number;
    bytes: number;
    packets: number;
    startTime: Date;
    endTime: Date;
    tcpFlags?: number | undefined;
    tos?: number | undefined;
}, {
    protocol: number;
    srcAddress: string;
    dstAddress: string;
    srcPort: number;
    dstPort: number;
    bytes: number;
    packets: number;
    startTime: Date;
    endTime: Date;
    tcpFlags?: number | undefined;
    tos?: number | undefined;
}>;
export declare const syslogMessageSchema: z.ZodObject<{
    facility: z.ZodNumber;
    severity: z.ZodNumber;
    timestamp: z.ZodDate;
    hostname: z.ZodString;
    appName: z.ZodOptional<z.ZodString>;
    procId: z.ZodOptional<z.ZodString>;
    msgId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    structuredData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    timestamp: Date;
    hostname: string;
    facility: number;
    severity: number;
    appName?: string | undefined;
    procId?: string | undefined;
    msgId?: string | undefined;
    structuredData?: Record<string, string> | undefined;
}, {
    message: string;
    timestamp: Date;
    hostname: string;
    facility: number;
    severity: number;
    appName?: string | undefined;
    procId?: string | undefined;
    msgId?: string | undefined;
    structuredData?: Record<string, string> | undefined;
}>;
export declare const alertSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodNativeEnum<typeof AlertType>;
    severity: z.ZodNativeEnum<typeof AlertSeverity>;
    title: z.ZodString;
    description: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
    connectionId: z.ZodOptional<z.ZodString>;
    details: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    remediation: z.ZodOptional<z.ZodString>;
    acknowledged: z.ZodBoolean;
    acknowledgedBy: z.ZodOptional<z.ZodString>;
    acknowledgedAt: z.ZodOptional<z.ZodDate>;
    resolved: z.ZodBoolean;
    resolvedAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: AlertType;
    id: string;
    createdAt: Date;
    description: string;
    severity: AlertSeverity;
    title: string;
    details: Record<string, unknown>;
    acknowledged: boolean;
    resolved: boolean;
    deviceId?: string | undefined;
    connectionId?: string | undefined;
    remediation?: string | undefined;
    acknowledgedBy?: string | undefined;
    acknowledgedAt?: Date | undefined;
    resolvedAt?: Date | undefined;
}, {
    type: AlertType;
    id: string;
    createdAt: Date;
    description: string;
    severity: AlertSeverity;
    title: string;
    details: Record<string, unknown>;
    acknowledged: boolean;
    resolved: boolean;
    deviceId?: string | undefined;
    connectionId?: string | undefined;
    remediation?: string | undefined;
    acknowledgedBy?: string | undefined;
    acknowledgedAt?: Date | undefined;
    resolvedAt?: Date | undefined;
}>;
export declare const createAlertSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    type: z.ZodNativeEnum<typeof AlertType>;
    severity: z.ZodNativeEnum<typeof AlertSeverity>;
    title: z.ZodString;
    description: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
    connectionId: z.ZodOptional<z.ZodString>;
    details: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    remediation: z.ZodOptional<z.ZodString>;
    acknowledged: z.ZodBoolean;
    acknowledgedBy: z.ZodOptional<z.ZodString>;
    acknowledgedAt: z.ZodOptional<z.ZodDate>;
    resolved: z.ZodBoolean;
    resolvedAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
}, "id" | "createdAt" | "acknowledged" | "acknowledgedBy" | "acknowledgedAt" | "resolved" | "resolvedAt"> & {
    acknowledged: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    resolved: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    type: AlertType;
    description: string;
    severity: AlertSeverity;
    title: string;
    details: Record<string, unknown>;
    acknowledged: boolean;
    resolved: boolean;
    deviceId?: string | undefined;
    connectionId?: string | undefined;
    remediation?: string | undefined;
}, {
    type: AlertType;
    description: string;
    severity: AlertSeverity;
    title: string;
    details: Record<string, unknown>;
    deviceId?: string | undefined;
    connectionId?: string | undefined;
    remediation?: string | undefined;
    acknowledged?: boolean | undefined;
    resolved?: boolean | undefined;
}>;
export declare const zoneDefinitionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    purdueLevel: z.ZodNativeEnum<typeof PurdueLevel>;
    securityZone: z.ZodNativeEnum<typeof SecurityZone>;
    description: z.ZodOptional<z.ZodString>;
    subnets: z.ZodArray<z.ZodString, "many">;
    firewallRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceZone: z.ZodString;
        destinationZone: z.ZodString;
        protocol: z.ZodString;
        port: z.ZodOptional<z.ZodNumber>;
        action: z.ZodEnum<["allow", "deny"]>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        protocol: string;
        sourceZone: string;
        destinationZone: string;
        action: "allow" | "deny";
        port?: number | undefined;
        description?: string | undefined;
    }, {
        id: string;
        protocol: string;
        sourceZone: string;
        destinationZone: string;
        action: "allow" | "deny";
        port?: number | undefined;
        description?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    purdueLevel: PurdueLevel;
    securityZone: SecurityZone;
    subnets: string[];
    description?: string | undefined;
    firewallRules?: {
        id: string;
        protocol: string;
        sourceZone: string;
        destinationZone: string;
        action: "allow" | "deny";
        port?: number | undefined;
        description?: string | undefined;
    }[] | undefined;
}, {
    name: string;
    id: string;
    purdueLevel: PurdueLevel;
    securityZone: SecurityZone;
    subnets: string[];
    description?: string | undefined;
    firewallRules?: {
        id: string;
        protocol: string;
        sourceZone: string;
        destinationZone: string;
        action: "allow" | "deny";
        port?: number | undefined;
        description?: string | undefined;
    }[] | undefined;
}>;
export declare const topologySnapshotSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodDate;
    devices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        hostname: z.ZodOptional<z.ZodString>;
        type: z.ZodNativeEnum<typeof DeviceType>;
        vendor: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        firmwareVersion: z.ZodOptional<z.ZodString>;
        serialNumber: z.ZodOptional<z.ZodString>;
        purdueLevel: z.ZodNativeEnum<typeof PurdueLevel>;
        securityZone: z.ZodNativeEnum<typeof SecurityZone>;
        status: z.ZodNativeEnum<typeof DeviceStatus>;
        interfaces: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            macAddress: z.ZodString;
            ipAddress: z.ZodOptional<z.ZodString>;
            subnetMask: z.ZodOptional<z.ZodString>;
            gateway: z.ZodOptional<z.ZodString>;
            vlanId: z.ZodOptional<z.ZodNumber>;
            speed: z.ZodOptional<z.ZodNumber>;
            duplex: z.ZodOptional<z.ZodEnum<["full", "half", "auto"]>>;
            status: z.ZodEnum<["up", "down", "unknown"]>;
        }, "strip", z.ZodTypeAny, {
            status: "unknown" | "up" | "down";
            name: string;
            macAddress: string;
            gateway?: string | undefined;
            ipAddress?: string | undefined;
            subnetMask?: string | undefined;
            vlanId?: number | undefined;
            speed?: number | undefined;
            duplex?: "full" | "half" | "auto" | undefined;
        }, {
            status: "unknown" | "up" | "down";
            name: string;
            macAddress: string;
            gateway?: string | undefined;
            ipAddress?: string | undefined;
            subnetMask?: string | undefined;
            vlanId?: number | undefined;
            speed?: number | undefined;
            duplex?: "full" | "half" | "auto" | undefined;
        }>, "many">;
        location: z.ZodOptional<z.ZodObject<{
            site: z.ZodOptional<z.ZodString>;
            building: z.ZodOptional<z.ZodString>;
            floor: z.ZodOptional<z.ZodString>;
            room: z.ZodOptional<z.ZodString>;
            rack: z.ZodOptional<z.ZodString>;
            coordinates: z.ZodOptional<z.ZodObject<{
                latitude: z.ZodNumber;
                longitude: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                latitude: number;
                longitude: number;
            }, {
                latitude: number;
                longitude: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            site?: string | undefined;
            building?: string | undefined;
            floor?: string | undefined;
            room?: string | undefined;
            rack?: string | undefined;
            coordinates?: {
                latitude: number;
                longitude: number;
            } | undefined;
        }, {
            site?: string | undefined;
            building?: string | undefined;
            floor?: string | undefined;
            room?: string | undefined;
            rack?: string | undefined;
            coordinates?: {
                latitude: number;
                longitude: number;
            } | undefined;
        }>>;
        metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        discoveredAt: z.ZodDate;
        lastSeenAt: z.ZodDate;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        interfaces: {
            status: "unknown" | "up" | "down";
            name: string;
            macAddress: string;
            gateway?: string | undefined;
            ipAddress?: string | undefined;
            subnetMask?: string | undefined;
            vlanId?: number | undefined;
            speed?: number | undefined;
            duplex?: "full" | "half" | "auto" | undefined;
        }[];
        type: DeviceType;
        status: DeviceStatus;
        metadata: Record<string, unknown>;
        name: string;
        id: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        discoveredAt: Date;
        lastSeenAt: Date;
        createdAt: Date;
        updatedAt: Date;
        hostname?: string | undefined;
        vendor?: string | undefined;
        model?: string | undefined;
        firmwareVersion?: string | undefined;
        serialNumber?: string | undefined;
        location?: {
            site?: string | undefined;
            building?: string | undefined;
            floor?: string | undefined;
            room?: string | undefined;
            rack?: string | undefined;
            coordinates?: {
                latitude: number;
                longitude: number;
            } | undefined;
        } | undefined;
    }, {
        interfaces: {
            status: "unknown" | "up" | "down";
            name: string;
            macAddress: string;
            gateway?: string | undefined;
            ipAddress?: string | undefined;
            subnetMask?: string | undefined;
            vlanId?: number | undefined;
            speed?: number | undefined;
            duplex?: "full" | "half" | "auto" | undefined;
        }[];
        type: DeviceType;
        status: DeviceStatus;
        metadata: Record<string, unknown>;
        name: string;
        id: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        discoveredAt: Date;
        lastSeenAt: Date;
        createdAt: Date;
        updatedAt: Date;
        hostname?: string | undefined;
        vendor?: string | undefined;
        model?: string | undefined;
        firmwareVersion?: string | undefined;
        serialNumber?: string | undefined;
        location?: {
            site?: string | undefined;
            building?: string | undefined;
            floor?: string | undefined;
            room?: string | undefined;
            rack?: string | undefined;
            coordinates?: {
                latitude: number;
                longitude: number;
            } | undefined;
        } | undefined;
    }>, "many">;
    connections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceDeviceId: z.ZodString;
        targetDeviceId: z.ZodString;
        sourceInterface: z.ZodOptional<z.ZodString>;
        targetInterface: z.ZodOptional<z.ZodString>;
        connectionType: z.ZodNativeEnum<typeof ConnectionType>;
        protocol: z.ZodOptional<z.ZodString>;
        port: z.ZodOptional<z.ZodNumber>;
        vlanId: z.ZodOptional<z.ZodNumber>;
        bandwidth: z.ZodOptional<z.ZodNumber>;
        latency: z.ZodOptional<z.ZodNumber>;
        isSecure: z.ZodBoolean;
        encryptionType: z.ZodOptional<z.ZodString>;
        discoveredAt: z.ZodDate;
        lastSeenAt: z.ZodDate;
        metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        metadata: Record<string, unknown>;
        id: string;
        discoveredAt: Date;
        lastSeenAt: Date;
        sourceDeviceId: string;
        targetDeviceId: string;
        connectionType: ConnectionType;
        isSecure: boolean;
        port?: number | undefined;
        vlanId?: number | undefined;
        sourceInterface?: string | undefined;
        targetInterface?: string | undefined;
        protocol?: string | undefined;
        bandwidth?: number | undefined;
        latency?: number | undefined;
        encryptionType?: string | undefined;
    }, {
        metadata: Record<string, unknown>;
        id: string;
        discoveredAt: Date;
        lastSeenAt: Date;
        sourceDeviceId: string;
        targetDeviceId: string;
        connectionType: ConnectionType;
        isSecure: boolean;
        port?: number | undefined;
        vlanId?: number | undefined;
        sourceInterface?: string | undefined;
        targetInterface?: string | undefined;
        protocol?: string | undefined;
        bandwidth?: number | undefined;
        latency?: number | undefined;
        encryptionType?: string | undefined;
    }>, "many">;
    zones: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        purdueLevel: z.ZodNativeEnum<typeof PurdueLevel>;
        securityZone: z.ZodNativeEnum<typeof SecurityZone>;
        description: z.ZodOptional<z.ZodString>;
        subnets: z.ZodArray<z.ZodString, "many">;
        firewallRules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            sourceZone: z.ZodString;
            destinationZone: z.ZodString;
            protocol: z.ZodString;
            port: z.ZodOptional<z.ZodNumber>;
            action: z.ZodEnum<["allow", "deny"]>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            protocol: string;
            sourceZone: string;
            destinationZone: string;
            action: "allow" | "deny";
            port?: number | undefined;
            description?: string | undefined;
        }, {
            id: string;
            protocol: string;
            sourceZone: string;
            destinationZone: string;
            action: "allow" | "deny";
            port?: number | undefined;
            description?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        subnets: string[];
        description?: string | undefined;
        firewallRules?: {
            id: string;
            protocol: string;
            sourceZone: string;
            destinationZone: string;
            action: "allow" | "deny";
            port?: number | undefined;
            description?: string | undefined;
        }[] | undefined;
    }, {
        name: string;
        id: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        subnets: string[];
        description?: string | undefined;
        firewallRules?: {
            id: string;
            protocol: string;
            sourceZone: string;
            destinationZone: string;
            action: "allow" | "deny";
            port?: number | undefined;
            description?: string | undefined;
        }[] | undefined;
    }>, "many">;
    metadata: z.ZodObject<{
        deviceCount: z.ZodNumber;
        connectionCount: z.ZodNumber;
        collectionDuration: z.ZodNumber;
        sources: z.ZodArray<z.ZodNativeEnum<typeof TelemetrySource>, "many">;
    }, "strip", z.ZodTypeAny, {
        deviceCount: number;
        connectionCount: number;
        collectionDuration: number;
        sources: TelemetrySource[];
    }, {
        deviceCount: number;
        connectionCount: number;
        collectionDuration: number;
        sources: TelemetrySource[];
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    metadata: {
        deviceCount: number;
        connectionCount: number;
        collectionDuration: number;
        sources: TelemetrySource[];
    };
    id: string;
    devices: {
        interfaces: {
            status: "unknown" | "up" | "down";
            name: string;
            macAddress: string;
            gateway?: string | undefined;
            ipAddress?: string | undefined;
            subnetMask?: string | undefined;
            vlanId?: number | undefined;
            speed?: number | undefined;
            duplex?: "full" | "half" | "auto" | undefined;
        }[];
        type: DeviceType;
        status: DeviceStatus;
        metadata: Record<string, unknown>;
        name: string;
        id: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        discoveredAt: Date;
        lastSeenAt: Date;
        createdAt: Date;
        updatedAt: Date;
        hostname?: string | undefined;
        vendor?: string | undefined;
        model?: string | undefined;
        firmwareVersion?: string | undefined;
        serialNumber?: string | undefined;
        location?: {
            site?: string | undefined;
            building?: string | undefined;
            floor?: string | undefined;
            room?: string | undefined;
            rack?: string | undefined;
            coordinates?: {
                latitude: number;
                longitude: number;
            } | undefined;
        } | undefined;
    }[];
    connections: {
        metadata: Record<string, unknown>;
        id: string;
        discoveredAt: Date;
        lastSeenAt: Date;
        sourceDeviceId: string;
        targetDeviceId: string;
        connectionType: ConnectionType;
        isSecure: boolean;
        port?: number | undefined;
        vlanId?: number | undefined;
        sourceInterface?: string | undefined;
        targetInterface?: string | undefined;
        protocol?: string | undefined;
        bandwidth?: number | undefined;
        latency?: number | undefined;
        encryptionType?: string | undefined;
    }[];
    zones: {
        name: string;
        id: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        subnets: string[];
        description?: string | undefined;
        firewallRules?: {
            id: string;
            protocol: string;
            sourceZone: string;
            destinationZone: string;
            action: "allow" | "deny";
            port?: number | undefined;
            description?: string | undefined;
        }[] | undefined;
    }[];
}, {
    timestamp: Date;
    metadata: {
        deviceCount: number;
        connectionCount: number;
        collectionDuration: number;
        sources: TelemetrySource[];
    };
    id: string;
    devices: {
        interfaces: {
            status: "unknown" | "up" | "down";
            name: string;
            macAddress: string;
            gateway?: string | undefined;
            ipAddress?: string | undefined;
            subnetMask?: string | undefined;
            vlanId?: number | undefined;
            speed?: number | undefined;
            duplex?: "full" | "half" | "auto" | undefined;
        }[];
        type: DeviceType;
        status: DeviceStatus;
        metadata: Record<string, unknown>;
        name: string;
        id: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        discoveredAt: Date;
        lastSeenAt: Date;
        createdAt: Date;
        updatedAt: Date;
        hostname?: string | undefined;
        vendor?: string | undefined;
        model?: string | undefined;
        firmwareVersion?: string | undefined;
        serialNumber?: string | undefined;
        location?: {
            site?: string | undefined;
            building?: string | undefined;
            floor?: string | undefined;
            room?: string | undefined;
            rack?: string | undefined;
            coordinates?: {
                latitude: number;
                longitude: number;
            } | undefined;
        } | undefined;
    }[];
    connections: {
        metadata: Record<string, unknown>;
        id: string;
        discoveredAt: Date;
        lastSeenAt: Date;
        sourceDeviceId: string;
        targetDeviceId: string;
        connectionType: ConnectionType;
        isSecure: boolean;
        port?: number | undefined;
        vlanId?: number | undefined;
        sourceInterface?: string | undefined;
        targetInterface?: string | undefined;
        protocol?: string | undefined;
        bandwidth?: number | undefined;
        latency?: number | undefined;
        encryptionType?: string | undefined;
    }[];
    zones: {
        name: string;
        id: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        subnets: string[];
        description?: string | undefined;
        firewallRules?: {
            id: string;
            protocol: string;
            sourceZone: string;
            destinationZone: string;
            action: "allow" | "deny";
            port?: number | undefined;
            description?: string | undefined;
        }[] | undefined;
    }[];
}>;
export declare const riskFactorSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodEnum<["vulnerability", "configuration", "exposure", "compliance"]>;
    score: z.ZodNumber;
    weight: z.ZodNumber;
    description: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    category: "compliance" | "configuration" | "vulnerability" | "exposure";
    score: number;
    weight: number;
    details?: Record<string, unknown> | undefined;
}, {
    name: string;
    description: string;
    category: "compliance" | "configuration" | "vulnerability" | "exposure";
    score: number;
    weight: number;
    details?: Record<string, unknown> | undefined;
}>;
export declare const riskAssessmentSchema: z.ZodObject<{
    deviceId: z.ZodString;
    overallScore: z.ZodNumber;
    factors: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        category: z.ZodEnum<["vulnerability", "configuration", "exposure", "compliance"]>;
        score: z.ZodNumber;
        weight: z.ZodNumber;
        description: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        category: "compliance" | "configuration" | "vulnerability" | "exposure";
        score: number;
        weight: number;
        details?: Record<string, unknown> | undefined;
    }, {
        name: string;
        description: string;
        category: "compliance" | "configuration" | "vulnerability" | "exposure";
        score: number;
        weight: number;
        details?: Record<string, unknown> | undefined;
    }>, "many">;
    recommendations: z.ZodArray<z.ZodString, "many">;
    lastAssessedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    overallScore: number;
    factors: {
        name: string;
        description: string;
        category: "compliance" | "configuration" | "vulnerability" | "exposure";
        score: number;
        weight: number;
        details?: Record<string, unknown> | undefined;
    }[];
    recommendations: string[];
    lastAssessedAt: Date;
}, {
    deviceId: string;
    overallScore: number;
    factors: {
        name: string;
        description: string;
        category: "compliance" | "configuration" | "vulnerability" | "exposure";
        score: number;
        weight: number;
        details?: Record<string, unknown> | undefined;
    }[];
    recommendations: string[];
    lastAssessedAt: Date;
}>;
export declare const snmpTargetSchema: z.ZodObject<{
    host: z.ZodString;
    port: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    version: z.ZodLiteral<3>;
    securityName: z.ZodString;
    securityLevel: z.ZodEnum<["noAuthNoPriv", "authNoPriv", "authPriv"]>;
    authProtocol: z.ZodOptional<z.ZodEnum<["MD5", "SHA", "SHA256", "SHA512"]>>;
    authKey: z.ZodOptional<z.ZodString>;
    privProtocol: z.ZodOptional<z.ZodEnum<["DES", "AES", "AES256"]>>;
    privKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    host: string;
    port: number;
    version: 3;
    securityName: string;
    securityLevel: "noAuthNoPriv" | "authNoPriv" | "authPriv";
    authProtocol?: "MD5" | "SHA" | "SHA256" | "SHA512" | undefined;
    privProtocol?: "DES" | "AES" | "AES256" | undefined;
    authKey?: string | undefined;
    privKey?: string | undefined;
}, {
    host: string;
    version: 3;
    securityName: string;
    securityLevel: "noAuthNoPriv" | "authNoPriv" | "authPriv";
    port?: number | undefined;
    authProtocol?: "MD5" | "SHA" | "SHA256" | "SHA512" | undefined;
    privProtocol?: "DES" | "AES" | "AES256" | undefined;
    authKey?: string | undefined;
    privKey?: string | undefined;
}>;
export declare const collectorConfigSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    pollInterval: z.ZodNumber;
    timeout: z.ZodNumber;
    retries: z.ZodNumber;
    batchSize: z.ZodNumber;
    maxConcurrent: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    pollInterval: number;
    timeout: number;
    retries: number;
    batchSize: number;
    maxConcurrent: number;
}, {
    enabled: boolean;
    pollInterval: number;
    timeout: number;
    retries: number;
    batchSize: number;
    maxConcurrent: number;
}>;
/**
 * Validate and parse data against a schema
 */
export declare function validate<T>(schema: z.ZodSchema<T>, data: unknown): T;
/**
 * Safely validate data and return result
 */
export declare function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    errors?: z.ZodError;
};
/**
 * Format validation errors for logging/display
 */
export declare function formatValidationErrors(errors: z.ZodError): string[];
export type ValidatedDevice = z.infer<typeof deviceSchema>;
export type ValidatedConnection = z.infer<typeof connectionSchema>;
export type ValidatedTelemetryData = z.infer<typeof telemetryDataSchema>;
export type ValidatedAlert = z.infer<typeof alertSchema>;
export type ValidatedZoneDefinition = z.infer<typeof zoneDefinitionSchema>;
export type ValidatedTopologySnapshot = z.infer<typeof topologySnapshotSchema>;
export type ValidatedRiskAssessment = z.infer<typeof riskAssessmentSchema>;
export type ValidatedSNMPTarget = z.infer<typeof snmpTargetSchema>;
//# sourceMappingURL=validators.d.ts.map