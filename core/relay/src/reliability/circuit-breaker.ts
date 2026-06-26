import { ConsecutiveBreaker, handleAll, circuitBreaker, type IPolicy } from 'cockatiel';

export function makeCircuitBreaker(thresholdFailures = 5, durationMs = 30_000): IPolicy {
  return circuitBreaker(handleAll, {
    halfOpenAfter: durationMs,
    breaker: new ConsecutiveBreaker(thresholdFailures),
  });
}
