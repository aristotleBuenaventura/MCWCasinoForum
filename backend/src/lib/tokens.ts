import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";
import { uid } from "./ids.js";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueAuthToken(userId: string, type: "reset" | "verify", ttlMs: number) {
  const token = randomBytes(32).toString("hex");
  await prisma.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.authToken.create({
    data: {
      id: uid("tok"),
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return token;
}

export async function consumeAuthToken(token: string, type: "reset" | "verify") {
  const row = await prisma.authToken.findFirst({
    where: { tokenHash: hashToken(token), type, usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!row) return null;
  await prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row;
}
