import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { titlesController as c } from "../controllers/titles.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { checkUserPermission } from "../middlewares/checkUserPermission.js";
import { idParams } from "../schemas/category.schema.js";
import {
  collectionQuery, createTitleBody, listTitlesQuery, setEmbedBody, updateTitleBody,
} from "../schemas/title.schema.js";

export async function titlesRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["titles"];
  const admin = [authMiddleware, checkUserPermission("admin")];

  r.post("/create", { preValidation: authMiddleware, schema: { body: createTitleBody, tags } }, c.create as never);
  r.get("/list", { schema: { querystring: listTitlesQuery, tags } }, c.list as never);
  r.get("/list/collection", { preValidation: authMiddleware, schema: { querystring: collectionQuery, tags } }, c.collection as never);
  r.get("/:id", { schema: { params: idParams, tags } }, c.getById as never);
  r.patch("/:id", { preValidation: admin, schema: { params: idParams, body: updateTitleBody, tags } }, c.update as never);
  r.patch("/:id/approve", { preValidation: admin, schema: { params: idParams, tags } }, c.approve as never);
  r.patch("/:id/reject", { preValidation: admin, schema: { params: idParams, tags } }, c.reject as never);
  r.put("/:id/embed", { preValidation: admin, schema: { params: idParams, body: setEmbedBody, tags } }, c.setEmbed as never);
  r.delete("/:id", { preValidation: admin, schema: { params: idParams, tags } }, c.delete as never);
}
