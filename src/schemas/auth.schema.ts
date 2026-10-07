import { z } from "zod";

const emailSchema = z.string().email().transform((v) => v.trim().toLowerCase());

/** Regla única de contraseña: registro, cambio y restablecimiento. */
export const passwordSchema = z.string().min(6);

/** Formato de `generateResetToken`: así un token mal copiado no llega a la BD. */
const resetTokenSchema = z.string().regex(/^[\w-]{43}$/);

export const registerBody = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1),
  phone: z.string().nullish().transform((v) => v || undefined),
  country: z.string().nullish().transform((v) => v || undefined),
  avatarUrl: z.string().nullish().transform((v) => v || undefined),
});

export const loginBody = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const forgotPasswordBody = z.object({ email: emailSchema });
export const validateResetBody = z.object({ token: resetTokenSchema });
export const resetPasswordBody = z.object({ token: resetTokenSchema, password: passwordSchema });

export type RegisterInput = z.infer<typeof registerBody>;
export type LoginInput = z.infer<typeof loginBody>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordBody>;
export type ValidateResetInput = z.infer<typeof validateResetBody>;
export type ResetPasswordInput = z.infer<typeof resetPasswordBody>;
