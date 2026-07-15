import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type {
  CreateInvestigationLlmProfileInput,
  UpdateInvestigationLlmProfileInput,
} from '@/contexts/settings/domain/investigation-llm-profile';
import { getBackendToken } from '@/lib/api/get-backend-token';
import { withAuth } from '@/lib/api/with-auth';

/**
 * BFF proxy for Core OSS Investigation LLM profiles (AC-084, AC-085).
 *
 * GET    /api/settings/investigation-llm-profiles          → Core GET    /v1/oss/investigation-llm-profiles
 * POST   /api/settings/investigation-llm-profiles          → Core POST   /v1/oss/investigation-llm-profiles
 * PATCH  /api/settings/investigation-llm-profiles/[id]     → Core PATCH  /v1/oss/investigation-llm-profiles/:id
 * DELETE /api/settings/investigation-llm-profiles/[id]     → Core DELETE /v1/oss/investigation-llm-profiles/:id
 */

export const CORE_INVESTIGATION_LLM_PROFILES_PATH = '/v1/oss/investigation-llm-profiles';

const SECRET_FIELD_NAMES = new Set(['apiKey', 'apiKeyEncrypted', 'api_key', 'api_key_encrypted']);

function coreBaseUrl(): string | null {
  const url = process.env.CORE_API_URL?.trim();
  return url || null;
}

export async function proxyToCore(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string = CORE_INVESTIGATION_LLM_PROFILES_PATH,
  body?: unknown,
): Promise<NextResponse> {
  const coreApiUrl = coreBaseUrl();
  if (!coreApiUrl) {
    return NextResponse.json({ error: 'CORE_API_URL is not configured' }, { status: 502 });
  }

  const token = await getBackendToken();
  const upstream = await fetch(`${coreApiUrl}${path}`, {
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

function redactProfileRecord(value: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_FIELD_NAMES.has(key)) continue;
    redacted[key] = entry;
  }
  if (value.apiKey !== undefined || value.apiKeyEncrypted !== undefined) {
    redacted.apiKeyConfigured = Boolean(
      value.apiKeyConfigured ?? value.apiKey ?? value.apiKeyEncrypted,
    );
  }
  return redacted;
}

export async function redactInvestigationLlmPayload(response: NextResponse): Promise<NextResponse> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return response;
  }

  const rawBody = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new NextResponse(rawBody, {
      status: response.status,
      headers: { 'Content-Type': contentType },
    });
  }

  let redacted = parsed;
  if (Array.isArray(parsed)) {
    redacted = parsed.map((item) =>
      item && typeof item === 'object'
        ? redactProfileRecord(item as Record<string, unknown>)
        : item,
    );
  } else if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      redacted = {
        ...redactProfileRecord(record),
        items: record.items.map((item) =>
          item && typeof item === 'object'
            ? redactProfileRecord(item as Record<string, unknown>)
            : item,
        ),
      };
    } else {
      redacted = redactProfileRecord(record);
    }
  }

  const serialized = JSON.stringify(redacted);
  const leakedSecret =
    /"apiKey"\s*:\s*"(?!configured|masked)/.test(serialized) ||
    serialized.includes('"apiKeyEncrypted"');
  if (leakedSecret) {
    return NextResponse.json(
      { error: 'Investigation LLM profile response leaked secret fields' },
      { status: 500 },
    );
  }

  return new NextResponse(serialized, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function validateCreateInput(
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

export function validateUpdateInput(
  body: unknown,
): UpdateInvestigationLlmProfileInput | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid JSON body' };
  }
  const input = body as Record<string, unknown>;
  const payload: UpdateInvestigationLlmProfileInput = {};

  if (input.label !== undefined) {
    if (typeof input.label !== 'string' || !input.label.trim()) {
      return { error: 'label must be a non-empty string when provided' };
    }
    payload.label = input.label.trim();
  }

  if (input.baseUrl !== undefined) {
    if (typeof input.baseUrl !== 'string' || !input.baseUrl.trim()) {
      return { error: 'baseUrl must be a non-empty string when provided' };
    }
    payload.baseUrl = input.baseUrl.trim();
  }

  if (input.model !== undefined) {
    if (typeof input.model !== 'string' || !input.model.trim()) {
      return { error: 'model must be a non-empty string when provided' };
    }
    payload.model = input.model.trim();
  }

  if (input.apiKey !== undefined && input.apiKey !== null && input.apiKey !== '') {
    if (typeof input.apiKey !== 'string' || !input.apiKey.trim()) {
      return { error: 'apiKey must be a non-empty string when provided' };
    }
    payload.apiKey = input.apiKey.trim();
  }

  if (input.contextWindowTokens !== undefined) {
    if (input.contextWindowTokens === null) {
      payload.contextWindowTokens = null;
    } else {
      const tokens = Number(input.contextWindowTokens);
      if (!Number.isInteger(tokens) || tokens <= 0) {
        return { error: 'contextWindowTokens must be a positive integer when provided' };
      }
      payload.contextWindowTokens = tokens;
    }
  }

  if (
    payload.label === undefined &&
    payload.baseUrl === undefined &&
    payload.model === undefined &&
    payload.apiKey === undefined &&
    payload.contextWindowTokens === undefined
  ) {
    return { error: 'At least one field is required to update a profile' };
  }

  return payload;
}

export const GET = withAuth(async (_request: NextRequest) => {
  const res = await proxyToCore('GET');
  return redactInvestigationLlmPayload(res);
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

    const res = await proxyToCore('POST', CORE_INVESTIGATION_LLM_PROFILES_PATH, validated);
    return redactInvestigationLlmPayload(res);
  },
  { adminOnly: true },
);
