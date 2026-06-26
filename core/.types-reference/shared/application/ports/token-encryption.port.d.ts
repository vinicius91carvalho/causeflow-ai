/**
 * Token Encryption Port — envelope encryption for sensitive credentials.
 *
 * Architecture: KMS envelope encryption (same pattern as AWS, Stripe, banks).
 * - Encrypt: KMS GenerateDataKey → AES-256-GCM encrypt → store ciphertext + encrypted DEK
 * - Decrypt: KMS Decrypt DEK → AES-256-GCM decrypt → plaintext (never stored/logged)
 */
export interface EncryptedPayload {
    /** Base64-encoded ciphertext */
    ciphertext: string;
    /** Base64-encoded KMS-encrypted DEK (data encryption key) */
    encryptedDek: string;
    /** Base64-encoded IV (initialization vector) */
    iv: string;
    /** Base64-encoded authentication tag (GCM integrity) */
    tag: string;
}
export interface TokenEncryption {
    encrypt(plaintext: string): Promise<EncryptedPayload>;
    decrypt(payload: EncryptedPayload): Promise<string>;
}
