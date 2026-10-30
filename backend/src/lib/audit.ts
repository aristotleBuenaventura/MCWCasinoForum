import type { Request } from "express";
import { prisma } from "./prisma.js";
import { uid } from "./ids.js";
import { clientIp } from "./sessions.js";

export async function audit(
  req: Request,
  action: string,
  targetType: string,
  targetId: string,
  meta: Record<string, unknown> = {},
) {
  try {
    await prisma.auditLog.create({
      data: {
        id: uid("audit"),
        actorId: req.user?.userId ?? null,
        action,
        targetType,
        targetId,
        meta: JSON.stringify(meta).slice(0, 4000),
        ip: clientIp(req),
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
