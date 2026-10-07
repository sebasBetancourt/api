import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../../constants/globalConstants.js";
import { AppError } from "../../libs/appError.js";
import { hashesMatch, hashToken } from "../../libs/tokens.js";
import { adminRepository } from "../../repositories/admin.repository.js";
import { passwordResetRepository } from "../../repositories/passwordReset.repository.js";
import { userAdminRepository, userRepository } from "../../repositories/user.repository.js";
import type { ResetPasswordInput } from "../../schemas/auth.schema.js";
import { INVALID_RESET_LINK } from "./validateResetTokenService.js";

export async function resetPasswordService({ token, password }: ResetPasswordInput) {
  const hash = hashToken(token);
  const record = await passwordResetRepository.consume(hash);
  if (!record || !hashesMatch(record.hash, hash)) throw new AppError(400, INVALID_RESET_LINK);

  const user = await userRepository.findById(record.userId);
  if (!user || user.banned) {
    await passwordResetRepository.invalidateForUser(record.userId);
    throw new AppError(400, INVALID_RESET_LINK);
  }

  await userAdminRepository.updatePassword(user.id, await bcrypt.hash(password, BCRYPT_ROUNDS));
  await passwordResetRepository.invalidateForUser(user.id);
  await adminRepository.audit(user.id, "user.password_reset", "user", user.id);
}
