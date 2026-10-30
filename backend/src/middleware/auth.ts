import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { readAuthToken } from "../lib/cookies.js";
import { IDLE_TIMEOUT_MS, jwtSecret } from "../lib/securityConfig.js";
import { findActiveSession, revokeSession, touchSession } from "../lib/sessions.js";

export type AuthUser = {
  userId: string;
  email: string;
  username: string;
  role: string;
  sessionId: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function resolveUser(req: Request): Promise<AuthUser | null> {
  const token = readAuthToken(req);
  if (!token) return null;
  const payload = jwt.verify(token, jwtSecret()) as {
    userId: string;
    email: string;
    role: string;
    sessionId?: string;
  };
  if (!payload.sessionId) return null;
  const session = await findActiveSession(payload.sessionId);
  if (!session || session.userId !== payload.userId) return null;
  const idleMs = Date.now() - session.lastSeenAt.getTime();
  if (idleMs > IDLE_TIMEOUT_MS) {
    await revokeSession(payload.sessionId);
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, username: true, role: true, banned: true, lockedUntil: true },
  });
  if (!user || user.banned) return null;
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null;
  void touchSession(payload.sessionId).catch(() => undefined);
  return {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    sessionId: payload.sessionId,
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  void resolveUser(req)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(() => next());
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  void resolveUser(req)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ ok: false, error: "Please log in." });
      }
      req.user = user;
      return next();
    })
    .catch(() => res.status(401).json({ ok: false, error: "Session expired. Please sign in again." }));
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Please log in." });
  if (req.user.role !== "moderator" && req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Moderator access required." });
  }
  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Please log in." });
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin access required." });
  }
  return next();
}
