import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/repositories/user.repository.js", () => ({
  userRepository: { findByEmail: vi.fn(), touchLogin: vi.fn() },
}));

import { userRepository } from "../src/repositories/user.repository.js";
import { loginService } from "../src/services/auth/loginService.js";

const baseUser = {
  id: "u1", email: "a@b.com", name: "A", role: "user", banned: false,
  passwordHash: bcrypt.hashSync("secret1", 4),
};

describe("loginService", () => {
  it("devuelve el usuario con credenciales válidas", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(baseUser as never);
    await expect(loginService({ email: "a@b.com", password: "secret1" })).resolves.toMatchObject({ id: "u1" });
  });
  it("rechaza contraseña incorrecta con 401", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(baseUser as never);
    await expect(loginService({ email: "a@b.com", password: "nope" })).rejects.toMatchObject({ statusCode: 401 });
  });
  it("rechaza usuario bloqueado con 403", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ ...baseUser, banned: true } as never);
    await expect(loginService({ email: "a@b.com", password: "secret1" })).rejects.toMatchObject({ statusCode: 403 });
  });
});
