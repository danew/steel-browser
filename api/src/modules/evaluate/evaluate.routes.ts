import { FastifyInstance, FastifyReply } from "fastify";
import { handleEvaluate } from "./evaluate.controller";
import { $ref } from "../../plugins/schemas";
import { EvaluateRequest } from "./evaluate.schema";

async function routes(server: FastifyInstance) {
  server.post(
    "/evaluate",
    {
      schema: {
        operationId: "evaluate",
        description: "Evaluate JavaScript code in a Puppeteer runtime.",
        tags: ["Node Runtime"],
        summary: "Evaluate JavaScript code with Puppeteer.",
        body: $ref("EvaluateRequest"),
        response: {
          200: $ref("EvaluateResponse"),
        },
      },
    },
    async (request: EvaluateRequest, reply: FastifyReply) => handleEvaluate(server.sessionService, server.cdpService, request, reply),
  );
}

export default routes;
