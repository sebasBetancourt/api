import { env } from "../../libs/env.js";
import type { ResetLinkSender } from "../../libs/resetLinkSender.js";
import { generateResetToken, hashToken } from "../../libs/tokens.js";
import { passwordResetRepository } from "../../repositories/passwordReset.repository.js";
import { userRepository } from "../../repositories/user.repository.js";

export const FORGOT_PASSWORD_MESSAGE =
  "Si el correo está registrado, te enviaremos un enlace para restablecer la contraseña.";

export const resetLinkFor = (token: string) =>
  `${env.FRONTEND_URL.split(",")[0].trim().replace(/\/+$/, "")}/reset-password?token=${token}`;

/** No devuelve nada ni lanza por correo desconocido: el llamador no debe poder distinguir los casos. */
export async function requestPasswordResetService(email: string, sender: ResetLinkSender) {
  const token = generateResetToken();
  const hash = hashToken(token);
  const user = await userRepository.findByEmail(email);
  if (!user || user.banned) return;

  await passwordResetRepository.invalidateForUser(user.id);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);
  await passwordResetRepository.create(user.id, hash, expiresAt);
  await sender.send(user.email, resetLinkFor(token));
}
