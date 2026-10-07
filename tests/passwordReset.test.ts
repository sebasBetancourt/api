import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017";
  process.env.JWT_SECRET ??= "test-secret-123";
  process.env.FRONTEND_URL = "https://app.test/,http://localhost:5173";
});

vi.mock("../src/repositories/user.repository.js", () => ({
  userRepository: { findByEmail: vi.fn(), findById: vi.fn() },
  userAdminRepository: { updatePassword: vi.fn() },
}));
vi.mock("../src/repositories/passwordReset.repository.js", () => ({
  passwordResetRepository: { invalidateForUser: vi.fn(), create: vi.fn(), findValidByHash: vi.fn(), consume: vi.fn() },
}));
vi.mock("../src/repositories/admin.repository.js", () => ({ adminRepository: { audit: vi.fn() } }));

import { buildApp } from "../src/app.js";
import { env } from "../src/libs/env.js";
import { ConsoleResetLinkSender } from "../src/libs/resetLinkSender.js";
import { generateResetToken, hashesMatch, hashToken } from "../src/libs/tokens.js";
import { adminRepository } from "../src/repositories/admin.repository.js";
import { passwordResetRepository } from "../src/repositories/passwordReset.repository.js";
import { userAdminRepository, userRepository } from "../src/repositories/user.repository.js";
import { requestPasswordResetService } from "../src/services/auth/requestPasswordResetService.js";
import { resetPasswordService } from "../src/services/auth/resetPasswordService.js";
import { validateResetTokenService } from "../src/services/auth/validateResetTokenService.js";

const user = { id: "64b000000000000000000001", email: "a@b.com", name: "A", role: "user", banned: false, passwordHash: "x" };
const repo = vi.mocked(passwordResetRepository);
const sender = () => ({ send: vi.fn(async (_email: string, _link: string) => undefined) });
const tokenOf = (link: string) => new URL(link).searchParams.get("token")!;
const recordFor = (token: string) => ({ userId: user.id, hash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) });

beforeEach(() => vi.resetAllMocks());

describe("tokens", () => {
  it("genera tokens aleatorios de 43 caracteres base64url", () => {
    const a = generateResetToken();
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(generateResetToken()).not.toBe(a);
  });
  it("el hash es SHA-256 determinista y distinto del token", () => {
    const t = generateResetToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashesMatch(hashToken(t), hashToken(t))).toBe(true);
    expect(hashesMatch(hashToken(t), hashToken(`${t}x`))).toBe(false);
  });
});

describe("requestPasswordResetService", () => {
  it("guarda solo el hash, con caducidad, y envía el enlace al primer origen del frontend", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user as never);
    const s = sender();
    const before = Date.now();
    await requestPasswordResetService(user.email, s);

    expect(repo.invalidateForUser).toHaveBeenCalledWith(user.id);
    const [to, link] = s.send.mock.calls[0];
    expect(to).toBe(user.email);
    expect(link).toMatch(/^https:\/\/app\.test\/reset-password\?token=[\w-]{43}$/);
    const token = tokenOf(link);
    const [userId, storedHash, expiresAt] = repo.create.mock.calls[0];
    expect(userId).toBe(user.id);
    expect(storedHash).toBe(hashToken(token));
    expect(storedHash).not.toContain(token);
    const ttl = env.PASSWORD_RESET_TTL_MINUTES * 60_000;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(ttl);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(ttl);
  });

  it.each([
    ["inexistente", null],
    ["bloqueado", { ...user, banned: true }],
  ])("con un correo %s no crea token ni envía nada, y termina igual", async (_, found) => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(found as never);
    const s = sender();
    await expect(requestPasswordResetService("x@y.com", s)).resolves.toBeUndefined();
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.invalidateForUser).not.toHaveBeenCalled();
    expect(s.send).not.toHaveBeenCalled();
  });
});

