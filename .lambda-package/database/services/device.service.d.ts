/**
 * Device Service - Business logic for device management
 */
import { Device, DeviceType, DeviceStatus, PurdueLevel, SecurityZone } from '../../utils/types';
export interface DeviceWithRelations extends Device {
    connections: {
        incoming: number;
        outgoing: number;
    };
    activeAlerts: number;
    riskScore?: number;
}
export interface DeviceStatistics {
    total: number;
    byStatus: Record<string, number>;
    byPurdueLevel: Record<number, number>;
    byType: Record<string, number>;
    bySecurityZone: Record<string, number>;
    recentlyDiscovered: number;
    offline: number;
}
export interface DeviceDiscoveryResult {
    device: Device;
    isNew: boolean;
    changes?: string[];
}
export declare class DeviceService {
    private deviceRepo;
    private connectionRepo;
    private alertRepo;
    constructor();
    /**
     * Get device by ID with full relations
     */
    getDeviceById(id: string): Promise<DeviceWithRelations | null>;
    /**
     * Get device by MAC address
     */
    getDeviceByMac(macAddress: string): Promise<Device | null>;
    /**
     * Get device by IP address
     */
    getDeviceByIp(ipAddress: string): Promise<Device | null>;
    /**
     * Create or update device from discovery
     */
    processDiscoveredDevice(data: {
        name: string;
        hostname?: string;
        type: DeviceType;
        vendor?: string;
        model?: string;
        firmwareVersion?: string;
        serialNumber?: string;
        macAddress?: string;
        ipAddress?: string;
        purdueLevel: PurdueLevel;
        securityZone: SecurityZone;
        metadata?: Record<string, unknown>;
    }): Promise<DeviceDiscoveryResult>;
    /**
     * Update device status based on last seen time
     */
    updateDeviceStatuses(offlineThresholdHours?: number): Promise<{
        updated: number;
        offline: number;
    }>;
    /**
     * Get device statistics
     */
    getStatistics(): Promise<DeviceStatistics>;
    /**
     * Get devices by Purdue level
     */
    getDevicesByPurdueLevel(level: PurdueLevel): Promise<Device[]>;
    /**
     * Get devices by security zone
     */
    getDevicesBySecurityZone(zone: SecurityZone): Promise<Device[]>;
    /**
     * Search devices
     */
    searchDevices(criteria: {
        type?: DeviceType;
        purdueLevel?: PurdueLevel;
        securityZone?: SecurityZone;
        status?: DeviceStatus;
        vendor?: string;
        searchTerm?: string;
    }, page?: number, limit?: number): Promise<import("..").PaginatedResult<Device>>;
    /**
     * Get recently discovered devices
     */
    getRecentlyDiscovered(hours?: number, limit?: number): Promise<Device[]>;
    /**
     * Get offline devices
     */
    getOfflineDevices(hours?: number): Promise<Device[]>;
    /**
     * Delete device and related data
     */
    deleteDevice(id: string): Promise<boolean>;
    /**
     * Mark device as seen (update last seen timestamp)
     */
    markDeviceSeen(id: string): Promise<void>;
    /**
     * Get device network graph data
     */
    getNetworkGraphData(): Promise<{
        nodes: Array<{
            id: string;
            label: string;
            type: string;
            purdueLevel: number;
            zone: string;
            status: string;
        }>;
        edges: Array<{
            source: string;
            target: string;
            type: string;
            isSecure: boolean;
        }>;
    }>;
}
export declare function getDeviceService(): DeviceService;
//# sourceMappingURL=device.service.d.ts.map