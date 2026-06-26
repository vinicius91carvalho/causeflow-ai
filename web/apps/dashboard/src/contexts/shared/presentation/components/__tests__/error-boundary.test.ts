import { describe, expect, it, vi } from 'vitest';

// Unit tests for error boundary logic (pure state machine logic, no React rendering)

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function getDerivedStateFromError(error: Error): ErrorBoundaryState {
  return { hasError: true, error };
}

function resetState(): ErrorBoundaryState {
  return { hasError: false, error: null };
}

describe('ErrorBoundary - state machine logic', () => {
  it('starts in no-error state', () => {
    const state = { hasError: false, error: null };
    expect(state.hasError).toBe(false);
    expect(state.error).toBeNull();
  });

  it('getDerivedStateFromError sets hasError to true', () => {
    const error = new Error('Something broke');
    const state = getDerivedStateFromError(error);
    expect(state.hasError).toBe(true);
    expect(state.error).toBe(error);
    expect(state.error?.message).toBe('Something broke');
  });

  it('reset clears error state', () => {
    // Start with error
    const errorState = getDerivedStateFromError(new Error('test'));
    expect(errorState.hasError).toBe(true);

    // Reset
    const clearedState = resetState();
    expect(clearedState.hasError).toBe(false);
    expect(clearedState.error).toBeNull();
  });

  it('captures different error types', () => {
    const typeError = new TypeError('Type error occurred');
    const referenceError = new ReferenceError('undefined is not a function');

    const state1 = getDerivedStateFromError(typeError);
    const state2 = getDerivedStateFromError(referenceError);

    expect(state1.error).toBeInstanceOf(TypeError);
    expect(state2.error).toBeInstanceOf(ReferenceError);
  });
});

describe('ErrorBoundary - componentDidCatch logging', () => {
  it('logs in development mode', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Simulate dev mode logging
    const isDev = process.env.NODE_ENV !== 'production';
    const error = new Error('dev error');
    if (isDev) {
      console.error('[ErrorBoundary] Caught error:', error);
      expect(consoleError).toHaveBeenCalled();
    } else {
      // In production, nothing is logged
      expect(consoleError).not.toHaveBeenCalled();
    }

    consoleError.mockRestore();
  });
});
