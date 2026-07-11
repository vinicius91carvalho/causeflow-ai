import { type NextRequest, NextResponse } from 'next/server';
import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/** OSS-only catalog card for the Core runnable test application (AC-055 / AC-058). */
const STUB_UPSTREAM_PROVIDER = {
  id: 'stub-upstream',
  name: 'Test Application (OSS)',
  category: 'monitoring',
  type: 'credential' as const,
  description:
    'Core-owned runnable test application for open-source connector verification. Connects via Core stub API — Composio is not used.',
};

/**
 * Second OSS catalog card (AC-058): Datadog webhook connector enabled against
 * the connected test application through Core `POST /v1/integrations/stub/enable`.
 */
const STUB_DATADOG_PROVIDER = {
  id: 'datadog',
  name: 'Datadog (OSS stub)',
  category: 'monitoring',
  type: 'credential' as const,
  description:
    'Enable Datadog-shaped webhook ingest against the Core test application. Requires Test Application (OSS) to be connected first. Composio is not used.',
};

/**
 * GET /api/integrations/catalog
 * Returns the full catalog of available integration providers from the backend.
 * Includes type (oauth/credential), category, description, and AWS setup info.
 * In OSS runtime, injects the test-app + Datadog stub connector cards (AC-055/058).
 */
export const GET = withAuth(async (_request: NextRequest) => {
  const catalog = (await getApiClient().getIntegrationCatalog()) as {
    providers?: Array<Record<string, unknown>>;
  };
  const providers = Array.isArray(catalog.providers) ? [...catalog.providers] : [];

  if (isOssRuntime()) {
    if (!providers.some((p) => p.id === 'stub-upstream')) {
      providers.unshift(STUB_UPSTREAM_PROVIDER);
    }
    // Prefer the OSS stub Datadog card over the Composio OAuth catalog entry.
    const datadogIdx = providers.findIndex((p) => p.id === 'datadog');
    if (datadogIdx >= 0) {
      providers[datadogIdx] = { ...providers[datadogIdx], ...STUB_DATADOG_PROVIDER };
    } else {
      providers.splice(1, 0, STUB_DATADOG_PROVIDER);
    }
  }

  return NextResponse.json({ ...catalog, providers });
});
