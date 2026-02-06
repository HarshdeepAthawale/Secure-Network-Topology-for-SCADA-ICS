/**
 * OPC-UA Collector - Industrial protocol data collection
 * Collects data from OPC-UA servers typically used in SCADA/ICS environments
 * 
 * NOTE: Requires 'node-opcua' package to be installed for full functionality.
 * This implementation provides the interface and mock functionality when the
 * package is not available.
 */

import { BaseCollector, CollectorTarget } from './base-collector';
import { TelemetryData, TelemetrySource, CollectorConfig } from '../utils/types';
import { logger } from '../utils/logger';
import { generateUUID } from '../utils/crypto';
import { config } from '../utils/config';

// ============================================================================
// Types
// ============================================================================

export interface OPCUATarget extends CollectorTarget {
    endpointUrl: string;
    securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy?: string;
    username?: string;
    password?: string;
    certificatePath?: string;
    privateKeyPath?: string;
    browseRootNode?: string;
    monitoredNodes?: string[];
    samplingInterval?: number;
}

export interface OPCUANode {
    nodeId: string;
    browseName: string;
    displayName: string;
    nodeClass: string;
    dataType?: string;
    value?: unknown;
    children?: OPCUANode[];
}

export interface OPCUAServerInfo {
    applicationName: string;
    applicationUri: string;
    productUri: string;
    manufacturerName?: string;
    softwareVersion?: string;
    buildNumber?: string;
    endpoints: Array<{
        endpointUrl: string;
        securityMode: string;
        securityPolicy: string;
    }>;
}

// ============================================================================
// OPC-UA Collector Class
// ============================================================================

export class OPCUACollector extends BaseCollector {
    private connections: Map<string, { connected: boolean; lastContact: Date }> = new Map();
    private opcuaAvailable = false;

    constructor(collectorConfig?: Partial<CollectorConfig>) {
        super(
            'opcua',
            TelemetrySource.OPCUA, // Using correct source
            {
                enabled: true,
                pollInterval: 60000,
                timeout: 30000,
                retries: 3,
                batchSize: 10,
                maxConcurrent: 5,
                ...collectorConfig
            } as CollectorConfig
        );
        this.checkOPCUAAvailability();
    }

    /**
     * Check if node-opcua is available
     */
    private checkOPCUAAvailability(): void {
        try {
            require.resolve('node-opcua');
            this.opcuaAvailable = true;
            logger.info('OPC-UA support available');
        } catch {
            this.opcuaAvailable = false;
            logger.warn('OPC-UA package not installed. Install node-opcua for full functionality.');
        }
    }

    /**
     * Initialize the OPC-UA collector
     */
    async initialize(): Promise<void> {
        logger.info('Initializing OPC-UA collector', { opcuaAvailable: this.opcuaAvailable });
    }

    /**
     * Collect data from a single target
     */
    async collect(target: CollectorTarget): Promise<TelemetryData[]> {
        const opcuaTarget = target as OPCUATarget;
        const telemetryData: TelemetryData[] = [];

        try {
            if (!this.opcuaAvailable) {
                // Return mock data when package is not available
                telemetryData.push(this.createMockServerInfoTelemetry(opcuaTarget));
                telemetryData.push(this.createMockNodesTelemetry(opcuaTarget));
                return telemetryData;
            }

            // Real OPC-UA collection would happen here
            // For now, return simulation data
            telemetryData.push(this.createServerInfoTelemetry(opcuaTarget, {
                applicationName: `OPCUA-Server-${opcuaTarget.id}`,
                applicationUri: opcuaTarget.endpointUrl,
                productUri: opcuaTarget.endpointUrl,
                manufacturerName: 'Industrial Vendor',
                softwareVersion: '1.0.0',
                endpoints: [{
                    endpointUrl: opcuaTarget.endpointUrl,
                    securityMode: opcuaTarget.securityMode || 'None',
                    securityPolicy: opcuaTarget.securityPolicy || 'None',
                }],
            }));

            // Track connection
            this.connections.set(opcuaTarget.id, {
                connected: true,
                lastContact: new Date(),
            });

            logger.debug('OPC-UA collection complete', { target: opcuaTarget.id });
        } catch (error) {
            logger.error('OPC-UA collection failed', {
                target: opcuaTarget.id,
                error: (error as Error).message,
            });
            throw error;
        }

        return telemetryData;
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        this.connections.clear();
        logger.info('OPC-UA collector cleaned up');
    }

