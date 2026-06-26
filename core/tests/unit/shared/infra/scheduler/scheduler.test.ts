import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { InProcessScheduler } from '../../../../../src/shared/infra/scheduler/scheduler.js';
import type { ScheduledJob } from '../../../../../src/shared/infra/scheduler/scheduler.js';

describe('InProcessScheduler', () => {
  let scheduler: InProcessScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new InProcessScheduler();
  });

  afterEach(async () => {
    await scheduler.stop();
    vi.useRealTimers();
  });

  it('should execute jobs at the specified interval', async () => {
    const executeFn = vi.fn().mockResolvedValue(undefined);
    const job: ScheduledJob = { name: 'test-job', intervalMs: 1000, execute: executeFn };

    scheduler.start([job]);

    // Job has not run yet (first run is after interval)
    expect(executeFn).not.toHaveBeenCalled();

    // Advance 1 second
    await vi.advanceTimersByTimeAsync(1000);
    expect(executeFn).toHaveBeenCalledTimes(1);

    // Advance another second
    await vi.advanceTimersByTimeAsync(1000);
    expect(executeFn).toHaveBeenCalledTimes(2);
  });

  it('should not start twice if already running', () => {
    const executeFn = vi.fn().mockResolvedValue(undefined);
    const job: ScheduledJob = { name: 'test-job', intervalMs: 1000, execute: executeFn };

    scheduler.start([job]);
    scheduler.start([job]); // Should be ignored

    // Only one interval should be set
    vi.advanceTimersByTime(1000);
    // If double started, we'd see 2 calls instead of 1
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it('should stop all timers on stop()', async () => {
    const executeFn = vi.fn().mockResolvedValue(undefined);
    const job: ScheduledJob = { name: 'test-job', intervalMs: 1000, execute: executeFn };

    scheduler.start([job]);
    await scheduler.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(executeFn).not.toHaveBeenCalled();
  });

  it('should handle job execution errors gracefully', async () => {
    const executeFn = vi.fn().mockRejectedValue(new Error('Job failed'));
    const job: ScheduledJob = { name: 'failing-job', intervalMs: 1000, execute: executeFn };

    scheduler.start([job]);

    // Should not throw
    await vi.advanceTimersByTimeAsync(1000);
    expect(executeFn).toHaveBeenCalledTimes(1);

    // Should still run next iteration
    await vi.advanceTimersByTimeAsync(1000);
    expect(executeFn).toHaveBeenCalledTimes(2);
  });

  it('should schedule multiple jobs independently', async () => {
    const execute1 = vi.fn().mockResolvedValue(undefined);
    const execute2 = vi.fn().mockResolvedValue(undefined);

    scheduler.start([
      { name: 'job-1', intervalMs: 1000, execute: execute1 },
      { name: 'job-2', intervalMs: 2000, execute: execute2 },
    ]);

    await vi.advanceTimersByTimeAsync(2000);

    expect(execute1).toHaveBeenCalledTimes(2); // 1000, 2000
    expect(execute2).toHaveBeenCalledTimes(1); // 2000
  });

  it('should allow restarting after stop', async () => {
    const executeFn = vi.fn().mockResolvedValue(undefined);
    const job: ScheduledJob = { name: 'test-job', intervalMs: 1000, execute: executeFn };

    scheduler.start([job]);
    await scheduler.stop();

    // Restart
    scheduler.start([job]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(executeFn).toHaveBeenCalledTimes(1);
  });
});
