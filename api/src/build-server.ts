import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import fastify, { FastifyServerOptions } from "fastify";
import browserInstancePlugin from "./plugins/browser";
import browserSessionPlugin from "./plugins/browser-session";
import browserWebSocket from "./plugins/browser-socket";
import customBodyParser from "./plugins/custom-body-parser";
import otelPlugin from "./plugins/otel";
import requestLogger from "./plugins/request-logger";
import openAPIPlugin from "./plugins/schemas";
import seleniumPlugin from "./plugins/selenium";
import { actionsRoutes, cdpRoutes, seleniumRoutes, sessionsRoutes } from "./routes";

export default async function buildFastifyServer(options?: FastifyServerOptions) {
  const server = fastify(options);

  // Plugins
  await server.register(otelPlugin, {
    serverName: 'fastify-ts-app',
    otlpUrl: 'http://localhost:4318/v1/traces'
  });
  server.register(requestLogger);
  server.register(fastifySensible);
  server.register(fastifyCors, { origin: true });
  server.register(openAPIPlugin);
  server.register(browserInstancePlugin);
  server.register(seleniumPlugin);
  server.register(browserWebSocket);
  server.register(customBodyParser);
  server.register(browserSessionPlugin);

  // Routes
  server.register(actionsRoutes, { prefix: "/v1" });
  server.register(sessionsRoutes, { prefix: "/v1" });
  server.register(cdpRoutes, { prefix: "/v1" });
  server.register(seleniumRoutes);

  return server;
}
