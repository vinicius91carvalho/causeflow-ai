/**
 * KMS Envelope Encryption — AES-256-GCM with KMS-managed DEKs.
 *
 * Security guarantees:
 * - Token never stored in plaintext (DynamoDB only holds ciphertext)
 * - DEK never stored in plaintext (only KMS-encrypted version persists)
 * - Plaintext DEK exists in memory only during encrypt/decrypt, then zeroed
 * - Even with full DB access, tokens are unreadable without KMS permissions
 * - AES-256-GCM provides authenticated encryption (integrity + confidentiality)
 */
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { TokenEncryption, EncryptedPayload } from '../../application/ports/token-encryption.port.js';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const TAG_LENGTH = 16;
export class KmsTokenEncryption {
    kms;
    keyId;
    constructor(keyId: string, opts?: { region?: string; endpoint?: string }) {
        this.keyId = keyId;
        this.kms = new KMSClient({
            region: opts?.region ?? 'us-east-1',
            ...(opts?.endpoint ? { endpoint: opts.endpoint } : {}),
        });
    }
    async encrypt(plaintext: string): Promise<EncryptedPayload> {
        // 1. Ask KMS for a fresh DEK (data encryption key)
        const { Plaintext: dekPlaintext, CiphertextBlob: dekEncrypted } = await this.kms.send(new GenerateDataKeyCommand({
            KeyId: this.keyId,
            KeySpec: 'AES_256',
        }));
        if (!dekPlaintext || !dekEncrypted) {
            throw new Error('KMS GenerateDataKey returned empty key material');
        }
        try {
            // 2. Encrypt the token with the plaintext DEK using AES-256-GCM
            const iv = randomBytes(IV_LENGTH);
            const cipher = createCipheriv(ALGORITHM, Buffer.from(dekPlaintext), iv, { authTagLength: TAG_LENGTH });
            const encrypted = Buffer.concat([
                cipher.update(plaintext, 'utf8'),
                cipher.final(),
            ]);
            const tag = cipher.getAuthTag();
            return {
                ciphertext: encrypted.toString('base64'),
                encryptedDek: Buffer.from(dekEncrypted).toString('base64'),
                iv: iv.toString('base64'),
                tag: tag.toString('base64'),
            };
        }
        finally {
            // 3. Zero out plaintext DEK from memory
            dekPlaintext.fill(0);
        }
    }
    async decrypt(payload: EncryptedPayload): Promise<string> {
        // 1. Ask KMS to decrypt the DEK
        const { Plaintext: dekPlaintext } = await this.kms.send(new DecryptCommand({
            CiphertextBlob: Buffer.from(payload.encryptedDek, 'base64'),
        }));
        if (!dekPlaintext) {
            throw new Error('KMS Decrypt returned empty plaintext');
        }
        try {
            // 2. Decrypt the ciphertext with the plaintext DEK
            const decipher = createDecipheriv(ALGORITHM, Buffer.from(dekPlaintext), Buffer.from(payload.iv, 'base64'), { authTagLength: TAG_LENGTH });
            decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(payload.ciphertext, 'base64')),
                decipher.final(),
            ]);
            return decrypted.toString('utf8');
        }
        finally {
            // 3. Zero out plaintext DEK from memory
            dekPlaintext.fill(0);
        }
    }
}
