import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { clearAuthCookie, setAuthCookie } from "../lib/cookies.js";
import { JWT_EXPIRES_IN, jwtSecret, LOCKOUT_MINUTES, LOGIN_RATE_MAX, LOGIN_RATE_WINDOW_MS } from "../lib/securityConfig.js";
import { createSession, revokeSession } from "../lib/sessions.js";
import { clientIp } from "../lib/sessions.js";
import { clearFailedSignIn, recordFailedSignIn } from "../lib/lockout.js";
import { ageFromDob, isDisposableEmail, rateLimit as hitLimit, verifyTurnstile } from "../lib/security.js";
import { uid } from "../lib/ids.js";
import { publicUser } from "../lib/forum.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

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
  user: { id: string; email: string; username: string; role: string; displayName: string; bio: string; avatar: string; banned: boolean; createdAt: Date; dateOfBirth: Date | null },
  stayLoggedIn = true,
) {
  const session = await createSession(user.id, req);
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, sessionId: session.id },
    jwtSecret(),
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
  setAuthCookie(res, token, stayLoggedIn);
  return res.json({ ok: true, user: publicUser(user, true) });
}

authRouter.post("/register", async (req, res) => {
  const ip = clientIp(req);
  if (!hitLimit(`reg:${ip}`, 5, 60 * 60_000)) {
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
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: "Password must be at least 8 characters." });
  }
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

  const user = await prisma.user.create({
    data: {
      id: uid("user"),
      username,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      displayName: body.displayName?.trim() || username,
      bio: "",
      avatar: "",
      role: "user",
      dateOfBirth: new Date(body.dateOfBirth),
    },
  });
  return issueSession(req, res, user, true);
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const body = req.body as { usernameOrEmail?: string; password?: string; stayLoggedIn?: boolean };
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

authRouter.patch("/me", requireAuth, async (req, res) => {
  const body = req.body as { displayName?: string; bio?: string; avatar?: string };
  await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      displayName: body.displayName,
      bio: body.bio,
      avatar: body.avatar,
    },
  });
  return res.json({ ok: true });
});
