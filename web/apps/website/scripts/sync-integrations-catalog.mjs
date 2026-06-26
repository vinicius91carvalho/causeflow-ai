#!/usr/bin/env node
/**
 * sync-integrations-catalog.mjs
 *
 * Syncs the integrations catalog from the live API to a static TypeScript file.
 * Usage: pnpm --filter @causeflow/website exec node scripts/sync-integrations-catalog.mjs
 *
 * The script tries the staging API first. Falls back to local dev if staging is offline.
 * On success, writes apps/website/src/contexts/marketing/presentation/data/integrations-catalog.ts
 * Commit the generated file — it is intentionally static (zero runtime fetches).
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENDPOINTS = [
  'https://dashboard-staging.causeflow.ai/api/integrations/catalog',
  'http://localhost:3001/api/integrations/catalog',
];

const OUTPUT_PATH = resolve(
  __dirname,
  '../src/contexts/marketing/presentation/data/integrations-catalog.ts',
);

async function fetchCatalog() {
  for (const url of ENDPOINTS) {
    try {
      console.log(`Trying ${url}...`);
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.warn(`  → HTTP ${response.status} — skipping`);
        continue;
      }

      const data = await response.json();
      const integrations = Array.isArray(data) ? data : (data.integrations ?? data.data);

      if (!Array.isArray(integrations) || integrations.length === 0) {
        console.warn('  → Empty or unexpected response shape — skipping');
        continue;
      }

      console.log(`  → Got ${integrations.length} integrations from ${url}`);
      return integrations;
    } catch (err) {
      console.warn(`  → Failed: ${err.message}`);
    }
  }

  throw new Error(
    'All endpoints failed. Run the dashboard locally or ensure staging is reachable.',
  );
}

async function main() {
  console.log('Syncing integrations catalog...\n');

  let integrations;
  try {
    integrations = await fetchCatalog();
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
    console.error('Fallback: current integrations-catalog.ts retained (no changes written).');
    process.exit(1);
  }

  const lastSynced = new Date().toISOString();

  const output = `/**
 * Static integrations catalog for the website.
 * AUTO-GENERATED — do not edit manually.
 * Regenerate via: pnpm --filter @causeflow/website exec node scripts/sync-integrations-catalog.mjs
 *
 * lastSynced: ${lastSynced}
 */
import type { Integration } from '@causeflow/shared/types';

export const CATALOG_INTEGRATIONS: Integration[] = ${JSON.stringify(integrations, null, 2)};

export const lastSynced = '${lastSynced}';
`;

  writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`\nWrote ${integrations.length} integrations to:\n  ${OUTPUT_PATH}`);
  console.log(`lastSynced: ${lastSynced}`);
}

main();
