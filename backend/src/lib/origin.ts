import type { NextFunction, Request, Response } from "express";

const allowed = (process.env.CORS_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const origin = (req.headers.origin || "").replace(/\/$/, "");
  const referer = req.headers.referer || "";
  if (origin) {
    if (origin !== allowed) {
      return res.status(403).json({ ok: false, error: "Cross-origin request blocked." });
    }
    return next();
  }
  if (referer && !referer.startsWith(allowed)) {
    return res.status(403).json({ ok: false, error: "Cross-origin request blocked." });
  }
  return next();
}
