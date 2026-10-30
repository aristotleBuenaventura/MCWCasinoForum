import { prisma } from "./prisma.js";
import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS } from "./securityConfig.js";

export async function recordFailedSignIn(user: {
  id: string;
  failedLoginAttempts: number;
}): Promise<{ lockedUntil: Date | null; attempts: number }> {
  const attempts = user.failedLoginAttempts + 1;
  const lockedUntil =
    attempts >= MAX_FAILED_LOGINS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
      : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: lockedUntil ? 0 : attempts,
      lockedUntil,
    },
  });

  return { lockedUntil, attempts };
}

export async function clearFailedSignIn(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
