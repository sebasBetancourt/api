import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { authController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { loginBody, registerBody } from "../schemas/auth.schema.js";

export async function authRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.post("/register", { schema: { body: registerBody, tags: ["auth"] } }, authController.register as never);
  r.post("/login", { schema: { body: loginBody, tags: ["auth"] } }, authController.login as never);
  r.get("/verify", { preValidation: authMiddleware, schema: { tags: ["auth"] } }, authController.verify);
}
