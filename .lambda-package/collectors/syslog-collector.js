"use strict";
/**
 * Syslog Collector - Security event collection (RFC 5424)
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
exports.SyslogCollector = void 0;
exports.createSyslogCollector = createSyslogCollector;
const dgram = __importStar(require("dgram"));
const net = __importStar(require("net"));
const base_collector_1 = require("./base-collector");
const types_1 = require("../utils/types");
const constants_1 = require("../utils/constants");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../utils/error-handler");
const config_1 = require("../utils/config");
// ============================================================================
// Syslog Collector Class
// ============================================================================
class SyslogCollector extends base_collector_1.BaseCollector {
    udpServer = null;
    tcpServer = null;
    port;
    protocol;
    messageBuffer = [];
    maxBufferSize = 50000;
    constructor(collectorConfig) {
        const mergedConfig = {
            ...config_1.config.collector,
            ...collectorConfig,
        };
        super('SyslogCollector', types_1.TelemetrySource.SYSLOG, mergedConfig);
        this.port = config_1.config.syslog.port;
        this.protocol = config_1.config.syslog.protocol;
    }
    // ============================================================================
    // Lifecycle Implementation
    // ============================================================================
    async initialize() {
        logger_1.logger.info('Initializing Syslog collector', {
            port: this.port,
            protocol: this.protocol,
        });
        if (this.protocol === 'udp') {
            await this.startUDPServer();
        }
        else {
            await this.startTCPServer();
        }
    }
    async cleanup() {
        logger_1.logger.info('Cleaning up Syslog collector');
        if (this.udpServer) {
            return new Promise((resolve) => {
                this.udpServer.close(() => {
                    this.udpServer = null;
                    resolve();
                });
            });
        }
        if (this.tcpServer) {
            return new Promise((resolve) => {
                this.tcpServer.close(() => {
                    this.tcpServer = null;
                    resolve();
                });
            });
        }
    }
    // ============================================================================
    // Server Setup
    // ============================================================================
    async startUDPServer() {
        return new Promise((resolve, reject) => {
            this.udpServer = dgram.createSocket('udp4');
            this.udpServer.on('error', (error) => {
                logger_1.logger.error('Syslog UDP server error', { error: error.message });
                reject(new error_handler_1.SyslogError(`UDP server error: ${error.message}`));
            });
            this.udpServer.on('message', (msg, rinfo) => {
                this.handleMessage(msg.toString(), rinfo.address);
            });
            this.udpServer.on('listening', () => {
                const address = this.udpServer.address();
                logger_1.logger.info('Syslog UDP server listening', {
                    address: address.address,
                    port: address.port,
                });
                resolve();
            });
            this.udpServer.bind(this.port);
        });
    }
    async startTCPServer() {
        return new Promise((resolve, reject) => {
            this.tcpServer = net.createServer((socket) => {
                const sourceIP = socket.remoteAddress || 'unknown';
                socket.on('data', (data) => {
                    const messages = data.toString().split('\n');
                    for (const message of messages) {
                        if (message.trim()) {
                            this.handleMessage(message, sourceIP);
                        }
                    }
                });
                socket.on('error', (error) => {
                    logger_1.logger.error('Syslog TCP connection error', {
                        error: error.message,
                        source: sourceIP,
                    });
                });
            });
            this.tcpServer.on('error', (error) => {
                logger_1.logger.error('Syslog TCP server error', { error: error.message });
                reject(new error_handler_1.SyslogError(`TCP server error: ${error.message}`));
            });
            this.tcpServer.listen(this.port, () => {
                logger_1.logger.info('Syslog TCP server listening', { port: this.port });
                resolve();
            });
        });
    }
    // ============================================================================
    // Collection Implementation
    // ============================================================================
    async collect(_target) {
        const telemetryData = [];
        if (this.messageBuffer.length > 0) {
            const messages = [...this.messageBuffer];
            this.messageBuffer = [];
            // Group by severity for analysis
            const bySeverity = this.groupBySeverity(messages);
            // Create telemetry for security-relevant messages
            const securityMessages = messages.filter(m => this.isSecurityRelevant(m));
            if (securityMessages.length > 0) {
                telemetryData.push(this.createTelemetryData({
                    type: 'syslog',
                    messageCount: messages.length,
                    securityEventCount: securityMessages.length,
                    severityDistribution: bySeverity,
                    messages: securityMessages,
                }, undefined));
            }
            // Also include summary of all messages
            telemetryData.push(this.createTelemetryData({
                type: 'syslog_summary',
                totalCount: messages.length,
                timeRange: {
                    start: messages[0]?.timestamp,
                    end: messages[messages.length - 1]?.timestamp,
                },
                severityDistribution: bySeverity,
                topHosts: this.getTopHosts(messages),
            }, undefined));
            logger_1.logger.debug('Syslog collection completed', {
                totalMessages: messages.length,
                securityMessages: securityMessages.length,
            });
        }
        return telemetryData;
    }
    // ============================================================================
    // Message Handling
    // ============================================================================
    /**
     * Handle incoming syslog message
     */
    handleMessage(rawMessage, sourceIP) {
        try {
            const parsed = this.parseMessage(rawMessage);
            if (parsed) {
                parsed.sourceIP = sourceIP;
                this.addToBuffer(parsed);
                // Emit high-severity events immediately
                if (parsed.severity <= 3) {
                    this.emit('securityEvent', parsed);
                }
            }
        }
        catch (error) {
            logger_1.logger.debug('Failed to parse syslog message', {
                error: error.message,
                source: sourceIP,
            });
        }
    }
    /**
     * Parse syslog message (RFC 5424 and RFC 3164)
     */
    parseMessage(raw) {
        // Try RFC 5424 format first
        const rfc5424 = this.parseRFC5424(raw);
        if (rfc5424)
            return rfc5424;
        // Fall back to RFC 3164 (BSD format)
        const rfc3164 = this.parseRFC3164(raw);
        if (rfc3164)
            return rfc3164;
        return null;
    }
    /**
     * Parse RFC 5424 syslog message
     * Format: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
     */
    parseRFC5424(raw) {
        const regex = /^<(\d+)>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\[.*?\]|-)\s*(.*)?$/;
        const match = raw.match(regex);
        if (!match)
            return null;
        const pri = parseInt(match[1], 10);
        const facility = Math.floor(pri / 8);
        const severity = pri % 8;
        return {
            facility,
            severity,
            timestamp: this.parseTimestamp(match[3]),
            hostname: match[4] === '-' ? 'unknown' : match[4],
            appName: match[5] === '-' ? undefined : match[5],
            procId: match[6] === '-' ? undefined : match[6],
            msgId: match[7] === '-' ? undefined : match[7],
            structuredData: match[8] === '-' ? undefined : this.parseStructuredData(match[8]),
            message: match[9] || '',
        };
    }
    /**
     * Parse RFC 3164 (BSD) syslog message
     * Format: <PRI>TIMESTAMP HOSTNAME TAG: MSG
     */
    parseRFC3164(raw) {
        const regex = /^<(\d+)>(\w{3}\s+\d+\s+\d+:\d+:\d+)\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)?$/;
        const match = raw.match(regex);
        if (!match) {
            // Try simplified format
            const simpleRegex = /^<(\d+)>(.*)?$/;
            const simpleMatch = raw.match(simpleRegex);
            if (simpleMatch) {
                const pri = parseInt(simpleMatch[1], 10);
                return {
                    facility: Math.floor(pri / 8),
                    severity: pri % 8,
                    timestamp: new Date(),
                    hostname: 'unknown',
                    message: simpleMatch[2] || '',
                };
            }
            return null;
        }
        const pri = parseInt(match[1], 10);
        const facility = Math.floor(pri / 8);
        const severity = pri % 8;
        return {
            facility,
            severity,
            timestamp: this.parseTimestamp(match[2]),
            hostname: match[3],
            appName: match[4],
            procId: match[5],
            message: match[6] || '',
        };
    }
    /**
     * Parse timestamp from various formats
     */
    parseTimestamp(timestamp) {
        // Try ISO 8601
        let date = new Date(timestamp);
        if (!isNaN(date.getTime()))
            return date;
        // Try BSD format (e.g., "Jan 12 14:30:00")
        const bsdRegex = /^(\w{3})\s+(\d+)\s+(\d+):(\d+):(\d+)$/;
        const match = timestamp.match(bsdRegex);
        if (match) {
            const months = {
                Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
            };
            const now = new Date();
            date = new Date(now.getFullYear(), months[match[1]] ?? 0, parseInt(match[2], 10), parseInt(match[3], 10), parseInt(match[4], 10), parseInt(match[5], 10));
            return date;
        }
        return new Date();
    }
    /**
     * Parse structured data element
     */
    parseStructuredData(sd) {
        if (!sd || sd === '-')
            return undefined;
        const result = {};
        const regex = /\[(\S+?)(?:\s+(.+?))?\]/g;
        let match;
        while ((match = regex.exec(sd)) !== null) {
            const sdId = match[1];
            const params = match[2];
            if (params) {
                const paramRegex = /(\S+?)="([^"]+)"/g;
                let paramMatch;
                while ((paramMatch = paramRegex.exec(params)) !== null) {
                    result[`${sdId}.${paramMatch[1]}`] = paramMatch[2];
                }
            }
        }
        return Object.keys(result).length > 0 ? result : undefined;
    }
    // ============================================================================
    // Buffer Management
    // ============================================================================
    addToBuffer(message) {
        this.messageBuffer.push(message);
        if (this.messageBuffer.length > this.maxBufferSize) {
            this.messageBuffer = this.messageBuffer.slice(-this.maxBufferSize);
            logger_1.logger.warn('Syslog buffer overflow - oldest messages dropped');
        }
    }
    // ============================================================================
    // Analysis Helpers
    // ============================================================================
    /**
     * Group messages by severity
     */
    groupBySeverity(messages) {
        const result = {};
        for (const msg of messages) {
            const severity = constants_1.SYSLOG_SEVERITIES[msg.severity] || 'unknown';
            result[severity] = (result[severity] || 0) + 1;
        }
        return result;
    }
    /**
     * Check if message is security-relevant
     */
    isSecurityRelevant(message) {
        // High severity is always relevant
        if (message.severity <= 3)
            return true;
        // Check for security-related facilities
        if (message.facility === 4 || message.facility === 10 || message.facility === 13) {
            return true;
        }
        // Check for security keywords
        const securityKeywords = [
            'authentication', 'auth', 'login', 'logout', 'failed',
            'denied', 'blocked', 'attack', 'intrusion', 'violation',
            'unauthorized', 'invalid', 'malicious', 'suspicious',
            'firewall', 'iptables', 'ssh', 'sudo', 'root',
        ];
        const lowerMessage = message.message.toLowerCase();
        return securityKeywords.some(keyword => lowerMessage.includes(keyword));
    }
    /**
     * Get top hosts by message count
     */
    getTopHosts(messages, limit = 10) {
        const counts = new Map();
        for (const msg of messages) {
            const host = msg.sourceIP || msg.hostname;
            counts.set(host, (counts.get(host) || 0) + 1);
        }
        return Array.from(counts.entries())
            .map(([host, count]) => ({ host, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Get facility name
     */
    getFacilityName(facility) {
        return constants_1.SYSLOG_FACILITIES[facility] || 'unknown';
    }
    /**
     * Get severity name
     */
    getSeverityName(severity) {
        return constants_1.SYSLOG_SEVERITIES[severity] || 'unknown';
    }
    /**
     * Get buffer statistics
     */
    getBufferStats() {
        return {
            messageCount: this.messageBuffer.length,
            oldestMessage: this.messageBuffer[0]?.timestamp,
            newestMessage: this.messageBuffer[this.messageBuffer.length - 1]?.timestamp,
            severityBreakdown: this.groupBySeverity(this.messageBuffer),
        };
    }
}
exports.SyslogCollector = SyslogCollector;
// ============================================================================
// Export
// ============================================================================
function createSyslogCollector(config) {
    return new SyslogCollector(config);
}
//# sourceMappingURL=syslog-collector.js.map