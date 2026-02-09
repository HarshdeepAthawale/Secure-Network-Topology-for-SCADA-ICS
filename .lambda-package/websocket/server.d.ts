/**
 * WebSocket Server for Real-time Updates
 * Provides live topology updates, alerts, and device status changes
 */
import WebSocket from 'ws';
import { EventEmitter } from 'events';
export interface WebSocketClient {
    id: string;
    socket: WebSocket;
    subscriptions: Set<string>;
    isAlive: boolean;
    connectedAt: Date;
    metadata: Record<string, unknown>;
}
export interface WebSocketMessage {
    type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
    channel?: string;
    data?: unknown;
}
export interface BroadcastMessage {
    channel: string;
    event: string;
    data: unknown;
    timestamp: string;
}
export type MessageChannel = 'topology' | 'devices' | 'alerts' | 'connections' | 'telemetry' | 'system';
export declare class RealTimeServer extends EventEmitter {
    private wss;
    private httpServer;
    private clients;
    private heartbeatInterval;
    private readonly port;
    constructor(port?: number);
    /**
     * Start the WebSocket server
     */
    start(): Promise<void>;
    /**
     * Stop the WebSocket server
     */
    stop(): Promise<void>;
    /**
     * Handle new client connection
     */
    private handleConnection;
    /**
     * Handle incoming message from client
     */
    private handleMessage;
    /**
     * Send message to specific client
     */
    private sendToClient;
    /**
     * Broadcast message to all subscribed clients
     */
    broadcast(channel: MessageChannel, event: string, data: unknown): void;
    /**
     * Broadcast device update
     */
    broadcastDeviceUpdate(device: unknown, action: 'created' | 'updated' | 'deleted'): void;
    /**
     * Broadcast new alert
     */
    broadcastAlert(alert: unknown): void;
    /**
     * Broadcast alert acknowledgment
     */
    broadcastAlertAcknowledged(alertId: string): void;
    /**
     * Broadcast connection update
     */
    broadcastConnectionUpdate(connection: unknown, action: 'created' | 'updated' | 'deleted'): void;
    /**
     * Broadcast topology update
     */
    broadcastTopologyUpdate(snapshot: unknown): void;
    /**
     * Broadcast telemetry data
     */
    broadcastTelemetry(telemetry: unknown): void;
    /**
     * Start heartbeat to detect stale connections
     */
    private startHeartbeat;
    /**
     * Validate channel name
     */
    private isValidChannel;
    /**
     * Get connected client count
     */
    get clientCount(): number;
    /**
     * Get all connected clients info
     */
    getClientsInfo(): Array<{
        id: string;
        subscriptions: string[];
        connectedAt: Date;
    }>;
}
export declare function getRealTimeServer(port?: number): RealTimeServer;
export declare function startRealTimeServer(port?: number): Promise<RealTimeServer>;
export declare function stopRealTimeServer(): Promise<void>;
//# sourceMappingURL=server.d.ts.map