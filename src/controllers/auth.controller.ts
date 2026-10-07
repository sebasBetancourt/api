import type { FastifyReply, FastifyRequest } from "fastify";
import { loginService } from "../services/auth/loginService.js";
import { registerService } from "../services/auth/registerService.js";
import {
  FORGOT_PASSWORD_MESSAGE,
  requestPasswordResetService,
} from "../services/auth/requestPasswordResetService.js";
import { resetPasswordService } from "../services/auth/resetPasswordService.js";
import { validateResetTokenService } from "../services/auth/validateResetTokenService.js";
import { userRepository } from "../repositories/user.repository.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ValidateResetInput,
} from "../schemas/auth.schema.js";

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

  async forgotPassword(req: FastifyRequest<{ Body: ForgotPasswordInput }>) {
    // Se responde sin esperar al trabajo: el tiempo de respuesta no revela si el correo existe.
    void requestPasswordResetService(req.body.email, req.server.resetLinkSender).catch((err) => req.log.error(err));
    return { message: FORGOT_PASSWORD_MESSAGE };
  },

  validateResetToken: (req: FastifyRequest<{ Body: ValidateResetInput }>) => validateResetTokenService(req.body.token),

  async resetPassword(req: FastifyRequest<{ Body: ResetPasswordInput }>) {
    await resetPasswordService(req.body);
    return { message: "Contraseña actualizada" };
  },
};
