/**
 * Device Service - Business logic for device management
 */

import { Device, DeviceType, DeviceStatus, PurdueLevel, SecurityZone, NetworkInterface } from '../../utils/types';
import { DeviceRepository, CreateDeviceDTO, UpdateDeviceDTO, getDeviceRepository } from '../repositories/device.repository';
import { ConnectionRepository, getConnectionRepository } from '../repositories/connection.repository';
import { AlertRepository, getAlertRepository } from '../repositories/alert.repository';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Device Service Class
// ============================================================================

export class DeviceService {
    private deviceRepo: DeviceRepository;
    private connectionRepo: ConnectionRepository;
    private alertRepo: AlertRepository;

    constructor() {
        this.deviceRepo = getDeviceRepository();
        this.connectionRepo = getConnectionRepository();
        this.alertRepo = getAlertRepository();
    }

    /**
     * Get device by ID with full relations
     */
    async getDeviceById(id: string): Promise<DeviceWithRelations | null> {
        const device = await this.deviceRepo.findByIdWithInterfaces(id);
        if (!device) return null;

        // Get connection counts
        const connections = await this.connectionRepo.findByDeviceId(id);
        const incoming = connections.filter(c => c.targetDeviceId === id).length;
        const outgoing = connections.filter(c => c.sourceDeviceId === id).length;

        // Get active alert count
        const alerts = await this.alertRepo.findByDeviceId(id);
        const activeAlerts = alerts.filter(a => !a.resolved).length;

        return {
            ...device,
            connections: { incoming, outgoing },
            activeAlerts,
        };
    }

    /**
     * Get device by MAC address
     */
    async getDeviceByMac(macAddress: string): Promise<Device | null> {
        return this.deviceRepo.findByMacAddress(macAddress);
    }

    /**
     * Get device by IP address
     */
    async getDeviceByIp(ipAddress: string): Promise<Device | null> {
        return this.deviceRepo.findByIpAddress(ipAddress);
    }

    /**
     * Create or update device from discovery
     */
    async processDiscoveredDevice(data: {
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
    }): Promise<DeviceDiscoveryResult> {
        const now = new Date();
        let existingDevice: Device | null = null;
        const changes: string[] = [];

        // Try to find existing device by various identifiers
        if (data.macAddress) {
            existingDevice = await this.deviceRepo.findByMacAddress(data.macAddress);
        }
        if (!existingDevice && data.ipAddress) {
            existingDevice = await this.deviceRepo.findByIpAddress(data.ipAddress);
        }
        if (!existingDevice && data.hostname) {
            existingDevice = await this.deviceRepo.findOne({ hostname: data.hostname });
        }

        if (existingDevice) {
            // Update existing device
            const updates: UpdateDeviceDTO = {
                lastSeenAt: now,
                status: DeviceStatus.ONLINE,
            };

            // Track changes
            if (data.vendor && data.vendor !== existingDevice.vendor) {
                updates.vendor = data.vendor;
                changes.push(`vendor: ${existingDevice.vendor} -> ${data.vendor}`);
            }
            if (data.model && data.model !== existingDevice.model) {
                updates.model = data.model;
                changes.push(`model: ${existingDevice.model} -> ${data.model}`);
            }
            if (data.firmwareVersion && data.firmwareVersion !== existingDevice.firmwareVersion) {
                updates.firmwareVersion = data.firmwareVersion;
                changes.push(`firmware: ${existingDevice.firmwareVersion} -> ${data.firmwareVersion}`);
            }
            if (data.purdueLevel !== existingDevice.purdueLevel) {
                updates.purdueLevel = data.purdueLevel;
                changes.push(`purdueLevel: ${existingDevice.purdueLevel} -> ${data.purdueLevel}`);
            }

            const updatedDevice = await this.deviceRepo.update(existingDevice.id, updates);

            return {
                device: updatedDevice || existingDevice,
                isNew: false,
                changes: changes.length > 0 ? changes : undefined,
            };
        }

        // Create new device
        const createData: CreateDeviceDTO = {
            id: generateUUID(),
            name: data.name,
            hostname: data.hostname,
            type: data.type,
            vendor: data.vendor,
            model: data.model,
            firmwareVersion: data.firmwareVersion,
            serialNumber: data.serialNumber,
            purdueLevel: data.purdueLevel,
            securityZone: data.securityZone,
            status: DeviceStatus.ONLINE,
            metadata: data.metadata,
            discoveredAt: now,
            lastSeenAt: now,
        };

        const newDevice = await this.deviceRepo.create(createData);

        logger.info('New device discovered', {
            id: newDevice.id,
            name: newDevice.name,
            type: newDevice.type,
            purdueLevel: newDevice.purdueLevel,
        });

        return {
            device: newDevice,
            isNew: true,
        };
    }

