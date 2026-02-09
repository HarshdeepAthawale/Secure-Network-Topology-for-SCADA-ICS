"use strict";
/**
 * ARP/MAC Table Collector - Layer 2 connectivity discovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARPCollector = void 0;
exports.createARPCollector = createARPCollector;
const base_collector_1 = require("./base-collector");
const types_1 = require("../utils/types");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../utils/error-handler");
const config_1 = require("../utils/config");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// ============================================================================
// ARP Collector Class
// ============================================================================
class ARPCollector extends base_collector_1.BaseCollector {
    constructor(collectorConfig) {
        const mergedConfig = {
            ...config_1.config.collector,
            ...collectorConfig,
        };
        super('ARPCollector', types_1.TelemetrySource.ARP, mergedConfig);
    }
    // ============================================================================
    // Lifecycle Implementation
    // ============================================================================
    async initialize() {
        logger_1.logger.info('Initializing ARP/MAC collector');
        // No persistent connections needed
    }
    async cleanup() {
        logger_1.logger.info('Cleaning up ARP/MAC collector');
        // No cleanup needed
    }
    // ============================================================================
    // Collection Implementation
    // ============================================================================
    async collect(target) {
        const arpTarget = target;
        const telemetryData = [];
        try {
            // Collect ARP entries
            if (arpTarget.collectType === 'arp' || arpTarget.collectType === 'both') {
                const arpEntries = await this.collectARPTable(arpTarget);
                if (arpEntries.length > 0) {
                    telemetryData.push(this.createTelemetryData({ type: 'arp', entries: arpEntries }, undefined));
                }
            }
            // Collect MAC table entries (for switches)
            if (arpTarget.collectType === 'mac' || arpTarget.collectType === 'both') {
                const macEntries = await this.collectMACTable(arpTarget);
                if (macEntries.length > 0) {
                    telemetryData.push(this.createTelemetryData({ type: 'mac', entries: macEntries }, undefined));
                }
            }
            logger_1.logger.debug(`ARP collection completed for ${arpTarget.host}`, {
                dataPoints: telemetryData.length,
            });
        }
        catch (error) {
            throw new error_handler_1.CollectorError('arp', `Failed to collect from ${arpTarget.host}: ${error.message}`, arpTarget.host);
        }
        return telemetryData;
    }
    // ============================================================================
    // ARP Table Collection
    // ============================================================================
    /**
     * Collect ARP table from the system
     */
    async collectARPTable(target) {
        const entries = [];
        try {
            // Different commands for different platforms
            const platform = process.platform;
            let command;
            switch (platform) {
                case 'linux':
                    command = target.interface
                        ? `ip neigh show dev ${target.interface}`
                        : 'ip neigh show';
                    break;
                case 'darwin':
                    command = 'arp -an';
                    break;
                case 'win32':
                    command = 'arp -a';
                    break;
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
            const { stdout } = await execAsync(command);
            const parsedEntries = this.parseARPOutput(stdout, platform);
            entries.push(...parsedEntries);
        }
        catch (error) {
            logger_1.logger.warn('Failed to collect local ARP table', {
                error: error.message,
            });
        }
        return entries;
    }
    /**
     * Parse ARP command output based on platform
     */
    parseARPOutput(output, platform) {
        const entries = [];
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
            try {
                let entry = null;
                switch (platform) {
                    case 'linux':
                        entry = this.parseLinuxARP(line);
                        break;
                    case 'darwin':
                        entry = this.parseDarwinARP(line);
                        break;
                    case 'win32':
                        entry = this.parseWindowsARP(line);
                        break;
                }
                if (entry) {
                    entries.push(entry);
                }
            }
            catch {
                // Skip unparseable lines
            }
        }
        return entries;
    }
    /**
     * Parse Linux 'ip neigh' output
     * Format: 192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE
     */
    parseLinuxARP(line) {
        const regex = /^(\d+\.\d+\.\d+\.\d+)\s+dev\s+(\S+)\s+lladdr\s+([0-9a-f:]+)\s+(\S+)/i;
        const match = line.match(regex);
        if (match) {
            return {
                ipAddress: match[1],
                macAddress: this.normalizeMacAddress(match[3]),
                interface: match[2],
                type: match[4].toLowerCase().includes('permanent') ? 'static' : 'dynamic',
            };
        }
        return null;
    }
    /**
     * Parse macOS 'arp -an' output
     * Format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
     */
    parseDarwinARP(line) {
        const regex = /\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]+)\s+on\s+(\S+)/i;
        const match = line.match(regex);
        if (match) {
            return {
                ipAddress: match[1],
                macAddress: this.normalizeMacAddress(match[2]),
                interface: match[3],
                type: line.includes('permanent') ? 'static' : 'dynamic',
            };
        }
        return null;
    }
    /**
     * Parse Windows 'arp -a' output
     * Format: 192.168.1.1    aa-bb-cc-dd-ee-ff     dynamic
     */
    parseWindowsARP(line) {
        const regex = /(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]+)\s+(dynamic|static)/i;
        const match = line.match(regex);
        if (match) {
            return {
                ipAddress: match[1],
                macAddress: this.normalizeMacAddress(match[2]),
                interface: 'unknown',
                type: match[3].toLowerCase(),
            };
        }
        return null;
    }
    // ============================================================================
    // MAC Table Collection
    // ============================================================================
    /**
     * Collect MAC address table (typically from switches via SNMP or CLI)
     */
    async collectMACTable(target) {
        const entries = [];
        // For this implementation, we'll simulate MAC table entries
        // In production, this would connect to switches via SNMP or SSH/Telnet
        logger_1.logger.debug('MAC table collection placeholder', {
            target: target.host,
            note: 'Implement switch-specific MAC table collection',
        });
        // Example: Connect to switch and collect MAC table
        // This would typically use SNMP to walk the bridge MIB
        // OID: 1.3.6.1.2.1.17.4.3 (dot1dTpFdbTable)
        return entries;
    }
    // ============================================================================
    // Network Discovery
    // ============================================================================
    /**
     * Discover devices on a subnet using ARP scanning
     * Note: This is an active scan - use with caution in OT environments
     */
    async discoverSubnet(subnet, options = {}) {
        const { passive = true, timeout = 5000 } = options;
        if (!passive) {
            logger_1.logger.warn('Active ARP scan requested - use with caution in OT environments', {
                subnet,
            });
        }
        const entries = [];
        try {
            // For passive discovery, just read the current ARP table
            if (passive) {
                const target = {
                    id: 'local',
                    host: 'localhost',
                    enabled: true,
                    collectType: 'arp',
                };
                const collected = await this.collectARPTable(target);
                // Filter entries that match the subnet
                const subnetParts = this.parseSubnet(subnet);
                if (subnetParts) {
                    for (const entry of collected) {
                        if (this.isInSubnet(entry.ipAddress, subnetParts)) {
                            entries.push(entry);
                        }
                    }
                }
                else {
                    entries.push(...collected);
                }
            }
            else {
                // Active scan would go here
                // This involves sending ARP requests to all IPs in the subnet
                // Not recommended for OT environments without proper authorization
                logger_1.logger.warn('Active ARP scanning not implemented - use passive discovery');
            }
        }
        catch (error) {
            logger_1.logger.error('Subnet discovery failed', {
                subnet,
                error: error.message,
            });
        }
        return entries;
    }
    /**
     * Parse subnet in CIDR notation
     */
    parseSubnet(subnet) {
        const match = subnet.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
        if (!match)
            return null;
        const octets = match[1].split('.').map(Number);
        const network = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
        const prefix = parseInt(match[2], 10);
        const mask = prefix === 0 ? 0 : ~((1 << (32 - prefix)) - 1);
        return { network: network & mask, mask };
    }
    /**
     * Check if IP is in subnet
     */
    isInSubnet(ip, subnet) {
        const octets = ip.split('.').map(Number);
        const ipNum = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
        return (ipNum & subnet.mask) === subnet.network;
    }
    // ============================================================================
    // Target Management
    // ============================================================================
    /**
     * Add a local ARP collection target
     */
    addLocalTarget(options = {}) {
        const target = {
            host: 'localhost',
            enabled: true,
            interface: options.interface,
            collectType: options.collectType || 'arp',
        };
        return this.addTarget(target);
    }
    /**
     * Add a remote target for MAC table collection
     */
    addRemoteTarget(host, options = {}) {
        const target = {
            host,
            port: options.port,
            enabled: true,
            collectType: options.collectType || 'mac',
        };
        return this.addTarget(target);
    }
}
exports.ARPCollector = ARPCollector;
// ============================================================================
// Export
// ============================================================================
function createARPCollector(config) {
    return new ARPCollector(config);
}
//# sourceMappingURL=arp-collector.js.map