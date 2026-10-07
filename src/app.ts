import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { API_PREFIX } from "./constants/globalConstants.js";
import { env } from "./libs/env.js";
import { ConsoleResetLinkSender, type ResetLinkSender } from "./libs/resetLinkSender.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { favoritesRoutes } from "./routes/favorites.routes.js";
import { meRoutes } from "./routes/me.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { categoriesRoutes } from "./routes/categories.routes.js";
import { reviewsRoutes } from "./routes/reviews.routes.js";
import { titlesRoutes } from "./routes/titles.routes.js";

export interface BuildAppOptions {
  resetLinkSender?: ResetLinkSender;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.decorate("resetLinkSender", opts.resetLinkSender ?? new ConsoleResetLinkSender(app.log));

  await app.register(helmet);
  await app.register(sensible);
  await app.register(cors, { origin: env.FRONTEND_URL.split(","), credentials: true, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] });
  await app.register(rateLimit, { max: 900, timeWindow: "2 minutes" });
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });
  await app.register(swagger, {
    openapi: { info: { title: "Pelixflix API", version: "2.0.0" } },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes, { prefix: `${API_PREFIX}/auth` });

  await app.register(titlesRoutes, { prefix: `${API_PREFIX}/titles` });
  await app.register(categoriesRoutes, { prefix: `${API_PREFIX}/categories` });
  await app.register(reviewsRoutes, { prefix: `${API_PREFIX}/reviews` });
  await app.register(meRoutes, { prefix: `${API_PREFIX}/me` });
  await app.register(favoritesRoutes, { prefix: `${API_PREFIX}/favorites` });
  await app.register(adminRoutes, { prefix: `${API_PREFIX}/admin` });

  return app;
}
