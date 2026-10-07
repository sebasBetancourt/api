import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { reviewsController as c } from "../controllers/reviews.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { checkUserPermission } from "../middlewares/checkUserPermission.js";
import { idParams } from "../schemas/category.schema.js";
import {
  createReviewBody, exportReviewsQuery, listReviewsQuery, titleIdParams, updateReviewBody,
} from "../schemas/review.schema.js";

export async function reviewsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["reviews"];
  const auth = { preValidation: authMiddleware };

  r.post("/create", { ...auth, schema: { body: createReviewBody, tags } }, c.create as never);
  r.get("/list", { schema: { querystring: listReviewsQuery, tags } }, c.list as never);
  r.get("/ranking/:titleId", { schema: { params: titleIdParams, tags } }, c.ranking as never);
  r.get("/csv", {
    preValidation: [authMiddleware, checkUserPermission("admin")],
    schema: { querystring: exportReviewsQuery, tags },
  }, c.exportCsv as never);
  r.put("/like/:id", { ...auth, schema: { params: idParams, tags } }, c.like as never);
  r.put("/dislike/:id", { ...auth, schema: { params: idParams, tags } }, c.dislike as never);
  r.get("/:id", { schema: { params: idParams, tags } }, c.getById as never);
  r.put("/:id", { ...auth, schema: { params: idParams, body: updateReviewBody, tags } }, c.update as never);
  r.delete("/:id", { ...auth, schema: { params: idParams, tags } }, c.delete as never);
}
