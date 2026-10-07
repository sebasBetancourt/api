import type { FastifyReply, FastifyRequest } from "fastify";
import type { RoleName } from "../constants/globalConstants.js";
import { userRepository } from "../repositories/user.repository.js";

/**
 * Verifica el rol del token y lo confirma contra la BD, para que un
 * cambio de rol o un bloqueo tenga efecto sin esperar a que expire el JWT.
 */
export const checkUserPermission =
  (...roles: RoleName[]) =>
  async (req: FastifyRequest, reply: FastifyReply) => {
    const deny = () => reply.code(403).send({ message: "No tienes permisos" });
    if (!roles.includes(req.user.role)) return deny();
    const user = await userRepository.findById(req.user.id);
    if (!user || user.banned || !roles.includes(user.role)) return deny();
  };
