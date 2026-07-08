#!/usr/bin/env tsx

/**
 * CLI script to add credits to a tenant via the Core API.
 *
 * Usage:
 *   pnpm --filter dashboard run credits:add -- --tenant <tenantId> --amount <n> [--reason "reason"]
 *
 * Requires CORE_API_URL and CORE_API_JWT_SECRET env vars.
 */

export interface AddCreditsResult {
  timestamp: string;
  tenantId: string;
  amount: number;
  reason: string;
}

interface Args {
  tenant: string;
  amount: number;
  reason?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let tenant = '';
  let amount = 0;
  let reason: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tenant':
        tenant = args[++i]!;
        break;
      case '--amount':
        amount = Number.parseInt(args[++i]!, 10);
        break;
      case '--reason':
        reason = args[++i]!;
        break;
    }
  }

  return { tenant, amount, reason };
}

async function main() {
  const { tenant: tenantId, amount, reason } = parseArgs();

  if (!tenantId) {
    console.error('Error: --tenant <tenantId> is required');
    process.exit(1);
  }

  if (!amount || amount <= 0) {
    console.error('Error: --amount must be a positive number');
    process.exit(1);
  }

  if (amount > 10000) {
    console.error('Error: --amount cannot exceed 10,000 (safety limit)');
    process.exit(1);
  }

  const apiUrl = process.env.CORE_API_URL;
  if (!apiUrl) {
    console.error('Error: CORE_API_URL environment variable is required');
    process.exit(1);
  }

  try {
    const response = await fetch(`${apiUrl}/api/v1/tenants/${tenantId}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason: reason ?? 'Manual credit addition via CLI' }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API returned ${response.status}: ${body}`);
    }

    const result = await response.json();
    console.log('Credits added successfully:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error('Failed to add credits:', err);
    process.exit(1);
  });
}
