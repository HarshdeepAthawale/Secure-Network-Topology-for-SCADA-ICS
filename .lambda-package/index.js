"use strict";
/**
 * SCADA Topology Discovery - Main Entry Point
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportHandler = exports.queryHandler = exports.processHandler = exports.ingestHandler = void 0;
// Export all modules
__exportStar(require("./utils"), exports);
__exportStar(require("./collectors"), exports);
__exportStar(require("./processors"), exports);
// Re-export Lambda handlers
var lambda_1 = require("./lambda");
Object.defineProperty(exports, "ingestHandler", { enumerable: true, get: function () { return lambda_1.ingestHandler; } });
Object.defineProperty(exports, "processHandler", { enumerable: true, get: function () { return lambda_1.processHandler; } });
Object.defineProperty(exports, "queryHandler", { enumerable: true, get: function () { return lambda_1.queryHandler; } });
Object.defineProperty(exports, "exportHandler", { enumerable: true, get: function () { return lambda_1.exportHandler; } });
// Application entry point
const collectors_1 = require("./collectors");
const utils_1 = require("./utils");
async function main() {
    (0, utils_1.setupGlobalErrorHandlers)();
    utils_1.logger.info('Starting SCADA Topology Discovery');
    const manager = (0, collectors_1.getCollectorManager)();
    // Handle shutdown
    const shutdown = async () => {
        utils_1.logger.info('Shutting down...');
        await manager.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    // Start collectors
    await manager.start();
    utils_1.logger.info('SCADA Topology Discovery is running');
}
// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        utils_1.logger.error('Fatal error', { error: error.message });
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map