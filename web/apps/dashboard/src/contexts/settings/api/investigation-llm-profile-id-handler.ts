import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  CORE_INVESTIGATION_LLM_PROFILES_PATH,
  proxyToCore,
  redactInvestigationLlmPayload,
  validateUpdateInput,
} from '@/contexts/settings/api/investigation-llm-profiles-handler';
import { withAuth } from '@/lib/api/with-auth';

/**
 * PATCH /api/settings/investigation-llm-profiles/[id] → Core PATCH /v1/oss/investigation-llm-profiles/:id
 * DELETE /api/settings/investigation-llm-profiles/[id] → Core DELETE /v1/oss/investigation-llm-profiles/:id
 */

const _patchHandler = withAuth(
  async (request: NextRequest, _ctx, params) => {
    const profileId = params?.id?.trim();
    if (!profileId) {
      return NextResponse.json({ error: 'Profile id is required' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validated = validateUpdateInput(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const res = await proxyToCore(
      'PATCH',
      `${CORE_INVESTIGATION_LLM_PROFILES_PATH}/${encodeURIComponent(profileId)}`,
      validated,
    );
    return redactInvestigationLlmPayload(res);
  },
  { adminOnly: true },
);

const _deleteHandler = withAuth(
  async (_request: NextRequest, _ctx, params) => {
    const profileId = params?.id?.trim();
    if (!profileId) {
      return NextResponse.json({ error: 'Profile id is required' }, { status: 400 });
    }

    const res = await proxyToCore(
      'DELETE',
      `${CORE_INVESTIGATION_LLM_PROFILES_PATH}/${encodeURIComponent(profileId)}`,
    );
    return redactInvestigationLlmPayload(res);
  },
  { adminOnly: true },
);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _patchHandler(request, { params: Promise.resolve(params) });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _deleteHandler(request, { params: Promise.resolve(params) });
}
