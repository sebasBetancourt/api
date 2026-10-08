import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageKind, processAvatar } from "../src/libs/imageProcessor.js";

const solid = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#336699" } });

describe("detectImageKind", () => {
  it("reconoce por firma JPEG, PNG y WebP", async () => {
    expect(detectImageKind(await solid(40, 40).jpeg().toBuffer())).toBe("jpeg");
    expect(detectImageKind(await solid(40, 40).png().toBuffer())).toBe("png");
    expect(detectImageKind(await solid(40, 40).webp().toBuffer())).toBe("webp");
  });
  it("rechaza SVG, GIF, HTML y texto", () => {
    for (const text of ["<svg xmlns='http://www.w3.org/2000/svg'/>", "GIF89a....", "<html><script>1</script>", "hola"]) {
      expect(detectImageKind(Buffer.from(text))).toBeNull();
    }
  });
});

describe("processAvatar", () => {
  it.each(["jpeg", "png", "webp"] as const)("convierte %s a WebP 256x256", async (fmt) => {
    const out = await processAvatar(await solid(500, 300)[fmt]().toBuffer());
    const meta = await sharp(out.data).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 256, height: 256 });
    expect(out.contentType).toBe("image/webp");
    expect(out.etag).toMatch(/^[0-9a-f]{16}$/);
  });

  it("elimina los metadatos EXIF", async () => {
    const withExif = await solid(200, 200).withExif({ IFD0: { Copyright: "secreto" } }).jpeg().toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    expect((await sharp((await processAvatar(withExif)).data).metadata()).exif).toBeUndefined();
  });

  it("rechaza vacío, formato falso, imagen dañada y muy pequeña", async () => {
    await expect(processAvatar(Buffer.alloc(0))).rejects.toMatchObject({ statusCode: 400 });
    await expect(processAvatar(Buffer.from("<svg/>"))).rejects.toMatchObject({ statusCode: 400 });
    const truncated = (await solid(300, 300).png().toBuffer()).subarray(0, 60);
    await expect(processAvatar(truncated)).rejects.toMatchObject({ statusCode: 400 });
    await expect(processAvatar(await solid(10, 10).png().toBuffer())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rechaza más de 2 MB", async () => {
    await expect(processAvatar(Buffer.alloc(2 * 1024 * 1024 + 1, 0xff))).rejects.toMatchObject({ statusCode: 413 });
  });
});
