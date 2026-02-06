/**
 * Utility module exports
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Configuration
export { config, Config } from './config';

// Logging
export { logger, Logger } from './logger';

// Cryptographic utilities
export {
  encrypt,
  decrypt,
  hash,
  hash512,
  hmac,
  hashPassword,
  verifyPassword,
  generateRandomString,
  generateUUID,
  generateToken,
  deriveKey,
  generateEncryptionKey,
  getCertificateFingerprint,
  secureCompare,
  maskSensitive,
  maskMacAddress,
  maskIpAddress,
  isValidEncryptionKey,
} from './crypto';

// Validation
export * from './validators';

// MQTT Client
export { MQTTClient, getMQTTClient, resetMQTTClient } from './mqtt-client';
export type { MQTTMessage, PublishOptions, MessageHandler } from './mqtt-client';

// Error handling
export * from './error-handler';
