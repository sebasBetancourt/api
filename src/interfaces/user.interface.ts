import type { RoleName } from "../constants/globalConstants.js";

/** Usuario completo para uso interno (incluye hash). Nunca se devuelve tal cual por la API. */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: RoleName;
  banned: boolean;
}

export interface PublicUserDto {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  phone: string | null;
  country: string | null;
  avatarUrl: string | null;
  banned: boolean;
  preferences: Record<string, unknown>;
  createdAt: Date;
  lastLoginAt: Date | null;
}
