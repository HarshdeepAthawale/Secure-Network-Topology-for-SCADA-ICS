"use strict";
/**
 * TLS-secured MQTT client for AWS IoT Core communication
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
exports.MQTTClient = void 0;
exports.getMQTTClient = getMQTTClient;
exports.resetMQTTClient = resetMQTTClient;
const mqtt = __importStar(require("mqtt"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
const config_1 = require("./config");
const logger_1 = require("./logger");
const crypto_1 = require("./crypto");
// ============================================================================
// MQTT Client Class
// ============================================================================
class MQTTClient extends events_1.EventEmitter {
    client = null;
    clientId;
    handlers = new Map();
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    isConnecting = false;
    isConnected = false;
    constructor() {
        super();
        this.clientId = `${config_1.config.appName}-${(0, crypto_1.generateUUID)().slice(0, 8)}`;
    }
    /**
     * Connect to the MQTT broker
     */
    async connect() {
        if (this.isConnected || this.isConnecting) {
            logger_1.logger.warn('MQTT client already connected or connecting');
            return;
        }
        this.isConnecting = true;
        const mqttConfig = config_1.config.mqtt;
        if (!mqttConfig.endpoint) {
            throw new Error('MQTT endpoint not configured');
        }
        try {
            // Load TLS certificates
            const tlsOptions = await this.loadTLSCertificates();
            const options = {
                clientId: this.clientId,
                protocol: 'mqtts',
                host: mqttConfig.endpoint,
                port: 8883,
                keepalive: mqttConfig.keepalive,
                reconnectPeriod: mqttConfig.reconnectPeriod,
                connectTimeout: 30000,
                clean: true,
                rejectUnauthorized: true,
                ...tlsOptions,
            };
            logger_1.logger.info('Connecting to MQTT broker', {
                endpoint: mqttConfig.endpoint,
                clientId: this.clientId,
            });
            return new Promise((resolve, reject) => {
                this.client = mqtt.connect(options);
                this.client.on('connect', () => {
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    logger_1.logger.info('Connected to MQTT broker', { clientId: this.clientId });
                    this.emit('connected');
                    resolve();
                });
                this.client.on('error', (error) => {
                    logger_1.logger.error('MQTT error', { error: error.message });
                    this.emit('error', error);
                    if (this.isConnecting) {
                        this.isConnecting = false;
                        reject(error);
                    }
                });
                this.client.on('close', () => {
                    this.isConnected = false;
                    logger_1.logger.warn('MQTT connection closed');
                    this.emit('disconnected');
                });
                this.client.on('reconnect', () => {
                    this.reconnectAttempts++;
                    logger_1.logger.info('MQTT reconnecting', { attempt: this.reconnectAttempts });
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        logger_1.logger.error('Max reconnect attempts reached');
                        this.client?.end(true);
                    }
                });
                this.client.on('offline', () => {
                    logger_1.logger.warn('MQTT client offline');
                    this.emit('offline');
                });
                this.client.on('message', (topic, payload) => {
                    this.handleMessage(topic, payload);
                });
            });
        }
        catch (error) {
            this.isConnecting = false;
            logger_1.logger.exception(error, 'Failed to connect to MQTT broker');
            throw error;
        }
    }
    /**
     * Load TLS certificates for secure connection
     */
    async loadTLSCertificates() {
        const tlsConfig = config_1.config.mqtt.tls;
        const certPath = path.resolve(tlsConfig.certPath);
        const keyPath = path.resolve(tlsConfig.keyPath);
        const caPath = path.resolve(tlsConfig.caPath);
        try {
            const [cert, key, ca] = await Promise.all([
                fs.promises.readFile(certPath),
                fs.promises.readFile(keyPath),
                fs.promises.readFile(caPath),
            ]);
            logger_1.logger.debug('TLS certificates loaded successfully');
            return { cert, key, ca };
        }
        catch (error) {
            logger_1.logger.error('Failed to load TLS certificates', {
                certPath,
                keyPath,
                caPath,
                error: error.message,
            });
            throw new Error('Failed to load TLS certificates');
        }
    }
    /**
     * Disconnect from the MQTT broker
     */
    async disconnect() {
        if (!this.client) {
            return;
        }
        return new Promise((resolve) => {
            this.client.end(false, {}, () => {
                this.isConnected = false;
                logger_1.logger.info('Disconnected from MQTT broker');
                resolve();
            });
        });
    }
    /**
     * Publish a message to a topic
     */
    async publish(topic, payload, options = {}) {
        if (!this.client || !this.isConnected) {
            throw new Error('MQTT client not connected');
        }
        const message = JSON.stringify(payload);
        const qos = options.qos ?? 1;
        const retain = options.retain ?? false;
        return new Promise((resolve, reject) => {
            this.client.publish(topic, message, { qos, retain }, (error) => {
                if (error) {
                    logger_1.logger.error('Failed to publish message', {
                        topic,
                        error: error.message,
                    });
                    reject(error);
                }
                else {
                    logger_1.logger.debug('Message published', { topic, qos, retain });
                    resolve();
                }
            });
        });
    }
    /**
     * Publish telemetry data
     */
    async publishTelemetry(data) {
        const topic = config_1.config.mqtt.topics.telemetry;
        await this.publish(topic, {
            timestamp: new Date().toISOString(),
            source: this.clientId,
            data,
        });
    }
    /**
     * Publish an alert
     */
    async publishAlert(alert) {
        const topic = config_1.config.mqtt.topics.alerts;
        await this.publish(topic, {
            timestamp: new Date().toISOString(),
            source: this.clientId,
            alert,
        }, { qos: 2 }); // Use QoS 2 for alerts to ensure delivery
    }
    /**
     * Subscribe to a topic
     */
    async subscribe(topic, handler) {
        if (!this.client || !this.isConnected) {
            throw new Error('MQTT client not connected');
        }
        return new Promise((resolve, reject) => {
            this.client.subscribe(topic, { qos: 1 }, (error) => {
                if (error) {
                    logger_1.logger.error('Failed to subscribe', { topic, error: error.message });
                    reject(error);
                }
                else {
                    // Register handler
                    const handlers = this.handlers.get(topic) || [];
                    handlers.push(handler);
                    this.handlers.set(topic, handlers);
                    logger_1.logger.info('Subscribed to topic', { topic });
                    resolve();
                }
            });
        });
    }
    /**
     * Unsubscribe from a topic
     */
    async unsubscribe(topic) {
        if (!this.client || !this.isConnected) {
            return;
        }
        return new Promise((resolve, reject) => {
            this.client.unsubscribe(topic, (error) => {
                if (error) {
                    logger_1.logger.error('Failed to unsubscribe', { topic, error: error.message });
                    reject(error);
                }
                else {
                    this.handlers.delete(topic);
                    logger_1.logger.info('Unsubscribed from topic', { topic });
                    resolve();
                }
            });
        });
    }
    /**
     * Handle incoming messages
     */
    handleMessage(topic, payload) {
        try {
            const data = JSON.parse(payload.toString());
            // Find matching handlers (support wildcards)
            for (const [pattern, handlers] of this.handlers) {
                if (this.topicMatches(topic, pattern)) {
                    for (const handler of handlers) {
                        Promise.resolve(handler(topic, data)).catch((error) => {
                            logger_1.logger.error('Error in message handler', {
                                topic,
                                error: error.message,
                            });
                        });
                    }
                }
            }
            this.emit('message', { topic, payload: data });
        }
        catch (error) {
            logger_1.logger.error('Failed to parse MQTT message', {
                topic,
                error: error.message,
            });
        }
    }
    /**
     * Check if a topic matches a pattern (supports + and # wildcards)
     */
    topicMatches(topic, pattern) {
        const topicParts = topic.split('/');
        const patternParts = pattern.split('/');
        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const topicPart = topicParts[i];
            if (patternPart === '#') {
                return true; // Multi-level wildcard matches everything
            }
            if (patternPart === '+') {
                continue; // Single-level wildcard matches any single level
            }
            if (patternPart !== topicPart) {
                return false;
            }
        }
        return topicParts.length === patternParts.length;
    }
    /**
     * Check if connected
     */
    get connected() {
        return this.isConnected;
    }
    /**
     * Get client ID
     */
    get id() {
        return this.clientId;
    }
}
exports.MQTTClient = MQTTClient;
// ============================================================================
// Singleton Instance
// ============================================================================
let mqttClientInstance = null;
function getMQTTClient() {
    if (!mqttClientInstance) {
        mqttClientInstance = new MQTTClient();
    }
    return mqttClientInstance;
}
function resetMQTTClient() {
    if (mqttClientInstance) {
        mqttClientInstance.disconnect().catch(() => { });
        mqttClientInstance = null;
    }
}
//# sourceMappingURL=mqtt-client.js.map