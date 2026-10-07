import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { AppError } from "../libs/appError.js";

export function errorHandler(err: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof AppError) return reply.code(err.statusCode).send({ message: err.message });
  if (hasZodFastifySchemaValidationErrors(err)) {
    return reply.code(400).send({ message: "Datos inválidos", issues: err.validation });
  }
  if (err.statusCode && err.statusCode < 500) {
    return reply.code(err.statusCode).send({ message: err.message });
  }
  req.log.error(err);
  return reply.code(500).send({ message: "Error en el servidor" });
}
