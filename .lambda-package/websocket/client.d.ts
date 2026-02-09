/**
 * WebSocket Client - Browser-compatible client for real-time updates
 */
export interface WebSocketConfig {
    url: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
}
export interface BroadcastMessage {
    channel: string;
    event: string;
    data: unknown;
    timestamp: string;
}
export type MessageHandler = (message: BroadcastMessage) => void;
/**
 * WebSocket client for connecting to the real-time server
 */
export declare class WebSocketClient {
    private ws;
    private config;
    private reconnectAttempts;
    private handlers;
    private globalHandlers;
    private heartbeatTimer;
    private reconnectTimer;
    private isConnecting;
    private manualClose;
    constructor(config: WebSocketConfig);
    /**
     * Connect to WebSocket server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void;
    /**
     * Subscribe to a channel
     */
    subscribe(channel: string): void;
    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channel: string): void;
    /**
     * Add handler for specific channel
     */
    on(channel: string, handler: MessageHandler): () => void;
    /**
     * Add handler for all messages
     */
    onMessage(handler: MessageHandler): () => void;
    /**
     * Add handler for device updates
     */
    onDeviceUpdate(handler: (data: {
        device: unknown;
        action: string;
    }) => void): () => void;
    /**
     * Add handler for new alerts
     */
    onAlert(handler: (alert: unknown) => void): () => void;
    /**
     * Add handler for topology updates
     */
    onTopologyUpdate(handler: (snapshot: unknown) => void): () => void;
    /**
     * Add handler for connection updates
     */
    onConnectionUpdate(handler: (data: {
        connection: unknown;
        action: string;
    }) => void): () => void;
    /**
     * Add handler for telemetry data
     */
    onTelemetry(handler: (telemetry: unknown) => void): () => void;
    /**
     * Check if connected
     */
    get isConnected(): boolean;
    /**
     * Get connection state
     */
    get state(): 'connecting' | 'connected' | 'disconnected';
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Start heartbeat to keep connection alive
     */
    private startHeartbeat;
    /**
     * Stop heartbeat
     */
    private stopHeartbeat;
    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect;
    /**
     * Clear reconnect timer
     */
    private clearReconnectTimer;
}
export declare function getWebSocketClient(config?: WebSocketConfig): WebSocketClient;
export declare function createWebSocketClient(config: WebSocketConfig): WebSocketClient;
//# sourceMappingURL=client.d.ts.map