import { createHmac, timingSafeEqual } from 'node:crypto';
/**
 * Validates Composio webhook signatures.
 *
 * Composio signs webhooks with HMAC-SHA256.
 * Header format: `webhook-signature: v1,<base64_signature>`
 */
export class ComposioWebhookValidator {
    secret;
    constructor(secret: string) {
        this.secret = secret;
    }
    validate(rawBody: string, signatureHeader: string): boolean {
        if (!this.secret || !signatureHeader)
            return false;
        // Parse "v1,<base64_signature>" format
        const parts = signatureHeader.split(',');
        if (parts.length < 2 || parts[0] !== 'v1')
            return false;
        const receivedSig = parts[1];
        if (!receivedSig)
            return false;
        const expected = createHmac('sha256', this.secret)
            .update(rawBody)
            .digest('base64');
        const receivedBuf = Buffer.from(receivedSig, 'base64');
        const expectedBuf = Buffer.from(expected, 'base64');
        if (receivedBuf.length !== expectedBuf.length)
            return false;
        return timingSafeEqual(receivedBuf, expectedBuf);
    }
}
