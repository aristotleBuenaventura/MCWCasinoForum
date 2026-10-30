import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 2_000_000);
const uploadRoot = path.resolve(
  process.env.UPLOAD_DIR ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../uploads"),
);

const SIGNATURES: { ext: string; mime: string; test: (buf: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "gif", mime: "image/gif", test: (b) => b.length > 6 && b.subarray(0, 6).toString("ascii").startsWith("GIF8") },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) =>
      b.length > 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export function detectImage(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf)) ?? null;
}

export async function saveLocalImage(buf: Buffer) {
  if (buf.length > MAX_BYTES) {
    throw new Error(`File too large. Max ${Math.round(MAX_BYTES / 1_000_000)}MB.`);
  }
  const kind = detectImage(buf);
  if (!kind) throw new Error("Only JPEG, PNG, GIF, and WebP images are allowed.");
  const key = `${Date.now().toString(36)}_${randomBytes(8).toString("hex")}.${kind.ext}`;
  if (key.includes("..") || key.includes("/") || key.includes("\\")) {
    throw new Error("Invalid filename.");
  }
  await fs.mkdir(uploadRoot, { recursive: true });
  await fs.writeFile(path.join(uploadRoot, key), buf);
  return { key, mime: kind.mime, url: `/uploads/${key}`, bytes: buf.length, hash: createHash("sha256").update(buf).digest("hex") };
}

export function uploadsDir() {
  return uploadRoot;
}

export { MAX_BYTES };
