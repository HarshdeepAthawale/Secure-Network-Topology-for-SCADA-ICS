/**
 * Risk Analyzer - Threat assessment and vulnerability scoring
 */
import { Device, Connection, RiskAssessment, Alert, AlertSeverity, PurdueLevel } from '../../utils/types';
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
    criticalPaths: Array<{
        path: string[];
        risk: number;
    }>;
    findings: SecurityFinding[];
}
export declare class RiskAnalyzer {
    analyzeDevice(device: Device, connections: Connection[]): RiskAssessment;
    private analyzeVulnerability;
    private analyzeConfiguration;
    private analyzeExposure;
    private analyzeCompliance;
    private calculateOverallScore;
    private generateRecommendations;
    analyzeTopology(devices: Device[], connections: Connection[]): TopologyRisk;
    getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low';
    createAlertFromAssessment(assessment: RiskAssessment, device: Device): Alert | null;
}
export declare const riskAnalyzer: RiskAnalyzer;
//# sourceMappingURL=risk-analyzer.d.ts.map