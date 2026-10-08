import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../libs/appError.js";

/**
 * Límite por usuario autenticado (no solo por IP): frena la fuerza bruta de la contraseña actual
 * aunque el atacante cambie de IP. Va en `preHandler`, cuando `req.user` ya existe.
 */
export function userRateLimit(app: FastifyInstance, name: string, max: number, timeWindow = "15 minutes") {
  const limiter = app.createRateLimit({ max, timeWindow, keyGenerator: (req) => `${name}:${req.user?.id ?? req.ip}` });
  return async (req: FastifyRequest) => {
    const res = await limiter(req);
    if (!res.isAllowed && res.isExceeded) {
      throw new AppError(429, "Demasiados intentos. Inténtalo de nuevo más tarde.");
    }
  };
}
