/**
 * Outbound webhook dispatch service.
 *
 * When `SVIX_API_KEY` is configured, uses Svix for reliable delivery (retries,
 * signing, delivery guarantees). When `SVIX_*` env vars are empty, falls back
 * to a direct `POST` via `fetch` with no retry library — the caller is
 * responsible for handling failures (AC-049).
 *
 * This service is never used in the open-source local runtime by default;
 * it exists so that any part of the system that sends outbound webhooks can
 * degrade gracefully when Svix is not configured.
 */
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

export interface OutboundWebhookPayload {
  eventType: string;
  payload: Record<string, unknown>;
  /** The tenant whose configuration (endpoints) to use. */
  tenantId: string;
}

export interface OutboundWebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Send an outbound webhook to a specific endpoint.
 *
 * When Svix is configured (`SVIX_API_KEY` set), the call goes through Svix
 * which handles retries, signing, and delivery guarantees. When Svix is not
 * configured, a direct `POST` is made with `fetch` — no retry, no signing.
 *
 * @param url      - The target endpoint URL.
 * @param payload  - The webhook payload to deliver.
 * @param secret   - Optional HMAC secret for direct `POST` fallback signature.
 * @returns Result indicating success or failure.
 */
export async function dispatchWebhook(
  url: string,
  payload: OutboundWebhookPayload,
  secret?: string,
): Promise<OutboundWebhookResult> {
  const hasSvix = !!(config.svix.apiKey && config.svix.appId);

  if (hasSvix) {
    return dispatchViaSvix(url, payload);
  }

  return dispatchViaFetch(url, payload, secret);
}

/**
 * Send webhook via Svix SDK (AC-049).
 * Falls back to `fetch` if the Svix SDK is unavailable at runtime.
 */
async function dispatchViaSvix(
  url: string,
  payload: OutboundWebhookPayload,
): Promise<OutboundWebhookResult> {
  try {
    // Dynamic import so svix is never loaded when env vars are empty
    const { Svix } = await import('svix');
    const client = new Svix(config.svix.apiKey!, {
      serverUrl: config.svix.baseUrl || undefined,
    });

    const appId = config.svix.appId!;

    await client.message.create(appId, {
      eventType: payload.eventType,
      payload: payload.payload,
    });

    logger.info(
      { eventType: payload.eventType, tenantId: payload.tenantId, url },
      'Outbound webhook dispatched via Svix',
    );

    return { success: true, statusCode: 200 };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn(
      { err: errorMessage, eventType: payload.eventType },
      'Svix dispatch failed — falling back to direct POST',
    );
    return dispatchViaFetch(url, payload);
  }
}

/**
 * Send webhook via direct `fetch` POST — no retry, no signing.
 * If a secret is provided, a simple HMAC-SHA256 signature is added to headers.
 */
async function dispatchViaFetch(
  url: string,
  payload: OutboundWebhookPayload,
  secret?: string,
): Promise<OutboundWebhookResult> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CauseFlow/1.0',
    };

    if (secret) {
      const signature = await computeHmac(JSON.stringify(payload), secret);
      headers['X-CauseFlow-Signature'] = signature;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    logger.info(
      { eventType: payload.eventType, statusCode: response.status, url },
      'Outbound webhook dispatched via fetch',
    );

    return { success: response.ok, statusCode: response.status };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(
      { err: errorMessage, eventType: payload.eventType, url },
      'Direct fetch webhook dispatch failed',
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * Compute HMAC-SHA256 signature for direct `POST` webhook payloads.
 */
async function computeHmac(payload: string, secret: string): Promise<string> {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(payload).digest('hex');
}
