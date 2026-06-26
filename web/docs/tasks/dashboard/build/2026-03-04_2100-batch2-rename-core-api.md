# Batch 2: Rename "External API" → "Core API"

Codebase-wide rename of all "external" API references to "core API". Must run AFTER Batch 1 merges.

## Context
- The backend API is called "Core API" (documented in `apps/core/core-api.md` and `apps/core/core-swagger-api.yaml`)
- The dashboard currently calls it "External API" everywhere — this needs to change
- This is a mechanical rename affecting files, types, variables, env vars, i18n strings, and docs

---

## Files to Rename

| Current | New |
|---|---|
| `apps/dashboard/src/lib/api/external-api-client.ts` | `apps/dashboard/src/lib/api/core-api-client.ts` |
| `apps/dashboard/src/lib/api/external-api-types.ts` | `apps/dashboard/src/lib/api/core-api-types.ts` |

## Type/Interface Renames

| Current | New |
|---|---|
| `IExternalApiClient` | `ICoreApiClient` |
| Any references to "External" in type names | Replace with "Core" |

## Env Var Renames

| Current | New | Location |
|---|---|---|
| `EXTERNAL_API_URL` | `CORE_API_URL` | `get-api-client.ts`, `.env.example`, `sst.config.ts` |
| `EXTERNAL_API_KEY` | `CORE_API_KEY` | `get-api-client.ts`, `.env.example`, `sst.config.ts` |

### Current `get-api-client.ts` (full file):
```ts
import type { IExternalApiClient } from './external-api-client';

let _client: IExternalApiClient | null = null;

export function getApiClient(): IExternalApiClient {
  if (_client) return _client;

  const apiUrl = process.env.EXTERNAL_API_URL;

  if (!apiUrl) {
    const { MockApiClient } = require('./mock-api-client') as typeof import('./mock-api-client');
    _client = new MockApiClient();
  } else {
    const { HttpApiClient } = require('./http-api-client') as typeof import('./http-api-client');
    _client = new HttpApiClient(apiUrl, async () => {
      return process.env.EXTERNAL_API_KEY ?? '';
    });
  }

  return _client;
}

export function resetApiClient(): void {
  _client = null;
}
```

After rename:
```ts
import type { ICoreApiClient } from './core-api-client';

let _client: ICoreApiClient | null = null;

export function getApiClient(): ICoreApiClient {
  if (_client) return _client;

  const apiUrl = process.env.CORE_API_URL;

  if (!apiUrl) {
    const { MockApiClient } = require('./mock-api-client') as typeof import('./mock-api-client');
    _client = new MockApiClient();
  } else {
    const { HttpApiClient } = require('./http-api-client') as typeof import('./http-api-client');
    _client = new HttpApiClient(apiUrl, async () => {
      return process.env.CORE_API_KEY ?? '';
    });
  }

  return _client;
}

export function resetApiClient(): void {
  _client = null;
}
```

### Current `.env.example` (lines 101-105):
```bash
# External API (Phase 9 extension)
# Leave blank to use mock data. Add real endpoint when available.
# Format: https://api.example.com/v1
EXTERNAL_API_URL=
```

After rename:
```bash
# Core API
# Leave blank to use mock data. Add real Core API endpoint when available.
# Format: https://api.example.com/v1
CORE_API_URL=
CORE_API_KEY=
```

### Current `sst.config.ts` (lines 438-439):
```ts
// External API (Phase 9: add binding here when real external API is available)
// EXTERNAL_API_URL: process.env.EXTERNAL_API_URL ?? '',
```

After rename:
```ts
// Core API (connect to CauseFlow Core API when available)
// CORE_API_URL: process.env.CORE_API_URL ?? '',
// CORE_API_KEY: process.env.CORE_API_KEY ?? '',
```

## Import Updates (all consumers)

Run this search to find ALL imports of the old files:
```bash
grep -rn "external-api-client\|external-api-types\|IExternalApiClient" apps/dashboard/src/
```

Every file that imports from `external-api-client` or `external-api-types` needs its import path updated.

Key files that definitely import these:
- `apps/dashboard/src/lib/api/get-api-client.ts`
- `apps/dashboard/src/lib/api/http-api-client.ts`
- `apps/dashboard/src/lib/api/mock-api-client.ts`
- All API route files under `apps/dashboard/src/app/api/` that use `getApiClient()` or types from `external-api-types`
- All presentation components that import types (SystemStatus, PatternInsights, etc.)

## i18n Updates

Search for "external" in dashboard i18n files:
- `apps/dashboard/src/contexts/shared/infrastructure/i18n/en.json`
- `apps/dashboard/src/contexts/shared/infrastructure/i18n/pt-br.json`
- `apps/dashboard/src/contexts/settings/infrastructure/i18n/en.json`
- `apps/dashboard/src/contexts/settings/infrastructure/i18n/pt-br.json`

Replace any "External API" strings with "Core API" / "API Principal" (pt-br).

## Documentation Updates

- `docs/apps/dashboard/api-reference.md` — rename references to "External API"
- `apps/dashboard/CLAUDE.md` — update any mentions of external API client

## Implementation Steps

1. **Rename the files** (create new, copy content, delete old):
   ```bash
   cd apps/dashboard/src/lib/api
   cp external-api-client.ts core-api-client.ts
   cp external-api-types.ts core-api-types.ts
   ```
2. **Update the interface name** in `core-api-client.ts`: `IExternalApiClient` → `ICoreApiClient`
3. **Update `get-api-client.ts`** with new import path and type
4. **Update `http-api-client.ts`** — import from `core-api-client` and `core-api-types`
5. **Update `mock-api-client.ts`** — same
6. **Find and update all other imports** across the codebase
7. **Update env vars** in `get-api-client.ts`, `.env.example`, `sst.config.ts`
8. **Update i18n** strings
9. **Update docs**
10. **Delete old files**: `external-api-client.ts`, `external-api-types.ts`
11. **Run verification**: `pnpm turbo build && pnpm exec biome check . && pnpm turbo check-types && pnpm turbo test`

## Verification
- `grep -rn "external-api\|ExternalApi\|EXTERNAL_API" apps/dashboard/` should return ZERO results
- Build passes with zero errors
- All tests pass
- Dev server starts without errors
