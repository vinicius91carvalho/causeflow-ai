import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';

/**
 * GET /api/integrations/slack/config
 *
 * Returns the current Slack integration configuration for the tenant.
 * Proxies to Core API GET /v1/integrations/slack/config.
 */
export async function handleGetSlackConfig(_req: NextRequest): Promise<NextResponse> {
  try {
    const config = await getApiClient().getSlackConfig();
    return NextResponse.json(config);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Slack config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/integrations/slack/config
 *
 * Updates the Slack notification channel for the tenant.
 * Proxies to Core API PATCH /v1/integrations/slack/config.
 */
export async function handleUpdateSlackConfig(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).channel !== 'string' ||
    !(body as Record<string, unknown>).channel
  ) {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 });
  }

  const { channel } = body as { channel: string };

  try {
    const updated = await getApiClient().updateSlackConfig({ channel });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update Slack config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/integrations/slack/disconnect
 *
 * Revokes the Slack OAuth installation for the tenant.
 * Proxies to Core API DELETE /v1/integrations/slack/oauth.
 */
export async function handleDeleteSlackOAuth(_req: NextRequest): Promise<NextResponse> {
  try {
    await getApiClient().deleteSlackOAuth();
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect Slack';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/integrations/slack/test
 *
 * Sends a test message to the configured Slack channel.
 * Proxies to Core API POST /v1/integrations/slack/test.
 */
export async function handleTestSlack(_req: NextRequest): Promise<NextResponse> {
  try {
    const result = await getApiClient().testSlackConnection();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Slack test failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
