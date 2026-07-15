import { NextResponse } from 'next/server';
import { INVESTIGATION_LLM_PROFILE_PRESETS } from '@/contexts/settings/domain/investigation-llm-profile-presets';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/settings/investigation-llm-profiles/example-presets
 * Returns operator example presets (AC-087) — helpers, not a seeded provider catalog.
 */
export const GET = withAuth(async () => {
  return NextResponse.json({
    items: INVESTIGATION_LLM_PROFILE_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      baseUrl: preset.baseUrl,
      model: preset.model,
      contextWindowTokens: preset.contextWindowTokens ?? null,
    })),
  });
});
