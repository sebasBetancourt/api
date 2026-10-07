import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../../constants/globalConstants.js";
import { AppError } from "../../libs/appError.js";
import { isDuplicateKey } from "../../libs/mongoHelpers.js";
import { userRepository } from "../../repositories/user.repository.js";
import type { RegisterInput } from "../../schemas/auth.schema.js";

export async function registerService(input: RegisterInput) {
  if (await userRepository.findByEmail(input.email)) {
    throw new AppError(409, "El usuario ya existe");
  }
  const { password, ...rest } = input;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await userRepository
    .create({ ...rest, passwordHash })
    .catch((e) => {
      // carrera entre dos registros simultáneos: lo frena el índice único de email
      throw isDuplicateKey(e) ? new AppError(409, "El usuario ya existe") : e;
    });
  return { id: user.id, email: user.email, role: user.role, name: user.name };
}
