/**
 * WebSocket Module - Central export
 */

// Server exports
export {
    RealTimeServer,
    WebSocketClient as ServerWebSocketClient,
    WebSocketMessage,
    BroadcastMessage,
    MessageChannel,
    getRealTimeServer,
    startRealTimeServer,
    stopRealTimeServer,
} from './server';

// Client exports (for frontend/browser usage)
export {
    WebSocketClient,
    WebSocketConfig,
    MessageHandler,
    getWebSocketClient,
    createWebSocketClient,
} from './client';
