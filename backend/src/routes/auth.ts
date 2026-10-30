import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { clearAuthCookie, setAuthCookie } from "../lib/cookies.js";
import { JWT_EXPIRES_IN, jwtSecret, LOCKOUT_MINUTES, LOGIN_RATE_MAX, LOGIN_RATE_WINDOW_MS } from "../lib/securityConfig.js";
import { createSession, revokeSession, revokeUserSessions } from "../lib/sessions.js";
import { clientIp } from "../lib/sessions.js";
import { clearFailedSignIn, recordFailedSignIn } from "../lib/lockout.js";
import {
  ageFromDob,
  isDisposableEmail,
  isTestTurnstile,
  passwordPolicyError,
  verifyTurnstile,
} from "../lib/security.js";
import { consumeRate } from "../lib/rateBuckets.js";
import { uid } from "../lib/ids.js";
import { publicUser } from "../lib/forum.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { consumeAuthToken, issueAuthToken } from "../lib/tokens.js";
import { publicAppUrl, sendMail } from "../lib/mail.js";
import { audit } from "../lib/audit.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_WINDOW_MS,
  max: LOGIN_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many login attempts. Please try again later." },
});

async function issueSession(
  req: Parameters<typeof createSession>[1],
  res: import("express").Response,
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    displayName: string;
    bio: string;
    avatar: string;
    banned: boolean;
    createdAt: Date;
    dateOfBirth: Date | null;
  },
  stayLoggedIn = true,
) {
  const session = await createSession(user.id, req);
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, sessionId: session.id },
    jwtSecret(),
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
  setAuthCookie(res, token, stayLoggedIn);
  return res.json({ ok: true, user: publicUser(user, { self: true }) });
}

authRouter.post("/register", async (req, res) => {
  const ip = clientIp(req);
  if (!(await consumeRate(`reg:${ip}`, 5, 60 * 60_000))) {
    return res.status(429).json({ ok: false, error: "Too many registration attempts. Try later." });
  }

  const body = req.body as {
    username?: string;
    email?: string;
    password?: string;
    displayName?: string;
    dateOfBirth?: string;
    turnstileToken?: string;
  };

  const username = (body.username || "").trim().toLowerCase();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ ok: false, error: "Username must be 3–20 chars (letters, numbers, underscore)." });
  }
  if (!email.includes("@") || email.length > 120) {
    return res.status(400).json({ ok: false, error: "Enter a valid email." });
  }
  if (isDisposableEmail(email)) {
    return res.status(400).json({ ok: false, error: "That email domain is not allowed." });
  }
  const pwErr = passwordPolicyError(password);
  if (pwErr) return res.status(400).json({ ok: false, error: pwErr });
  if (!body.dateOfBirth) return res.status(400).json({ ok: false, error: "Date of birth is required." });
  if (ageFromDob(body.dateOfBirth) < 18) {
    return res.status(400).json({ ok: false, error: "You must be 18 or older to register." });
  }
  const human = await verifyTurnstile(body.turnstileToken || "", ip);
  if (!human) return res.status(400).json({ ok: false, error: "Please complete the verification check." });

  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (exists) return res.status(409).json({ ok: false, error: "Username or email already registered." });

  const autoVerify = process.env.NODE_ENV !== "production" || isTestTurnstile();
  const user = await prisma.user.create({
    data: {
      id: uid("user"),
      username,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      displayName: body.displayName?.trim() || username,
      bio: "",
      avatar: "",
      role: "user",
      dateOfBirth: new Date(body.dateOfBirth),
      emailVerifiedAt: autoVerify ? new Date() : null,
    },
  });
  if (!autoVerify) {
    const verifyToken = await issueAuthToken(user.id, "verify", 24 * 60 * 60_000);
    await sendMail({
      to: email,
      subject: "Verify your MCW Forum account",
      text: `Verify your email: ${publicAppUrl()}/verify-email?token=${verifyToken}`,
    });
  }
  return issueSession(req, res, user, true);
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const ip = clientIp(req);
  const body = req.body as { usernameOrEmail?: string; password?: string; stayLoggedIn?: boolean; turnstileToken?: string };
  if (!isTestTurnstile()) {
    const human = await verifyTurnstile(body.turnstileToken || "", ip);
    if (!human) return res.status(400).json({ ok: false, error: "Please complete the verification check." });
  }
  const key = (body.usernameOrEmail || "").trim().toLowerCase();
  const password = body.password || "";
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: key }, { email: key }] },
  });
  const good = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !good) {
    if (user) {
      const result = await recordFailedSignIn(user);
      if (result.lockedUntil) {
        return res.status(429).json({
          ok: false,
          error: `Too many failed logins. Try again in ${LOCKOUT_MINUTES} minutes.`,
        });
      }
    }
    return res.status(401).json({ ok: false, error: "Invalid username/email or password." });
  }
  if (user.banned) {
    return res.status(403).json({ ok: false, error: "This account has been removed by a moderator." });
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return res.status(403).json({ ok: false, error: "Account is temporarily locked." });
  }
  await clearFailedSignIn(user.id);
  return issueSession(req, res, user, body.stayLoggedIn !== false);
});

