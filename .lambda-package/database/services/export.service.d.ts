/**
 * Export Service - Report generation and data export
 */
import { AlertSeverity } from '../../utils/types';
export type ExportFormat = 'json' | 'csv' | 'xml' | 'html';
export interface ExportOptions {
    format: ExportFormat;
    includeDevices?: boolean;
    includeConnections?: boolean;
    includeAlerts?: boolean;
    includeMetadata?: boolean;
    dateRange?: {
        from: Date;
        to: Date;
    };
}
export interface ComplianceReport {
    id: string;
    generatedAt: Date;
    framework: 'NIST' | 'IEC62443' | 'NERC-CIP' | 'custom';
    summary: {
        totalFindings: number;
        criticalFindings: number;
        highFindings: number;
        mediumFindings: number;
        lowFindings: number;
        complianceScore: number;
    };
    findings: ComplianceFinding[];
    recommendations: string[];
}
export interface ComplianceFinding {
    id: string;
    control: string;
    description: string;
    severity: AlertSeverity;
    affectedDevices: string[];
    status: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable';
    evidence?: string;
}
export interface NetworkDiagramData {
    nodes: Array<{
        id: string;
        label: string;
        group: string;
        level: number;
        x?: number;
        y?: number;
        color?: string;
        shape?: string;
    }>;
    edges: Array<{
        from: string;
        to: string;
        label?: string;
        color?: string;
        dashes?: boolean;
        width?: number;
    }>;
    zones: Array<{
        id: string;
        name: string;
        level: number;
        color: string;
        devices: string[];
    }>;
}
export declare class ExportService {
    private snapshotRepo;
    private deviceRepo;
    private connectionRepo;
    private alertRepo;
    constructor();
    /**
     * Export topology data
     */
    exportTopology(options: ExportOptions): Promise<string>;
    /**
     * Generate compliance report
     */
    generateComplianceReport(framework: 'NIST' | 'IEC62443' | 'NERC-CIP' | 'custom'): Promise<ComplianceReport>;
    /**
     * Generate network diagram data
     */
    generateNetworkDiagram(): Promise<NetworkDiagramData>;
    /**
     * Export device inventory
     */
    exportDeviceInventory(format?: ExportFormat): Promise<string>;
    /**
     * Export alert history
     */
    exportAlertHistory(days?: number, format?: ExportFormat): Promise<string>;
    /**
     * Gather export data based on options
     */
    private gatherExportData;
    /**
     * Convert to JSON
     */
    private toJSON;
    /**
     * Convert to CSV (simplified - devices only)
     */
    private toCSV;
    /**
     * Convert to XML
     */
    private toXML;
    /**
     * Convert to HTML report
     */
    private toHTML;
    /**
     * Escape XML special characters
     */
    private escapeXML;
    /**
     * Get device shape for diagram
     */
    private getDeviceShape;
}
export declare function getExportService(): ExportService;
//# sourceMappingURL=export.service.d.ts.map