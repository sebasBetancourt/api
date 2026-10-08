import dns from "node:dns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSafeUrl, isPublicIp, safeDownload, safeLookup } from "../src/libs/safeFetch.js";

describe("isPublicIp", () => {
  it.each([
    "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1",
    "::ffff:10.1.2.3", "ff02::1",
  ])("%s no es pública", (ip) => expect(isPublicIp(ip)).toBe(false));

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s es pública", (ip) => expect(isPublicIp(ip)).toBe(true),
  );
});

describe("assertSafeUrl", () => {
  it.each([
    "http://example.com/a.png", "ftp://example.com/a.png", "https://127.0.0.1/a.png", "https://[::1]/a.png",
    "https://169.254.169.254/latest", "https://localhost/a.png", "https://app.localhost/a.png", "https://example.com:8443/a.png",
    "https://user:pass@example.com/a.png", "no es url", "https://10.0.0.1/x", "https://metadata.internal/x",
  ])("rechaza %s", (url) => expect(() => assertSafeUrl(url)).toThrow());

  it("acepta https público en 443", () => {
    expect(assertSafeUrl("https://example.com/a.png").hostname).toBe("example.com");
    expect(assertSafeUrl("https://example.com:443/a.png").port).toBe("");
  });
});

describe("safeLookup", () => {
  afterEach(() => vi.restoreAllMocks());
  const lookup = (hostname: string) =>
    new Promise<{ err: unknown; address: string }>((resolve) => safeLookup(hostname, {}, (err, address) => resolve({ err, address })));

  it("bloquea hosts que resuelven a IPs internas (rebinding / DNS apuntando a la red local)", async () => {
    vi.spyOn(dns, "lookup").mockImplementation(((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.7", family: 4 }])) as never);
    expect((await lookup("mixto.test")).err).toMatchObject({ statusCode: 400 });
  });

  it("fija la IP pública validada", async () => {
    vi.spyOn(dns, "lookup").mockImplementation(((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [{ address: "93.184.216.34", family: 4 }])) as never);
    expect(await lookup("ok.test")).toEqual({ err: null, address: "93.184.216.34" });
  });
});

describe("safeDownload", () => {
  it("no hace ninguna conexión a direcciones internas", async () => {
    await expect(safeDownload("https://127.0.0.1/x.png", 1000)).rejects.toMatchObject({ statusCode: 400 });
    await expect(safeDownload("http://example.com/x.png", 1000)).rejects.toMatchObject({ statusCode: 400 });
  });
});