authRouter.post("/logout", optionalAuth, async (req, res) => {
  if (req.user?.sessionId) await revokeSession(req.user.sessionId);
  clearAuthCookie(res);
  return res.json({ ok: true });
});

authRouter.post("/password", requireAuth, async (req, res) => {
  const body = req.body as { currentPassword?: string; newPassword?: string };
  const pwErr = passwordPolicyError(body.newPassword || "");
  if (pwErr) return res.status(400).json({ ok: false, error: pwErr });
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(401).json({ ok: false, error: "Please log in." });
  const ok = await bcrypt.compare(body.currentPassword || "", user.passwordHash);
  if (!ok) return res.status(400).json({ ok: false, error: "Current password is incorrect." });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(body.newPassword!, 12) },
  });
  await revokeUserSessions(user.id);
  return issueSession(req, res, user, true);
});

authRouter.post("/forgot", async (req, res) => {
  const ip = clientIp(req);
  if (!(await consumeRate(`forgot:${ip}`, 5, 60 * 60_000))) {
    return res.status(429).json({ ok: false, error: "Too many reset requests." });
  }
  const email = String((req.body as { email?: string }).email || "").trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  let devResetUrl: string | undefined;
  if (user && !user.banned) {
    const token = await issueAuthToken(user.id, "reset", 60 * 60_000);
    const url = `${publicAppUrl()}/reset?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "Reset your MCW Forum password",
      text: `Reset your password: ${url}\nThis link expires in 1 hour.`,
    });
    if (process.env.NODE_ENV !== "production") devResetUrl = url;
  }
  return res.json({
    ok: true,
    message: "If that email is registered, a reset link was sent.",
    ...(devResetUrl ? { devResetUrl } : {}),
  });
});

authRouter.post("/reset", async (req, res) => {
  const body = req.body as { token?: string; password?: string };
  const pwErr = passwordPolicyError(body.password || "");
  if (pwErr) return res.status(400).json({ ok: false, error: pwErr });
  const row = await consumeAuthToken(body.token || "", "reset");
  if (!row) return res.status(400).json({ ok: false, error: "Reset link is invalid or expired." });
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) return res.status(400).json({ ok: false, error: "Reset link is invalid or expired." });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(body.password!, 12), failedLoginAttempts: 0, lockedUntil: null },
  });
  await revokeUserSessions(user.id);
  return issueSession(req, res, user, true);
});

authRouter.post("/verify-email", async (req, res) => {
  const token = String((req.body as { token?: string }).token || "");
  const row = await consumeAuthToken(token, "verify");
  if (!row) return res.status(400).json({ ok: false, error: "Verification link is invalid or expired." });
  await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
  return res.json({ ok: true });
});

authRouter.delete("/account", requireAuth, async (req, res) => {
  const password = String((req.body as { password?: string }).password || "");
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(401).json({ ok: false, error: "Please log in." });
  if (user.role === "admin") return res.status(400).json({ ok: false, error: "Admins cannot self-delete. Transfer ownership first." });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ ok: false, error: "Password is incorrect." });
  await audit(req, "user.delete", "user", user.id, { username: user.username });
  await prisma.user.delete({ where: { id: user.id } });
  clearAuthCookie(res);
  return res.json({ ok: true });
});
