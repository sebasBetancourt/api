import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1),
  DB_NAME: z.string().min(1).default("netflix-reviews-db"),
  DB_NAME_TEST: z.string().min(1).default("pelixflix-test"),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("1d"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(1).default(30),
  /** Imprime el enlace de recuperación en los logs aunque NODE_ENV sea production. */
  PASSWORD_RESET_LOG_LINK: z.stringbool().default(false),
  /** Clave de la API de listados de Vimeus (solo servidor). Se acepta el nombre antiguo VIMEO_API_KEY. */
  VIMEUS_API_KEY: z.string().trim().optional(),
  VIMEO_API_KEY: z.string().trim().optional(),
  VIMEUS_BASE_URL: z.url().default("https://vimeus.com"),
  VIMEUS_SYNC_ENABLED: z.stringbool().default(false),
  VIMEUS_SYNC_CRON: z.string().default("0 4 * * *"),
});

const parsed = envSchema.parse(process.env);
export const env = { ...parsed, VIMEUS_API_KEY: parsed.VIMEUS_API_KEY || parsed.VIMEO_API_KEY || undefined };
