import { prisma } from "./prisma.js";

export async function consumeRate(key: string, max: number, windowMs: number) {
  const now = new Date();
  const row = await prisma.rateBucket.findUnique({ where: { key } });
  if (!row || now.getTime() - row.windowStart.getTime() >= windowMs) {
    await prisma.rateBucket.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return true;
  }
  if (row.count >= max) return false;
  await prisma.rateBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return true;
}
