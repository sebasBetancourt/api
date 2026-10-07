import type { FastifyReply, FastifyRequest, RouteGenericInterface } from "fastify";
import {
  approveTitleService, deleteTitleService, getTitleByIdService, listCollectionService,
  listTitlesService, rejectTitleService, setTitleEmbedService, updateTitleService,
} from "../services/titles/titleServices.js";
import { createTitleService } from "../services/titles/createTitleService.js";
import type { CreateTitleInput, ListTitlesQuery, UpdateTitleInput } from "../schemas/title.schema.js";

type Req<T extends RouteGenericInterface = RouteGenericInterface> = FastifyRequest<T>;
type Id = { Params: { id: string } };

export const titlesController = {
  async create(req: Req<{ Body: CreateTitleInput }>, reply: FastifyReply) {
    const t = await createTitleService(req.body, req.user.id);
    return reply.code(201).send({ message: "Título creado exitosamente", id: t.id });
  },
  list: (req: Req<{ Querystring: ListTitlesQuery }>) => listTitlesService(req.query),
  collection: (req: Req<{ Querystring: { skip: number; limit: number; type?: "movie" | "tv" | "anime" } }>) =>
    listCollectionService(req.user.id, req.query.skip, req.query.limit, req.query.type),
  getById: (req: Req<Id>) => getTitleByIdService(req.params.id),
  update: (req: Req<Id & { Body: UpdateTitleInput }>) => updateTitleService(req.params.id, req.body),
  async approve(req: Req<Id>) {
    await approveTitleService(req.params.id);
    return { message: "Título aprobado" };
  },
  async reject(req: Req<Id>) {
    await rejectTitleService(req.params.id);
    return { message: "Título rechazado" };
  },
  async delete(req: Req<Id>) {
    await deleteTitleService(req.params.id);
    return { message: "Título eliminado" };
  },
  async setEmbed(req: Req<Id & { Body: { embedUrl: string | null } }>) {
    await setTitleEmbedService(req.params.id, req.body.embedUrl);
    return { message: "Embed actualizado" };
  },
};
