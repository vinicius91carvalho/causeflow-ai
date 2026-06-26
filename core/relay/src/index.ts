import pino from 'pino';
import type { IPolicy } from 'cockatiel';

import { loadConfig, watchConfig } from './config/loader.js';
import type { RelayConfig, ResourceConfig } from './config/schema.js';

import { DriverRegistry, type IReadOnlyDriver } from './drivers/driver.port.js';
import { pgDriverFactory } from './drivers/postgres/pg-driver.js';
import { mongoDriverFactory } from './drivers/mongodb/mongo-driver.js';
import { mysqlDriverFactory } from './drivers/mysql/mysql-driver.js';
import { redisDriverFactory } from './drivers/redis/redis-driver.js';
import { elasticsearchDriverFactory } from './drivers/elasticsearch/es-driver.js';
import { httpDriverFactory } from './drivers/http/http-driver.js';
import { prometheusDriverFactory } from './drivers/prometheus/prom-driver.js';
import { cloudwatchDriverFactory } from './drivers/cloudwatch/cw-driver.js';
import { kubernetesDriverFactory } from './drivers/kubernetes/kube-driver.js';
import { loadPlugins } from './drivers/plugin-loader.js';

import { LocalPolicyEngine } from './policy/local-policy-engine.js';
import { OpaPolicyClient } from './policy/opa-client.js';
import type { IPolicyEvaluator } from './policy/policy.port.js';

import { MaskingEngine } from './masking/masking-engine.js';
import { AuditLogger, type AuditEntry } from './audit/audit-logger.js';
import { AuditForwarder } from './audit/forwarder.js';
import { HealthReporter } from './health/health-reporter.js';

import { SecretResolver } from './secrets/secrets.port.js';
import { EnvSecretProvider } from './secrets/env-provider.js';
import { AwsSecretsManagerProvider } from './secrets/aws-sm-provider.js';
import { AzureKeyVaultProvider } from './secrets/azure-kv-provider.js';
import { GcpSecretManagerProvider } from './secrets/gcp-sm-provider.js';
import { VaultProvider } from './secrets/vault-provider.js';

import { MetricsRegistry } from './observability/metrics.js';
import { startHttpServer } from './observability/http-server.js';

import { SessionManager } from './session/session-manager.js';
import { ApprovalManager, type ApprovalTransport } from './approval/approval-manager.js';

import { WsClient } from './transport/ws-client.js';
import { createResponse, createErrorResponse, type RpcRequest } from './transport/protocol.js';
import type { ITransport } from './transport/transport.port.js';

import { makeCircuitBreaker } from './reliability/circuit-breaker.js';
import { RateLimiterRegistry } from './reliability/rate-limiter.js';
import { retryWithBackoff } from './reliability/retry.js';

const logger = pino({ name: 'causeflow-relay' });

function buildSecretResolver(): SecretResolver {
  const resolver = new SecretResolver();
  resolver.register(new EnvSecretProvider());
  if (process.env['AWS_REGION']) resolver.register(new AwsSecretsManagerProvider(process.env['AWS_REGION']));
  if (process.env['AZURE_KEY_VAULT_URL']) resolver.register(new AzureKeyVaultProvider(process.env['AZURE_KEY_VAULT_URL']));
  resolver.register(new GcpSecretManagerProvider());
  if (process.env['VAULT_ADDR'] && process.env['VAULT_TOKEN']) {
    resolver.register(new VaultProvider(process.env['VAULT_ADDR'], process.env['VAULT_TOKEN'], process.env['VAULT_NAMESPACE']));
  }
  return resolver;
}

function buildDriverRegistry(): DriverRegistry {
  const registry = new DriverRegistry();
  registry.register(pgDriverFactory);
  registry.register(mongoDriverFactory);
  registry.register(mysqlDriverFactory);
  registry.register(redisDriverFactory);
  registry.register(elasticsearchDriverFactory);
  registry.register(httpDriverFactory);
  registry.register(prometheusDriverFactory);
  registry.register(cloudwatchDriverFactory);
  registry.register(kubernetesDriverFactory);
  return registry;
}

