import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { relayConfigSchema, type RelayConfig } from './schema.js';

function interpolateEnv(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_match, varName) => {
    return process.env[varName] ?? '';
  });
}

function interpolateObject(obj: unknown): unknown {
  if (typeof obj === 'string') return interpolateEnv(obj);
  if (Array.isArray(obj)) return obj.map(interpolateObject);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value);
    }
    return result;
  }
  return obj;
}

export function loadConfig(configPath?: string): RelayConfig {
  const path = configPath ?? process.env['RELAY_CONFIG_PATH'] ?? '/app/relay-config.yaml';

  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf-8');
    const parsed = parseYaml(raw);
    const interpolated = interpolateObject(parsed);
    return relayConfigSchema.parse(interpolated);
  }

  // Fallback: build config from environment variables only
  const resources = [];
  let idx = 0;
  while (process.env[`RESOURCE_${idx}_ID`]) {
    resources.push({
      id: process.env[`RESOURCE_${idx}_ID`]!,
      type: process.env[`RESOURCE_${idx}_TYPE`] as 'postgres' | 'mongodb',
      name: process.env[`RESOURCE_${idx}_NAME`] ?? `resource-${idx}`,
      connection: JSON.parse(process.env[`RESOURCE_${idx}_CONNECTION`] ?? '{}'),
      maxRowsPerQuery: Number(process.env[`RESOURCE_${idx}_MAX_ROWS`] ?? '1000'),
    });
    idx++;
  }

  return relayConfigSchema.parse({
    controlPlane: {
      url: process.env['CONTROL_PLANE_URL'] ?? 'ws://localhost:3000/v1/relay/connect',
      token: process.env['RELAY_TOKEN'] ?? '',
      tenantId: process.env['TENANT_ID'] ?? '',
    },
    resources,
    masking: {
      enabled: (process.env['MASKING_ENABLED'] ?? 'true') === 'true',
    },
    audit: {
      enabled: (process.env['AUDIT_ENABLED'] ?? 'true') === 'true',
    },
  });
}
