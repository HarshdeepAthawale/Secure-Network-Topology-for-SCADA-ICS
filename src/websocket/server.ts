/**
 * WebSocket Server for Real-time Updates
 * Provides live topology updates, alerts, and device status changes
 */

import WebSocket, { WebSocketServer } from 'ws';
import { createServer, Server as HttpServer, IncomingMessage } from 'http';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { generateUUID } from '../utils/crypto';
import { config } from '../utils/config';

// ============================================================================
// Types
// ============================================================================

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

export type MessageChannel =
    | 'topology'
    | 'devices'
    | 'alerts'
    | 'connections'
    | 'telemetry'
    | 'system';

// ============================================================================
// WebSocket Server Class
// ============================================================================

export class RealTimeServer extends EventEmitter {
    private wss: WebSocketServer | null = null;
    private httpServer: HttpServer | null = null;
    private clients: Map<string, WebSocketClient> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly port: number;

    constructor(port = 8080) {
        super();
        this.port = port;
    }

    /**
     * Start the WebSocket server
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.httpServer = createServer((req, res) => {
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

                this.wss = new WebSocketServer({ server: this.httpServer });

                this.wss.on('connection', (socket, request) => {
                    this.handleConnection(socket, request);
                });

                this.wss.on('error', (error) => {
                    logger.error('WebSocket server error', { error: error.message });
                    this.emit('error', error);
                });

                // Start heartbeat to detect stale connections
                this.startHeartbeat();

                this.httpServer.listen(this.port, () => {
                    logger.info('WebSocket server started', { port: this.port });
                    this.emit('started');
                    resolve();
                });

                this.httpServer.on('error', (error) => {
                    logger.error('HTTP server error', { error: error.message });
                    reject(error);
                });
            } catch (error) {
                logger.error('Failed to start WebSocket server', { error: (error as Error).message });
                reject(error);
            }
        });
    }

    /**
     * Stop the WebSocket server
     */
    async stop(): Promise<void> {
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
                            logger.info('WebSocket server stopped');
                            this.emit('stopped');
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle new client connection
     */
    private handleConnection(socket: WebSocket, request: IncomingMessage): void {
        const clientId = generateUUID();
        const client: WebSocketClient = {
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
        logger.info('Client connected', { clientId, ip: client.metadata.ip });

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
            logger.info('Client disconnected', { clientId, code, reason: reason.toString() });
            this.emit('clientDisconnected', clientId);
        });

        socket.on('error', (error) => {
            logger.error('Client socket error', { clientId, error: error.message });
        });

        this.emit('clientConnected', clientId, client);
    }

    /**
     * Handle incoming message from client
     */
    private handleMessage(client: WebSocketClient, data: WebSocket.RawData): void {
        try {
            const message: WebSocketMessage = JSON.parse(data.toString());

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
                        logger.debug('Client subscribed', { clientId: client.id, channel: message.channel });
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
                        logger.debug('Client unsubscribed', { clientId: client.id, channel: message.channel });
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
                    logger.warn('Unknown message type', { clientId: client.id, type: message.type });
            }
        } catch (error) {
            logger.error('Failed to parse message', { clientId: client.id, error: (error as Error).message });
        }
    }

    /**
     * Send message to specific client
     */
    private sendToClient(client: WebSocketClient, message: BroadcastMessage): void {
        if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify(message));
        }
    }

    /**
     * Broadcast message to all subscribed clients
     */
    broadcast(channel: MessageChannel, event: string, data: unknown): void {
        const message: BroadcastMessage = {
            channel,
            event,
            data,
            timestamp: new Date().toISOString(),
        };

        let sentCount = 0;
        for (const client of this.clients.values()) {
            if (client.subscriptions.has(channel) && client.socket.readyState === WebSocket.OPEN) {
                client.socket.send(JSON.stringify(message));
                sentCount++;
            }
        }

        logger.debug('Broadcast sent', { channel, event, clients: sentCount });
    }

    /**
     * Broadcast device update
     */
    broadcastDeviceUpdate(device: unknown, action: 'created' | 'updated' | 'deleted'): void {
        this.broadcast('devices', `device:${action}`, device);
    }

    /**
     * Broadcast new alert
     */
    broadcastAlert(alert: unknown): void {
        this.broadcast('alerts', 'alert:new', alert);
    }

    /**
     * Broadcast alert acknowledgment
     */
    broadcastAlertAcknowledged(alertId: string): void {
        this.broadcast('alerts', 'alert:acknowledged', { alertId });
    }

    /**
     * Broadcast connection update
     */
    broadcastConnectionUpdate(connection: unknown, action: 'created' | 'updated' | 'deleted'): void {
        this.broadcast('connections', `connection:${action}`, connection);
    }

    /**
     * Broadcast topology update
     */
    broadcastTopologyUpdate(snapshot: unknown): void {
        this.broadcast('topology', 'topology:updated', snapshot);
    }

    /**
     * Broadcast telemetry data
     */
    broadcastTelemetry(telemetry: unknown): void {
        this.broadcast('telemetry', 'telemetry:received', telemetry);
    }

    /**
     * Start heartbeat to detect stale connections
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            for (const [clientId, client] of this.clients) {
                if (!client.isAlive) {
                    logger.info('Terminating stale connection', { clientId });
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
    private isValidChannel(channel: string): boolean {
        const validChannels = ['topology', 'devices', 'alerts', 'connections', 'telemetry', 'system'];
        return validChannels.includes(channel);
    }

    /**
     * Get connected client count
     */
    get clientCount(): number {
        return this.clients.size;
    }

    /**
     * Get all connected clients info
     */
    getClientsInfo(): Array<{ id: string; subscriptions: string[]; connectedAt: Date }> {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            subscriptions: Array.from(client.subscriptions),
            connectedAt: client.connectedAt,
        }));
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serverInstance: RealTimeServer | null = null;

export function getRealTimeServer(port?: number): RealTimeServer {
    if (!serverInstance) {
        serverInstance = new RealTimeServer(port || 8080);
    }
    return serverInstance;
}

export async function startRealTimeServer(port?: number): Promise<RealTimeServer> {
    const server = getRealTimeServer(port);
    await server.start();
    return server;
}

export async function stopRealTimeServer(): Promise<void> {
    if (serverInstance) {
        await serverInstance.stop();
        serverInstance = null;
    }
}
