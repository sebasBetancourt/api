export const API_PREFIX = "/api/v1";
export const BCRYPT_ROUNDS = 10;
export const ROLES = { USER: "user", ADMIN: "admin" } as const;
export type RoleName = (typeof ROLES)[keyof typeof ROLES];
