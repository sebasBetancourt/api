import type { FastifyReply, FastifyRequest, RouteGenericInterface } from "fastify";
import {
  createCategoryService, deleteCategoryService, renameCategoryService, getCategoryByIdService,
  getCategoryByNameService, listCategoriesService,
} from "../services/categories/categoryServices.js";

type Req<T extends RouteGenericInterface = RouteGenericInterface> = FastifyRequest<T>;

export const categoriesController = {
  async create(req: Req<{ Body: { name: string } }>, reply: FastifyReply) {
    const category = await createCategoryService(req.body.name);
    return reply.code(201).send({ message: "Categoría creada exitosamente", category });
  },
  list: (req: Req<{ Querystring: { skip: number; limit: number } }>) =>
    listCategoriesService(req.query.skip, req.query.limit),
  getById: (req: Req<{ Params: { id: string } }>) => getCategoryByIdService(req.params.id),
  getByName: (req: Req<{ Params: { name: string } }>) => getCategoryByNameService(req.params.name),
  rename: (req: Req<{ Params: { id: string }; Body: { name: string } }>) =>
    renameCategoryService(req.params.id, req.body.name),
  async delete(req: Req<{ Params: { id: string } }>) {
    await deleteCategoryService(req.params.id);
    return { message: "Categoría eliminada" };
  },
};
