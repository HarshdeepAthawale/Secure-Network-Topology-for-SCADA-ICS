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
export class WebSocketClient {
    private ws: WebSocket | null = null;
    private config: Required<WebSocketConfig>;
    private reconnectAttempts = 0;
    private handlers: Map<string, Set<MessageHandler>> = new Map();
    private globalHandlers: Set<MessageHandler> = new Set();
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isConnecting = false;
    private manualClose = false;

    constructor(config: WebSocketConfig) {
        this.config = {
            url: config.url,
            autoReconnect: config.autoReconnect ?? true,
            reconnectInterval: config.reconnectInterval ?? 5000,
            maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
            heartbeatInterval: config.heartbeatInterval ?? 30000,
        };
    }

    /**
     * Connect to WebSocket server
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            if (this.isConnecting) {
                reject(new Error('Connection already in progress'));
                return;
            }

            this.isConnecting = true;
            this.manualClose = false;

            try {
                this.ws = new WebSocket(this.config.url);

                this.ws.onopen = () => {
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    console.log('[WebSocket] Connected to', this.config.url);
                    resolve();
                };

                this.ws.onclose = (event) => {
                    this.isConnecting = false;
                    this.stopHeartbeat();
                    console.log('[WebSocket] Disconnected', event.code, event.reason);

                    if (!this.manualClose && this.config.autoReconnect) {
                        this.scheduleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    this.isConnecting = false;
                    console.error('[WebSocket] Error', error);
                    reject(error);
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        this.manualClose = true;
        this.stopHeartbeat();
        this.clearReconnectTimer();

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
    }

    /**
     * Subscribe to a channel
     */
    subscribe(channel: string): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                channel,
            }));
        }
    }

    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channel: string): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'unsubscribe',
                channel,
            }));
        }
    }

    /**
     * Add handler for specific channel
     */
    on(channel: string, handler: MessageHandler): () => void {
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
        }
        this.handlers.get(channel)!.add(handler);

        // Return unsubscribe function
        return () => {
            this.handlers.get(channel)?.delete(handler);
        };
    }

    /**
     * Add handler for all messages
     */
    onMessage(handler: MessageHandler): () => void {
        this.globalHandlers.add(handler);

        return () => {
            this.globalHandlers.delete(handler);
        };
    }

    /**
     * Add handler for device updates
     */
    onDeviceUpdate(handler: (data: { device: unknown; action: string }) => void): () => void {
        return this.on('devices', (msg) => {
            const action = msg.event.split(':')[1];
            handler({ device: msg.data, action });
        });
    }

    /**
     * Add handler for new alerts
     */
    onAlert(handler: (alert: unknown) => void): () => void {
        return this.on('alerts', (msg) => {
            if (msg.event === 'alert:new') {
                handler(msg.data);
            }
        });
    }

    /**
     * Add handler for topology updates
     */
    onTopologyUpdate(handler: (snapshot: unknown) => void): () => void {
        return this.on('topology', (msg) => {
            if (msg.event === 'topology:updated') {
                handler(msg.data);
            }
        });
    }

    /**
     * Add handler for connection updates
     */
    onConnectionUpdate(handler: (data: { connection: unknown; action: string }) => void): () => void {
        return this.on('connections', (msg) => {
            const action = msg.event.split(':')[1];
            handler({ connection: msg.data, action });
        });
    }

    /**
     * Add handler for telemetry data
     */
    onTelemetry(handler: (telemetry: unknown) => void): () => void {
        return this.on('telemetry', (msg) => {
            handler(msg.data);
        });
    }

    /**
     * Check if connected
     */
    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Get connection state
     */
    get state(): 'connecting' | 'connected' | 'disconnected' {
        if (this.isConnecting) return 'connecting';
        if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
        return 'disconnected';
    }

    /**
     * Handle incoming message
     */
    private handleMessage(data: string): void {
        try {
            const message: BroadcastMessage = JSON.parse(data);

            // Call global handlers
            for (const handler of this.globalHandlers) {
                try {
                    handler(message);
                } catch (error) {
                    console.error('[WebSocket] Handler error', error);
                }
            }

            // Call channel-specific handlers
            const channelHandlers = this.handlers.get(message.channel);
            if (channelHandlers) {
                for (const handler of channelHandlers) {
                    try {
                        handler(message);
                    } catch (error) {
                        console.error('[WebSocket] Handler error', error);
                    }
                }
            }
        } catch (error) {
            console.error('[WebSocket] Message parse error', error);
        }
    }

    /**
     * Start heartbeat to keep connection alive
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.log('[WebSocket] Max reconnect attempts reached');
            return;
        }

        this.clearReconnectTimer();

        const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts);
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch((error) => {
                console.error('[WebSocket] Reconnect failed', error);
            });
        }, delay);
    }

    /**
     * Clear reconnect timer
     */
    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}

/**
 * Create WebSocket client singleton
 */
let clientInstance: WebSocketClient | null = null;

export function getWebSocketClient(config?: WebSocketConfig): WebSocketClient {
    if (!clientInstance && config) {
        clientInstance = new WebSocketClient(config);
    }
    if (!clientInstance) {
        throw new Error('WebSocket client not initialized. Call with config first.');
    }
    return clientInstance;
}

export function createWebSocketClient(config: WebSocketConfig): WebSocketClient {
    return new WebSocketClient(config);
}
