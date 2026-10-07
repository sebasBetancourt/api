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
});

export const env = envSchema.parse(process.env);
