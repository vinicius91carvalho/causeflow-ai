import { type NextRequest, NextResponse } from 'next/server';
import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/** OSS-only catalog card for the Core stub upstream / test-app (AC-055). */
const STUB_UPSTREAM_PROVIDER = {
  id: 'stub-upstream',
  name: 'Stub Upstream (OSS)',
  category: 'monitoring',
  type: 'credential' as const,
  description:
    'Core-owned mock upstream / webhook simulator for open-source connector verification. Connects via Core stub API — Composio is not used.',
};

/**
 * GET /api/integrations/catalog
 * Returns the full catalog of available integration providers from the backend.
 * Includes type (oauth/credential), category, description, and AWS setup info.
 * In OSS runtime, injects the stub-upstream connector card (AC-055).
 */
export const GET = withAuth(async (_request: NextRequest) => {
  const catalog = (await getApiClient().getIntegrationCatalog()) as {
    providers?: Array<Record<string, unknown>>;
  };
  const providers = Array.isArray(catalog.providers) ? [...catalog.providers] : [];

  if (isOssRuntime() && !providers.some((p) => p.id === 'stub-upstream')) {
    providers.unshift(STUB_UPSTREAM_PROVIDER);
  }

  return NextResponse.json({ ...catalog, providers });
});
