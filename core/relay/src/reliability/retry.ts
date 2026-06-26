export interface RetryOptions {
  attempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitterRatio?: number;
  onAttempt?: (attempt: number, err: unknown) => void;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let delay = opts.initialDelayMs;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (opts.onAttempt) opts.onAttempt(attempt, err);
      if (attempt === opts.attempts) break;
      const jitter = delay * (opts.jitterRatio ?? 0.2) * Math.random();
      await new Promise((r) => setTimeout(r, Math.floor(delay + jitter)));
      delay = Math.min(opts.maxDelayMs, delay * opts.factor);
    }
  }
  throw lastErr;
}
