"use strict";
/**
 * Device Repository - Database operations for devices
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceRepository = void 0;
exports.getDeviceRepository = getDeviceRepository;
const base_repository_1 = require("./base.repository");
const types_1 = require("../../utils/types");
const uuid_1 = require("uuid");
// ============================================================================
// Device Repository Class
// ============================================================================
class DeviceRepository extends base_repository_1.BaseRepository {
    constructor() {
        super('devices');
    }
    /**
     * Convert database row to Device entity
     */
    toEntity(row) {
        return {
            id: row.id,
            name: row.name,
            hostname: row.hostname || undefined,
            type: row.type,
            vendor: row.vendor || undefined,
            model: row.model || undefined,
            firmwareVersion: row.firmware_version || undefined,
            serialNumber: row.serial_number || undefined,
            purdueLevel: parseInt(row.purdue_level),
            securityZone: row.security_zone,
            status: row.status,
            interfaces: [], // Loaded separately
            location: row.location || undefined,
            metadata: row.metadata || {},
            discoveredAt: new Date(row.discovered_at),
            lastSeenAt: new Date(row.last_seen_at),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
    /**
     * Convert create DTO to database columns
     */
    processCreateData(data) {
        return {
            id: data.id || (0, uuid_1.v4)(),
            name: data.name,
            hostname: data.hostname,
            type: data.type,
            vendor: data.vendor,
            model: data.model,
            firmware_version: data.firmwareVersion,
            serial_number: data.serialNumber,
            purdue_level: data.purdueLevel.toString(),
            security_zone: data.securityZone,
            status: data.status || types_1.DeviceStatus.UNKNOWN,
            location: data.location ? JSON.stringify(data.location) : null,
            metadata: JSON.stringify(data.metadata || {}),
            discovered_at: data.discoveredAt,
            last_seen_at: data.lastSeenAt,
        };
    }
    /**
     * Convert update DTO to database columns
     */
    processUpdateData(data) {
        const result = {};
        if (data.name !== undefined)
            result.name = data.name;
        if (data.hostname !== undefined)
            result.hostname = data.hostname;
        if (data.type !== undefined)
            result.type = data.type;
        if (data.vendor !== undefined)
            result.vendor = data.vendor;
        if (data.model !== undefined)
            result.model = data.model;
        if (data.firmwareVersion !== undefined)
            result.firmware_version = data.firmwareVersion;
        if (data.purdueLevel !== undefined)
            result.purdue_level = data.purdueLevel.toString();
        if (data.securityZone !== undefined)
            result.security_zone = data.securityZone;
        if (data.status !== undefined)
            result.status = data.status;
        if (data.location !== undefined)
            result.location = JSON.stringify(data.location);
        if (data.metadata !== undefined)
            result.metadata = JSON.stringify(data.metadata);
        if (data.lastSeenAt !== undefined)
            result.last_seen_at = data.lastSeenAt;
        return result;
    }
    /**
     * Find device by ID with interfaces
     */
    async findByIdWithInterfaces(id) {
        const device = await this.findById(id);
        if (!device)
            return null;
        // Load interfaces
        const interfaces = await this.rawQuery(`SELECT * FROM network_interfaces WHERE device_id = $1`, [id]);
        return {
            ...device,
            interfaces,
        };
    }
    /**
     * Override findById to convert DB row to entity
     */
    async findById(id) {
        const row = await this.db.queryOne(`SELECT * FROM ${this.tableName} WHERE id = $1`, [id]);
        return row ? this.toEntity(row) : null;
    }
    /**
     * Override findAll to convert DB rows to entities
     */
    async findAll(options = {}) {
        const rows = await super.findAll(options);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Override create to convert database row to entity
     */
    async create(data) {
        const processedData = this.processCreateData(data);
        const row = await this.db.insert(this.tableName, processedData);
        return this.toEntity(row);
    }
    /**
     * Search devices with multiple criteria
     */
    async search(criteria, page = 1, limit = 50) {
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        if (criteria.type) {
            conditions.push(`type = $${paramIndex++}`);
            params.push(criteria.type);
        }
        if (criteria.purdueLevel !== undefined) {
            conditions.push(`purdue_level = $${paramIndex++}`);
            params.push(criteria.purdueLevel.toString());
        }
        if (criteria.securityZone) {
            conditions.push(`security_zone = $${paramIndex++}`);
            params.push(criteria.securityZone);
        }
        if (criteria.status) {
            conditions.push(`status = $${paramIndex++}`);
            params.push(criteria.status);
        }
        if (criteria.vendor) {
            conditions.push(`vendor ILIKE $${paramIndex++}`);
            params.push(`%${criteria.vendor}%`);
        }
        if (criteria.searchTerm) {
            conditions.push(`(name ILIKE $${paramIndex} OR hostname ILIKE $${paramIndex})`);
            params.push(`%${criteria.searchTerm}%`);
            paramIndex++;
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (page - 1) * limit;
        // Count total
        const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
        const total = await this.db.queryCount(countSql, params);
        // Get data
        const dataSql = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ORDER BY last_seen_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
        const rows = await this.db.query(dataSql, params);
        const totalPages = Math.ceil(total / limit);
        return {
            data: rows.map(row => this.toEntity(row)),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1,
            },
        };
    }
    /**
     * Find devices by Purdue level
     */
    async findByPurdueLevel(level) {
        const rows = await this.db.query(`SELECT * FROM ${this.tableName} WHERE purdue_level = $1 ORDER BY name`, [level.toString()]);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Find devices by security zone
     */
    async findBySecurityZone(zone) {
        const rows = await this.db.query(`SELECT * FROM ${this.tableName} WHERE security_zone = $1 ORDER BY name`, [zone]);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Find devices by MAC address (via interfaces)
     */
    async findByMacAddress(macAddress) {
        const row = await this.db.queryOne(`
      SELECT d.* FROM ${this.tableName} d
      INNER JOIN network_interfaces i ON i.device_id = d.id
      WHERE i.mac_address = $1
      LIMIT 1
    `, [macAddress.toLowerCase()]);
        return row ? this.toEntity(row) : null;
    }
    /**
     * Find devices by IP address (via interfaces)
     */
    async findByIpAddress(ipAddress) {
        const row = await this.db.queryOne(`
      SELECT d.* FROM ${this.tableName} d
      INNER JOIN network_interfaces i ON i.device_id = d.id
      WHERE i.ip_address = $1
      LIMIT 1
    `, [ipAddress]);
        return row ? this.toEntity(row) : null;
    }
    /**
     * Update last seen timestamp
     */
    async updateLastSeen(id) {
        await this.db.query(`UPDATE ${this.tableName} SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    }
    /**
     * Get device count by Purdue level
     */
    async countByPurdueLevel() {
        const rows = await this.db.query(`
      SELECT purdue_level, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY purdue_level
    `);
        const result = {};
        rows.forEach(row => {
            result[parseInt(row.purdue_level)] = parseInt(row.count);
        });
        return result;
    }
    /**
     * Get device count by status
     */
    async countByStatus() {
        const rows = await this.db.query(`
      SELECT status, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY status
    `);
        const result = {};
        rows.forEach(row => {
            result[row.status] = parseInt(row.count);
        });
        return result;
    }
    /**
     * Get recently discovered devices
     */
    async findRecentlyDiscovered(hours = 24, limit = 50) {
        const rows = await this.db.query(`
      SELECT * FROM ${this.tableName}
      WHERE discovered_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY discovered_at DESC
      LIMIT ${limit}
    `);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Get offline devices (not seen in specified hours)
     */
    async findOfflineDevices(hours = 24) {
        const rows = await this.db.query(`
      SELECT * FROM ${this.tableName}
      WHERE last_seen_at < NOW() - INTERVAL '${hours} hours'
      ORDER BY last_seen_at DESC
    `);
        return rows.map(row => this.toEntity(row));
    }
    /**
     * Upsert device by unique identifier (MAC or hostname)
     */
    async upsertByIdentifier(data, identifier) {
        const conflictColumn = identifier === 'hostname' ? 'hostname' : 'serial_number';
        const processedData = this.processCreateData(data);
        const row = await this.db.upsert(this.tableName, processedData, [conflictColumn]);
        return this.toEntity(row);
    }
}
exports.DeviceRepository = DeviceRepository;
// ============================================================================
// Singleton Instance
// ============================================================================
let deviceRepositoryInstance = null;
function getDeviceRepository() {
    if (!deviceRepositoryInstance) {
        deviceRepositoryInstance = new DeviceRepository();
    }
    return deviceRepositoryInstance;
}
//# sourceMappingURL=device.repository.js.map