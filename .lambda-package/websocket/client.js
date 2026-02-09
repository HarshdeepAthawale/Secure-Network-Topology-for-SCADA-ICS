"use strict";
/**
 * WebSocket Client - Browser-compatible client for real-time updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
exports.getWebSocketClient = getWebSocketClient;
exports.createWebSocketClient = createWebSocketClient;
/**
 * WebSocket client for connecting to the real-time server
 */
class WebSocketClient {
    ws = null;
    config;
    reconnectAttempts = 0;
    handlers = new Map();
    globalHandlers = new Set();
    heartbeatTimer = null;
    reconnectTimer = null;
    isConnecting = false;
    manualClose = false;
    constructor(config) {
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
    connect() {
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
            }
            catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }
    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
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
    subscribe(channel) {
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
    unsubscribe(channel) {
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
    on(channel, handler) {
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
        }
        this.handlers.get(channel).add(handler);
        // Return unsubscribe function
        return () => {
            this.handlers.get(channel)?.delete(handler);
        };
    }
    /**
     * Add handler for all messages
     */
    onMessage(handler) {
        this.globalHandlers.add(handler);
        return () => {
            this.globalHandlers.delete(handler);
        };
    }
    /**
     * Add handler for device updates
     */
    onDeviceUpdate(handler) {
        return this.on('devices', (msg) => {
            const action = msg.event.split(':')[1];
            handler({ device: msg.data, action });
        });
    }
    /**
     * Add handler for new alerts
     */
    onAlert(handler) {
        return this.on('alerts', (msg) => {
            if (msg.event === 'alert:new') {
                handler(msg.data);
            }
        });
    }
    /**
     * Add handler for topology updates
     */
    onTopologyUpdate(handler) {
        return this.on('topology', (msg) => {
            if (msg.event === 'topology:updated') {
                handler(msg.data);
            }
        });
    }
    /**
     * Add handler for connection updates
     */
    onConnectionUpdate(handler) {
        return this.on('connections', (msg) => {
            const action = msg.event.split(':')[1];
            handler({ connection: msg.data, action });
        });
    }
    /**
     * Add handler for telemetry data
     */
    onTelemetry(handler) {
        return this.on('telemetry', (msg) => {
            handler(msg.data);
        });
    }
    /**
     * Check if connected
     */
    get isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    /**
     * Get connection state
     */
    get state() {
        if (this.isConnecting)
            return 'connecting';
        if (this.ws?.readyState === WebSocket.OPEN)
            return 'connected';
        return 'disconnected';
    }
    /**
     * Handle incoming message
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            // Call global handlers
            for (const handler of this.globalHandlers) {
                try {
                    handler(message);
                }
                catch (error) {
                    console.error('[WebSocket] Handler error', error);
                }
            }
            // Call channel-specific handlers
            const channelHandlers = this.handlers.get(message.channel);
            if (channelHandlers) {
                for (const handler of channelHandlers) {
                    try {
                        handler(message);
                    }
                    catch (error) {
                        console.error('[WebSocket] Handler error', error);
                    }
                }
            }
        }
        catch (error) {
            console.error('[WebSocket] Message parse error', error);
        }
    }
    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
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
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
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
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
exports.WebSocketClient = WebSocketClient;
/**
 * Create WebSocket client singleton
 */
let clientInstance = null;
function getWebSocketClient(config) {
    if (!clientInstance && config) {
        clientInstance = new WebSocketClient(config);
    }
    if (!clientInstance) {
        throw new Error('WebSocket client not initialized. Call with config first.');
    }
    return clientInstance;
}
function createWebSocketClient(config) {
    return new WebSocketClient(config);
}
//# sourceMappingURL=client.js.map