import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  CORE_INVESTIGATION_LLM_PROFILES_PATH,
  proxyToCore,
  redactInvestigationLlmPayload,
} from '@/contexts/settings/api/investigation-llm-profiles-handler';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/settings/investigation-llm-profiles/[id]/activate
 * → Core POST /v1/oss/investigation-llm-profiles/:id/activate
 */

const _activateHandler = withAuth(
  async (_request: NextRequest, _ctx, params) => {
    const profileId = params?.id?.trim();
    if (!profileId) {
      return NextResponse.json({ error: 'Profile id is required' }, { status: 400 });
    }

    const res = await proxyToCore(
      'POST',
      `${CORE_INVESTIGATION_LLM_PROFILES_PATH}/${encodeURIComponent(profileId)}/activate`,
    );
    return redactInvestigationLlmPayload(res);
  },
  { adminOnly: true },
);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _activateHandler(request, { params: Promise.resolve(params) });
}
