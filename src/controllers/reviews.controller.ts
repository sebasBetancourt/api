import type { FastifyReply, FastifyRequest, RouteGenericInterface } from "fastify";
import {
  createReviewService, deleteReviewService, exportReviewsCsvService, getReviewByIdService,
  listReviewsService, rankingService, reactToReviewService, updateReviewService,
} from "../services/reviews/reviewServices.js";
import type { CreateReviewInput, ListReviewsQuery, UpdateReviewInput } from "../schemas/review.schema.js";

type Req<T extends RouteGenericInterface = RouteGenericInterface> = FastifyRequest<T>;
type Id = { Params: { id: string } };

export const reviewsController = {
  async create(req: Req<{ Body: CreateReviewInput }>, reply: FastifyReply) {
    return reply.code(201).send(await createReviewService(req.body, req.user.id));
  },
  list: (req: Req<{ Querystring: ListReviewsQuery }>) => listReviewsService(req.query),
  getById: (req: Req<Id>) => getReviewByIdService(req.params.id),
  update: (req: Req<Id & { Body: UpdateReviewInput }>) =>
    updateReviewService(req.params.id, req.body, req.user),
  async delete(req: Req<Id>) {
    await deleteReviewService(req.params.id, req.user);
    return { message: "Reseña eliminada" };
  },
  like: (req: Req<Id>) => reactToReviewService(req.params.id, "like", req.user.id),
  dislike: (req: Req<Id>) => reactToReviewService(req.params.id, "dislike", req.user.id),
  async ranking(req: Req<{ Params: { titleId: string } }>) {
    return { titleId: req.params.titleId, ranking: await rankingService(req.params.titleId) };
  },
  async exportCsv(req: Req<{ Querystring: { titleId?: string } }>, reply: FastifyReply) {
    const csv = await exportReviewsCsvService(req.query.titleId);
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="reviews.csv"')
      .send(csv);
  },
};
