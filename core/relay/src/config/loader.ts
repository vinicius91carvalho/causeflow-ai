import { readFileSync, existsSync, watch, type FSWatcher } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import pino from 'pino';
import { relayConfigSchema, legacyConfigSchema, type RelayConfig } from './schema.js';

const logger = pino({ name: 'config-loader' });

function interpolateEnv(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_match, varName) => process.env[varName] ?? '');
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

function migrateLegacy(legacy: ReturnType<typeof legacyConfigSchema.parse>): unknown {
  return {
    transport: {
      kind: 'wss',
      url: legacy.controlPlane.url,
      tenantId: legacy.controlPlane.tenantId,
      tokenRef: `plain:${legacy.controlPlane.token}`,
    },
    resources: legacy.resources.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      connection: r.connection,
      allowedOperations: r.allowedOperations ?? ['query', 'describe_table', 'list_tables', 'explain'],
      maxRowsPerQuery: r.maxRowsPerQuery ?? 1000,
    })),
    masking: {
      enabled: legacy.masking?.enabled ?? true,
      patterns: legacy.masking?.patterns ?? [],
    },
    audit: {
      enabled: legacy.audit?.enabled ?? true,
      level: legacy.audit?.level ?? 'info',
    },
  };
}

function buildFromEnv(): unknown {
  const resources = [];
  let idx = 0;
  while (process.env[`RESOURCE_${idx}_ID`]) {
    resources.push({
      id: process.env[`RESOURCE_${idx}_ID`]!,
      type: process.env[`RESOURCE_${idx}_TYPE`] as string,
      name: process.env[`RESOURCE_${idx}_NAME`] ?? `resource-${idx}`,
      connection: JSON.parse(process.env[`RESOURCE_${idx}_CONNECTION`] ?? '{}'),
      maxRowsPerQuery: Number(process.env[`RESOURCE_${idx}_MAX_ROWS`] ?? '1000'),
    });
    idx++;
  }
  return {
    transport: {
      kind: 'wss',
      url: process.env['CONTROL_PLANE_URL'] ?? 'ws://localhost:3000/v1/relay/connect',
      tenantId: process.env['TENANT_ID'] ?? '',
      tokenRef: process.env['RELAY_TOKEN']
        ? `plain:${process.env['RELAY_TOKEN']}`
        : process.env['RELAY_TOKEN_REF'] ?? 'plain:',
    },
    resources,
    masking: { enabled: (process.env['MASKING_ENABLED'] ?? 'true') === 'true' },
    audit: { enabled: (process.env['AUDIT_ENABLED'] ?? 'true') === 'true' },
  };
}

export function loadConfig(configPath?: string): RelayConfig {
  const path = configPath ?? process.env['RELAY_CONFIG_PATH'] ?? '/app/relay-config.yaml';

  let parsed: unknown;
  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf-8');
    parsed = interpolateObject(parseYaml(raw));
  } else {
    parsed = buildFromEnv();
  }

  const legacyAttempt = legacyConfigSchema.safeParse(parsed);
  if (legacyAttempt.success && !(parsed as { transport?: unknown }).transport) {
    logger.warn('Legacy config detected — migrating. Please update to schema v2.');
    parsed = migrateLegacy(legacyAttempt.data);
  }

  return relayConfigSchema.parse(parsed);
}

export interface ConfigWatchOptions {
  path: string;
  onChange: (config: RelayConfig) => void;
  debounceMs?: number;
}

export function watchConfig(opts: ConfigWatchOptions): FSWatcher | null {
  if (!existsSync(opts.path)) return null;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const watcher = watch(opts.path, () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      try {
        const next = loadConfig(opts.path);
        logger.info('Config reloaded');
        opts.onChange(next);
      } catch (err) {
        logger.error({ err }, 'Config reload failed');
      }
    }, opts.debounceMs ?? 500);
  });
  process.on('SIGHUP', () => {
    try {
      const next = loadConfig(opts.path);
      logger.info('Config reloaded via SIGHUP');
      opts.onChange(next);
    } catch (err) {
      logger.error({ err }, 'SIGHUP reload failed');
    }
  });
  return watcher;
}
