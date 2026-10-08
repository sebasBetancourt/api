import { z } from "zod";
import { passwordSchema } from "./auth.schema.js";

/** Teléfono internacional "laxo": dígitos con +, espacios, guiones o paréntesis. */
export const phoneSchema = z.string().trim().regex(/^\+?[0-9 ()\-]{6,20}$/, "Teléfono no válido");

export const updateMeBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    phone: phoneSchema.nullable().optional(),
    country: z.string().trim().min(1).max(60).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada que actualizar");

export const preferencesBody = z.object({
  marketingEmails: z.boolean().optional(),
  personalizedRecs: z.boolean().optional(),
  shareAnonymized: z.boolean().optional(),
  dataRetentionMonths: z.coerce.number().int().min(1).max(60).optional(),
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const avatarUrlBody = z.object({ url: z.string().trim().min(1).max(2048) });

export const deleteAccountBody = z.object({ password: z.string().min(1) });

export const listUsersQuery = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export const setRoleBody = z.object({ role: z.enum(["user", "admin"]) });
export const setStatusBody = z.object({ banned: z.boolean() });

export const adminTitlesQuery = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  type: z.enum(["movie", "tv", "anime"]).optional(),
  search: z.string().trim().optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeBody>;
export type PreferencesInput = z.infer<typeof preferencesBody>;
