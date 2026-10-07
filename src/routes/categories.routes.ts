import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { categoriesController as c } from "../controllers/categories.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { checkUserPermission } from "../middlewares/checkUserPermission.js";
import { createCategoryBody, idParams, nameParams, pageQuery } from "../schemas/category.schema.js";

export async function categoriesRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["categories"];
  const admin = [authMiddleware, checkUserPermission("admin")];

  r.post("/create", { preValidation: admin, schema: { body: createCategoryBody, tags } }, c.create as never);
  r.get("/list", { schema: { querystring: pageQuery, tags } }, c.list as never);
  r.get("/name/:name", { schema: { params: nameParams, tags } }, c.getByName as never);
  r.get("/:id", { schema: { params: idParams, tags } }, c.getById as never);
  r.patch("/:id", { preValidation: admin, schema: { params: idParams, body: createCategoryBody, tags } }, c.rename as never);
  r.delete("/:id", { preValidation: admin, schema: { params: idParams, tags } }, c.delete as never);
}
