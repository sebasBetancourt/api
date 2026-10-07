import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 bytes aleatorios en base64url: 43 caracteres seguros para una URL. */
export const generateResetToken = () => randomBytes(32).toString("base64url");

/** SHA-256 en hex. En la BD solo se guarda esto, nunca el token. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function hashesMatch(a: string, b: string) {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
