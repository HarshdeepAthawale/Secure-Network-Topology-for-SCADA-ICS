/**
 * Crypto utilities tests
 */

import {
  encrypt,
  decrypt,
  hash,
  hashPassword,
  verifyPassword,
  generateRandomString,
  generateUUID,
  generateToken,
  secureCompare,
  maskSensitive,
  maskMacAddress,
  maskIpAddress,
} from '../../../src/utils/crypto';

describe('Crypto Utilities', () => {
  const testKey = 'a'.repeat(32); // 32 character key

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'Hello, SCADA World!';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'Test data';
      const encrypted1 = encrypt(plaintext, testKey);
      const encrypted2 = encrypt(plaintext, testKey);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should fail decryption with wrong key', () => {
      const encrypted = encrypt('secret', testKey);
      const wrongKey = 'b'.repeat(32);
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });
  });

  describe('hash', () => {
    it('should produce consistent SHA-256 hash', () => {
      const data = 'test data';
      const hash1 = hash(data);
      const hash2 = hash(data);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('password hashing', () => {
    it('should hash and verify password correctly', () => {
      const password = 'SecurePassword123!';
      const hashed = hashPassword(password);
      expect(verifyPassword(password, hashed)).toBe(true);
      expect(verifyPassword('wrong', hashed)).toBe(false);
    });

    it('should produce different hashes for same password', () => {
      const password = 'TestPassword';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('random generation', () => {
    it('should generate random string of correct length', () => {
      const str = generateRandomString(16);
      expect(str).toHaveLength(16);
    });

    it('should generate valid UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate token', () => {
      const token = generateToken(32);
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('secureCompare', () => {
    it('should return true for equal strings', () => {
      expect(secureCompare('test', 'test')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('test', 'Test')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(secureCompare('test', 'testing')).toBe(false);
    });
  });

  describe('masking', () => {
    it('should mask sensitive data', () => {
      expect(maskSensitive('1234567890', 4)).toBe('1234******');
    });

    it('should mask MAC address', () => {
      expect(maskMacAddress('aa:bb:cc:dd:ee:ff')).toBe('aa:xx:xx:xx:xx:ff');
    });

    it('should mask IP address', () => {
      expect(maskIpAddress('192.168.1.100')).toBe('192.xxx.xxx.100');
    });
  });
});