describe("validateResetTokenService", () => {
  it("acepta un token vigente buscando por su hash", async () => {
    const token = generateResetToken();
    repo.findValidByHash.mockResolvedValue(recordFor(token));
    await expect(validateResetTokenService(token)).resolves.toEqual({ valid: true });
    expect(repo.findValidByHash).toHaveBeenCalledWith(hashToken(token));
  });
  it("rechaza con 400 un token inválido, vencido o usado", async () => {
    repo.findValidByHash.mockResolvedValue(null);
    await expect(validateResetTokenService(generateResetToken())).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("resetPasswordService", () => {
  it("cambia la contraseña con bcrypt, invalida los tokens y audita", async () => {
    const token = generateResetToken();
    repo.consume.mockResolvedValue(recordFor(token));
    vi.mocked(userRepository.findById).mockResolvedValue(user as never);
    await resetPasswordService({ token, password: "nueva123" });

    expect(repo.consume).toHaveBeenCalledWith(hashToken(token));
    const [id, hash] = vi.mocked(userAdminRepository.updatePassword).mock.calls[0];
    expect(id).toBe(user.id);
    expect(await bcrypt.compare("nueva123", hash)).toBe(true);
    expect(repo.invalidateForUser).toHaveBeenCalledWith(user.id);
    expect(adminRepository.audit).toHaveBeenCalledWith(user.id, "user.password_reset", "user", user.id);
  });

  it("es de un solo uso: el segundo intento con el mismo token da 400", async () => {
    const token = generateResetToken();
    repo.consume.mockResolvedValueOnce(recordFor(token)).mockResolvedValueOnce(null);
    vi.mocked(userRepository.findById).mockResolvedValue(user as never);
    await resetPasswordService({ token, password: "nueva123" });
    await expect(resetPasswordService({ token, password: "otra1234" })).rejects.toMatchObject({ statusCode: 400 });
    expect(userAdminRepository.updatePassword).toHaveBeenCalledTimes(1);
  });

  it("rechaza un token vencido o inexistente sin tocar la contraseña", async () => {
    repo.consume.mockResolvedValue(null);
    await expect(resetPasswordService({ token: generateResetToken(), password: "nueva123" }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(userAdminRepository.updatePassword).not.toHaveBeenCalled();
  });

  it("rechaza si el usuario fue bloqueado después de pedir el enlace", async () => {
    const token = generateResetToken();
    repo.consume.mockResolvedValue(recordFor(token));
    vi.mocked(userRepository.findById).mockResolvedValue({ ...user, banned: true } as never);
    await expect(resetPasswordService({ token, password: "nueva123" })).rejects.toMatchObject({ statusCode: 400 });
    expect(userAdminRepository.updatePassword).not.toHaveBeenCalled();
    expect(repo.invalidateForUser).toHaveBeenCalledWith(user.id);
  });
});

describe("ConsoleResetLinkSender", () => {
  const log = () => ({ info: vi.fn(), warn: vi.fn() });
  it("fuera de producción escribe el enlace en el log", async () => {
    const l = log();
    await new ConsoleResetLinkSender(l, true).send("a@b.com", "https://app.test/reset-password?token=abc");
    expect(l.info).toHaveBeenCalledWith(expect.objectContaining({ link: "https://app.test/reset-password?token=abc" }), expect.any(String));
  });
  it("en producción nunca imprime el token", async () => {
    const l = log();
    await new ConsoleResetLinkSender(l, false).send("a@b.com", "https://app.test/reset-password?token=abc");
    expect(l.info).not.toHaveBeenCalled();
    expect(JSON.stringify(l.warn.mock.calls)).not.toContain("abc");
  });
});

describe("POST /auth/forgot-password", () => {
  it("responde lo mismo exista o no el correo, y solo envía al existente", async () => {
    const s = sender();
    const app = await buildApp({ resetLinkSender: s });
    vi.mocked(userRepository.findByEmail).mockImplementation(async (email) => (email === user.email ? user : null) as never);
    const ask = (email: string) => app.inject({ method: "POST", url: "/api/v1/auth/forgot-password", payload: { email } });

    const known = await ask(user.email);
    const unknown = await ask("nadie@b.com");
    expect(known.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json()).toEqual(known.json());
    await vi.waitFor(() => expect(s.send).toHaveBeenCalledTimes(1));
    expect(s.send).toHaveBeenCalledWith(user.email, expect.any(String));
    await app.close();
  });

  it("limita las peticiones a un mismo correo aunque lleguen desde IPs distintas", async () => {
    const app = await buildApp({ resetLinkSender: sender() });
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
    const ask = (i: number, email = "Victima@B.com") =>
      app.inject({ method: "POST", url: "/api/v1/auth/forgot-password", payload: { email }, remoteAddress: `10.0.0.${i}` });

    for (let i = 1; i <= 5; i++) expect((await ask(i)).statusCode).toBe(200);
    expect((await ask(6, "victima@b.com")).statusCode).toBe(429);
    expect((await ask(7, "otra@b.com")).statusCode).toBe(200);
    await app.close();
  });
});
