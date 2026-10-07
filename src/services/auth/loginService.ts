import bcrypt from "bcryptjs";
import { AppError } from "../../libs/appError.js";
import { userRepository } from "../../repositories/user.repository.js";
import type { LoginInput } from "../../schemas/auth.schema.js";
import type { PublicUser } from "../../interfaces/auth.interface.js";

export async function loginService(input: LoginInput): Promise<PublicUser> {
  const user = await userRepository.findByEmail(input.email);
  // Mismo mensaje para email inexistente y contraseña errónea.
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, "Credenciales inválidas");
  }
  if (user.banned) throw new AppError(403, "Usuario bloqueado");
  await userRepository.touchLogin(user.id);
  return { id: user.id, email: user.email, role: user.role, name: user.name };
}
