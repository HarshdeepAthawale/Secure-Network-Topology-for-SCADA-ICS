"use strict";
/**
 * Risk Analyzer - Threat assessment and vulnerability scoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskAnalyzer = exports.RiskAnalyzer = void 0;
const types_1 = require("../../utils/types");
const constants_1 = require("../../utils/constants");
const crypto_1 = require("../../utils/crypto");
class RiskAnalyzer {
    analyzeDevice(device, connections) {
        const factors = [];
        // Analyze vulnerability factors
        factors.push(this.analyzeVulnerability(device));
        // Analyze configuration factors
        factors.push(this.analyzeConfiguration(device, connections));
        // Analyze exposure factors
        factors.push(this.analyzeExposure(device, connections));
        // Analyze compliance factors
        factors.push(this.analyzeCompliance(device));
        // Calculate overall score
        const overallScore = this.calculateOverallScore(factors);
        // Generate recommendations
        const recommendations = this.generateRecommendations(device, factors);
        return {
            deviceId: device.id,
            overallScore,
            factors,
            recommendations,
            lastAssessedAt: new Date(),
        };
    }
    analyzeVulnerability(device) {
        let score = 0;
        const details = {};
        // Check for known vulnerable device types
        if (device.type === 'plc' || device.type === 'rtu') {
            score += 30;
            details.reason = 'Control devices have inherent vulnerabilities';
        }
        // Check firmware age (simulated - would need actual data)
        if (!device.firmwareVersion) {
            score += 20;
            details.missingFirmware = true;
        }
        // Check vendor security reputation
        const riskyVendors = ['unknown'];
        if (!device.vendor || riskyVendors.includes(device.vendor.toLowerCase())) {
            score += 15;
            details.unknownVendor = true;
        }
        return {
            name: 'Vulnerability',
            category: 'vulnerability',
            score: Math.min(score, 100),
            weight: constants_1.RISK_WEIGHTS.vulnerability,
            description: 'Assessment of known vulnerabilities and security weaknesses',
            details,
        };
    }
    analyzeConfiguration(device, connections) {
        let score = 0;
        const details = {};
        // Check for insecure connections
        const insecureConnections = connections.filter(c => !c.isSecure);
        if (insecureConnections.length > 0) {
            score += 25;
            details.insecureConnections = insecureConnections.length;
        }
        // Check for missing encryption
        const unencryptedConnections = connections.filter(c => !c.encryptionType);
        if (unencryptedConnections.length > connections.length / 2) {
            score += 20;
            details.mostlyUnencrypted = true;
        }
        // Check for default ports
        const defaultPorts = [502, 102, 44818]; // Modbus, S7, EtherNet/IP
        const hasDefaultPorts = connections.some(c => c.port && defaultPorts.includes(c.port));
        if (hasDefaultPorts) {
            score += 15;
            details.defaultIndustrialPorts = true;
        }
        return {
            name: 'Configuration',
            category: 'configuration',
            score: Math.min(score, 100),
            weight: constants_1.RISK_WEIGHTS.configuration,
            description: 'Assessment of security configuration and hardening',
            details,
        };
    }
    analyzeExposure(device, connections) {
        let score = 0;
        const details = {};
        // Higher exposure at lower Purdue levels is more critical
        if (device.purdueLevel <= 1) {
            score += 20;
            details.criticalLevel = true;
        }
        // Check connection count (more connections = more exposure)
        if (connections.length > 10) {
            score += 15;
            details.highConnectivity = connections.length;
        }
        // Check for cross-zone connections
        // This would need additional context about connected device levels
        // Check for internet-facing (Level 5 connections from OT)
        if (device.purdueLevel < 4 && device.securityZone !== 'dmz') {
            // Simulated check - would need actual routing analysis
            score += 10;
        }
        return {
            name: 'Exposure',
            category: 'exposure',
            score: Math.min(score, 100),
            weight: constants_1.RISK_WEIGHTS.exposure,
            description: 'Assessment of network exposure and attack surface',
            details,
        };
    }
    analyzeCompliance(device) {
        let score = 0;
        const details = {};
        const violations = [];
        // Check for required metadata (IEC 62443 asset inventory)
        if (!device.vendor || !device.model) {
            score += 15;
            violations.push('Missing asset identification (IEC 62443)');
        }
        // Check for location information (physical security)
        if (!device.location) {
            score += 10;
            violations.push('Missing location data');
        }
        // Check for proper zone assignment
        if (device.securityZone === 'untrusted') {
            score += 25;
            violations.push('Device in untrusted zone');
        }
        details.violations = violations;
        return {
            name: 'Compliance',
            category: 'compliance',
            score: Math.min(score, 100),
            weight: constants_1.RISK_WEIGHTS.compliance,
            description: 'Assessment against security standards (IEC 62443, NERC CIP)',
            details,
        };
    }
    calculateOverallScore(factors) {
        let weightedSum = 0;
        let totalWeight = 0;
        for (const factor of factors) {
            weightedSum += factor.score * factor.weight;
            totalWeight += factor.weight;
        }
        return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    }
    generateRecommendations(device, factors) {
        const recommendations = [];
        for (const factor of factors) {
            if (factor.score >= constants_1.RISK_THRESHOLDS.HIGH) {
                switch (factor.category) {
                    case 'vulnerability':
                        recommendations.push('Update firmware and apply security patches');
                        recommendations.push('Implement virtual patching at network perimeter');
                        break;
                    case 'configuration':
                        recommendations.push('Enable encryption for all connections');
                        recommendations.push('Change default ports and credentials');
                        break;
                    case 'exposure':
                        recommendations.push('Reduce network connectivity to minimum required');
                        recommendations.push('Implement network segmentation');
                        break;
                    case 'compliance':
                        recommendations.push('Complete asset inventory documentation');
                        recommendations.push('Assign device to appropriate security zone');
                        break;
                }
            }
        }
        return [...new Set(recommendations)]; // Remove duplicates
    }
    analyzeTopology(devices, connections) {
        const deviceConnections = new Map();
        // Group connections by device
        for (const conn of connections) {
            const sourceConns = deviceConnections.get(conn.sourceDeviceId) || [];
            sourceConns.push(conn);
            deviceConnections.set(conn.sourceDeviceId, sourceConns);
            const targetConns = deviceConnections.get(conn.targetDeviceId) || [];
            targetConns.push(conn);
            deviceConnections.set(conn.targetDeviceId, targetConns);
        }
        // Analyze each device
        const assessments = [];
        const zoneScores = new Map();
        const highRiskDevices = [];
        const findings = [];
        for (const device of devices) {
            const conns = deviceConnections.get(device.id) || [];
            const assessment = this.analyzeDevice(device, conns);
            assessments.push(assessment);
            // Track zone scores
            const zoneList = zoneScores.get(device.purdueLevel) || [];
            zoneList.push(assessment.overallScore);
            zoneScores.set(device.purdueLevel, zoneList);
            // Track high risk devices
            if (assessment.overallScore >= constants_1.RISK_THRESHOLDS.HIGH) {
                highRiskDevices.push(device.id);
                findings.push({
                    id: (0, crypto_1.generateUUID)(),
                    type: 'vulnerability',
                    severity: assessment.overallScore >= constants_1.RISK_THRESHOLDS.CRITICAL ? types_1.AlertSeverity.CRITICAL : types_1.AlertSeverity.HIGH,
                    title: `High Risk Device: ${device.name}`,
                    description: `Device has overall risk score of ${assessment.overallScore}`,
                    affectedDeviceId: device.id,
                    recommendation: assessment.recommendations[0] || 'Review device security posture',
                });
            }
        }
        // Calculate zone risks
        const zoneRisks = new Map();
        for (const [level, scores] of zoneScores) {
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            zoneRisks.set(level, Math.round(avgScore));
        }
        // Calculate overall topology risk
        const allScores = assessments.map(a => a.overallScore);
        const overallScore = allScores.length > 0
            ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
            : 0;
        return {
            overallScore,
            zoneRisks,
            highRiskDevices,
            criticalPaths: [], // Would require path analysis
            findings,
        };
    }
    getRiskLevel(score) {
        if (score >= constants_1.RISK_THRESHOLDS.CRITICAL)
            return 'critical';
        if (score >= constants_1.RISK_THRESHOLDS.HIGH)
            return 'high';
        if (score >= constants_1.RISK_THRESHOLDS.MEDIUM)
            return 'medium';
        return 'low';
    }
    createAlertFromAssessment(assessment, device) {
        if (assessment.overallScore < constants_1.RISK_THRESHOLDS.MEDIUM)
            return null;
        const severity = assessment.overallScore >= constants_1.RISK_THRESHOLDS.CRITICAL ? types_1.AlertSeverity.CRITICAL :
            assessment.overallScore >= constants_1.RISK_THRESHOLDS.HIGH ? types_1.AlertSeverity.HIGH : types_1.AlertSeverity.MEDIUM;
        return {
            id: (0, crypto_1.generateUUID)(),
            type: types_1.AlertType.SECURITY,
            severity,
            title: `Risk Assessment Alert: ${device.name}`,
            description: `Device has elevated risk score of ${assessment.overallScore}`,
            deviceId: device.id,
            details: {
                factors: assessment.factors,
                recommendations: assessment.recommendations,
            },
            remediation: assessment.recommendations.join('; '),
            acknowledged: false,
            resolved: false,
            createdAt: new Date(),
        };
    }
}
exports.RiskAnalyzer = RiskAnalyzer;
exports.riskAnalyzer = new RiskAnalyzer();
//# sourceMappingURL=risk-analyzer.js.map