import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { prisma } from "./prisma.js";

export function clientIp(req: Request): string {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  return ip.replace(/^::ffff:/, "").slice(0, 64);
}

export function clientUserAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  if (!ua) return null;
  return ua.slice(0, 512);
}

export async function createSession(userId: string, req: Request) {
  return prisma.userSession.create({
    data: {
      id: randomUUID(),
      userId,
      ipAddress: clientIp(req),
      userAgent: clientUserAgent(req),
    },
  });
}

export async function touchSession(sessionId: string) {
  await prisma.userSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { lastSeenAt: new Date() },
  });
}

export async function revokeSession(sessionId: string) {
  await prisma.userSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserSessions(userId: string) {
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function findActiveSession(sessionId: string) {
  return prisma.userSession.findFirst({
    where: { id: sessionId, revokedAt: null },
  });
}
