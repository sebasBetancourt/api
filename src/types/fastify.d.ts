import "@fastify/jwt";
import "fastify";
import type { AuthTokenPayload } from "../interfaces/auth.interface.js";
import type { ResetLinkSender } from "../libs/resetLinkSender.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    resetLinkSender: ResetLinkSender;
  }
}