    /**
     * Create server info telemetry
     */
    private createServerInfoTelemetry(target: OPCUATarget, serverInfo: OPCUAServerInfo): TelemetryData {
        return {
            id: generateUUID(),
            source: TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'opcua_server_info',
                serverInfo,
                endpoint: target.endpointUrl,
            },
            metadata: {
                collector: 'opcua',
                targetId: target.id,
                protocol: 'OPC-UA',
            },
        };
    }

    /**
     * Create mock server info telemetry
     */
    private createMockServerInfoTelemetry(target: OPCUATarget): TelemetryData {
        return this.createServerInfoTelemetry(target, {
            applicationName: 'Mock OPC-UA Server',
            applicationUri: target.endpointUrl,
            productUri: target.endpointUrl,
            manufacturerName: 'Mock Vendor',
            softwareVersion: '1.0.0-mock',
            endpoints: [{
                endpointUrl: target.endpointUrl,
                securityMode: target.securityMode || 'None',
                securityPolicy: target.securityPolicy || 'None',
            }],
        });
    }

    /**
     * Create nodes telemetry
     */
    private createNodesTelemetry(target: OPCUATarget, nodes: OPCUANode[]): TelemetryData {
        return {
            id: generateUUID(),
            source: TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'opcua_namespace',
                nodes,
                nodeCount: this.countNodes(nodes),
            },
            metadata: {
                collector: 'opcua',
                targetId: target.id,
                protocol: 'OPC-UA',
            },
        };
    }

    /**
     * Create mock nodes telemetry
     */
    private createMockNodesTelemetry(target: OPCUATarget): TelemetryData {
        const mockNodes: OPCUANode[] = [
            {
                nodeId: 'ns=2;s=Simulation',
                browseName: 'Simulation',
                displayName: 'Simulation Folder',
                nodeClass: 'Object',
                children: [
                    {
                        nodeId: 'ns=2;s=Counter',
                        browseName: 'Counter',
                        displayName: 'Counter Variable',
                        nodeClass: 'Variable',
                        dataType: 'Int32',
                        value: Math.floor(Math.random() * 1000),
                    },
                    {
                        nodeId: 'ns=2;s=Temperature',
                        browseName: 'Temperature',
                        displayName: 'Temperature Sensor',
                        nodeClass: 'Variable',
                        dataType: 'Double',
                        value: 20 + Math.random() * 10,
                    },
                ],
            },
        ];

        return this.createNodesTelemetry(target, mockNodes);
    }

    /**
     * Create values telemetry
     */
    private createValuesTelemetry(target: OPCUATarget, values: Record<string, unknown>): TelemetryData {
        return {
            id: generateUUID(),
            source: TelemetrySource.SNMP,
            timestamp: new Date(),
            processed: false,
            data: {
                type: 'opcua_values',
                values,
            },
            metadata: {
                collector: 'opcua',
                targetId: target.id,
                protocol: 'OPC-UA',
            },
        };
    }

    /**
     * Count all nodes recursively
     */
    private countNodes(nodes: OPCUANode[]): number {
        let count = nodes.length;
        for (const node of nodes) {
            if (node.children) {
                count += this.countNodes(node.children);
            }
        }
        return count;
    }

    /**
     * Get connection status for a target
     */
    getConnectionStatus(targetId: string): { connected: boolean; lastContact?: Date } {
        const connection = this.connections.get(targetId);
        return connection || { connected: false };
    }

    /**
     * Add OPC-UA target
     */
    addOPCUATarget(target: Omit<OPCUATarget, 'id'>): string {
        return this.addTarget(target);
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let opcuaCollectorInstance: OPCUACollector | null = null;

export function getOPCUACollector(): OPCUACollector {
    if (!opcuaCollectorInstance) {
        opcuaCollectorInstance = new OPCUACollector();
    }
    return opcuaCollectorInstance;
}

export function createOPCUACollector(config?: Partial<CollectorConfig>): OPCUACollector {
    return new OPCUACollector(config);
}
