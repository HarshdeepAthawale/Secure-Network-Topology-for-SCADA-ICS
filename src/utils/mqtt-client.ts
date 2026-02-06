/**
 * TLS-secured MQTT client for AWS IoT Core communication
 */

import * as mqtt from 'mqtt';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { config } from './config';
import { logger } from './logger';
import { generateUUID } from './crypto';

// ============================================================================
// Types
// ============================================================================

export interface MQTTMessage {
  topic: string;
  payload: unknown;
  qos: 0 | 1 | 2;
  retain: boolean;
}

export interface PublishOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

export type MessageHandler = (topic: string, payload: unknown) => void | Promise<void>;

// ============================================================================
// MQTT Client Class
// ============================================================================

export class MQTTClient extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private readonly clientId: string;
  private readonly handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private isConnecting = false;
  private isConnected = false;

  constructor() {
    super();
    this.clientId = `${config.appName}-${generateUUID().slice(0, 8)}`;
  }

  /**
   * Connect to the MQTT broker
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      logger.warn('MQTT client already connected or connecting');
      return;
    }

    this.isConnecting = true;

    const mqttConfig = config.mqtt;

    if (!mqttConfig.endpoint) {
      throw new Error('MQTT endpoint not configured');
    }

    try {
      // Load TLS certificates
      const tlsOptions = await this.loadTLSCertificates();

      const options: mqtt.IClientOptions = {
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

      logger.info('Connecting to MQTT broker', {
        endpoint: mqttConfig.endpoint,
        clientId: this.clientId,
      });

      return new Promise((resolve, reject) => {
        this.client = mqtt.connect(options);

        this.client.on('connect', () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          logger.info('Connected to MQTT broker', { clientId: this.clientId });
          this.emit('connected');
          resolve();
        });

        this.client.on('error', (error) => {
          logger.error('MQTT error', { error: error.message });
          this.emit('error', error);
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(error);
          }
        });

        this.client.on('close', () => {
          this.isConnected = false;
          logger.warn('MQTT connection closed');
          this.emit('disconnected');
        });

        this.client.on('reconnect', () => {
          this.reconnectAttempts++;
          logger.info('MQTT reconnecting', { attempt: this.reconnectAttempts });

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnect attempts reached');
            this.client?.end(true);
          }
        });

        this.client.on('offline', () => {
          logger.warn('MQTT client offline');
          this.emit('offline');
        });

        this.client.on('message', (topic, payload) => {
          this.handleMessage(topic, payload);
        });
      });
    } catch (error) {
      this.isConnecting = false;
      logger.exception(error as Error, 'Failed to connect to MQTT broker');
      throw error;
    }
  }

  /**
   * Load TLS certificates for secure connection
   */
  private async loadTLSCertificates(): Promise<{
    cert: Buffer;
    key: Buffer;
    ca: Buffer;
  }> {
    const tlsConfig = config.mqtt.tls;

    const certPath = path.resolve(tlsConfig.certPath);
    const keyPath = path.resolve(tlsConfig.keyPath);
    const caPath = path.resolve(tlsConfig.caPath);

    try {
      const [cert, key, ca] = await Promise.all([
        fs.promises.readFile(certPath),
        fs.promises.readFile(keyPath),
        fs.promises.readFile(caPath),
      ]);

      logger.debug('TLS certificates loaded successfully');
      return { cert, key, ca };
    } catch (error) {
      logger.error('Failed to load TLS certificates', {
        certPath,
        keyPath,
        caPath,
        error: (error as Error).message,
      });
      throw new Error('Failed to load TLS certificates');
    }
  }

  /**
   * Disconnect from the MQTT broker
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    return new Promise((resolve) => {
      this.client!.end(false, {}, () => {
        this.isConnected = false;
        logger.info('Disconnected from MQTT broker');
        resolve();
      });
    });
  }

  /**
   * Publish a message to a topic
   */
  async publish(topic: string, payload: unknown, options: PublishOptions = {}): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const message = JSON.stringify(payload);
    const qos = options.qos ?? 1;
    const retain = options.retain ?? false;

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, message, { qos, retain }, (error) => {
        if (error) {
          logger.error('Failed to publish message', {
            topic,
            error: error.message,
          });
          reject(error);
        } else {
          logger.debug('Message published', { topic, qos, retain });
          resolve();
        }
      });
    });
  }

  /**
   * Publish telemetry data
   */
  async publishTelemetry(data: unknown): Promise<void> {
    const topic = config.mqtt.topics.telemetry;
    await this.publish(topic, {
      timestamp: new Date().toISOString(),
      source: this.clientId,
      data,
    });
  }

  /**
   * Publish an alert
   */
  async publishAlert(alert: unknown): Promise<void> {
    const topic = config.mqtt.topics.alerts;
    await this.publish(topic, {
      timestamp: new Date().toISOString(),
      source: this.clientId,
      alert,
    }, { qos: 2 }); // Use QoS 2 for alerts to ensure delivery
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(topic: string, handler: MessageHandler): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client!.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          logger.error('Failed to subscribe', { topic, error: error.message });
          reject(error);
        } else {
          // Register handler
          const handlers = this.handlers.get(topic) || [];
          handlers.push(handler);
          this.handlers.set(topic, handlers);

          logger.info('Subscribed to topic', { topic });
          resolve();
        }
      });
    });
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(topic: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.client!.unsubscribe(topic, (error) => {
        if (error) {
          logger.error('Failed to unsubscribe', { topic, error: error.message });
          reject(error);
        } else {
          this.handlers.delete(topic);
          logger.info('Unsubscribed from topic', { topic });
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(topic: string, payload: Buffer): void {
    try {
      const data = JSON.parse(payload.toString());

      // Find matching handlers (support wildcards)
      for (const [pattern, handlers] of this.handlers) {
        if (this.topicMatches(topic, pattern)) {
          for (const handler of handlers) {
            Promise.resolve(handler(topic, data)).catch((error) => {
              logger.error('Error in message handler', {
                topic,
                error: (error as Error).message,
              });
            });
          }
        }
      }

      this.emit('message', { topic, payload: data });
    } catch (error) {
      logger.error('Failed to parse MQTT message', {
        topic,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Check if a topic matches a pattern (supports + and # wildcards)
   */
  private topicMatches(topic: string, pattern: string): boolean {
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
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get client ID
   */
  get id(): string {
    return this.clientId;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let mqttClientInstance: MQTTClient | null = null;

export function getMQTTClient(): MQTTClient {
  if (!mqttClientInstance) {
    mqttClientInstance = new MQTTClient();
  }
  return mqttClientInstance;
}

export function resetMQTTClient(): void {
  if (mqttClientInstance) {
    mqttClientInstance.disconnect().catch(() => {});
    mqttClientInstance = null;
  }
}
