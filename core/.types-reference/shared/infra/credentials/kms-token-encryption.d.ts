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
import type { TokenEncryption, EncryptedPayload } from '../../application/ports/token-encryption.port.js';
export declare class KmsTokenEncryption implements TokenEncryption {
    private readonly kms;
    private readonly keyId;
    constructor(keyId: string, opts?: {
        endpoint?: string;
        region?: string;
    });
    encrypt(plaintext: string): Promise<EncryptedPayload>;
    decrypt(payload: EncryptedPayload): Promise<string>;
}