async function buildDrivers(
  config: RelayConfig,
  resolver: SecretResolver,
  registry: DriverRegistry,
): Promise<Map<string, IReadOnlyDriver>> {
  const drivers = new Map<string, IReadOnlyDriver>();
  for (const resource of config.resources) {
    const factory = registry.get(resource.type);
    if (!factory) {
      logger.error({ type: resource.type }, 'No driver registered for type');
      continue;
    }
    try {
      const resolvedConn = await resolveResourceSecrets(resource, resolver);
      const driver = await retryWithBackoff(
        () => factory.create(resource, resolvedConn),
        {
          attempts: 5,
          initialDelayMs: 1_000,
          maxDelayMs: 15_000,
          factor: 2,
          onAttempt: (attempt, err) => logger.warn({ attempt, err, resource: resource.id }, 'Driver init retry'),
        },
      );
      drivers.set(resource.id, driver);
      logger.info({ id: resource.id, type: resource.type }, 'Driver initialized');
    } catch (err) {
      logger.error({ err, id: resource.id }, 'Driver init failed after retries — resource unavailable');
    }
  }
  return drivers;
}

async function resolveResourceSecrets(resource: ResourceConfig, resolver: SecretResolver): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(resource.connection)) {
    if (typeof v === 'string' && /^(env|aws-sm|azure-kv|gcp-sm|vault|plain):/.test(v)) {
      out[k] = await resolver.resolve(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function buildPolicyEngine(config: RelayConfig): IPolicyEvaluator {
  const local = new LocalPolicyEngine(config.resources);
  if (config.policy.engine === 'opa') {
    return new OpaPolicyClient(config.policy.opa, local);
  }
  return local;
}

function buildRateLimiters(config: RelayConfig): RateLimiterRegistry {
  const r = new RateLimiterRegistry();
  for (const resource of config.resources) {
    r.configure(resource.id, {
      requestsPerMinute: resource.rateLimit.requestsPerMinute,
      burstCapacity: resource.rateLimit.burstCapacity,
    });
  }
  return r;
}

function buildCircuitBreakers(config: RelayConfig): Map<string, IPolicy> {
  const m = new Map<string, IPolicy>();
  for (const resource of config.resources) {
    m.set(resource.id, makeCircuitBreaker(5, 30_000));
  }
  return m;
}

async function main(): Promise<void> {
  logger.info('Starting CauseFlow Relay v2...');

  const configPath = process.env['RELAY_CONFIG_PATH'] ?? '/app/relay-config.yaml';
  let config = loadConfig(configPath);
  logger.info({ resources: config.resources.length, tenantId: config.transport.tenantId }, 'Config loaded');

  const resolver = buildSecretResolver();
  const driverRegistry = buildDriverRegistry();
  await loadPlugins(config.plugins.directory, driverRegistry);

  const token = await resolver.resolve(config.transport.tokenRef);

  const drivers = await buildDrivers(config, resolver, driverRegistry);
  const policyEngine = buildPolicyEngine(config);
  const maskingEngine = new MaskingEngine(
    config.masking,
    config.masking.fpe.enabled && config.masking.fpe.keyRef ? await resolver.resolve(config.masking.fpe.keyRef) : undefined,
  );
  const healthReporter = new HealthReporter(drivers);
  const rateLimiters = buildRateLimiters(config);
  const circuitBreakers = buildCircuitBreakers(config);
  const sessionManager = new SessionManager(config.session.timeBoxed.requireActiveIncident);

  const metrics = config.observability.metrics.enabled ? new MetricsRegistry() : null;
  let readyForTraffic = false;

  const auditHmacKey = config.audit.hashChain.hmacKeyRef
    ? await resolver.resolve(config.audit.hashChain.hmacKeyRef)
    : undefined;

  let wsClient: WsClient | null = null;
  const auditTransport = {
    async send(batch) {
      if (!wsClient?.isConnected()) throw new Error('control plane not connected');
      wsClient.sendRaw({ type: 'audit_batch', relayId: wsClient.id, tenantId: config.transport.tenantId, entries: batch });
    },
  } as ConstructorParameters<typeof AuditForwarder>[0];

  const auditForwarder = config.audit.forward.enabled
    ? new AuditForwarder({
      bufferPath: config.audit.forward.bufferPath,
      batchSize: config.audit.forward.batchSize,
      flushIntervalMs: config.audit.forward.flushIntervalMs,
      send: auditTransport.send,
    })
    : null;

  if (auditForwarder) await auditForwarder.start();

  const auditLogger = new AuditLogger(config.audit, '', auditHmacKey, auditForwarder);

  const approvalTransport: ApprovalTransport = {
    async forward(request) {
      wsClient?.sendRaw({ type: 'approval_request', relayId: wsClient.id, tenantId: config.transport.tenantId, request });
    },
  };
  const approvalManager = new ApprovalManager(approvalTransport);

  if (config.observability.http.enabled) {
    const breakGlassSecret = config.session.breakGlass.sharedSecretRef
      ? await resolver.resolve(config.session.breakGlass.sharedSecretRef)
      : undefined;
    startHttpServer({
      port: config.observability.http.port,
      metrics,
      isReady: () => readyForTraffic,
      breakGlass: config.session.breakGlass.enabled && breakGlassSecret
        ? {
          path: config.session.breakGlass.controlEndpointPath,
          sharedSecret: breakGlassSecret,
          onTrip: (reason) => {
            logger.warn({ reason }, 'Break-glass tripped');
            sessionManager.tripBreakGlass(reason);
            metrics?.connected.set(0);
          },
        }
        : undefined,
    });
  }

  wsClient = new WsClient({
    url: config.transport.url,
    token,
    tenantId: config.transport.tenantId,
    tls: {
      ...(config.transport.mtls.enabled
        ? {
          cert: config.transport.mtls.certRef ? await resolver.resolve(config.transport.mtls.certRef) : undefined,
          key: config.transport.mtls.keyRef ? await resolver.resolve(config.transport.mtls.keyRef) : undefined,
          ca: config.transport.mtls.caRef ? await resolver.resolve(config.transport.mtls.caRef) : undefined,
        }
        : {}),
      pinnedSha256: config.transport.pinnedSha256,
    },
    reconnect: config.transport.reconnect,
    replay: config.transport.replayWindow,
    onConnect: () => {
      metrics?.connected.set(1);
      readyForTraffic = true;
      wsClient?.sendResourceUpdate(
        config.resources.map((r) => ({
          resourceId: r.id,
          type: r.type,
          name: r.name,
          database: r.connection['database'] ?? '',
          readOnly: true,
          capabilities: drivers.get(r.id)?.capabilities(),
        })),
      );
    },
    onDisconnect: () => {
      metrics?.connected.set(0);
      readyForTraffic = false;
    },
    onMessage: (request) =>
      handleRequest(request, {
        config,
        drivers,
        policyEngine,
        maskingEngine,
        healthReporter,
        rateLimiters,
        circuitBreakers,
        sessionManager,
        approvalManager,
        auditLogger,
        metrics,
        wsClient: () => wsClient!,
      }),
  });
  wsClient.connect();

  watchConfig({
    path: configPath,
    onChange: (next) => {
      config = next;
      logger.info({ resources: next.resources.length }, 'Config applied (masking/patterns hot-reload enabled)');
    },
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    wsClient?.close();
    for (const driver of drivers.values()) {
      await driver.close().catch(() => undefined);
    }
    await auditLogger.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

interface RequestDeps {
  config: RelayConfig;
  drivers: Map<string, IReadOnlyDriver>;
  policyEngine: IPolicyEvaluator;
  maskingEngine: MaskingEngine;
  healthReporter: HealthReporter;
  rateLimiters: RateLimiterRegistry;
  circuitBreakers: Map<string, IPolicy>;
  sessionManager: SessionManager;
  approvalManager: ApprovalManager;
  auditLogger: AuditLogger;
  metrics: MetricsRegistry | null;
  wsClient: () => ITransport;
}

async function handleRequest(request: RpcRequest, deps: RequestDeps): Promise<void> {
  const transport = deps.wsClient();
  const now = new Date().toISOString();
  const incidentId = typeof request.params['incidentId'] === 'string' ? (request.params['incidentId'] as string) : undefined;
  const session = deps.sessionManager.canAccept(incidentId);
  if (!session.ok) {
    transport.send(createErrorResponse(request.id, -32001, `Session denied: ${session.reason}`));
    await logAudit(deps, {
      timestamp: now,
      relayId: '',
      tenantId: deps.config.transport.tenantId,
      requestId: request.id,
      incidentId,
      resource: '',
      operation: String(request.method),
      result: 'denied',
      policyChecks: { session: session.reason },
    });
    return;
  }

  try {
    switch (request.method) {
      case 'list_resources': {
        const resources = deps.config.resources.map((r) => ({
          resourceId: r.id,
          type: r.type,
          name: r.name,
          database: r.connection['database'] ?? '',
          readOnly: true,
          capabilities: deps.drivers.get(r.id)?.capabilities(),
        }));
        transport.send(createResponse(request.id, resources));
        return;
      }
      case 'describe_resource': {
        const resourceId = request.params['resourceId'] as string;
        const driver = deps.drivers.get(resourceId);
        if (!driver) {
          transport.send(createErrorResponse(request.id, -32602, `Unknown resource: ${resourceId}`));
          return;
        }
        const result = await driver.execute({ operation: 'list_tables', params: {} });
        transport.send(createResponse(request.id, {
          tables: result.rows,
          type: driver.type,
          database: deps.config.resources.find((r) => r.id === resourceId)?.connection['database'] ?? '',
        }));
        return;
      }
      case 'health_check': {
        const statuses = await deps.healthReporter.checkAll();
        for (const s of statuses) {
          deps.metrics?.resourceHealth.set({ resource: s.resourceId, type: s.type }, s.healthy ? 1 : 0);
        }
        transport.send(createResponse(request.id, statuses));
        return;
      }
      case 'execute': {
        await handleExecute(request, deps, incidentId);
        return;
      }
      default:
        transport.send(createErrorResponse(request.id, -32601, `Unknown method: ${request.method}`));
    }
  } catch (err) {
    logger.error({ err, requestId: request.id }, 'Request handler error');
    transport.send(createErrorResponse(request.id, -32603, err instanceof Error ? err.message : 'Internal error'));
  }
}

async function handleExecute(request: RpcRequest, deps: RequestDeps, incidentId: string | undefined): Promise<void> {
  const transport = deps.wsClient();
  const resourceId = request.params['resourceId'] as string;
  const operation = request.params['operation'] as string;
  const params = (request.params['params'] as Record<string, unknown>) ?? {};
  const now = new Date().toISOString();

  if (!deps.rateLimiters.tryConsume(resourceId)) {
    deps.metrics?.rateLimited.inc({ resource: resourceId });
    transport.send(createErrorResponse(request.id, -32010, 'Rate limit exceeded'));
    await logAudit(deps, {
      timestamp: now,
      relayId: '',
      tenantId: deps.config.transport.tenantId,
      requestId: request.id,
      incidentId,
      resource: resourceId,
      operation,
      result: 'denied',
      policyChecks: { reason: 'rate_limit' },
    });
    return;
  }

  const command = { operation, params };
  const policy = await deps.policyEngine.evaluate({
    tenantId: deps.config.transport.tenantId,
    resourceId,
    command,
    requestId: request.id,
    incidentId,
  });

  if (!policy.allowed) {
    deps.metrics?.policyDenials.inc({ resource: resourceId, reason: policy.reason ?? 'unknown' });
    transport.send(createErrorResponse(request.id, -32600, `Policy denied: ${policy.reason}`));
    await logAudit(deps, {
      timestamp: now,
      relayId: '',
      tenantId: deps.config.transport.tenantId,
      requestId: request.id,
      incidentId,
      resource: resourceId,
      operation,
      result: 'denied',
      policyChecks: { reason: policy.reason },
    });
    return;
  }

  if (policy.clampRowLimit !== undefined) {
    params['limit'] = Math.min(Number(params['limit'] ?? policy.clampRowLimit), policy.clampRowLimit);
  }

  const driver = deps.drivers.get(resourceId);
  if (!driver) {
    transport.send(createErrorResponse(request.id, -32602, `Unknown resource: ${resourceId}`));
    return;
  }

  const validation = driver.validate(command);
  if (!validation.valid) {
    transport.send(createErrorResponse(request.id, -32602, `Validation failed: ${validation.reason}`));
    await logAudit(deps, {
      timestamp: now,
      relayId: '',
      tenantId: deps.config.transport.tenantId,
      requestId: request.id,
      incidentId,
      resource: resourceId,
      operation,
      result: 'denied',
      policyChecks: { reason: validation.reason },
    });
    return;
  }

  if (policy.requiresApproval) {
    deps.metrics?.approvalsRequested.inc({ resource: resourceId, reason: 'policy_threshold' });
    await logAudit(deps, {
      timestamp: now,
      relayId: '',
      tenantId: deps.config.transport.tenantId,
      requestId: request.id,
      incidentId,
      resource: resourceId,
      operation,
      result: 'approval_required',
      policyChecks: { threshold: true },
    });
    const decision = await deps.approvalManager.request({
      requestId: request.id,
      tenantId: deps.config.transport.tenantId,
      resourceId,
      operation,
      params,
      reason: 'Policy threshold exceeded (sensitive table or row count)',
    });
    if (!decision.approved) {
      transport.send(createErrorResponse(request.id, -32011, 'Approval denied or timed out'));
      return;
    }
  }

  const breaker = deps.circuitBreakers.get(resourceId);
  const resource = deps.config.resources.find((r) => r.id === resourceId);
  const startMs = Date.now();
  try {
    const result = breaker
      ? await breaker.execute(() => driver.execute(command))
      : await driver.execute(command);

    const maskContext = {
      resourceId,
      table: params['tableName'] as string | undefined,
      columnRules: resource?.columnRules,
    };
    const { masked, detections, maskedFieldCount } = deps.maskingEngine.mask(result.rows, maskContext);
    for (const det of detections) {
      deps.metrics?.masked.inc({ detector: det.detector, resource: resourceId }, det.count);
    }
    deps.metrics?.queries.inc({ resource: resourceId, operation, result: 'success' });
    deps.metrics?.queryLatency.observe({ resource: resourceId, operation }, Date.now() - startMs);

    transport.send(createResponse(request.id, {
      rows: masked,
      rowCount: result.rowCount,
      fields: result.fields,
      executionTimeMs: result.executionTimeMs,
      masked: maskedFieldCount > 0,
      maskedFieldCount,
      detections,
    }));

    await logAudit(deps, {
      timestamp: now,
      relayId: '',
      tenantId: deps.config.transport.tenantId,
      requestId: request.id,
      incidentId,
      resource: resourceId,
      operation,
      result: 'success',
      rowCount: result.rowCount,
      maskedFieldCount,
      maskedDetectors: detections,
      executionTimeMs: result.executionTimeMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.metrics?.queryErrors.inc({ resource: resourceId, operation, reason: message.slice(0, 64) });
    transport.send(createErrorResponse(request.id, -32603, message));
    await logAudit(deps, {
      timestamp: now,
      relayId: '',
      tenantId: deps.config.transport.tenantId,
      requestId: request.id,
      incidentId,
      resource: resourceId,
      operation,
      result: 'error',
      errorMessage: message,
    });
  }
}

async function logAudit(deps: RequestDeps, entry: AuditEntry): Promise<void> {
  try {
    await deps.auditLogger.log(entry);
  } catch (err) {
    logger.warn({ err }, 'Audit log failed');
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start relay');
  process.exit(1);
});
