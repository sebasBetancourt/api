import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { meController as c } from "../controllers/me.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  changePasswordBody, deleteAccountBody, preferencesBody, updateMeBody,
} from "../schemas/user.schema.js";

export async function meRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["me"];
  const auth = { preValidation: authMiddleware };

  r.get("/", { ...auth, schema: { tags } }, c.get as never);
  r.patch("/", { ...auth, schema: { body: updateMeBody, tags } }, c.update as never);
  r.patch("/preferences", { ...auth, schema: { body: preferencesBody, tags } }, c.preferences as never);
  r.patch("/password", { ...auth, schema: { body: changePasswordBody, tags } }, c.password as never);
  r.get("/export", { ...auth, schema: { tags } }, c.export as never);
  r.delete("/", { ...auth, schema: { body: deleteAccountBody, tags } }, c.delete as never);
}
