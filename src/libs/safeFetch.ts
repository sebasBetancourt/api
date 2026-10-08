import dns from "node:dns";
import https from "node:https";
import net from "node:net";
import { AppError } from "./appError.js";

const MAX_REDIRECTS = 2;
const TIMEOUT_MS = 5_000;

const parseV4 = (ip: string) => ip.split(".").map(Number) as [number, number, number, number];

function isPrivateV4(ip: string): boolean {
  const [a, b, c] = parseV4(ip);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||           // link-local y metadatos cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                              // multicast y reservadas
  );
}

/** `true` solo para direcciones públicas y enrutables (IPv4 e IPv6). */
export function isPublicIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return !isPrivateV4(ip);
  if (kind !== 6) return false;
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^(?:::ffff:|0:0:0:0:0:ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return !isPrivateV4(mapped[1]);
  const hextet = v6.startsWith("::") ? 0 : parseInt(v6.split(":")[0] || "0", 16);
  return !(
    v6 === "::" || v6 === "::1" ||
    (hextet & 0xfe00) === 0xfc00 || // fc00::/7 (ULA)
    (hextet & 0xffc0) === 0xfe80 || // fe80::/10 (link-local)
    (hextet & 0xff00) === 0xff00 || // multicast
    v6.startsWith("64:ff9b:")       // NAT64
  );
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string, family: number) => void;

/** `lookup` propio: resuelve, rechaza si alguna dirección no es pública y fija la IP validada. */
export const safeLookup = (hostname: string, _options: unknown, callback: LookupCallback) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    if (addresses.length === 0 || addresses.some((a) => !isPublicIp(a.address))) {
      return callback(new AppError(400, "La URL apunta a una dirección no permitida") as never, "", 4);
    }
    callback(null, addresses[0].address, addresses[0].family);
  });
};

export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(400, "La URL no es válida");
  }
  if (url.protocol !== "https:") throw new AppError(400, "Solo se permiten URLs https");
  if (url.port && url.port !== "443") throw new AppError(400, "Solo se permite el puerto 443");
  if (url.username || url.password) throw new AppError(400, "La URL no puede incluir credenciales");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // Las IP literales no pasan por `lookup`: se validan aquí.
  if (net.isIP(host) && !isPublicIp(host)) throw new AppError(400, "La URL apunta a una dirección no permitida");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new AppError(400, "La URL apunta a una dirección no permitida");
  }
  return url;
}

function getOnce(url: URL, maxBytes: number): Promise<{ status: number; location?: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        lookup: safeLookup as never,
        timeout: TIMEOUT_MS,
        headers: { Accept: "image/jpeg,image/png,image/webp", "User-Agent": "PixelFlix-avatar-fetch/1.0" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, body: Buffer.alloc(0) });
        }
        if (status !== 200) {
          res.resume();
          return reject(new AppError(400, `No se pudo descargar la imagen (HTTP ${status})`));
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > maxBytes) {
          req.destroy();
          return reject(new AppError(413, "La imagen supera los 2 MB"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            return reject(new AppError(413, "La imagen supera los 2 MB"));
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new AppError(400, "La descarga de la imagen tardó demasiado")));
    req.on("error", (e) => reject(e instanceof AppError ? e : new AppError(400, "No se pudo descargar la imagen")));
    req.end();
  });
}

/**
 * Descarga una imagen de una URL pública. Defensas anti-SSRF: solo https/443, IP validada
 * en la conexión (no solo antes), redirecciones revalidadas, tope de tamaño y de tiempo.
 */
export async function safeDownload(rawUrl: string, maxBytes: number): Promise<Buffer> {
  let url = assertSafeUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await getOnce(url, maxBytes);
    if (res.status === 200) return res.body;
    if (!res.location) throw new AppError(400, "Redirección inválida");
    url = assertSafeUrl(new URL(res.location, url).toString());
  }
  throw new AppError(400, "Demasiadas redirecciones");
}
