import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';

interface CloudWatchLogsClient {
  send(cmd: unknown): Promise<unknown>;
}

export interface CloudWatchDriverConfig {
  region: string;
  maxRows?: number;
  timeoutMs?: number;
}

export class CloudWatchLogsDriver implements IReadOnlyDriver {
  readonly type = 'cloudwatch' as const;
  private clientPromise: Promise<{ client: CloudWatchLogsClient; ctors: Record<string, unknown> }>;
  private maxRows: number;

  constructor(config: CloudWatchDriverConfig) {
    this.maxRows = config.maxRows ?? 1000;
    this.clientPromise = (async () => {
      const mod = await import('@aws-sdk/client-cloudwatch-logs' as string).catch(() => {
        throw new Error('Install @aws-sdk/client-cloudwatch-logs to use CloudWatch Logs driver');
      });
      const typed = mod as unknown as Record<string, unknown>;
      const Client = typed['CloudWatchLogsClient'] as new (opts: { region: string }) => CloudWatchLogsClient;
      const client = new Client({ region: config.region });
      return { client, ctors: typed };
    })();
  }

  validate(command: DriverCommand): DriverValidation {
    if (command.operation === 'query') {
      const q = command.params['query'];
      if (typeof q !== 'string') return { valid: false, reason: 'Missing query (CloudWatch Logs Insights)' };
      const lg = command.params['logGroup'];
      if (typeof lg !== 'string') return { valid: false, reason: 'Missing logGroup' };
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();
    const { client, ctors } = await this.clientPromise;

    switch (command.operation) {
      case 'list_tables': {
        const Cmd = ctors['DescribeLogGroupsCommand'] as new (input: Record<string, unknown>) => unknown;
        const response = (await client.send(new Cmd({ limit: this.maxRows }))) as { logGroups?: unknown[] };
        const rows = (response.logGroups ?? []) as Record<string, unknown>[];
        return { rows, rowCount: rows.length, executionTimeMs: Date.now() - start };
      }
      case 'query': {
        const StartCmd = ctors['StartQueryCommand'] as new (input: Record<string, unknown>) => unknown;
        const GetCmd = ctors['GetQueryResultsCommand'] as new (input: Record<string, unknown>) => unknown;
        const start_time = Number(command.params['startTime'] ?? Math.floor(Date.now() / 1000) - 3600);
        const end_time = Number(command.params['endTime'] ?? Math.floor(Date.now() / 1000));
        const startResp = (await client.send(new StartCmd({
          logGroupName: command.params['logGroup'],
          queryString: command.params['query'],
          startTime: start_time,
          endTime: end_time,
          limit: this.maxRows,
        }))) as { queryId?: string };
        const queryId = startResp.queryId;
        if (!queryId) throw new Error('CloudWatch Logs: failed to start query');

        const deadline = Date.now() + (Number(command.params['timeoutMs'] ?? 30_000));
        let result: { status?: string; results?: unknown[] } = {};
        while (Date.now() < deadline) {
          result = (await client.send(new GetCmd({ queryId }))) as { status?: string; results?: unknown[] };
          if (result.status === 'Complete' || result.status === 'Failed' || result.status === 'Cancelled') break;
          await new Promise((r) => setTimeout(r, 500));
        }
        const rows = (result.results ?? []) as Record<string, unknown>[];
        return { rows, rowCount: rows.length, executionTimeMs: Date.now() - start };
      }
      default:
        throw new Error(`Unknown operation: ${command.operation}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.clientPromise;
      return true;
    } catch {
      return false;
    }
  }

  capabilities(): string[] {
    return ['query', 'list_tables'];
  }

  async close(): Promise<void> { /* no persistent resources */ }
}

export const cloudwatchDriverFactory: DriverFactory = {
  type: 'cloudwatch',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    return new CloudWatchLogsDriver({
      region: secrets['region'] ?? resource.connection['region'] ?? 'us-east-1',
      maxRows: resource.maxRowsPerQuery,
      timeoutMs: resource.statementTimeoutMs,
    });
  },
};
