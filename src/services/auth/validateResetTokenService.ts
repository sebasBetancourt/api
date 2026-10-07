import { AppError } from "../../libs/appError.js";
import { hashesMatch, hashToken } from "../../libs/tokens.js";
import { passwordResetRepository } from "../../repositories/passwordReset.repository.js";

export const INVALID_RESET_LINK = "El enlace no es válido o ha caducado";

export async function validateResetTokenService(token: string) {
  const hash = hashToken(token);
  const record = await passwordResetRepository.findValidByHash(hash);
  if (!record || !hashesMatch(record.hash, hash)) throw new AppError(400, INVALID_RESET_LINK);
  return { valid: true as const };
}
