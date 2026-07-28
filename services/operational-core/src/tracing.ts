// OpenTelemetry bootstrap — must be imported before any other module (see
// main.ts's first import) so auto-instrumentation can patch HTTP/Express/
// Prisma before they're required elsewhere. Real spans are generated for
// real; there is no live Jaeger/Tempo/Grafana collector in this environment
// to send them to, so the exporter honestly defaults to console output
// unless OTEL_EXPORTER_OTLP_ENDPOINT is set, in which case it exports via
// real OTLP/HTTP to whatever collector that URL points at. See
// docs/architecture/production-observability.md.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

const sdk = new NodeSDK({
  serviceName: 'aios-operational-core',
  traceExporter: otlpEndpoint ? new OTLPTraceExporter({ url: otlpEndpoint }) : new ConsoleSpanExporter(),
  instrumentations: [getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } })],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});

export { sdk };
