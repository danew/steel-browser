import { FastifyReply } from "fastify";
import { CDPService } from "../../services/cdp.service";
import { SessionService } from "../../services/session.service";
import { getPage } from "../actions/actions.controller";
import { EvaluateRequest } from "./evaluate.schema";
import { runScript } from "./runtime/puppeteer-runtime";

export const handleEvaluate = async (sessionService: SessionService, browserService: CDPService, request: EvaluateRequest, reply: FastifyReply) => {
  const { code, stream } = request.body;

  if (!code) {
    return reply.code(400).send({ error: "Script is required" });
  }

  const { page, close } = await getPage({}, 0, sessionService, browserService);

  if (stream) {
    reply.header("Content-Type", "text/event-stream");
    reply.header("Cache-Control", "no-cache");
    reply.header("Connection", "keep-alive");

    const sendEvent = (data: any) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { result, logs, error } = await runScript(page, close, code);

      logs.forEach((log) => sendEvent({ log }));

      if (error) {
        sendEvent({ error });
      } else {
        sendEvent({ result });
      }
    } catch (e: unknown) {
      sendEvent({ error: "Evaluation failed" });
    } finally {
      reply.raw.write("event: close\n\n");
      reply.raw.end();
    }
  } else {
    try {
      const { result, logs, error } = await runScript(page, close, code);
      if (error) {
        return reply.code(500).send({ error, logs });
      }
      return reply.send({ result, logs });
    } catch (e: unknown) {
      return reply.code(500).send({ message: "Evaluation failed", error: e });
    }
  }
};
