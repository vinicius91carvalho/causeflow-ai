/**
 * Validates Composio webhook signatures.
 *
 * Composio signs webhooks with HMAC-SHA256.
 * Header format: `webhook-signature: v1,<base64_signature>`
 */
export declare class ComposioWebhookValidator {
    private readonly secret;
    constructor(secret: string);
    validate(rawBody: string, signatureHeader: string): boolean;
}
