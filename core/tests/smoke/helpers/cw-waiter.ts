/**
 * CloudWatch waiter stub for the open-source local runtime (AC-050).
 *
 * In the AWS runtime, this module waited for CloudWatch Logs events to appear.
 * In the OSS runtime, no CloudWatch endpoint exists — the smoke tests use
 * stub agents so log/metric data is not required.
 *
 * This module is kept as a minimal no-op stub so existing smoke tests compile
 * without modification. No AWS SDK is imported.
 */

export async function waitForLogEvents(
  _logGroupName: string,
  _filterPattern?: string,
  _timeoutMs?: number,
): Promise<string[]> {
  // In OSS runtime, log events come from the stub agent, not from CloudWatch.
  // Return an empty array — the caller should check stub agent state instead.
  return [];
}
