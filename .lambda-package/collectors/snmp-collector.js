"use strict";
/**
 * SNMPv3 Collector - Secure device discovery and monitoring
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SNMPCollector = void 0;
exports.createSNMPCollector = createSNMPCollector;
const snmp = __importStar(require("net-snmp"));
const base_collector_1 = require("./base-collector");
const types_1 = require("../utils/types");
const constants_1 = require("../utils/constants");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../utils/error-handler");
const config_1 = require("../utils/config");
// ============================================================================
// SNMP Collector Class
// ============================================================================
class SNMPCollector extends base_collector_1.BaseCollector {
    sessions = new Map();
    constructor(snmpConfig) {
        const collectorConfig = {
            ...config_1.config.snmp,
            ...snmpConfig,
        };
        super('SNMPv3Collector', types_1.TelemetrySource.SNMP, collectorConfig);
    }
    // ============================================================================
    // Lifecycle Implementation
    // ============================================================================
    async initialize() {
        logger_1.logger.info('Initializing SNMPv3 collector');
        // Sessions are created on-demand for each target
    }
    async cleanup() {
        logger_1.logger.info('Cleaning up SNMPv3 collector');
        // Close all sessions
        for (const [targetId, session] of this.sessions) {
            try {
                session.close();
                logger_1.logger.debug(`Closed SNMP session for target ${targetId}`);
            }
            catch (error) {
                logger_1.logger.error(`Error closing SNMP session`, {
                    targetId,
                    error: error.message,
                });
            }
        }
        this.sessions.clear();
    }
    // ============================================================================
    // Collection Implementation
    // ============================================================================
    async collect(target) {
        const snmpTarget = target;
        const telemetryData = [];
        try {
            // Create or get session
            const session = await this.getSession(snmpTarget);
            // Collect system information
            const deviceInfo = await this.getSystemInfo(session);
            telemetryData.push(this.createTelemetryData({ type: 'system', ...deviceInfo }, undefined, JSON.stringify(deviceInfo)));
            // Collect interface information
            const interfaces = await this.getInterfaces(session);
            telemetryData.push(this.createTelemetryData({ type: 'interfaces', interfaces }, undefined));
            // Collect LLDP neighbors
            const neighbors = await this.getLLDPNeighbors(session);
            if (neighbors.length > 0) {
                telemetryData.push(this.createTelemetryData({ type: 'neighbors', neighbors }, undefined));
            }
            // Collect ARP table
            const arpTable = await this.getARPTable(session);
            if (arpTable.length > 0) {
                telemetryData.push(this.createTelemetryData({ type: 'arp', entries: arpTable }, undefined));
            }
            logger_1.logger.debug(`SNMP collection completed for ${snmpTarget.host}`, {
                dataPoints: telemetryData.length,
            });
        }
        catch (error) {
            throw new error_handler_1.SNMPError(`Failed to collect from ${snmpTarget.host}: ${error.message}`, snmpTarget.host);
        }
        return telemetryData;
    }
    // ============================================================================
    // Session Management
    // ============================================================================
    async getSession(target) {
        // Check for existing session
        const existingSession = this.sessions.get(target.id);
        if (existingSession) {
            return existingSession;
        }
        // Create new session
        const session = await this.createSession(target);
        this.sessions.set(target.id, session);
        return session;
    }
    async createSession(target) {
        return new Promise((resolve, reject) => {
            try {
                const user = {
                    name: target.securityName,
                    level: target.securityLevel,
                };
                if (target.authProtocol && target.authKey) {
                    user.authProtocol = target.authProtocol;
                    user.authKey = target.authKey;
                }
                if (target.privProtocol && target.privKey) {
                    user.privProtocol = target.privProtocol;
                    user.privKey = target.privKey;
                }
                const options = {
                    port: target.port || 161,
                    timeout: this.config.timeout,
                    retries: this.config.retries,
                    version: snmp.Version3,
                };
                const session = snmp.createV3Session(target.host, user, options);
                session.on('error', (err) => {
                    logger_1.logger.error(`SNMP session error for ${target.host}`, {
                        error: err.message,
                    });
                });
                logger_1.logger.debug(`Created SNMP session for ${target.host}`);
                resolve(session);
            }
            catch (error) {
                reject(new error_handler_1.SNMPError(`Failed to create session: ${error.message}`, target.host));
            }
        });
    }
    // ============================================================================
    // SNMP Operations
    // ============================================================================
    /**
     * Get system information from device
     */
    async getSystemInfo(session) {
        const oids = [
            constants_1.SNMP_OIDS.sysDescr,
            constants_1.SNMP_OIDS.sysObjectID,
            constants_1.SNMP_OIDS.sysUpTime,
            constants_1.SNMP_OIDS.sysContact,
            constants_1.SNMP_OIDS.sysName,
            constants_1.SNMP_OIDS.sysLocation,
        ];
        const varbinds = await this.get(session, oids);
        return {
            sysDescr: this.extractString(varbinds, constants_1.SNMP_OIDS.sysDescr),
            sysObjectID: this.extractString(varbinds, constants_1.SNMP_OIDS.sysObjectID),
            sysUpTime: this.extractNumber(varbinds, constants_1.SNMP_OIDS.sysUpTime),
            sysContact: this.extractString(varbinds, constants_1.SNMP_OIDS.sysContact),
            sysName: this.extractString(varbinds, constants_1.SNMP_OIDS.sysName),
            sysLocation: this.extractString(varbinds, constants_1.SNMP_OIDS.sysLocation),
        };
    }
    /**
     * Get interface information
     */
    async getInterfaces(session) {
        const interfaces = [];
        try {
            // Walk the interface table
            const ifTableResults = await this.walk(session, constants_1.SNMP_OIDS.ifTable);
            // Group by interface index
            const ifData = new Map();
            for (const varbind of ifTableResults) {
                const oidParts = varbind.oid.split('.');
                const ifIndex = parseInt(oidParts[oidParts.length - 1], 10);
                const subOid = oidParts.slice(0, -1).join('.');
                if (!ifData.has(ifIndex)) {
                    ifData.set(ifIndex, { index: ifIndex });
                }
                const iface = ifData.get(ifIndex);
                const value = varbind.value;
                if (value === null)
                    continue;
                switch (subOid) {
                    case constants_1.SNMP_OIDS.ifDescr:
                        iface.name = value.toString();
                        break;
                    case constants_1.SNMP_OIDS.ifType:
                        iface.type = parseInt(value.toString(), 10);
                        break;
                    case constants_1.SNMP_OIDS.ifSpeed:
                        iface.speed = parseInt(value.toString(), 10);
                        break;
                    case constants_1.SNMP_OIDS.ifPhysAddress:
                        iface.physAddress = this.formatMacAddress(value);
                        break;
                    case constants_1.SNMP_OIDS.ifAdminStatus:
                        iface.adminStatus = parseInt(value.toString(), 10);
                        break;
                    case constants_1.SNMP_OIDS.ifOperStatus:
                        iface.operStatus = parseInt(value.toString(), 10);
                        break;
                    case constants_1.SNMP_OIDS.ifInOctets:
                        iface.inOctets = parseInt(value.toString(), 10);
                        break;
                    case constants_1.SNMP_OIDS.ifOutOctets:
                        iface.outOctets = parseInt(value.toString(), 10);
                        break;
                }
            }
            // Convert to array
            for (const iface of ifData.values()) {
                if (iface.index !== undefined && iface.name) {
                    interfaces.push({
                        index: iface.index,
                        name: iface.name,
                        description: iface.description,
                        type: iface.type || 0,
                        speed: iface.speed || 0,
                        physAddress: iface.physAddress || '',
                        adminStatus: iface.adminStatus || 0,
                        operStatus: iface.operStatus || 0,
                        inOctets: iface.inOctets || 0,
                        outOctets: iface.outOctets || 0,
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to get interface table', {
                error: error.message,
            });
        }
        return interfaces;
    }
    /**
     * Get LLDP neighbor information
     */
    async getLLDPNeighbors(session) {
        const neighbors = [];
        try {
            const lldpResults = await this.walk(session, constants_1.SNMP_OIDS.lldpRemTable);
            // Group by neighbor index
            const neighborData = new Map();
            for (const varbind of lldpResults) {
                const oidParts = varbind.oid.split('.');
                const neighborKey = oidParts.slice(-3).join('-');
                const subOid = oidParts.slice(0, -3).join('.');
                if (!neighborData.has(neighborKey)) {
                    neighborData.set(neighborKey, { protocol: 'lldp' });
                }
                const neighbor = neighborData.get(neighborKey);
                const value = varbind.value;
                if (value === null)
                    continue;
                switch (subOid) {
                    case constants_1.SNMP_OIDS.lldpRemChassisId:
                        neighbor.remoteDeviceId = value.toString();
                        break;
                    case constants_1.SNMP_OIDS.lldpRemPortId:
                        neighbor.remoteInterface = value.toString();
                        break;
                    case constants_1.SNMP_OIDS.lldpRemSysName:
                        neighbor.remoteDeviceId = value.toString();
                        break;
                }
            }
            for (const neighbor of neighborData.values()) {
                if (neighbor.remoteDeviceId) {
                    neighbors.push({
                        localInterface: neighbor.localInterface || 'unknown',
                        remoteDeviceId: neighbor.remoteDeviceId,
                        remoteInterface: neighbor.remoteInterface,
                        protocol: 'lldp',
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.debug('LLDP not available or failed', {
                error: error.message,
            });
        }
        return neighbors;
    }
    /**
     * Get ARP table
     */
    async getARPTable(session) {
        const arpEntries = [];
        try {
            const arpResults = await this.walk(session, constants_1.SNMP_OIDS.ipNetToMediaTable);
            for (const varbind of arpResults) {
                // Parse ARP entry
                const oidParts = varbind.oid.split('.');
                const value = varbind.value;
                if (value === null)
                    continue;
                // OID format: .1.3.6.1.2.1.4.22.1.<type>.<ifIndex>.<ip>
                if (oidParts.length >= 4) {
                    const ip = oidParts.slice(-4).join('.');
                    const mac = this.formatMacAddress(value);
                    if (this.isValidIP(ip) && mac) {
                        arpEntries.push({ ip, mac });
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.debug('ARP table walk failed', {
                error: error.message,
            });
        }
        return arpEntries;
    }
    // ============================================================================
    // SNMP Helper Methods
    // ============================================================================
    get(session, oids) {
        return new Promise((resolve, reject) => {
            session.get(oids, (error, varbinds) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(varbinds);
                }
            });
        });
    }
    walk(session, oid) {
        return new Promise((resolve, reject) => {
            const results = [];
            session.walk(oid, this.config.batchSize, (varbinds) => {
                for (const varbind of varbinds) {
                    if (!snmp.isVarbindError(varbind)) {
                        results.push(varbind);
                    }
                }
            }, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });
    }
    extractString(varbinds, oid) {
        const varbind = varbinds.find(v => v.oid === oid);
        return varbind && varbind.value !== null ? varbind.value.toString() : '';
    }
    extractNumber(varbinds, oid) {
        const varbind = varbinds.find(v => v.oid === oid);
        return varbind && varbind.value !== null ? parseInt(varbind.value.toString(), 10) : 0;
    }
    formatMacAddress(value) {
        if (Buffer.isBuffer(value)) {
            return Array.from(value)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(':');
        }
        return this.normalizeMacAddress(value.toString());
    }
    isValidIP(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4)
            return false;
        return parts.every(part => {
            const num = parseInt(part, 10);
            return !isNaN(num) && num >= 0 && num <= 255;
        });
    }
    // ============================================================================
    // Target Management Override
    // ============================================================================
    /**
     * Add an SNMPv3 target
     */
    addSNMPTarget(host, securityName, options = {}) {
        const target = {
            host,
            port: options.port || 161,
            enabled: true,
            version: 3,
            securityName,
            securityLevel: options.securityLevel || snmp.SecurityLevel.authPriv,
            authProtocol: options.authProtocol,
            authKey: options.authKey,
            privProtocol: options.privProtocol,
            privKey: options.privKey,
        };
        return this.addTarget(target);
    }
}
exports.SNMPCollector = SNMPCollector;
// ============================================================================
// Export
// ============================================================================
function createSNMPCollector(config) {
    return new SNMPCollector(config);
}
//# sourceMappingURL=snmp-collector.js.map