import "@fastify/jwt";
import type { AuthTokenPayload } from "../interfaces/auth.interface.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}
