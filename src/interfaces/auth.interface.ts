import type { RoleName } from "../constants/globalConstants.js";

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: RoleName;
}

export interface PublicUser {
  id: string;
  email: string;
  role: RoleName;
  name: string;
  avatarUrl: string | null;
}
