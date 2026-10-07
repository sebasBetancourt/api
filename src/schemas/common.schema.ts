import { z } from "zod";

/** ObjectId de MongoDB en hexadecimal (24 caracteres). */
export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Id inválido");
