import { FastifyRequest } from "fastify";
import { z } from "zod";

const EvaluateRequestSchema = z.object({
  code: z.string().describe("The JavaScript/Node.js code to evaluate."),
  stream: z.boolean().optional().describe("Enable streaming response."),
});

const EvaluateResponseSchema = z.object({
  result: z.any().optional(),
  logs: z.array(z.string()).describe("Console logs captured during execution."),
  error: z.any().optional(),
});

export type EvaluateRequestBody = z.infer<typeof EvaluateRequestSchema>;
export type EvaluateRequest = FastifyRequest<{ Body: EvaluateRequestBody }>;

export const nodeRuntimeSchemas = {
  EvaluateRequest: EvaluateRequestSchema,
  EvaluateResponse: EvaluateResponseSchema,
};

export default nodeRuntimeSchemas;