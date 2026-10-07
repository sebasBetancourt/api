import type { FastifyReply, FastifyRequest } from "fastify";
import { loginService } from "../services/auth/loginService.js";
import { registerService } from "../services/auth/registerService.js";
import { userRepository } from "../repositories/user.repository.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema.js";

export const authController = {
  async register(req: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) {
    const user = await registerService(req.body);
    return reply.code(201).send({ message: "Usuario registrado exitosamente", user });
  },

  async login(req: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) {
    const user = await loginService(req.body);
    const token = await reply.jwtSign({ id: user.id, email: user.email, role: user.role });
    return { message: "Login exitoso", user, token };
  },

  async verify(req: FastifyRequest) {
    const user = await userRepository.findById(req.user.id);
    return { valid: !!user && !user.banned, user: req.user };
  },
};
