import pino from 'pino';
import { loadConfig } from './config/loader.js';
import { PgDriver } from './drivers/postgres/pg-driver.js';
import { MongoDriver } from './drivers/mongodb/mongo-driver.js';
import type { IReadOnlyDriver, DriverCommand } from './drivers/driver.port.js';
import { PolicyEngine } from './policy/policy-engine.js';
import { MaskingEngine } from './masking/masking-engine.js';
import { AuditLogger, type AuditEntry } from './audit/audit-logger.js';
import { HealthReporter } from './health/health-reporter.js';
import { WsClient } from './transport/ws-client.js';
import { createResponse, createErrorResponse, type RpcRequest } from './transport/protocol.js';

const logger = pino({ name: 'causeflow-relay' });

async function main() {
  logger.info('Starting CauseFlow Relay...');

  const config = loadConfig();
  logger.info({ resources: config.resources.length, tenantId: config.controlPlane.tenantId }, 'Config loaded');

  // Initialize drivers
  const drivers = new Map<string, IReadOnlyDriver>();

  for (const resource of config.resources) {
    try {
      if (resource.type === 'postgres') {
        const conn = resource.connection;
        drivers.set(resource.id, new PgDriver({
          host: String(conn['host'] ?? 'localhost'),
          port: Number(conn['port'] ?? 5432),
          database: String(conn['database'] ?? ''),
          user: String(conn['user'] ?? ''),
          password: String(conn['password'] ?? ''),
          maxRows: resource.maxRowsPerQuery,
        }));
      } else if (resource.type === 'mongodb') {
        const conn = resource.connection;
        drivers.set(resource.id, new MongoDriver({
          uri: String(conn['uri'] ?? ''),
          database: String(conn['database'] ?? ''),
          maxRows: resource.maxRowsPerQuery,
        }));
      }
      logger.info({ id: resource.id, type: resource.type }, 'Driver initialized');
    } catch (err) {
      logger.error({ err, id: resource.id }, 'Failed to initialize driver');
    }
  }

  // Initialize engines
  const policyEngine = new PolicyEngine(config.resources);
  const maskingEngine = new MaskingEngine(config.masking);
  const healthReporter = new HealthReporter(drivers);

  // Connect to control plane
  const wsClient = new WsClient({
    url: config.controlPlane.url,
    token: config.controlPlane.token,
    tenantId: config.controlPlane.tenantId,
    onConnect: () => {
      // Send resource list on connect — only resources with initialized drivers
      const connectedResources = config.resources.filter((r) => drivers.has(r.id));
      wsClient.sendResourceUpdate(
        connectedResources.map((r) => ({
          resourceId: r.id,
          type: r.type,
          name: r.name,
          database: String(r.connection['database'] ?? ''),
          readOnly: true,
        })),
      );
    },
    onMessage: async (request: RpcRequest) => {
      const auditLogger = new AuditLogger(config.audit, wsClient.id);

      try {
        switch (request.method) {
          case 'list_resources': {
            const resources = policyEngine
              .listResources()
              .filter((r) => drivers.has(r.id))
              .map((r) => ({
                resourceId: r.id,
                type: r.type,
                name: r.name,
                database: String(r.connection['database'] ?? ''),
                readOnly: true,
              }));
            wsClient.send(createResponse(request.id, resources));
            break;
          }

          case 'describe_resource': {
            const resourceId = request.params['resourceId'] as string;
            const driver = drivers.get(resourceId);
            if (!driver) {
              wsClient.send(createErrorResponse(request.id, -32602, `Unknown resource: ${resourceId}`));
              return;
            }
            const result = await driver.execute({ operation: 'list_tables', params: {} });
            const resource = policyEngine.getResource(resourceId);
            wsClient.send(createResponse(request.id, {
              tables: result.rows,
              type: resource?.type ?? driver.type,
              database: String(resource?.connection['database'] ?? ''),
            }));
            break;
          }

          case 'execute': {
            const resourceId = request.params['resourceId'] as string;
            const operation = request.params['operation'] as string;
            const params = (request.params['params'] as Record<string, unknown>) ?? {};

            const command: DriverCommand = { operation: operation as any, params };

            // Policy check
            const policy = policyEngine.evaluate(resourceId, command);
            if (!policy.allowed) {
              const entry: AuditEntry = {
                timestamp: new Date().toISOString(),
                relayId: wsClient.id,
                requestId: request.id,
                resource: resourceId,
                operation,
                result: 'denied',
                policyChecks: { reason: policy.reason },
              };
              auditLogger.log(entry);
              wsClient.send(createErrorResponse(request.id, -32600, `Policy denied: ${policy.reason}`));
              return;
            }

            // Driver validation
            const driver = drivers.get(resourceId);
            if (!driver) {
              wsClient.send(createErrorResponse(request.id, -32602, `Unknown resource: ${resourceId}`));
              return;
            }

            const validation = driver.validate(command);
            if (!validation.valid) {
              const entry: AuditEntry = {
                timestamp: new Date().toISOString(),
                relayId: wsClient.id,
                requestId: request.id,
                resource: resourceId,
                operation,
                result: 'denied',
                policyChecks: { reason: validation.reason },
              };
              auditLogger.log(entry);
              wsClient.send(createErrorResponse(request.id, -32602, `Validation failed: ${validation.reason}`));
              return;
            }

            // Execute
            const result = await driver.execute(command);

            // Mask
            const { masked, maskedFieldCount } = maskingEngine.mask(result.rows);

            const response = {
              rows: masked,
              rowCount: result.rowCount,
              fields: result.fields,
              executionTimeMs: result.executionTimeMs,
              masked: maskedFieldCount > 0,
              maskedFieldCount,
            };

            // Audit
            const entry: AuditEntry = {
              timestamp: new Date().toISOString(),
              relayId: wsClient.id,
              requestId: request.id,
              resource: resourceId,
              operation,
              result: 'success',
              rowCount: result.rowCount,
              maskedFieldCount,
              executionTimeMs: result.executionTimeMs,
            };
            auditLogger.log(entry);

            wsClient.send(createResponse(request.id, response));
            break;
          }

          case 'health_check': {
            const statuses = await healthReporter.checkAll();
            wsClient.send(createResponse(request.id, statuses));
            break;
          }

          default:
            wsClient.send(createErrorResponse(request.id, -32601, `Unknown method: ${request.method}`));
        }
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : 'Internal error';
        const rpcRequest = request as RpcRequest;
        const res = ((rpcRequest.params as Record<string, unknown>)?.['resourceId'] as string) ?? 'unknown';
        const op = ((rpcRequest.params as Record<string, unknown>)?.['operation'] as string) ?? 'unknown';
        const errorEntry: AuditEntry = {
          timestamp: new Date().toISOString(),
          relayId: wsClient.id,
          requestId: request.id,
          resource: res,
          operation: op,
          result: 'error',
          errorMessage: errMessage,
        };
        auditLogger.log(errorEntry);
        logger.error({ err, requestId: request.id }, 'Request handler error');
        wsClient.send(createErrorResponse(request.id, -32603, errMessage));
      }
    },
  });

  wsClient.connect();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    wsClient.close();
    for (const driver of drivers.values()) {
      await driver.close().catch(() => {});
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start relay');
  process.exit(1);
});
