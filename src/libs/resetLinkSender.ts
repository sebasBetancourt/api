import type { FastifyBaseLogger } from "fastify";
import { env } from "./env.js";

/** Entrega el enlace de recuperación al usuario. Para enviar correos basta otra implementación (p. ej. SMTP). */
export interface ResetLinkSender {
  send(email: string, link: string): Promise<void>;
}

/** Sin correo real: escribe el enlace en los logs, salvo en producción (donde nunca imprime el token). */
export class ConsoleResetLinkSender implements ResetLinkSender {
  constructor(
    private readonly log: Pick<FastifyBaseLogger, "info" | "warn">,
    private readonly logLink = env.NODE_ENV !== "production" || env.PASSWORD_RESET_LOG_LINK,
  ) {}

  async send(email: string, link: string) {
    if (this.logLink) this.log.info({ email, link }, "Enlace de recuperación de contraseña");
    else this.log.warn("Recuperación de contraseña solicitada, pero no hay envío de correo configurado");
  }
}
