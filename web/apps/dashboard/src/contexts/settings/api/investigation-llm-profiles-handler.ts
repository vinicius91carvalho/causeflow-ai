import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { CreateInvestigationLlmProfileInput } from '@/contexts/settings/domain/investigation-llm-profile';
import { getBackendToken } from '@/lib/api/get-backend-token';
import { withAuth } from '@/lib/api/with-auth';

/**
 * BFF proxy for Core OSS Investigation LLM profiles (AC-084).
 *
 * GET  /api/settings/investigation-llm-profiles → Core GET  /v1/oss/investigation-llm-profiles
 * POST /api/settings/investigation-llm-profiles → Core POST /v1/oss/investigation-llm-profiles
 */

const CORE_PATH = '/v1/oss/investigation-llm-profiles';

function coreBaseUrl(): string | null {
  const url = process.env.CORE_API_URL?.trim();
  return url || null;
}

async function proxyToCore(method: 'GET' | 'POST', body?: unknown): Promise<NextResponse> {
  const coreApiUrl = coreBaseUrl();
  if (!coreApiUrl) {
    return NextResponse.json({ error: 'CORE_API_URL is not configured' }, { status: 502 });
  }

  const token = await getBackendToken();
  const upstream = await fetch(`${coreApiUrl}${CORE_PATH}`, {
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

function validateCreateInput(
  body: unknown,
): CreateInvestigationLlmProfileInput | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid JSON body' };
  }
  const input = body as Record<string, unknown>;
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim() : '';
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (!label || !baseUrl || !model) {
    return { error: 'label, baseUrl, and model are required' };
  }

  const payload: CreateInvestigationLlmProfileInput = { label, baseUrl, model };

  if (input.apiKey !== undefined && input.apiKey !== null && input.apiKey !== '') {
    if (typeof input.apiKey !== 'string' || !input.apiKey.trim()) {
      return { error: 'apiKey must be a non-empty string when provided' };
    }
    payload.apiKey = input.apiKey.trim();
  }

  if (input.contextWindowTokens !== undefined && input.contextWindowTokens !== null) {
    const tokens = Number(input.contextWindowTokens);
    if (!Number.isInteger(tokens) || tokens <= 0) {
      return { error: 'contextWindowTokens must be a positive integer when provided' };
    }
    payload.contextWindowTokens = tokens;
  }

  return payload;
}

export const GET = withAuth(async (_request: NextRequest) => {
  return proxyToCore('GET');
});

export const POST = withAuth(
  async (request: NextRequest) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validated = validateCreateInput(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    return proxyToCore('POST', validated);
  },
  { adminOnly: true },
);
