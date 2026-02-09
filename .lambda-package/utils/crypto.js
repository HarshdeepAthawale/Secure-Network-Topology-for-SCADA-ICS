"use strict";
/**
 * Cryptographic utilities for SCADA Topology Discovery
 * Provides encryption, decryption, and secure key management
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
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.hash = hash;
exports.hash512 = hash512;
exports.hmac = hmac;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateRandomString = generateRandomString;
exports.generateUUID = generateUUID;
exports.generateToken = generateToken;
exports.deriveKey = deriveKey;
exports.generateEncryptionKey = generateEncryptionKey;
exports.getCertificateFingerprint = getCertificateFingerprint;
exports.generateSelfSignedCert = generateSelfSignedCert;
exports.secureCompare = secureCompare;
exports.maskSensitive = maskSensitive;
exports.maskMacAddress = maskMacAddress;
exports.maskIpAddress = maskIpAddress;
exports.isValidEncryptionKey = isValidEncryptionKey;
const crypto = __importStar(require("crypto"));
const config_1 = require("./config");
const logger_1 = require("./logger");
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
function encrypt(plaintext, key) {
    const encryptionKey = key || config_1.config.security.encryptionKey;
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
    }
    catch (error) {
        logger_1.logger.exception(error, 'Encryption failed');
        throw new Error('Encryption failed');
    }
}
/**
 * Decrypt data encrypted with AES-256-GCM
 * Input: base64(iv + authTag + ciphertext)
 */
function decrypt(encryptedData, key) {
    const encryptionKey = key || config_1.config.security.encryptionKey;
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
    }
    catch (error) {
        logger_1.logger.exception(error, 'Decryption failed');
        throw new Error('Decryption failed - data may be corrupted or key is incorrect');
    }
}
// ============================================================================
// Hashing
// ============================================================================
/**
 * Create a SHA-256 hash of data
 */
function hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
/**
 * Create a SHA-512 hash of data
 */
function hash512(data) {
    return crypto.createHash('sha512').update(data).digest('hex');
}
/**
 * Create a HMAC-SHA256 signature
 */
function hmac(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}
// ============================================================================
// Password Hashing
// ============================================================================
/**
 * Hash a password using PBKDF2
 * Returns: salt:hash (both base64 encoded)
 */
function hashPassword(password) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
    return `${salt.toString('base64')}:${hash.toString('base64')}`;
}
/**
 * Verify a password against a hash
 */
function verifyPassword(password, storedHash) {
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
function generateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}
/**
 * Generate a UUID v4
 */
function generateUUID() {
    return crypto.randomUUID();
}
/**
 * Generate a secure token
 */
function generateToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}
// ============================================================================
// Key Derivation
// ============================================================================
/**
 * Derive a key from a password using PBKDF2
 */
function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
    return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha512');
}
/**
 * Generate a new encryption key
 */
function generateEncryptionKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('base64');
}
// ============================================================================
// Certificate Utilities
// ============================================================================
/**
 * Verify a certificate's public key fingerprint
 */
function getCertificateFingerprint(certPem) {
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
function generateSelfSignedCert() {
    // Note: In production, use proper CA-signed certificates
    logger_1.logger.warn('Generating self-signed certificate - for development only');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });
    return {
        key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        cert: publicKey.export({ type: 'spki', format: 'pem' }),
    };
}
// ============================================================================
// Secure Comparison
// ============================================================================
/**
 * Timing-safe string comparison
 */
function secureCompare(a, b) {
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
function maskSensitive(data, visibleChars = 4) {
    if (data.length <= visibleChars) {
        return '*'.repeat(data.length);
    }
    return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
}
/**
 * Mask MAC address (show first and last octets)
 */
function maskMacAddress(mac) {
    const parts = mac.split(':');
    if (parts.length !== 6)
        return mac;
    return `${parts[0]}:xx:xx:xx:xx:${parts[5]}`;
}
/**
 * Mask IP address (show first and last octets)
 */
function maskIpAddress(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4)
        return ip;
    return `${parts[0]}.xxx.xxx.${parts[3]}`;
}
// ============================================================================
// Validation
// ============================================================================
/**
 * Check if encryption key is valid (proper length and entropy)
 */
function isValidEncryptionKey(key) {
    // Key should be at least 32 characters
    if (key.length < 32) {
        return false;
    }
    // Check for basic entropy (not all same character, has variety)
    const uniqueChars = new Set(key).size;
    return uniqueChars >= 10;
}
//# sourceMappingURL=crypto.js.map