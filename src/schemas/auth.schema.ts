import { z } from "zod";

export const registerBody = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().nullish().transform((v) => v || undefined),
  country: z.string().nullish().transform((v) => v || undefined),
  avatarUrl: z.string().nullish().transform((v) => v || undefined),
});

export const loginBody = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerBody>;
export type LoginInput = z.infer<typeof loginBody>;
