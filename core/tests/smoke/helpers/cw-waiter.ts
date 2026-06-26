import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

const CUSTOMER_ENDPOINT = process.env['CLOUD_PROVIDER_ENDPOINT'] ?? 'http://localhost:4567';
const REGION = process.env['AWS_REGION'] ?? 'us-east-1';

function getLogsClient(): CloudWatchLogsClient {
  return new CloudWatchLogsClient({
    region: REGION,
    endpoint: CUSTOMER_ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
}

/**
 * Polls CloudWatch Logs until at least one entry matching filterPattern appears.
 * Returns the matching log messages.
 */
export async function waitForCWLog(
  logGroup: string,
  filterPattern: string,
  timeoutMs = 60_000,
): Promise<string[]> {
  const client = getLogsClient();
  const startTime = Date.now();
  const lookbackMs = 300_000; // look 5 minutes back

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await client.send(new FilterLogEventsCommand({
        logGroupName: logGroup,
        filterPattern,
        startTime: Date.now() - lookbackMs,
        limit: 50,
      }));

      const events = result.events ?? [];
      if (events.length > 0) {
        return events.map((e) => e.message ?? '');
      }
    } catch {
      // log group may not exist yet
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`No CW logs matching "${filterPattern}" in ${logGroup} after ${timeoutMs}ms`);
}

/**
 * Checks if CloudWatch logs contain any entry matching the filter (non-blocking).
 */
export async function hasCWLog(
  logGroup: string,
  filterPattern: string,
): Promise<boolean> {
  const client = getLogsClient();
  try {
    const result = await client.send(new FilterLogEventsCommand({
      logGroupName: logGroup,
      filterPattern,
      startTime: Date.now() - 300_000,
      limit: 1,
    }));
    return (result.events?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
