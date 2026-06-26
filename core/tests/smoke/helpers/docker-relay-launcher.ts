import { execSync, type ExecSyncOptions } from 'node:child_process';
import pino from 'pino';

const logger = pino({ name: 'relay-launcher' });
const RELAY_CONTAINER = 'causeflow-relay-smoke';

const execOpts: ExecSyncOptions = {
  cwd: process.cwd(),
  encoding: 'utf-8',
  stdio: 'pipe',
};

export interface RelayLauncherConfig {
  tenantId: string;
  controlPlanePort: number;
  token: string;
}

/**
 * Launches the REAL causeflow-relay Docker container.
 *
 * Uses `docker-compose run` to inherit network config from docker-compose.yml:
 * - customer-vpc (internal) — access to order-postgres + order-mongo
 * - default — outbound WSS to CauseFlow control plane on host
 *
 * The relay runs with real:
 * - Postgres driver (pg) connecting to order-postgres:5432
 * - MongoDB driver connecting to order-mongo:27017
 * - SQL parser (node-sql-parser AST validation)
 * - Policy engine (resource + operation allowlist)
 * - Masking engine (PII regex: CPF, email, credit card, phone, bearer)
 * - Audit logger (structured JSON)
 * - WSS client with auto-reconnect (exponential backoff)
 */
export async function launchRelayContainer(config: RelayLauncherConfig): Promise<void> {
  // Stop any leftover container from a previous run
  stopRelayContainer();

  const controlPlaneUrl = `ws://host.docker.internal:${config.controlPlanePort}/v1/relay/connect`;

  // Build relay image
  logger.info('Building relay Docker image...');
  execSync('docker-compose build causeflow-relay', { ...execOpts, stdio: 'inherit' });

  // Launch via docker-compose run (inherits networks: customer-vpc + default)
  // Use the CONTAINER env var names (CONTROL_PLANE_URL, TENANT_ID) directly,
  // not the docker-compose YAML interpolation vars (RELAY_CONTROL_PLANE_URL, RELAY_TENANT_ID).
  const envOverrides = [
    `-e CONTROL_PLANE_URL=${controlPlaneUrl}`,
    `-e RELAY_TOKEN=${config.token}`,
    `-e TENANT_ID=${config.tenantId}`,
  ].join(' ');

  const cmd = `docker-compose run -d --rm --name ${RELAY_CONTAINER} ${envOverrides} causeflow-relay`;

  logger.info({ tenantId: config.tenantId, controlPlaneUrl }, 'Starting relay container...');
  const output = execSync(cmd, execOpts) as string;
  logger.info({ containerId: output.trim().slice(0, 12) }, 'Relay container started');
}

/**
 * Wait for the relay to appear in the CauseFlow registry.
 * The relay has auto-reconnect with exponential backoff, so it may take
 * a few seconds after container start for the WSS connection to establish.
 */
export async function waitForRelayConnection(
  isConnected: () => boolean,
  timeoutMs = 60_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isConnected()) {
      logger.info('Relay connected to control plane');
      return;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  // Dump relay logs for debugging on failure
  const logs = getRelayLogs(30);
  logger.error({ logs }, 'Relay did not connect — container logs');
  throw new Error(`Relay did not connect within ${timeoutMs}ms`);
}

/**
 * Stop and remove the relay container.
 */
export function stopRelayContainer(): void {
  try {
    execSync(`docker rm -f ${RELAY_CONTAINER}`, { ...execOpts, stdio: 'ignore' });
    logger.info('Relay container stopped');
  } catch { /* not running — OK */ }
}

/**
 * Get relay container logs (for debugging failures and verifying audit trail).
 */
export function getRelayLogs(tail = 100): string {
  try {
    return execSync(`docker logs ${RELAY_CONTAINER} --tail ${tail}`, execOpts) as string;
  } catch {
    return '(no logs available)';
  }
}
