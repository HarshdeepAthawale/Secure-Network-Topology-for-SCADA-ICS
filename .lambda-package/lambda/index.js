"use strict";
/**
 * Lambda functions module exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportHandler = exports.queryHandler = exports.processHandler = exports.ingestHandler = void 0;
var handler_1 = require("./ingest/handler");
Object.defineProperty(exports, "ingestHandler", { enumerable: true, get: function () { return handler_1.handler; } });
var handler_2 = require("./process/handler");
Object.defineProperty(exports, "processHandler", { enumerable: true, get: function () { return handler_2.handler; } });
var handler_3 = require("./query/handler");
Object.defineProperty(exports, "queryHandler", { enumerable: true, get: function () { return handler_3.handler; } });
var handler_4 = require("./export/handler");
Object.defineProperty(exports, "exportHandler", { enumerable: true, get: function () { return handler_4.handler; } });
//# sourceMappingURL=index.js.map