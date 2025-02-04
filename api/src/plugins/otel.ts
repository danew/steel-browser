import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import FastifyOtelInstrumentation from '@fastify/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

export interface OtelPluginOptions {
  serverName?: string;
  otlpUrl?: string;
}

const otelPlugin: FastifyPluginAsync<OtelPluginOptions> = async (fastify, opts) => {
  const {
    serverName = 'fastify-ts-app',
    otlpUrl = 'http://localhost:4318/v1/traces'
  } = opts;

  const exporter = new OTLPTraceExporter({ url: otlpUrl });
  const provider = new NodeTracerProvider({
    spanProcessors: [new BatchSpanProcessor(exporter)]
  });
  provider.register();

  const fastifyOtelInstrumentation = new FastifyOtelInstrumentation({ servername: serverName });
  fastifyOtelInstrumentation.setTracerProvider(provider);

  await fastify.register(fastifyOtelInstrumentation.plugin());
};

export default fp(otelPlugin, { name: 'otel-plugin' });