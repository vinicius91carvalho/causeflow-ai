/**
 * Server-side incident simulation engine.
 *
 * Simulates AI processing of an incident through realistic state transitions:
 *   open -> triaging (after ~1.5 s)
 *   triaging -> investigating (after ~3 s)
 *   investigating -> resolved (after ~10-15 s total)
 *
 * This is a fire-and-forget mechanism -- it does NOT use async/await at the call site.
 * All timing is handled with `setTimeout`.
 *
 * In production, this would be replaced by a real AI pipeline (SQS + Lambda + Bedrock).
 */

import { getApiClient } from '@/lib/api/get-api-client';
import { selectTemplate } from './incident-templates';

// ---------------------------------------------------------------------------
// Source providers
// ---------------------------------------------------------------------------

const SOURCE_PROVIDERS = ['cloudwatch', 'datadog', 'pagerduty', 'sentry', 'grafana'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a random integer in [min, max] (inclusive). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random source provider (or use connected integrations). */
function pickSourceProvider(integrations: string[]): string {
  const monitoringProviders = integrations.filter((i) => SOURCE_PROVIDERS.includes(i));
  if (monitoringProviders.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: array is non-empty, index is always valid
    return monitoringProviders[randInt(0, monitoringProviders.length - 1)] ?? SOURCE_PROVIDERS[0]!;
  }
  return SOURCE_PROVIDERS[randInt(0, SOURCE_PROVIDERS.length - 1)] ?? 'cloudwatch';
}

// ---------------------------------------------------------------------------
// Main simulator
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget incident simulator.
 *
 * Call this immediately after creating an incident.
 * It schedules async state transitions using setTimeout -- no awaiting needed.
 *
 * @param incidentId   - The ID of the newly created incident
 * @param _tenantId    - The tenant owning the incident (unused, kept for API compat)
 * @param title        - The incident title (used for template selection)
 * @param integrations - Integration types connected by the tenant
 */
export function simulateIncident(
  incidentId: string,
  _tenantId: string,
  title: string,
  integrations: string[],
): void {
  selectTemplate(title);
  pickSourceProvider(integrations);

  // Stage 1: open -> triaging (after 1-2 s)
  const triagingDelay = randInt(1000, 2000);

  // Stage 2: triaging -> investigating (after 2-4 s total)
  const investigatingDelay = randInt(2000, 4000);

  // Stage 3: investigating -> resolved (after 10-15 s total from creation)
  const resolvedDelay = randInt(10_000, 15_000);

  const client = getApiClient();

  // Schedule triaging transition
  setTimeout(() => {
    client.updateIncident(incidentId, { status: 'triaging' }).catch((err: unknown) => {
      console.error('[incident-simulator] Failed to update status to triaging:', err);
    });
  }, triagingDelay);

  // Schedule investigating transition
  setTimeout(() => {
    client.updateIncident(incidentId, { status: 'investigating' }).catch((err: unknown) => {
      console.error('[incident-simulator] Failed to update status to investigating:', err);
    });
  }, investigatingDelay);

  // Schedule resolved transition
  setTimeout(() => {
    client.updateIncident(incidentId, { status: 'resolved' }).catch((err: unknown) => {
      console.error('[incident-simulator] Failed to update status to resolved:', err);
    });
  }, resolvedDelay);
}
