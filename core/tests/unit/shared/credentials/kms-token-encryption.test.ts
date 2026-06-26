import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TokenEncryption, EncryptedPayload } from '../../../../src/shared/application/ports/token-encryption.port.js';

// Mock KMS client
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-kms', () => ({
  KMSClient: vi.fn(() => ({ send: mockSend })),
  GenerateDataKeyCommand: vi.fn((input) => ({ input, _type: 'GenerateDataKey' })),
  DecryptCommand: vi.fn((input) => ({ input, _type: 'Decrypt' })),
}));

import { KmsTokenEncryption } from '../../../../src/shared/infra/credentials/kms-token-encryption.js';

describe('KmsTokenEncryption', () => {
  let encryption: TokenEncryption;
  const fakeKey = Buffer.alloc(32, 'a'); // 256-bit key
  const fakeEncryptedDek = Buffer.from('encrypted-dek-material');

  beforeEach(() => {
    vi.clearAllMocks();
    encryption = new KmsTokenEncryption('alias/test-key', { region: 'us-east-1' });
  });

  it('should encrypt and produce all required fields', async () => {
    mockSend.mockResolvedValueOnce({
      Plaintext: new Uint8Array(fakeKey),
      CiphertextBlob: new Uint8Array(fakeEncryptedDek),
    });

    const result = await encryption.encrypt('my-secret-token');

    expect(result.ciphertext).toBeDefined();
    expect(result.encryptedDek).toBeDefined();
    expect(result.iv).toBeDefined();
    expect(result.tag).toBeDefined();

    // ciphertext should NOT be the plaintext
    expect(Buffer.from(result.ciphertext, 'base64').toString('utf8')).not.toBe('my-secret-token');

    // encryptedDek should be the KMS-encrypted version
    expect(result.encryptedDek).toBe(fakeEncryptedDek.toString('base64'));
  });

  it('should decrypt back to original plaintext', async () => {
    // First encrypt
    mockSend.mockResolvedValueOnce({
      Plaintext: new Uint8Array(fakeKey),
      CiphertextBlob: new Uint8Array(fakeEncryptedDek),
    });

    const encrypted = await encryption.encrypt('super-secret-token-123');

    // Then decrypt
    mockSend.mockResolvedValueOnce({
      Plaintext: new Uint8Array(fakeKey),
    });

    const decrypted = await encryption.decrypt(encrypted);
    expect(decrypted).toBe('super-secret-token-123');
  });

  it('should fail to decrypt with wrong key', async () => {
    // Encrypt with one key
    mockSend.mockResolvedValueOnce({
      Plaintext: new Uint8Array(fakeKey),
      CiphertextBlob: new Uint8Array(fakeEncryptedDek),
    });

    const encrypted = await encryption.encrypt('secret');

    // Decrypt with different key
    const wrongKey = Buffer.alloc(32, 'b');
    mockSend.mockResolvedValueOnce({
      Plaintext: new Uint8Array(wrongKey),
    });

    await expect(encryption.decrypt(encrypted)).rejects.toThrow();
  });

  it('should fail to decrypt with tampered ciphertext', async () => {
    mockSend.mockResolvedValueOnce({
      Plaintext: new Uint8Array(fakeKey),
      CiphertextBlob: new Uint8Array(fakeEncryptedDek),
    });

    const encrypted = await encryption.encrypt('secret');

    // Tamper with ciphertext
    const tampered: EncryptedPayload = {
      ...encrypted,
      ciphertext: Buffer.from('tampered-data').toString('base64'),
    };

    mockSend.mockResolvedValueOnce({
      Plaintext: new Uint8Array(fakeKey),
    });

    await expect(encryption.decrypt(tampered)).rejects.toThrow();
  });

  it('should zero out plaintext DEK after encrypt', async () => {
    const plaintextDek = new Uint8Array(Buffer.alloc(32, 'c'));
    mockSend.mockResolvedValueOnce({
      Plaintext: plaintextDek,
      CiphertextBlob: new Uint8Array(fakeEncryptedDek),
    });

    await encryption.encrypt('token');

    // DEK should be zeroed
    expect(plaintextDek.every((b) => b === 0)).toBe(true);
  });

  it('should zero out plaintext DEK after decrypt', async () => {
    mockSend.mockResolvedValueOnce({
      Plaintext: new Uint8Array(fakeKey),
      CiphertextBlob: new Uint8Array(fakeEncryptedDek),
    });
    const encrypted = await encryption.encrypt('token');

    const decryptDek = new Uint8Array(Buffer.from(fakeKey));
    mockSend.mockResolvedValueOnce({
      Plaintext: decryptDek,
    });

    await encryption.decrypt(encrypted);

    // DEK should be zeroed
    expect(decryptDek.every((b) => b === 0)).toBe(true);
  });
});
