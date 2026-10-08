import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { meController as c } from "../controllers/me.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.js";
import {
  avatarUrlBody, changePasswordBody, deleteAccountBody, preferencesBody, updateMeBody,
} from "../schemas/user.schema.js";

export async function meRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["me"];
  const auth = { preValidation: authMiddleware };

  r.get("/", { ...auth, schema: { tags } }, c.get as never);
  r.patch("/", { ...auth, schema: { body: updateMeBody, tags } }, c.update as never);
  r.patch("/preferences", { ...auth, schema: { body: preferencesBody, tags } }, c.preferences as never);
  r.patch("/password", {
    ...auth, preHandler: userRateLimit(app, "me-password", 5), schema: { body: changePasswordBody, tags },
  }, c.password as never);

  const avatarLimit = userRateLimit(app, "me-avatar", 20);
  r.put("/avatar", { ...auth, preHandler: avatarLimit, schema: { tags, consumes: ["multipart/form-data"] } }, c.setAvatar as never);
  r.put("/avatar/url", { ...auth, preHandler: avatarLimit, schema: { body: avatarUrlBody, tags } }, c.setAvatarUrl as never);
  r.delete("/avatar", { ...auth, preHandler: avatarLimit, schema: { tags } }, c.removeAvatar as never);
  r.get("/export", { ...auth, schema: { tags } }, c.export as never);
  r.delete("/", {
    ...auth, preHandler: userRateLimit(app, "me-delete", 3), schema: { body: deleteAccountBody, tags },
  }, c.delete as never);
}
