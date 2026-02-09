/**
 * Cryptographic utilities for SCADA Topology Discovery
 * Provides encryption, decryption, and secure key management
 */
/**
 * Encrypt data using AES-256-GCM
 * Returns: base64(iv + authTag + ciphertext)
 */
export declare function encrypt(plaintext: string, key?: string): string;
/**
 * Decrypt data encrypted with AES-256-GCM
 * Input: base64(iv + authTag + ciphertext)
 */
export declare function decrypt(encryptedData: string, key?: string): string;
/**
 * Create a SHA-256 hash of data
 */
export declare function hash(data: string): string;
/**
 * Create a SHA-512 hash of data
 */
export declare function hash512(data: string): string;
/**
 * Create a HMAC-SHA256 signature
 */
export declare function hmac(data: string, secret: string): string;
/**
 * Hash a password using PBKDF2
 * Returns: salt:hash (both base64 encoded)
 */
export declare function hashPassword(password: string): string;
/**
 * Verify a password against a hash
 */
export declare function verifyPassword(password: string, storedHash: string): boolean;
/**
 * Generate a cryptographically secure random string
 */
export declare function generateRandomString(length: number): string;
/**
 * Generate a UUID v4
 */
export declare function generateUUID(): string;
/**
 * Generate a secure token
 */
export declare function generateToken(bytes?: number): string;
/**
 * Derive a key from a password using PBKDF2
 */
export declare function deriveKey(password: string, salt: string, iterations?: number): Buffer;
/**
 * Generate a new encryption key
 */
export declare function generateEncryptionKey(): string;
/**
 * Verify a certificate's public key fingerprint
 */
export declare function getCertificateFingerprint(certPem: string): string;
/**
 * Generate a self-signed certificate (for development only)
 */
export declare function generateSelfSignedCert(): {
    cert: string;
    key: string;
};
/**
 * Timing-safe string comparison
 */
export declare function secureCompare(a: string, b: string): boolean;
/**
 * Mask sensitive data for logging
 */
export declare function maskSensitive(data: string, visibleChars?: number): string;
/**
 * Mask MAC address (show first and last octets)
 */
export declare function maskMacAddress(mac: string): string;
/**
 * Mask IP address (show first and last octets)
 */
export declare function maskIpAddress(ip: string): string;
/**
 * Check if encryption key is valid (proper length and entropy)
 */
export declare function isValidEncryptionKey(key: string): boolean;
//# sourceMappingURL=crypto.d.ts.map