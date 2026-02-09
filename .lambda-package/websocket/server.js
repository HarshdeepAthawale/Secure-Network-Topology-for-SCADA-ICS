"use strict";
/**
 * WebSocket Server for Real-time Updates
 * Provides live topology updates, alerts, and device status changes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTimeServer = void 0;
exports.getRealTimeServer = getRealTimeServer;
exports.startRealTimeServer = startRealTimeServer;
exports.stopRealTimeServer = stopRealTimeServer;
const ws_1 = __importStar(require("ws"));
const http_1 = require("http");
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const crypto_1 = require("../utils/crypto");
// ============================================================================
// WebSocket Server Class
// ============================================================================
class RealTimeServer extends events_1.EventEmitter {
    wss = null;
    httpServer = null;
    clients = new Map();
    heartbeatInterval = null;
    port;
    constructor(port = 8080) {
        super();
        this.port = port;
    }
    /**
     * Start the WebSocket server
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.httpServer = (0, http_1.createServer)((req, res) => {
                    // Health check endpoint
                    if (req.url === '/health') {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            status: 'healthy',
                            clients: this.clients.size,
                            uptime: process.uptime(),
                        }));
                        return;
                    }
                    res.writeHead(404);
                    res.end();
                });
                this.wss = new ws_1.WebSocketServer({ server: this.httpServer });
                this.wss.on('connection', (socket, request) => {
                    this.handleConnection(socket, request);
                });
                this.wss.on('error', (error) => {
                    logger_1.logger.error('WebSocket server error', { error: error.message });
                    this.emit('error', error);
                });
                // Start heartbeat to detect stale connections
                this.startHeartbeat();
                this.httpServer.listen(this.port, () => {
                    logger_1.logger.info('WebSocket server started', { port: this.port });
                    this.emit('started');
                    resolve();
                });
                this.httpServer.on('error', (error) => {
                    logger_1.logger.error('HTTP server error', { error: error.message });
                    reject(error);
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to start WebSocket server', { error: error.message });
                reject(error);
            }
        });
    }
    /**
     * Stop the WebSocket server
     */
    async stop() {
        return new Promise((resolve) => {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
            // Close all client connections
            for (const client of this.clients.values()) {
                client.socket.close(1001, 'Server shutting down');
            }
            this.clients.clear();
            if (this.wss) {
                this.wss.close(() => {
                    if (this.httpServer) {
                        this.httpServer.close(() => {
                            logger_1.logger.info('WebSocket server stopped');
                            this.emit('stopped');
                            resolve();
                        });
                    }
                    else {
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Handle new client connection
     */
    handleConnection(socket, request) {
        const clientId = (0, crypto_1.generateUUID)();
        const client = {
            id: clientId,
            socket,
            subscriptions: new Set(['system']), // Always subscribed to system
            isAlive: true,
            connectedAt: new Date(),
            metadata: {
                ip: request.socket.remoteAddress,
                userAgent: request.headers['user-agent'],
            },
        };
        this.clients.set(clientId, client);
        logger_1.logger.info('Client connected', { clientId, ip: client.metadata.ip });
        // Send welcome message
        this.sendToClient(client, {
            channel: 'system',
            event: 'connected',
            data: {
                clientId,
                serverTime: new Date().toISOString(),
                availableChannels: ['topology', 'devices', 'alerts', 'connections', 'telemetry'],
            },
            timestamp: new Date().toISOString(),
        });
        socket.on('message', (data) => {
            this.handleMessage(client, data);
        });
        socket.on('pong', () => {
            client.isAlive = true;
        });
        socket.on('close', (code, reason) => {
            this.clients.delete(clientId);
            logger_1.logger.info('Client disconnected', { clientId, code, reason: reason.toString() });
            this.emit('clientDisconnected', clientId);
        });
        socket.on('error', (error) => {
            logger_1.logger.error('Client socket error', { clientId, error: error.message });
        });
        this.emit('clientConnected', clientId, client);
    }
    /**
     * Handle incoming message from client
     */
    handleMessage(client, data) {
        try {
            const message = JSON.parse(data.toString());
            switch (message.type) {
                case 'subscribe':
                    if (message.channel && this.isValidChannel(message.channel)) {
                        client.subscriptions.add(message.channel);
                        this.sendToClient(client, {
                            channel: 'system',
                            event: 'subscribed',
                            data: { channel: message.channel },
                            timestamp: new Date().toISOString(),
                        });
                        logger_1.logger.debug('Client subscribed', { clientId: client.id, channel: message.channel });
                    }
                    break;
                case 'unsubscribe':
                    if (message.channel && message.channel !== 'system') {
                        client.subscriptions.delete(message.channel);
                        this.sendToClient(client, {
                            channel: 'system',
                            event: 'unsubscribed',
                            data: { channel: message.channel },
                            timestamp: new Date().toISOString(),
                        });
                        logger_1.logger.debug('Client unsubscribed', { clientId: client.id, channel: message.channel });
                    }
                    break;
                case 'ping':
                    this.sendToClient(client, {
                        channel: 'system',
                        event: 'pong',
                        data: { serverTime: new Date().toISOString() },
                        timestamp: new Date().toISOString(),
                    });
                    break;
                default:
                    logger_1.logger.warn('Unknown message type', { clientId: client.id, type: message.type });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to parse message', { clientId: client.id, error: error.message });
        }
    }
    /**
     * Send message to specific client
     */
    sendToClient(client, message) {
        if (client.socket.readyState === ws_1.default.OPEN) {
            client.socket.send(JSON.stringify(message));
        }
    }
    /**
     * Broadcast message to all subscribed clients
     */
    broadcast(channel, event, data) {
        const message = {
            channel,
            event,
            data,
            timestamp: new Date().toISOString(),
        };
        let sentCount = 0;
        for (const client of this.clients.values()) {
            if (client.subscriptions.has(channel) && client.socket.readyState === ws_1.default.OPEN) {
                client.socket.send(JSON.stringify(message));
                sentCount++;
            }
        }
        logger_1.logger.debug('Broadcast sent', { channel, event, clients: sentCount });
    }
    /**
     * Broadcast device update
     */
    broadcastDeviceUpdate(device, action) {
        this.broadcast('devices', `device:${action}`, device);
    }
    /**
     * Broadcast new alert
     */
    broadcastAlert(alert) {
        this.broadcast('alerts', 'alert:new', alert);
    }
    /**
     * Broadcast alert acknowledgment
     */
    broadcastAlertAcknowledged(alertId) {
        this.broadcast('alerts', 'alert:acknowledged', { alertId });
    }
    /**
     * Broadcast connection update
     */
    broadcastConnectionUpdate(connection, action) {
        this.broadcast('connections', `connection:${action}`, connection);
    }
    /**
     * Broadcast topology update
     */
    broadcastTopologyUpdate(snapshot) {
        this.broadcast('topology', 'topology:updated', snapshot);
    }
    /**
     * Broadcast telemetry data
     */
    broadcastTelemetry(telemetry) {
        this.broadcast('telemetry', 'telemetry:received', telemetry);
    }
    /**
     * Start heartbeat to detect stale connections
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            for (const [clientId, client] of this.clients) {
                if (!client.isAlive) {
                    logger_1.logger.info('Terminating stale connection', { clientId });
                    client.socket.terminate();
                    this.clients.delete(clientId);
                    continue;
                }
                client.isAlive = false;
                client.socket.ping();
            }
        }, 30000); // 30 second heartbeat
    }
    /**
     * Validate channel name
     */
    isValidChannel(channel) {
        const validChannels = ['topology', 'devices', 'alerts', 'connections', 'telemetry', 'system'];
        return validChannels.includes(channel);
    }
    /**
     * Get connected client count
     */
    get clientCount() {
        return this.clients.size;
    }
    /**
     * Get all connected clients info
     */
    getClientsInfo() {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            subscriptions: Array.from(client.subscriptions),
            connectedAt: client.connectedAt,
        }));
    }
}
exports.RealTimeServer = RealTimeServer;
// ============================================================================
// Singleton Instance
// ============================================================================
let serverInstance = null;
function getRealTimeServer(port) {
    if (!serverInstance) {
        serverInstance = new RealTimeServer(port || 8080);
    }
    return serverInstance;
}
async function startRealTimeServer(port) {
    const server = getRealTimeServer(port);
    await server.start();
    return server;
}
async function stopRealTimeServer() {
    if (serverInstance) {
        await serverInstance.stop();
        serverInstance = null;
    }
}
//# sourceMappingURL=server.js.map