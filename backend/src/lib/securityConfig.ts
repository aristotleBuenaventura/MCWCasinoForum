export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";
export const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "mcw_session";

export const IDLE_TIMEOUT_MS = Number(
  process.env.SESSION_IDLE_TIMEOUT_MS ?? 30 * 60 * 1000,
);

export const MAX_FAILED_LOGINS = Number(process.env.MAX_FAILED_LOGINS ?? 5);
export const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES ?? 15);

export const LOGIN_RATE_WINDOW_MS = Number(
  process.env.LOGIN_RATE_WINDOW_MS ?? 15 * 60 * 1000,
);
export const LOGIN_RATE_MAX = Number(process.env.LOGIN_RATE_MAX ?? 20);

export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true" || process.env.COOKIE_SECURE === "1") return true;
  if (process.env.COOKIE_SECURE === "false" || process.env.COOKIE_SECURE === "0") return false;
  return process.env.NODE_ENV === "production";
}

export function cookieSameSite(): "lax" | "strict" | "none" {
  const value = (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase();
  if (value === "strict" || value === "none" || value === "lax") return value;
  return "lax";
}

export function trustProxyEnabled(): boolean {
  const value = (process.env.TRUST_PROXY ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
  }
  return "mcw-forum-dev-only-change-me-to-32chars";
}
