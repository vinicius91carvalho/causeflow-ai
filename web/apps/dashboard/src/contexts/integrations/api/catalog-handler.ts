import { SITE } from '@causeflow/shared/constants';
import { type NextRequest, NextResponse } from 'next/server';
import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import { INTEGRATION_AUTH_TYPES, type IntegrationType } from '@/contexts/integrations/domain/types';
import { INTEGRATION_CATALOG } from '@/contexts/integrations/presentation/components/integration-catalog';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/** OSS-only catalog card for the Core runnable test application (AC-020 / AC-055 / AC-058). */
const STUB_UPSTREAM_PROVIDER = {
  id: 'stub-upstream',
  name: 'Test Application (OSS)',
  category: 'monitoring',
  type: 'credential' as const,
  description:
    'Core-owned demo upstream for the fixed failure catalog (pool exhaustion, payment timeout, CPU/latency, deploy marker). Connect via Core stub API — Composio is not used.',
  learnMoreUrl: SITE.testApplicationDocsUrl,
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

/** AC-027 / AC-051 catalog identifiers (Core uses `aws` for CloudWatch). */
const OSS_CATALOG_IDS = new Set<string>([
  'slack',
  'github',
  'jira',
  'aws',
  'cloudwatch',
  'hubspot',
  'trello',
  'postgresql',
  'linear',
  'sentry',
  'mongodb',
  'datadog',
  'pagerduty',
  'grafana',
  'confluence',
  'webhooks',
]);

const CORE_ID_BY_TYPE: Partial<Record<IntegrationType, string>> = {
  cloudwatch: 'aws',
};

function stripComposioLogo<T extends Record<string, unknown>>(provider: T): T {
  const logo = provider.logo;
  if (typeof logo === 'string' && logo.includes('composio.dev')) {
    const { logo: _removed, ...rest } = provider;
    return rest as T;
  }
  return provider;
}

function localFallbackProviders(): Array<Record<string, unknown>> {
  return INTEGRATION_CATALOG.map((entry) => {
    const id = CORE_ID_BY_TYPE[entry.type] ?? entry.type;
    const auth = INTEGRATION_AUTH_TYPES[entry.type];
    return {
      id,
      name: entry.name,
      category: entry.category,
      type: auth === 'credentials' ? ('credential' as const) : ('oauth' as const),
      description: entry.description,
    };
  });
}

/**
 * GET /api/integrations/catalog
 * Returns the full catalog of available integration providers from the backend.
 * Includes type (oauth/credential), category, description, and AWS setup info.
 * In OSS runtime, injects the test-app + Datadog stub connector cards (AC-055/058),
 * strips Composio CDN logos (AC-051), and keeps the AC-027 15-type catalog.
 */
export const GET = withAuth(async (_request: NextRequest) => {
  const catalog = (await getApiClient().getIntegrationCatalog()) as {
    providers?: Array<Record<string, unknown>>;
  };
  let providers = Array.isArray(catalog.providers) ? [...catalog.providers] : [];

  if (isOssRuntime()) {
    providers = providers
      .filter((p) => typeof p.id === 'string' && OSS_CATALOG_IDS.has(p.id))
      .map((p) => stripComposioLogo(p));

    const present = new Set(providers.map((p) => String(p.id)));
    for (const fallback of localFallbackProviders()) {
      const id = String(fallback.id);
      if (!present.has(id) && !present.has(id === 'aws' ? 'cloudwatch' : id)) {
        providers.push(fallback);
        present.add(id);
      }
    }

    // Deduplicate aws/cloudwatch so CloudWatch appears once.
    const awsIdx = providers.findIndex((p) => p.id === 'aws');
    const cwIdx = providers.findIndex((p) => p.id === 'cloudwatch');
    if (awsIdx >= 0 && cwIdx >= 0) {
      providers.splice(cwIdx, 1);
    }

    // Prefer the OSS Test Application card (scope summary + Learn more → AC-023 docs).
    const stubIdx = providers.findIndex((p) => p.id === 'stub-upstream');
    if (stubIdx >= 0) {
      providers[stubIdx] = {
        ...stripComposioLogo(providers[stubIdx]!),
        ...STUB_UPSTREAM_PROVIDER,
      };
    } else {
      providers.unshift(STUB_UPSTREAM_PROVIDER);
    }
    // Prefer the OSS stub Datadog card over any OAuth catalog entry.
    const datadogIdx = providers.findIndex((p) => p.id === 'datadog');
    if (datadogIdx >= 0) {
      providers[datadogIdx] = {
        ...stripComposioLogo(providers[datadogIdx]!),
        ...STUB_DATADOG_PROVIDER,
      };
    } else {
      providers.splice(1, 0, STUB_DATADOG_PROVIDER);
    }

    // Final pass: never leak Composio CDN URLs to the browser (AC-051).
    providers = providers.map((p) => stripComposioLogo(p));
  }

  return NextResponse.json({ ...catalog, providers });
});
