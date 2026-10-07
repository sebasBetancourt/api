import type { FastifyRequest, RouteGenericInterface } from "fastify";
import {
  deleteUserService, getMetricsService, listAllTitlesService, listUsersService,
  setUserBannedService, setUserRoleService,
} from "../services/admin/adminServices.js";

type Req<T extends RouteGenericInterface = RouteGenericInterface> = FastifyRequest<T>;
type Id = { Params: { id: string } };

export const adminController = {
  metrics: () => getMetricsService(),
  titles: (req: Req<{ Querystring: Parameters<typeof listAllTitlesService>[0] }>) =>
    listAllTitlesService(req.query),
  users: (req: Req<{ Querystring: { skip: number; limit: number; search?: string } }>) =>
    listUsersService(req.query.skip, req.query.limit, req.query.search),
  setRole: (req: Req<Id & { Body: { role: "user" | "admin" } }>) =>
    setUserRoleService(req.user.id, req.params.id, req.body.role),
  setStatus: (req: Req<Id & { Body: { banned: boolean } }>) =>
    setUserBannedService(req.user.id, req.params.id, req.body.banned),
  async deleteUser(req: Req<Id>) {
    await deleteUserService(req.user.id, req.params.id);
    return { message: "Usuario eliminado" };
  },
};
