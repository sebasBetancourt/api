import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { authController } from "../controllers/auth.controller.js";
import { AppError } from "../libs/appError.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  forgotPasswordBody,
  loginBody,
  registerBody,
  resetPasswordBody,
  validateResetBody,
  type ForgotPasswordInput,
} from "../schemas/auth.schema.js";

const RESET_WINDOW = "15 minutes";
const TOO_MANY_REQUESTS = "Demasiadas solicitudes. Inténtalo de nuevo más tarde.";
const perIpLimit = (max: number) => ({
  rateLimit: {
    max,
    timeWindow: RESET_WINDOW,
    errorResponseBuilder: () => ({ statusCode: 429, error: "Too Many Requests", message: TOO_MANY_REQUESTS }),
  },
});

export async function authRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.post("/register", { schema: { body: registerBody, tags: ["auth"] } }, authController.register as never);
  r.post("/login", { schema: { body: loginBody, tags: ["auth"] } }, authController.login as never);
  r.get("/verify", { preValidation: authMiddleware, schema: { tags: ["auth"] } }, authController.verify);

  // Además del límite por IP, uno por correo (ya validado y normalizado) frena el bombardeo
  // a un mismo buzón desde varias IP. `createRateLimit` porque el plugin aplica un solo hook por petición.
  const perEmailLimit = app.createRateLimit({
    max: 5,
    timeWindow: RESET_WINDOW,
    keyGenerator: (req) => `forgot:${(req.body as ForgotPasswordInput).email}`,
  });
  const limitPerEmail = async (req: FastifyRequest) => {
    const res = await perEmailLimit(req);
    if (!res.isAllowed && res.isExceeded) throw new AppError(429, TOO_MANY_REQUESTS);
  };

  r.post("/forgot-password", {
    config: perIpLimit(5),
    preHandler: limitPerEmail,
    schema: { body: forgotPasswordBody, tags: ["auth"] },
  }, authController.forgotPassword as never);
  r.post("/reset-password/validate", {
    config: perIpLimit(10),
    schema: { body: validateResetBody, tags: ["auth"] },
  }, authController.validateResetToken as never);
  r.post("/reset-password", {
    config: perIpLimit(10),
    schema: { body: resetPasswordBody, tags: ["auth"] },
  }, authController.resetPassword as never);
}
