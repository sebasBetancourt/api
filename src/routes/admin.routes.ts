import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { adminController as c } from "../controllers/admin.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { checkUserPermission } from "../middlewares/checkUserPermission.js";
import { idParams } from "../schemas/category.schema.js";
import {
  adminTitlesQuery, listUsersQuery, setRoleBody, setStatusBody,
} from "../schemas/user.schema.js";

export async function adminRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["admin"];
  const admin = { preValidation: [authMiddleware, checkUserPermission("admin")] };

  r.get("/metrics", { ...admin, schema: { tags } }, c.metrics as never);
  r.get("/titles", { ...admin, schema: { querystring: adminTitlesQuery, tags } }, c.titles as never);
  r.get("/users", { ...admin, schema: { querystring: listUsersQuery, tags } }, c.users as never);
  r.patch("/users/:id/role", { ...admin, schema: { params: idParams, body: setRoleBody, tags } }, c.setRole as never);
  r.patch("/users/:id/status", { ...admin, schema: { params: idParams, body: setStatusBody, tags } }, c.setStatus as never);
  r.delete("/users/:id", { ...admin, schema: { params: idParams, tags } }, c.deleteUser as never);
}
