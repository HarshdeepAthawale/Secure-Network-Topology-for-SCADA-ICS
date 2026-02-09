/**
 * Device Repository - Database operations for devices
 */
import { BaseRepository, FindOptions, PaginatedResult } from './base.repository';
import { Device, DeviceType, DeviceStatus, PurdueLevel, SecurityZone, NetworkInterface } from '../../utils/types';
export interface CreateDeviceDTO {
    id?: string;
    name: string;
    hostname?: string;
    type: DeviceType;
    vendor?: string;
    model?: string;
    firmwareVersion?: string;
    serialNumber?: string;
    purdueLevel: PurdueLevel;
    securityZone: SecurityZone;
    status?: DeviceStatus;
    interfaces?: NetworkInterface[];
    location?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    discoveredAt: Date;
    lastSeenAt: Date;
}
export interface UpdateDeviceDTO {
    name?: string;
    hostname?: string;
    type?: DeviceType;
    vendor?: string;
    model?: string;
    firmwareVersion?: string;
    purdueLevel?: PurdueLevel;
    securityZone?: SecurityZone;
    status?: DeviceStatus;
    location?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    lastSeenAt?: Date;
}
export interface DeviceSearchCriteria {
    type?: DeviceType;
    purdueLevel?: PurdueLevel;
    securityZone?: SecurityZone;
    status?: DeviceStatus;
    vendor?: string;
    searchTerm?: string;
}
export declare class DeviceRepository extends BaseRepository<Device, CreateDeviceDTO, UpdateDeviceDTO> {
    constructor();
    /**
     * Convert database row to Device entity
     */
    private toEntity;
    /**
     * Convert create DTO to database columns
     */
    protected processCreateData(data: CreateDeviceDTO): Record<string, unknown>;
    /**
     * Convert update DTO to database columns
     */
    protected processUpdateData(data: UpdateDeviceDTO): Record<string, unknown>;
    /**
     * Find device by ID with interfaces
     */
    findByIdWithInterfaces(id: string): Promise<Device | null>;
    /**
     * Override findById to convert DB row to entity
     */
    findById(id: string): Promise<Device | null>;
    /**
     * Override findAll to convert DB rows to entities
     */
    findAll(options?: FindOptions): Promise<Device[]>;
    /**
     * Override create to convert database row to entity
     */
    create(data: CreateDeviceDTO): Promise<Device>;
    /**
     * Search devices with multiple criteria
     */
    search(criteria: DeviceSearchCriteria, page?: number, limit?: number): Promise<PaginatedResult<Device>>;
    /**
     * Find devices by Purdue level
     */
    findByPurdueLevel(level: PurdueLevel): Promise<Device[]>;
    /**
     * Find devices by security zone
     */
    findBySecurityZone(zone: SecurityZone): Promise<Device[]>;
    /**
     * Find devices by MAC address (via interfaces)
     */
    findByMacAddress(macAddress: string): Promise<Device | null>;
    /**
     * Find devices by IP address (via interfaces)
     */
    findByIpAddress(ipAddress: string): Promise<Device | null>;
    /**
     * Update last seen timestamp
     */
    updateLastSeen(id: string): Promise<void>;
    /**
     * Get device count by Purdue level
     */
    countByPurdueLevel(): Promise<Record<number, number>>;
    /**
     * Get device count by status
     */
    countByStatus(): Promise<Record<string, number>>;
    /**
     * Get recently discovered devices
     */
    findRecentlyDiscovered(hours?: number, limit?: number): Promise<Device[]>;
    /**
     * Get offline devices (not seen in specified hours)
     */
    findOfflineDevices(hours?: number): Promise<Device[]>;
    /**
     * Upsert device by unique identifier (MAC or hostname)
     */
    upsertByIdentifier(data: CreateDeviceDTO, identifier: 'hostname' | 'serialNumber'): Promise<Device>;
}
export declare function getDeviceRepository(): DeviceRepository;
//# sourceMappingURL=device.repository.d.ts.map