import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { LLM_CONNECTOR_IDS, type LlmConnectorId } from '@/contexts/settings/domain/llm-connector';
import { getBackendToken } from '@/lib/api/get-backend-token';
import { withAuth } from '@/lib/api/with-auth';

/**
 * BFF proxy for Core OSS LLM connector selection (AC-059).
 *
 * GET  /api/settings/llm-connector → Core GET  /v1/oss/llm-connector
 * PUT  /api/settings/llm-connector → Core PUT  /v1/oss/llm-connector
 *
 * Credentials stay on the operator host / Core env (OPENCODE_API_KEY,
 * NVIDIA_API_KEY from ~/.pi/agent/auth.json etc.) — never committed here.
 */

function coreBaseUrl(): string | null {
  const url = process.env.CORE_API_URL?.trim();
  return url || null;
}

async function proxyToCore(method: 'GET' | 'PUT', body?: unknown): Promise<NextResponse> {
  const coreApiUrl = coreBaseUrl();
  if (!coreApiUrl) {
    return NextResponse.json({ error: 'CORE_API_URL is not configured' }, { status: 502 });
  }

  const token = await getBackendToken();
  const upstream = await fetch(`${coreApiUrl}/v1/oss/llm-connector`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const rawBody = await upstream.text();
  const upstreamHeaders = Object.fromEntries(upstream.headers.entries());
  return new NextResponse(rawBody, {
    status: upstream.status,
    headers: {
      'Content-Type': upstreamHeaders['content-type'] ?? 'application/json',
    },
  });
}

export const GET = withAuth(async (_request: NextRequest) => {
  return proxyToCore('GET');
});

export const PUT = withAuth(
  async (request: NextRequest) => {
    let body: { connector?: string };
    try {
      body = (await request.json()) as { connector?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const connector = typeof body.connector === 'string' ? body.connector.trim() : '';
    if (!(LLM_CONNECTOR_IDS as readonly string[]).includes(connector)) {
      return NextResponse.json(
        {
          error: 'Invalid connector',
          allowed: LLM_CONNECTOR_IDS,
        },
        { status: 400 },
      );
    }

    return proxyToCore('PUT', { connector: connector as LlmConnectorId });
  },
  { adminOnly: true },
);
