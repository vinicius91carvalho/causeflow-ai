/**
 * AES-256-GCM Token Encryption — local replacement for KmsTokenEncryption
 * in the open-source local runtime (AC-044).
 *
 * Uses Node's built-in `crypto` module with a key derived from the
 * TOKEN_ENCRYPTION_KEY env var. No AWS KMS dependency.
 *
 * Security guarantees:
 * - AES-256-GCM provides authenticated encryption (integrity + confidentiality)
 * - Each encryption uses a fresh random IV (12 bytes, GCM recommended)
 * - The auth tag is verified on every decryption; tampered ciphertext is rejected
 * - Key is loaded once at construction; plaintext key lives in memory but never
 *   logged or persisted
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import type {
  TokenEncryption,
  EncryptedPayload,
} from '../../application/ports/token-encryption.port.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const TAG_LENGTH = 16;

export class AesGcmTokenEncryption implements TokenEncryption {
  private key: Buffer;

  /**
   * @param key Hex-encoded 256-bit (64 hex chars) or arbitrary passphrase.
   *            If shorter than 32 bytes the key is derived via SHA-256.
   */
  constructor(key?: string) {
    const raw = key ?? process.env['TOKEN_ENCRYPTION_KEY'] ?? '';
    if (!raw) {
      throw new Error(
        'AesGcmTokenEncryption: TOKEN_ENCRYPTION_KEY env var is required. ' +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }
    // Accept both hex-encoded 32-byte keys and arbitrary passphrases
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      this.key = Buffer.from(raw, 'hex');
    } else {
      // Derive a 256-bit key from the passphrase using SHA-256
      this.key = createHash('sha256').update(raw).digest();
    }
  }

  async encrypt(plaintext: string): Promise<EncryptedPayload> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: encrypted.toString('base64'),
      // No KMS DEK — store empty string for interface compatibility
      encryptedDek: '',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  async decrypt(payload: EncryptedPayload): Promise<string> {
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(payload.iv, 'base64'), {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
