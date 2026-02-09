"use strict";
/**
 * Syslog Parser - Security event analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.syslogParser = exports.SyslogParser = void 0;
const types_1 = require("../../utils/types");
const constants_1 = require("../../utils/constants");
const crypto_1 = require("../../utils/crypto");
class SyslogParser {
    securityPatterns = [
        { pattern: /failed\s+(password|login|auth)/i, type: 'authentication_failure', severity: types_1.AlertSeverity.MEDIUM },
        { pattern: /invalid\s+user/i, type: 'invalid_user', severity: types_1.AlertSeverity.MEDIUM },
        { pattern: /accepted\s+(password|publickey)/i, type: 'successful_login', severity: types_1.AlertSeverity.INFO },
        { pattern: /connection\s+(refused|denied|blocked)/i, type: 'connection_blocked', severity: types_1.AlertSeverity.LOW },
        { pattern: /(brute.?force|repeated.?failure)/i, type: 'brute_force', severity: types_1.AlertSeverity.HIGH },
        { pattern: /(root|admin|sudo)/i, type: 'privileged_access', severity: types_1.AlertSeverity.MEDIUM },
        { pattern: /(firewall|iptables|denied)/i, type: 'firewall_event', severity: types_1.AlertSeverity.LOW },
        { pattern: /(malware|virus|trojan|ransomware)/i, type: 'malware_detected', severity: types_1.AlertSeverity.CRITICAL },
        { pattern: /(intrusion|attack|exploit)/i, type: 'intrusion_attempt', severity: types_1.AlertSeverity.HIGH },
        { pattern: /(unauthorized|violation|breach)/i, type: 'policy_violation', severity: types_1.AlertSeverity.HIGH },
    ];
    parse(telemetry) {
        const data = telemetry.data;
        if (!Array.isArray(data.messages))
            return [];
        return data.messages.map(msg => this.parseMessage(msg));
    }
    parseMessage(msg) {
        const eventType = this.classifyEvent(msg.message);
        const extractedData = this.extractData(msg.message);
        const isSecurityRelevant = this.isSecurityRelevant(msg);
        return {
            id: (0, crypto_1.generateUUID)(),
            timestamp: msg.timestamp,
            hostname: msg.hostname,
            facility: constants_1.SYSLOG_FACILITIES[msg.facility] || 'unknown',
            severity: constants_1.SYSLOG_SEVERITIES[msg.severity] || 'unknown',
            message: msg.message,
            eventType,
            isSecurityRelevant,
            extractedData,
            riskScore: this.calculateRiskScore(msg, isSecurityRelevant),
        };
    }
    classifyEvent(message) {
        const lower = message.toLowerCase();
        if (/auth|login|password|credential/.test(lower))
            return 'authentication';
        if (/denied|forbidden|unauthorized|permission/.test(lower))
            return 'authorization';
        if (/connect|network|firewall|port/.test(lower))
            return 'network';
        if (/attack|intrusion|malware|exploit/.test(lower))
            return 'security';
        if (/system|kernel|service|daemon/.test(lower))
            return 'system';
        return 'unknown';
    }
    extractData(message) {
        const data = {};
        const patterns = [
            [/(?:from|src|source)[:\s]+(\d+\.\d+\.\d+\.\d+)/i, 'sourceIP'],
            [/(?:to|dst|destination)[:\s]+(\d+\.\d+\.\d+\.\d+)/i, 'destinationIP'],
            [/(?:user|username)[:\s]+(\S+)/i, 'username'],
            [/port[:\s]+(\d+)/i, 'port'],
        ];
        for (const [pattern, key] of patterns) {
            const match = message.match(pattern);
            if (match)
                data[key] = match[1];
        }
        return data;
    }
    isSecurityRelevant(msg) {
        if (msg.severity <= 3)
            return true;
        if ([4, 10, 13].includes(msg.facility))
            return true;
        return this.securityPatterns.some(p => p.pattern.test(msg.message));
    }
    calculateRiskScore(msg, isSecurityRelevant) {
        let score = (7 - msg.severity) * 10;
        if (isSecurityRelevant)
            score += 20;
        for (const { pattern, severity } of this.securityPatterns) {
            if (pattern.test(msg.message)) {
                const severityScores = { critical: 40, high: 30, medium: 20, low: 10, info: 5 };
                score += severityScores[severity] || 0;
                break;
            }
        }
        return Math.min(score, 100);
    }
    toAlert(event) {
        if (!event.isSecurityRelevant || event.riskScore < 30)
            return null;
        const severity = event.riskScore >= 80 ? types_1.AlertSeverity.CRITICAL :
            event.riskScore >= 60 ? types_1.AlertSeverity.HIGH :
                event.riskScore >= 40 ? types_1.AlertSeverity.MEDIUM : types_1.AlertSeverity.LOW;
        return {
            id: (0, crypto_1.generateUUID)(),
            type: types_1.AlertType.SECURITY,
            severity,
            title: `Security Event: ${event.eventType}`,
            description: event.message.substring(0, 500),
            details: { ...event.extractedData, riskScore: event.riskScore, facility: event.facility },
            acknowledged: false,
            resolved: false,
            createdAt: event.timestamp,
        };
    }
}
exports.SyslogParser = SyslogParser;
exports.syslogParser = new SyslogParser();
//# sourceMappingURL=syslog-parser.js.map