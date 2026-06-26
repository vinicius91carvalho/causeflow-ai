import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

export interface ScenarioContext {
  tenantId: string;
  serviceName: string;
  timestamp: Date;
}

const CUSTOMER_ENDPOINT = process.env['CLOUD_PROVIDER_ENDPOINT'] ?? 'http://localhost:4567';
const REGION = process.env['AWS_REGION'] ?? 'us-east-1';

function getLogsClient(): CloudWatchLogsClient {
  return new CloudWatchLogsClient({
    region: REGION,
    endpoint: CUSTOMER_ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
}

function getCWClient(): CloudWatchClient {
  return new CloudWatchClient({
    region: REGION,
    endpoint: CUSTOMER_ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
}

export async function injectOOMScenario(ctx: ScenarioContext): Promise<void> {
  const logsClient = getLogsClient();
  const cwClient = getCWClient();
  const { serviceName, timestamp } = ctx;
  const logGroupName = `/ecs/${serviceName}`;

  // Inject log entries simulating OOM kill
  const logEvents = [
    { timestamp: timestamp.getTime() - 300000, message: `[INFO] ${serviceName}: Memory usage at 60% - normal operations` },
    { timestamp: timestamp.getTime() - 240000, message: `[WARN] ${serviceName}: Memory usage at 75% - approaching threshold` },
    { timestamp: timestamp.getTime() - 180000, message: `[WARN] ${serviceName}: GC pause time exceeded 2s - heap pressure detected` },
    { timestamp: timestamp.getTime() - 120000, message: `[ERROR] ${serviceName}: Memory usage at 90% - critical threshold exceeded` },
    { timestamp: timestamp.getTime() - 60000, message: `[ERROR] ${serviceName}: GC pause time exceeded 5s - severe heap pressure` },
    { timestamp: timestamp.getTime() - 30000, message: `[FATAL] ${serviceName}: OOMKilled - container killed by kernel OOM killer. Exit code 137` },
    { timestamp: timestamp.getTime(), message: `[INFO] ${serviceName}: Container restarting - ECS task manager initiated restart` },
  ];

  await logsClient.send(new PutLogEventsCommand({
    logGroupName,
    logStreamName: 'default',
    logEvents,
  }));

  // Inject CloudWatch metrics simulating memory spike
  const metricData = [];
  const baseTime = new Date(timestamp.getTime() - 1800000); // 30 min before
  for (let i = 0; i < 31; i++) {
    const t = new Date(baseTime.getTime() + i * 60000);
    let value: number;
    if (i < 15) value = 60 + Math.random() * 5; // Baseline ~60%
    else if (i < 25) value = 60 + (i - 15) * 3.5 + Math.random() * 2; // Ramp up
    else value = 90 + (i - 25) * 1 + Math.random() * 1; // Critical zone

    metricData.push({
      MetricName: 'MemoryUtilization',
      Namespace: 'AWS/ECS',
      Timestamp: t,
      Value: Math.min(value, 99),
      Unit: 'Percent' as const,
      Dimensions: [
        { Name: 'ServiceName', Value: serviceName },
        { Name: 'ClusterName', Value: 'production' },
      ],
    });
  }

  // PutMetricData accepts max 1000 items, we have 31
  await cwClient.send(new PutMetricDataCommand({ Namespace: 'AWS/ECS', MetricData: metricData }));
}

export async function injectLatencySpike(ctx: ScenarioContext): Promise<void> {
  const logsClient = getLogsClient();
  const cwClient = getCWClient();
  const { serviceName, timestamp } = ctx;
  const logGroupName = `/ecs/${serviceName}`;

  const logEvents = [
    { timestamp: timestamp.getTime() - 300000, message: `[WARN] ${serviceName}: Database connection timeout after 5000ms - retrying (attempt 1/3)` },
    { timestamp: timestamp.getTime() - 240000, message: `[ERROR] ${serviceName}: Database connection timeout after 5000ms - retrying (attempt 2/3)` },
    { timestamp: timestamp.getTime() - 180000, message: `[ERROR] ${serviceName}: Database connection timeout after 5000ms - all retries exhausted` },
    { timestamp: timestamp.getTime() - 120000, message: `[WARN] ${serviceName}: Circuit breaker OPEN for database pool - requests being rejected` },
    { timestamp: timestamp.getTime() - 60000, message: `[ERROR] ${serviceName}: HTTP 503 Service Unavailable returned to 47 requests in last 60s` },
    { timestamp: timestamp.getTime() - 30000, message: `[WARN] ${serviceName}: Circuit breaker HALF-OPEN - testing database connection` },
    { timestamp: timestamp.getTime(), message: `[INFO] ${serviceName}: Database connection restored - circuit breaker CLOSED. Recovery time: 5m` },
  ];

  await logsClient.send(new PutLogEventsCommand({
    logGroupName,
    logStreamName: 'default',
    logEvents,
  }));

  const metricData = [];
  const baseTime = new Date(timestamp.getTime() - 1800000);
  for (let i = 0; i < 31; i++) {
    const t = new Date(baseTime.getTime() + i * 60000);
    let value: number;
    if (i < 15) value = 120 + Math.random() * 30; // Baseline ~120ms
    else if (i < 25) value = 120 + (i - 15) * 108 + Math.random() * 50; // Spike to 1200ms
    else value = 1200 + Math.random() * 100; // Sustained high

    metricData.push({
      MetricName: 'RequestLatency',
      Namespace: 'Custom/App',
      Timestamp: t,
      Value: value,
      Unit: 'Milliseconds' as const,
      Dimensions: [
        { Name: 'ServiceName', Value: serviceName },
      ],
    });
  }

  await cwClient.send(new PutMetricDataCommand({ Namespace: 'Custom/App', MetricData: metricData }));
}

export async function injectCascadingFailure(
  ctx: ScenarioContext,
  services: string[] = ['api-gateway', 'payment-service', 'order-service'],
): Promise<void> {
  const baseTimestamp = ctx.timestamp;
  for (let i = 0; i < services.length; i++) {
    await injectLatencySpike({
      ...ctx,
      serviceName: services[i]!,
      timestamp: new Date(baseTimestamp.getTime() + i * 60000), // Cascade delay
    });
  }
}
