/**
 * Seeds the local DynamoDB with a tenant, service graph, and GitHub App
 * installation for interactive dev/dashboard testing.
 *
 * Prerequisites: CauseFlow must be running (pnpm dev) and localstack up.
 *
 * Usage: pnpm tsx scripts/seed-dev.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as jose from 'jose';

// Load env files (same pattern as smoke tests)
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (override || !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch { /* file not found */ }
}

const root = resolve(import.meta.dirname ?? '.', '..');
loadEnvFile(resolve(root, '.env.smoke'));
const localPath = resolve(root, '.env.smoke.local');
if (existsSync(localPath)) loadEnvFile(localPath, true);

const BASE_URL = `http://localhost:${process.env['PORT'] ?? '3099'}`;
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'smoke-test-secret';

let TENANT_ID = '';

async function generateJWT(tenantId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT({
    tenant_id: tenantId,
    email: 'admin@causeflow.ai',
    roles: ['admin'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('seed-script')
    .setIssuer('causeflow')
    .setAudience('causeflow-api')
    .setExpirationTime('1h')
    .sign(secret);
}

async function api(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok && res.status !== 409) {
    console.error(`  [ERROR] ${method} ${path}: ${res.status}`, data);
  }
  return { status: res.status, data };
}

async function main() {
  console.log('=== CauseFlow Dev Seed ===\n');

  // 1. Check health
  const health = await api('GET', '/health');
  if (health.status !== 200) {
    console.error('CauseFlow is not running! Start with: PORT=3099 pnpm dev');
    process.exit(1);
  }
  console.log('[1/6] CauseFlow is healthy');

  // 2. Create tenant (use 'system' tenant_id for bootstrap JWT)
  const bootstrapJwt = await generateJWT('system');
  const tenantRes = await api('POST', '/v1/tenants', {
    name: 'Dev Test Corp',
    slug: `dev-test-${Date.now()}`,
    ownerEmail: 'admin@causeflow.ai',
    plan: 'enterprise',
  }, bootstrapJwt);

  if (tenantRes.status === 201 || tenantRes.status === 200) {
    TENANT_ID = tenantRes.data.tenantId;
    console.log(`[2/6] Tenant created: ${TENANT_ID}`);
  } else {
    console.error('Failed to create tenant', tenantRes);
    process.exit(1);
  }

  const jwt = await generateJWT(TENANT_ID);

  // 3. Configure AWS settings
  await api('PATCH', `/v1/tenants/${TENANT_ID}`, {
    settings: {
      awsRoleArn: process.env['AWS_ROLE_ARN'] ?? 'arn:aws:iam::000000000000:role/CauseFlowCrossAccountRole',
      awsExternalId: TENANT_ID,
      awsRegion: process.env['AWS_REGION'] ?? 'us-east-1',
    },
  }, jwt);
  console.log('[3/6] AWS settings configured');

  // 4. Seed service graph
  const nodes = [
    { serviceId: 'api-gateway', name: 'api-gateway', type: 'api', ownerTeam: 'platform', criticality: 'critical' },
    { serviceId: 'payment-service', name: 'payment-service', type: 'api', ownerTeam: 'payments', criticality: 'critical' },
    { serviceId: 'billing-service', name: 'billing-service', type: 'api', ownerTeam: 'billing', criticality: 'critical' },
    { serviceId: 'order-service', name: 'order-service', type: 'api', ownerTeam: 'orders', criticality: 'high' },
    { serviceId: 'billing-postgres', name: 'billing-postgres', type: 'database', ownerTeam: 'billing', criticality: 'critical' },
    { serviceId: 'postgres-primary', name: 'postgres-primary', type: 'database', ownerTeam: 'platform', criticality: 'critical' },
    { serviceId: 'redis-cache', name: 'redis-cache', type: 'cache', ownerTeam: 'platform', criticality: 'high' },
  ];

  for (const node of nodes) {
    await api('POST', '/v1/graph/nodes', node, jwt);
  }

  const edges = [
    { edgeId: 'gw-payment', sourceService: 'api-gateway', targetService: 'payment-service', edgeType: 'http' },
    { edgeId: 'gw-billing', sourceService: 'api-gateway', targetService: 'billing-service', edgeType: 'http' },
    { edgeId: 'gw-order', sourceService: 'api-gateway', targetService: 'order-service', edgeType: 'http' },
    { edgeId: 'billing-pg', sourceService: 'billing-service', targetService: 'billing-postgres', edgeType: 'database' },
    { edgeId: 'payment-pg', sourceService: 'payment-service', targetService: 'postgres-primary', edgeType: 'database' },
    { edgeId: 'payment-redis', sourceService: 'payment-service', targetService: 'redis-cache', edgeType: 'cache' },
    { edgeId: 'order-billing', sourceService: 'order-service', targetService: 'billing-service', edgeType: 'http' },
  ];

  for (const edge of edges) {
    await api('POST', '/v1/graph/edges', edge, jwt);
  }
  console.log(`[4/6] Service graph seeded: ${nodes.length} nodes, ${edges.length} edges`);

  // 5-6. GitHub App removed — code integration now via Composio
  console.log('[5/6] GitHub App removed — code integration via Composio');
  console.log('[6/6] Repo mappings skipped (use Composio triggers)');

  console.log('\n=== Seed Complete ===');
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log(`JWT Secret: ${JWT_SECRET}`);
  console.log(`Dashboard: ${BASE_URL}/dashboard`);
  console.log(`\nUpdate the dashboard "Tenant ID" field to: ${TENANT_ID}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
