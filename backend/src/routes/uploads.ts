import { Router } from "express";
import Busboy from "busboy";
import { requireAuth } from "../middleware/auth.js";
import { consumeRate } from "../lib/rateBuckets.js";
import { clientIp } from "../lib/sessions.js";
import { MAX_BYTES, saveLocalImage } from "../lib/upload.js";

export const uploadsRouter = Router();

uploadsRouter.post("/", requireAuth, async (req, res) => {
  const ip = clientIp(req);
  if (!(await consumeRate(`upload:${req.user!.userId}`, 30, 60 * 60_000))) {
    return res.status(429).json({ ok: false, error: "Too many uploads." });
  }
  if (!(await consumeRate(`uploadip:${ip}`, 60, 60 * 60_000))) {
    return res.status(429).json({ ok: false, error: "Too many uploads from this network." });
  }
  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.startsWith("multipart/form-data")) {
    return res.status(400).json({ ok: false, error: "Expected multipart upload." });
  }

  let settled = false;
  const done = (status: number, body: object) => {
    if (settled || res.headersSent) return;
    settled = true;
    res.status(status).json(body);
  };

  try {
    const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_BYTES } });
    let fileBuf: Buffer | null = null;
    let tooLarge = false;
    bb.on("file", (_name, file) => {
      const parts: Buffer[] = [];
      file.on("data", (d: Buffer) => parts.push(d));
      file.on("limit", () => {
        tooLarge = true;
      });
      file.on("end", () => {
        fileBuf = Buffer.concat(parts);
      });
    });
    bb.on("error", () => done(400, { ok: false, error: "Invalid upload." }));
    bb.on("finish", () => {
      void (async () => {
        if (tooLarge) return done(400, { ok: false, error: "File too large." });
        if (!fileBuf) return done(400, { ok: false, error: "No image uploaded." });
        try {
          const saved = await saveLocalImage(fileBuf);
          done(200, { ok: true, url: saved.url, mime: saved.mime, bytes: saved.bytes });
        } catch (err) {
          done(400, { ok: false, error: err instanceof Error ? err.message : "Upload failed." });
        }
      })();
    });
    req.pipe(bb);
  } catch {
    done(500, { ok: false, error: "Upload parser unavailable." });
  }
});