    /**
     * Update device status based on last seen time
     */
    async updateDeviceStatuses(offlineThresholdHours = 24): Promise<{ updated: number; offline: number }> {
        const offlineDevices = await this.deviceRepo.findOfflineDevices(offlineThresholdHours);
        let updated = 0;
        let offline = 0;

        for (const device of offlineDevices) {
            if (device.status !== DeviceStatus.OFFLINE) {
                await this.deviceRepo.update(device.id, { status: DeviceStatus.OFFLINE });
                updated++;
                offline++;

                logger.info('Device marked offline', {
                    id: device.id,
                    name: device.name,
                    lastSeen: device.lastSeenAt,
                });
            }
        }

        return { updated, offline };
    }

    /**
     * Get device statistics
     */
    async getStatistics(): Promise<DeviceStatistics> {
        const [total, byStatus, byPurdueLevel, recentDevices, offlineDevices] = await Promise.all([
            this.deviceRepo.count(),
            this.deviceRepo.countByStatus(),
            this.deviceRepo.countByPurdueLevel(),
            this.deviceRepo.findRecentlyDiscovered(24),
            this.deviceRepo.findOfflineDevices(24),
        ]);

        // Calculate by type and zone from all devices
        const allDevices = await this.deviceRepo.findAll({ limit: 10000 });
        const byType: Record<string, number> = {};
        const bySecurityZone: Record<string, number> = {};

        for (const device of allDevices) {
            byType[device.type] = (byType[device.type] || 0) + 1;
            bySecurityZone[device.securityZone] = (bySecurityZone[device.securityZone] || 0) + 1;
        }

        return {
            total,
            byStatus,
            byPurdueLevel,
            byType,
            bySecurityZone,
            recentlyDiscovered: recentDevices.length,
            offline: offlineDevices.length,
        };
    }

    /**
     * Get devices by Purdue level
     */
    async getDevicesByPurdueLevel(level: PurdueLevel): Promise<Device[]> {
        return this.deviceRepo.findByPurdueLevel(level);
    }

    /**
     * Get devices by security zone
     */
    async getDevicesBySecurityZone(zone: SecurityZone): Promise<Device[]> {
        return this.deviceRepo.findBySecurityZone(zone);
    }

    /**
     * Search devices
     */
    async searchDevices(criteria: {
        type?: DeviceType;
        purdueLevel?: PurdueLevel;
        securityZone?: SecurityZone;
        status?: DeviceStatus;
        vendor?: string;
        searchTerm?: string;
    }, page = 1, limit = 50) {
        return this.deviceRepo.search(criteria, page, limit);
    }

    /**
     * Get recently discovered devices
     */
    async getRecentlyDiscovered(hours = 24, limit = 50): Promise<Device[]> {
        return this.deviceRepo.findRecentlyDiscovered(hours, limit);
    }

    /**
     * Get offline devices
     */
    async getOfflineDevices(hours = 24): Promise<Device[]> {
        return this.deviceRepo.findOfflineDevices(hours);
    }

    /**
     * Delete device and related data
     */
    async deleteDevice(id: string): Promise<boolean> {
        // Delete related connections
        await this.connectionRepo.deleteMany({ source_device_id: id });
        await this.connectionRepo.deleteMany({ target_device_id: id });

        // Delete related alerts
        await this.alertRepo.deleteMany({ device_id: id });

        // Delete device
        const deleted = await this.deviceRepo.delete(id);

        if (deleted) {
            logger.info('Device deleted', { id });
        }

        return deleted;
    }

    /**
     * Mark device as seen (update last seen timestamp)
     */
    async markDeviceSeen(id: string): Promise<void> {
        await this.deviceRepo.updateLastSeen(id);
        await this.deviceRepo.update(id, { status: DeviceStatus.ONLINE });
    }

    /**
     * Get device network graph data
     */
    async getNetworkGraphData(): Promise<{
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
    }> {
        const devices = await this.deviceRepo.findAll({ limit: 10000 });
        const edges = await this.connectionRepo.getTopologyEdges();

        const nodes = devices.map(device => ({
            id: device.id,
            label: device.name,
            type: device.type,
            purdueLevel: device.purdueLevel,
            zone: device.securityZone,
            status: device.status,
        }));

        return { nodes, edges };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let deviceServiceInstance: DeviceService | null = null;

export function getDeviceService(): DeviceService {
    if (!deviceServiceInstance) {
        deviceServiceInstance = new DeviceService();
    }
    return deviceServiceInstance;
}
