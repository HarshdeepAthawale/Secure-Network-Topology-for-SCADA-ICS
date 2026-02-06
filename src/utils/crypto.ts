/**
 * Cryptographic utilities for SCADA Topology Discovery
 * Provides encryption, decryption, and secure key management
 */

import * as crypto from 'crypto';
import { config } from './config';
import { logger } from './logger';

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits for AES-256
const PBKDF2_ITERATIONS = 100000;

// ============================================================================
// Encryption/Decryption
// ============================================================================

/**
 * Encrypt data using AES-256-GCM
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string, key?: string): string {
  const encryptionKey = key || config.security.encryptionKey;

  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive a 32-byte key from the encryption key
    const derivedKey = crypto.scryptSync(encryptionKey, 'scada-salt', KEY_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    // Encrypt the data
    let ciphertext = cipher.update(plaintext, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    // Get the auth tag
    const authTag = cipher.getAuthTag();

    // Combine iv + authTag + ciphertext
    const combined = Buffer.concat([iv, authTag, ciphertext]);

    return combined.toString('base64');
  } catch (error) {
    logger.exception(error as Error, 'Encryption failed');
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * Input: base64(iv + authTag + ciphertext)
 */
export function decrypt(encryptedData: string, key?: string): string {
  const encryptionKey = key || config.security.encryptionKey;

  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  try {
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract iv, authTag, and ciphertext
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

    // Derive the key
    const derivedKey = crypto.scryptSync(encryptionKey, 'scada-salt', KEY_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext.toString('utf8');
  } catch (error) {
    logger.exception(error as Error, 'Decryption failed');
    throw new Error('Decryption failed - data may be corrupted or key is incorrect');
  }
}

// ============================================================================
// Hashing
// ============================================================================

/**
 * Create a SHA-256 hash of data
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create a SHA-512 hash of data
 */
export function hash512(data: string): string {
  return crypto.createHash('sha512').update(data).digest('hex');
}

/**
 * Create a HMAC-SHA256 signature
 */
export function hmac(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// ============================================================================
// Password Hashing
// ============================================================================

/**
 * Hash a password using PBKDF2
 * Returns: salt:hash (both base64 encoded)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltBase64, hashBase64] = storedHash.split(':');

  if (!saltBase64 || !hashBase64) {
    return false;
  }

  const salt = Buffer.from(saltBase64, 'base64');
  const expectedHash = Buffer.from(hashBase64, 'base64');
  const actualHash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

  return crypto.timingSafeEqual(expectedHash, actualHash);
}

// ============================================================================
// Random Generation
// ============================================================================

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a secure token
 */
export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derive a key from a password using PBKDF2
 */
export function deriveKey(password: string, salt: string, iterations: number = PBKDF2_ITERATIONS): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha512');
}

/**
 * Generate a new encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

// ============================================================================
// Certificate Utilities
// ============================================================================

/**
 * Verify a certificate's public key fingerprint
 */
export function getCertificateFingerprint(certPem: string): string {
  const lines = certPem.split('\n');
  const base64Cert = lines
    .filter(line => !line.startsWith('-----'))
    .join('');
  const certBuffer = Buffer.from(base64Cert, 'base64');
  return crypto.createHash('sha256').update(certBuffer).digest('hex');
}

/**
 * Generate a self-signed certificate (for development only)
 */
export function generateSelfSignedCert(): { cert: string; key: string } {
  // Note: In production, use proper CA-signed certificates
  logger.warn('Generating self-signed certificate - for development only');

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  return {
    key: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    cert: publicKey.export({ type: 'spki', format: 'pem' }) as string,
  };
}

// ============================================================================
// Secure Comparison
// ============================================================================

/**
 * Timing-safe string comparison
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================================================
// Data Masking
// ============================================================================

/**
 * Mask sensitive data for logging
 */
export function maskSensitive(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) {
    return '*'.repeat(data.length);
  }
  return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
}

/**
 * Mask MAC address (show first and last octets)
 */
export function maskMacAddress(mac: string): string {
  const parts = mac.split(':');
  if (parts.length !== 6) return mac;
  return `${parts[0]}:xx:xx:xx:xx:${parts[5]}`;
}

/**
 * Mask IP address (show first and last octets)
 */
export function maskIpAddress(ip: string): string {
  const parts = ip.split('.');
  if (parts.length !== 4) return ip;
  return `${parts[0]}.xxx.xxx.${parts[3]}`;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if encryption key is valid (proper length and entropy)
 */
export function isValidEncryptionKey(key: string): boolean {
  // Key should be at least 32 characters
  if (key.length < 32) {
    return false;
  }

  // Check for basic entropy (not all same character, has variety)
  const uniqueChars = new Set(key).size;
  return uniqueChars >= 10;
}
