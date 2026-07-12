import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

/**
 * OpenTelemetry is enabled by default. In the open-source local runtime
 * (AC-039) the environment is clean — no OTEL_EXPORTER_OTLP_ENDPOINT — so the
 * SDK is NOT started and no outbound trace export (not even to localhost:4318)
 * happens at boot. An operator can opt back in by setting
 * OTEL_EXPORTER_OTLP_ENDPOINT explicitly.
 */
const OTEL_ENABLED = !(
  process.env['CAUSEFLOW_RUNTIME'] === 'oss' && !process.env['OTEL_EXPORTER_OTLP_ENDPOINT']
);

export let sdk: NodeSDK | undefined;
if (OTEL_ENABLED) {
  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(), // reads OTEL_EXPORTER_OTLP_* from env
    idGenerator: new AWSXRayIdGenerator(),
    textMapPropagator: new AWSXRayPropagator(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => {
            const url = req.url ?? '';
            return (
              url === '/healthz' ||
              url === '/auth' ||
              url.startsWith('/auth/') ||
              url === '/oauth' ||
              url.startsWith('/oauth/') ||
              url === '/webhooks/clerk'
            );
          },
          requestHook: (_span, _req) => {
            // Do NOT copy any HTTP headers to spans — avoid leaking sensitive data.
          },
        },
      }),
    ],
  });
  sdk.start();
}

export async function shutdownOtel(timeoutMs = 5000): Promise<void> {
  if (!sdk) return;
  try {
    await Promise.race([
      sdk.shutdown(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // swallow — we are already shutting down
  }
}
