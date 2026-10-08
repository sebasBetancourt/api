import { createHash } from "node:crypto";
import sharp from "sharp";
import { AppError } from "./appError.js";

export const AVATAR_SIZE = 256;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_PIXELS = 25_000_000;
const MIN_SIDE = 32;

export type ImageKind = "jpeg" | "png" | "webp";

/** Tipo real según la firma de bytes; el `Content-Type` y el nombre del archivo no se usan nunca. */
export function detectImageKind(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

export interface ProcessedAvatar {
  data: Buffer;
  contentType: "image/webp";
  etag: string;
}

/**
 * Valida y re-procesa una imagen de perfil: solo JPEG/PNG/WebP reales, límite de píxeles,
 * orientación EXIF aplicada, recorte cuadrado centrado, 256×256 y WebP sin metadatos.
 */
export async function processAvatar(input: Buffer): Promise<ProcessedAvatar> {
  if (input.length === 0) throw new AppError(400, "La imagen está vacía");
  if (input.length > MAX_AVATAR_BYTES) throw new AppError(413, "La imagen supera los 2 MB");
  if (!detectImageKind(input)) throw new AppError(400, "Formato no permitido: usa JPG, PNG o WebP");

  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const { width = 0, height = 0 } = await image.metadata();
    if (Math.min(width, height) < MIN_SIDE) throw new AppError(400, `La imagen es muy pequeña (mínimo ${MIN_SIDE}×${MIN_SIDE})`);

    // Sharp elimina los metadatos (EXIF, ICC, XMP) salvo que se pida `withMetadata`.
    const data = await image
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
    return { data, contentType: "image/webp", etag: createHash("sha1").update(data).digest("hex").slice(0, 16) };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, "No se pudo procesar la imagen: archivo dañado o demasiado grande");
  }
}
