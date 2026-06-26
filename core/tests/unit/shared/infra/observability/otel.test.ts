import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// The otel.ts module calls sdk.start() on import. Mock NodeSDK to prevent
// real OTel initialization during unit tests.
// ---------------------------------------------------------------------------
const mockSdkStart = vi.fn();
const mockSdkShutdown = vi.fn(() => Promise.resolve());

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: mockSdkStart,
    shutdown: mockSdkShutdown,
  })),
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn(() => []),
}));

vi.mock('@opentelemetry/id-generator-aws-xray', () => ({
  AWSXRayIdGenerator: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/propagator-aws-xray', () => ({
  AWSXRayPropagator: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(() => ({})),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  // Re-register mocks after resetModules
  vi.mock('@opentelemetry/sdk-node', () => ({
    NodeSDK: vi.fn().mockImplementation(() => ({
      start: mockSdkStart,
      shutdown: mockSdkShutdown,
    })),
  }));
  vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
    getNodeAutoInstrumentations: vi.fn(() => []),
  }));
  vi.mock('@opentelemetry/id-generator-aws-xray', () => ({
    AWSXRayIdGenerator: vi.fn().mockImplementation(() => ({})),
  }));
  vi.mock('@opentelemetry/propagator-aws-xray', () => ({
    AWSXRayPropagator: vi.fn().mockImplementation(() => ({})),
  }));
  vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => ({
    OTLPTraceExporter: vi.fn().mockImplementation(() => ({})),
  }));
});

describe('otel module', () => {
  it('exports sdk and shutdownOtel', async () => {
    const mod = await import('@shared/infra/observability/otel.js');
    expect(mod.sdk).toBeDefined();
    expect(typeof mod.shutdownOtel).toBe('function');
  });

  it('calls sdk.start() on import', async () => {
    await import('@shared/infra/observability/otel.js');
    expect(mockSdkStart).toHaveBeenCalledOnce();
  });

  it('shutdownOtel resolves even when sdk.shutdown() resolves immediately', async () => {
    const { shutdownOtel } = await import('@shared/infra/observability/otel.js');
    await expect(shutdownOtel(1000)).resolves.toBeUndefined();
  });

  it('shutdownOtel resolves within timeout when sdk.shutdown() hangs', async () => {
    mockSdkShutdown.mockImplementationOnce(
      () => new Promise<void>((resolve) => setTimeout(resolve, 10000)),
    );
    const { shutdownOtel } = await import('@shared/infra/observability/otel.js');
    const start = Date.now();
    await shutdownOtel(100);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('shutdownOtel swallows sdk.shutdown() rejection', async () => {
    mockSdkShutdown.mockRejectedValueOnce(new Error('sdk error'));
    const { shutdownOtel } = await import('@shared/infra/observability/otel.js');
    await expect(shutdownOtel(1000)).resolves.toBeUndefined();
  });
});
