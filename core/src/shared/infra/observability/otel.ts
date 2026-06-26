import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

const exporter = new OTLPTraceExporter(); // reads OTEL_EXPORTER_OTLP_* from env

export const sdk = new NodeSDK({
  traceExporter: exporter,
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

export async function shutdownOtel(timeoutMs = 5000): Promise<void> {
  try {
    await Promise.race([
      sdk.shutdown(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // swallow — we are already shutting down
  }
}
