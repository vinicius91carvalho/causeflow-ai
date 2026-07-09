import { describe, it, expect, beforeEach } from 'vitest';
import { AesGcmTokenEncryption } from '../../../../src/shared/infra/credentials/aes-gcm-token-encryption.js';
import type { EncryptedPayload } from '../../../../src/shared/application/ports/token-encryption.port.js';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('AesGcmTokenEncryption', () => {
  let encryption: AesGcmTokenEncryption;

  beforeEach(() => {
    encryption = new AesGcmTokenEncryption(TEST_KEY);
  });

  describe('round-trip', () => {
    it('should encrypt and decrypt a sample OAuth token', async () => {
      const original = 'xoxb-12345-67890-abcdefgh';
      const encrypted = await encryption.encrypt(original);
      const decrypted = await encryption.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should encrypt and decrypt a long token', async () => {
      const original = 'a'.repeat(4096);
      const encrypted = await encryption.encrypt(original);
      const decrypted = await encryption.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should encrypt and decrypt an empty string', async () => {
      const original = '';
      const encrypted = await encryption.encrypt(original);
      const decrypted = await encryption.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce distinct ciphertexts for the same plaintext (random IV)', async () => {
      const original = 'same-value';
      const a = await encryption.encrypt(original);
      const b = await encryption.encrypt(original);
      expect(a.ciphertext).not.toBe(b.ciphertext);
    });
  });

  describe('tamper detection (GCM auth tag)', () => {
    it('should reject ciphertext with a single byte changed', async () => {
      const original = 'my-secret-oauth-token';
      const encrypted = await encryption.encrypt(original);

      // Flip one byte in the ciphertext
      const buf = Buffer.from(encrypted.ciphertext, 'base64');
      buf[0] = (buf[0] as number) ^ 0xff;
      const tampered: EncryptedPayload = {
        ...encrypted,
        ciphertext: buf.toString('base64'),
      };

      await expect(encryption.decrypt(tampered)).rejects.toThrow();
    });

    it('should reject ciphertext with a tampered IV', async () => {
      const original = 'token-with-iv-check';
      const encrypted = await encryption.encrypt(original);

      // Flip one byte in the IV
      const ivBuf = Buffer.from(encrypted.iv, 'base64');
      ivBuf[0] = (ivBuf[0] as number) ^ 0x01;
      const tampered: EncryptedPayload = {
        ...encrypted,
        iv: ivBuf.toString('base64'),
      };

      await expect(encryption.decrypt(tampered)).rejects.toThrow();
    });

    it('should reject ciphertext with a tampered auth tag', async () => {
      const original = 'token-with-tag-check';
      const encrypted = await encryption.encrypt(original);

      // Flip one byte in the auth tag
      const tagBuf = Buffer.from(encrypted.tag, 'base64');
      tagBuf[0] = (tagBuf[0] as number) ^ 0x01;
      const tampered: EncryptedPayload = {
        ...encrypted,
        tag: tagBuf.toString('base64'),
      };

      await expect(encryption.decrypt(tampered)).rejects.toThrow();
    });

    it('should reject completely replaced ciphertext', async () => {
      const original = 'real-token';
      const encrypted = await encryption.encrypt(original);

      const tampered: EncryptedPayload = {
        ...encrypted,
        ciphertext: Buffer.from('fake-ciphertext').toString('base64'),
      };

      await expect(encryption.decrypt(tampered)).rejects.toThrow();
    });
  });

  describe('construction', () => {
    it('should read key from env when no argument given', async () => {
      process.env['TOKEN_ENCRYPTION_KEY'] = TEST_KEY;
      const inst = new AesGcmTokenEncryption();
      const encrypted = await inst.encrypt('env-key-test');
      const decrypted = await inst.decrypt(encrypted);
      expect(decrypted).toBe('env-key-test');
      delete process.env['TOKEN_ENCRYPTION_KEY'];
    });

    it('should derive key from arbitrary passphrase via SHA-256', async () => {
      const inst = new AesGcmTokenEncryption('my-arbitrary-passphrase');
      const encrypted = await inst.encrypt('passphrase-test');
      const decrypted = await inst.decrypt(encrypted);
      expect(decrypted).toBe('passphrase-test');
    });

    it('should throw when no key is provided and env is unset', () => {
      const saved = process.env['TOKEN_ENCRYPTION_KEY'];
      delete process.env['TOKEN_ENCRYPTION_KEY'];
      expect(() => new AesGcmTokenEncryption()).toThrow('TOKEN_ENCRYPTION_KEY');
      if (saved) process.env['TOKEN_ENCRYPTION_KEY'] = saved;
    });
  });
});
