import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getAvatarService } from "../services/me/avatarServices.js";
import { objectId } from "../schemas/common.schema.js";

/** Lectura pública de fotos de perfil: se cargan con `<img>`, que no puede enviar el token. */
export async function avatarsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/:userId",
    { schema: { params: z.object({ userId: objectId }), tags: ["avatars"] } },
    async (req, reply) => {
      const avatar = await getAvatarService(req.params.userId);
      const etag = `"${avatar.etag}"`;
      reply
        .header("ETag", etag)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .header("X-Content-Type-Options", "nosniff")
        // helmet pone `same-origin`, que bloquearía la imagen cuando el frontend vive en otro origen.
        .header("Cross-Origin-Resource-Policy", "cross-origin");
      if (req.headers["if-none-match"] === etag) return reply.code(304).send();
      return reply.type(avatar.contentType).send(avatar.data);
    },
  );
}
