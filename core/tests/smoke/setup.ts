import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(filePath: string, override = false): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes (handles PEM keys with \n)
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (override || !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // File not found — skip silently
  }
}

// Load .env.smoke as base, then .env.smoke.local as override
loadEnvFile(resolve(process.cwd(), '.env.smoke'));
const localEnvPath = resolve(process.cwd(), '.env.smoke.local');
if (existsSync(localEnvPath)) {
  console.log('[Smoke Setup] Loading .env.smoke.local overrides');
  loadEnvFile(localEnvPath, true);
}

async function waitForHealthy(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`[Smoke Setup] ${url} is healthy`);
        return;
      }
    } catch {
      // service not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${url} not healthy after ${timeoutMs}ms`);
}

export async function setup(): Promise<void> {
  console.log('[Smoke Setup] Waiting for services...');
  const healthChecks = [
    waitForHealthy('http://localhost:4566/_localstack/health', 30_000),
    waitForHealthy('http://localhost:4567/_localstack/health', 30_000),
    waitForHealthy('http://localhost:3100/health', 60_000),
  ];

  // Optionally wait for order-service if relay tests are enabled
  if (process.env['RELAY_ENABLED'] === 'true') {
    healthChecks.push(waitForHealthy('http://localhost:3200/health', 60_000));
  }

  // Optionally wait for marketplace-platform services
  if (process.env['MARKETPLACE_ENABLED'] === 'true') {
    healthChecks.push(waitForHealthy('http://localhost:3400/health', 60_000));
    healthChecks.push(waitForHealthy('http://localhost:3500/health', 60_000));
    healthChecks.push(waitForHealthy('http://localhost:3600/health', 60_000));
  }

  await Promise.all(healthChecks);
  console.log('[Smoke Setup] All services ready!');

  // Optional: check Langfuse if configured
  if (process.env['LANGFUSE_PUBLIC_KEY'] && process.env['LANGFUSE_SECRET_KEY']) {
    try {
      await waitForHealthy(
        process.env['LANGFUSE_BASE_URL'] ?? 'http://localhost:3001',
        15_000,
      );
    } catch {
      console.warn('[Smoke Setup] Langfuse not available, continuing with Noop');
    }
  }
}
