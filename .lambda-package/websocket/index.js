"use strict";
/**
 * WebSocket Module - Central export
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebSocketClient = exports.getWebSocketClient = exports.WebSocketClient = exports.stopRealTimeServer = exports.startRealTimeServer = exports.getRealTimeServer = exports.RealTimeServer = void 0;
// Server exports
var server_1 = require("./server");
Object.defineProperty(exports, "RealTimeServer", { enumerable: true, get: function () { return server_1.RealTimeServer; } });
Object.defineProperty(exports, "getRealTimeServer", { enumerable: true, get: function () { return server_1.getRealTimeServer; } });
Object.defineProperty(exports, "startRealTimeServer", { enumerable: true, get: function () { return server_1.startRealTimeServer; } });
Object.defineProperty(exports, "stopRealTimeServer", { enumerable: true, get: function () { return server_1.stopRealTimeServer; } });
// Client exports (for frontend/browser usage)
var client_1 = require("./client");
Object.defineProperty(exports, "WebSocketClient", { enumerable: true, get: function () { return client_1.WebSocketClient; } });
Object.defineProperty(exports, "getWebSocketClient", { enumerable: true, get: function () { return client_1.getWebSocketClient; } });
Object.defineProperty(exports, "createWebSocketClient", { enumerable: true, get: function () { return client_1.createWebSocketClient; } });
//# sourceMappingURL=index.js.map