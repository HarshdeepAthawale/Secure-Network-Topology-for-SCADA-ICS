/**
 * Risk Analyzer - Threat assessment and vulnerability scoring
 */

import { Device, Connection, RiskAssessment, RiskFactor, Alert, AlertSeverity, AlertType, PurdueLevel } from '../../utils/types';
import { RISK_THRESHOLDS, RISK_WEIGHTS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

export interface SecurityFinding {
  id: string;
  type: 'vulnerability' | 'misconfiguration' | 'exposure' | 'compliance';
  severity: AlertSeverity;
  title: string;
  description: string;
  affectedDeviceId: string;
  recommendation: string;
  cvssScore?: number;
}

export interface TopologyRisk {
  overallScore: number;
  zoneRisks: Map<PurdueLevel, number>;
  highRiskDevices: string[];
  criticalPaths: Array<{ path: string[]; risk: number }>;
  findings: SecurityFinding[];
}

export class RiskAnalyzer {
  analyzeDevice(device: Device, connections: Connection[]): RiskAssessment {
    const factors: RiskFactor[] = [];

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

  private analyzeVulnerability(device: Device): RiskFactor {
    let score = 0;
    const details: Record<string, unknown> = {};

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
      weight: RISK_WEIGHTS.vulnerability,
      description: 'Assessment of known vulnerabilities and security weaknesses',
      details,
    };
  }

  private analyzeConfiguration(device: Device, connections: Connection[]): RiskFactor {
    let score = 0;
    const details: Record<string, unknown> = {};

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
      weight: RISK_WEIGHTS.configuration,
      description: 'Assessment of security configuration and hardening',
      details,
    };
  }

  private analyzeExposure(device: Device, connections: Connection[]): RiskFactor {
    let score = 0;
    const details: Record<string, unknown> = {};

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
      weight: RISK_WEIGHTS.exposure,
      description: 'Assessment of network exposure and attack surface',
      details,
    };
  }

  private analyzeCompliance(device: Device): RiskFactor {
    let score = 0;
    const details: Record<string, unknown> = {};
    const violations: string[] = [];

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
      weight: RISK_WEIGHTS.compliance,
      description: 'Assessment against security standards (IEC 62443, NERC CIP)',
      details,
    };
  }

  private calculateOverallScore(factors: RiskFactor[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      weightedSum += factor.score * factor.weight;
      totalWeight += factor.weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  private generateRecommendations(device: Device, factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    for (const factor of factors) {
      if (factor.score >= RISK_THRESHOLDS.HIGH) {
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

  analyzeTopology(devices: Device[], connections: Connection[]): TopologyRisk {
    const deviceConnections = new Map<string, Connection[]>();

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
    const assessments: RiskAssessment[] = [];
    const zoneScores = new Map<PurdueLevel, number[]>();
    const highRiskDevices: string[] = [];
    const findings: SecurityFinding[] = [];

    for (const device of devices) {
      const conns = deviceConnections.get(device.id) || [];
      const assessment = this.analyzeDevice(device, conns);
      assessments.push(assessment);

      // Track zone scores
      const zoneList = zoneScores.get(device.purdueLevel) || [];
      zoneList.push(assessment.overallScore);
      zoneScores.set(device.purdueLevel, zoneList);

      // Track high risk devices
      if (assessment.overallScore >= RISK_THRESHOLDS.HIGH) {
        highRiskDevices.push(device.id);

        findings.push({
          id: generateUUID(),
          type: 'vulnerability',
          severity: assessment.overallScore >= RISK_THRESHOLDS.CRITICAL ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
          title: `High Risk Device: ${device.name}`,
          description: `Device has overall risk score of ${assessment.overallScore}`,
          affectedDeviceId: device.id,
          recommendation: assessment.recommendations[0] || 'Review device security posture',
        });
      }
    }

    // Calculate zone risks
    const zoneRisks = new Map<PurdueLevel, number>();
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

  getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= RISK_THRESHOLDS.CRITICAL) return 'critical';
    if (score >= RISK_THRESHOLDS.HIGH) return 'high';
    if (score >= RISK_THRESHOLDS.MEDIUM) return 'medium';
    return 'low';
  }

  createAlertFromAssessment(assessment: RiskAssessment, device: Device): Alert | null {
    if (assessment.overallScore < RISK_THRESHOLDS.MEDIUM) return null;

    const severity = assessment.overallScore >= RISK_THRESHOLDS.CRITICAL ? AlertSeverity.CRITICAL :
                     assessment.overallScore >= RISK_THRESHOLDS.HIGH ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;

    return {
      id: generateUUID(),
      type: AlertType.SECURITY,
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

export const riskAnalyzer = new RiskAnalyzer();
