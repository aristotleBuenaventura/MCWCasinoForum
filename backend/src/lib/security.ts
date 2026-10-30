import { createHash } from "node:crypto";

const hits = new Map<string, number[]>();
const lastWrite = new Map<string, { at: number; hash: string }>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const next = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (next.length >= max) {
    hits.set(key, next);
    return false;
  }
  next.push(now);
  hits.set(key, next);
  return true;
}

export function ageFromDob(iso: string) {
  const dob = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function linkCount(text: string) {
  return (text.match(/https?:\/\/[^\s]+/gi) || []).length;
}

function contentHash(title: string, content: string) {
  return createHash("sha256").update(`${title}\n${content}`).digest("hex");
}

export function assertCanPost(
  userId: string,
  createdAt: Date | string,
  title: string,
  content: string,
) {
  const created = new Date(createdAt).getTime();
  if (Date.now() - created < 15_000) {
    return "New accounts must wait a few seconds before posting.";
  }
  const now = Date.now();
  const prev = lastWrite.get(userId);
  if (prev && now - prev.at < 30_000) {
    return "Please wait 30 seconds between posts.";
  }
  const hash = contentHash(title, content);
  if (prev && prev.hash === hash && now - prev.at < 10 * 60_000) {
    return "Duplicate post detected.";
  }
  if (linkCount(`${title}\n${content}`) > 4) {
    return "Too many links in this post.";
  }
  lastWrite.set(userId, { at: now, hash });
  return null;
}

const TEST_TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";

export function turnstileSecret() {
  return process.env.TURNSTILE_SECRET || TEST_TURNSTILE_SECRET;
}

export function isTestTurnstile() {
  const secret = turnstileSecret();
  return secret === TEST_TURNSTILE_SECRET || secret.startsWith("1x000000000000000000000");
}

export function assertTurnstileConfigured() {
  if (process.env.NODE_ENV === "production" && isTestTurnstile()) {
    throw new Error("TURNSTILE_SECRET must be a real Cloudflare secret in production.");
  }
}

export function passwordPolicyError(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must include a letter and a number.";
  }
  return null;
}

export async function verifyTurnstile(token: string, ip: string) {
  const secret = turnstileSecret();
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function isDisposableEmail(email: string) {
  const domain = email.split("@")[1] || "";
  const blocked = new Set([
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "tempmail.com",
    "trashmail.com",
    "yopmail.com",
  ]);
  return blocked.has(domain.toLowerCase());
}
