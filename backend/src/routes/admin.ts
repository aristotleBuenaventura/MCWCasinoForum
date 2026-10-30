import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { uid } from "../lib/ids.js";
import { slugify } from "../lib/security.js";
import { seedForum } from "../../prisma/seed.js";
import { clearAuthCookie } from "../lib/cookies.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { mapReport, publicUser } from "../lib/serialize.js";
import { loadDisabledNameplate, nameplateCatalog, saveDisabledNameplate } from "../lib/nameplateAccess.js";
import {
  MEMBERSHIPS,
  NAME_EMBLEMS,
  NAME_FRAMES,
  parseMembership,
  parseNameEmblem,
  parseNameFrame,
  parseUnlocks,
  withGrantedUnlock,
} from "../../../src/lib/nameplate.ts";
import { AD_SLOTS, type AdSlot, type Role } from "../../../src/types.ts";

export const adminRouter = Router();

function routeId(req: { params: { id?: string | string[] } }) {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] || "" : value || "";
}

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/stats", async (_req, res) => {
  const [users, threads, comments, reports, openReports] = await Promise.all([
    prisma.user.count(),
    prisma.thread.count(),
    prisma.comment.count(),
    prisma.report.count(),
    prisma.report.count({ where: { status: "open" } }),
  ]);
  res.json({ ok: true, stats: { users, threads, comments, reports, openReports } });
});

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, take: 200 });
  res.json({
    ok: true,
    users: users.map((u) => ({ ...publicUser(u, { self: true }), banned: u.banned, role: u.role })),
  });
});

adminRouter.get("/reports", async (_req, res) => {
  const reports = await prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ ok: true, reports: reports.map(mapReport) });
});

adminRouter.get("/threads", async (req, res) => {
  const threads = await prisma.thread.findMany({
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit) > 0 ? Math.min(100, Number(req.query.limit)) : 50,
    select: { id: true, title: true, pinned: true, createdAt: true, authorId: true, forumId: true },
  });
  res.json({ ok: true, threads });
});

adminRouter.get("/audit", async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ ok: true, logs });
});

adminRouter.post("/users/:id/role", async (req, res) => {
  const role = (req.body as { role?: Role }).role;
  if (!role || !["user", "moderator", "admin"].includes(role)) {
    return res.status(400).json({ ok: false, error: "Invalid role." });
  }
  await prisma.user.update({ where: { id: routeId(req) }, data: { role } });
  await audit(req, "user.role", "user", routeId(req), { role });
  res.json({ ok: true });
});

adminRouter.get("/nameplate", async (_req, res) => {
  const disabled = await loadDisabledNameplate();
  res.json({
    ok: true,
    disabled,
    frames: NAME_FRAMES,
    emblems: NAME_EMBLEMS,
    memberships: MEMBERSHIPS,
  });
});

adminRouter.post("/nameplate", async (req, res) => {
  const body = req.body as { disabledFrames?: unknown; disabledEmblems?: unknown };
  const frames = Array.isArray(body.disabledFrames) ? body.disabledFrames.map(String) : [];
  const emblems = Array.isArray(body.disabledEmblems) ? body.disabledEmblems.map(String) : [];
  await saveDisabledNameplate(frames, emblems);
  await audit(req, "nameplate.disabled", "setting", "nameplate", { frames, emblems });
  res.json({ ok: true, disabled: await loadDisabledNameplate() });
});

adminRouter.post("/users/:id/nameplate", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: routeId(req) } });
  if (!user) return res.status(404).json({ ok: false, error: "User not found." });
  const body = req.body as {
    membership?: unknown;
    frame?: unknown;
    emblem?: unknown;
    unlockFrames?: unknown;
    unlockEmblems?: unknown;
  };
  const membership = body.membership !== undefined ? parseMembership(body.membership) : parseMembership(user.membership);
  let extra = parseUnlocks(user.nameUnlocks);
  if (Array.isArray(body.unlockFrames) || Array.isArray(body.unlockEmblems)) {
    extra = parseUnlocks({
      frames: Array.isArray(body.unlockFrames) ? body.unlockFrames : extra.frames,
      emblems: Array.isArray(body.unlockEmblems) ? body.unlockEmblems : extra.emblems,
    });
  }
  const frame = body.frame !== undefined ? parseNameFrame(body.frame) : parseNameFrame(user.nameFrame);
  const emblem = body.emblem !== undefined ? parseNameEmblem(body.emblem) : parseNameEmblem(user.nameEmblem);
  extra = withGrantedUnlock(extra, frame, emblem);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      membership,
      nameFrame: frame,
      nameEmblem: emblem,
      nameUnlocks: extra,
    },
  });
  await audit(req, "user.nameplate", "user", user.id, { membership, frame, emblem });
  const disabled = await loadDisabledNameplate();
  res.json({
    ok: true,
    user: publicUser({ ...user, membership, nameFrame: frame, nameEmblem: emblem, nameUnlocks: extra }, { self: true }),
    catalog: nameplateCatalog({
      role: user.role,
      membership,
      extra,
      frame,
      emblem,
      disabled,
    }),
  });
});

adminRouter.post("/reset", async (req, res) => {
  if (process.env.ALLOW_DEMO_RESET !== "true") {
    return res.status(403).json({ ok: false, error: "Demo reset is disabled." });
  }
  await audit(req, "forum.reset", "forum", "all");
  await seedForum();
  clearAuthCookie(res);
  res.json({ ok: true });
});

adminRouter.post("/categories", async (req, res) => {
  const body = req.body as {
    id?: string;
    slug?: string;
    name?: string;
    description?: string;
    parentId?: string | null;
    featured?: boolean;
    order?: number;
  };
  const slug = slugify(body.slug || body.name || "");
  if (!slug) return res.status(400).json({ ok: false, error: "Slug is required." });
  const clash = await prisma.category.findFirst({
    where: { slug, ...(body.id ? { NOT: { id: body.id } } : {}) },
  });
  if (clash) return res.status(409).json({ ok: false, error: "That slug is already used." });
  if (body.id) {
    await prisma.category.update({
      where: { id: body.id },
      data: {
        slug,
        name: body.name || "",
        description: body.description || "",
        parentId: body.parentId || null,
        featured: !!body.featured,
        sortOrder: body.order || 0,
      },
    });
  } else {
    await prisma.category.create({
      data: {
        id: uid("cat"),
        slug,
        name: body.name?.trim() || slug,
        description: body.description?.trim() || "",
        parentId: body.parentId || null,
        featured: !!body.featured,
        sortOrder: body.order || 0,
      },
    });
  }
  res.json({ ok: true });
});

adminRouter.delete("/categories/:id", async (req, res) => {
  const kids = await prisma.category.count({ where: { parentId: routeId(req) } });
  if (kids) return res.status(400).json({ ok: false, error: "Remove nested communities first." });
  const threads = await prisma.thread.count({ where: { forumId: routeId(req) } });
  if (threads) return res.status(400).json({ ok: false, error: "This community still has threads." });
  await prisma.category.delete({ where: { id: routeId(req) } });
  res.json({ ok: true });
});

adminRouter.post("/categories/:id/featured", async (req, res) => {
  const cat = await prisma.category.findUnique({ where: { id: routeId(req) } });
  if (!cat) return res.status(404).json({ ok: false, error: "Not found." });
  await prisma.category.update({ where: { id: cat.id }, data: { featured: !cat.featured } });
  res.json({ ok: true });
});

adminRouter.post("/ads", async (req, res) => {
  const body = req.body as { id?: string; slot: string; imageUrl: string; url: string; title: string; order: number };
  if (!AD_SLOTS.includes(body.slot as AdSlot)) {
    return res.status(400).json({ ok: false, error: "Invalid ad slot." });
  }
  if (body.id) {
    await prisma.ad.update({
      where: { id: body.id },
      data: {
        slot: body.slot,
        imageUrl: body.imageUrl || "",
        url: body.url || "",
        title: body.title || "",
        sortOrder: body.order || 0,
      },
    });
  } else {
    await prisma.ad.create({
      data: {
        id: uid("ad"),
        slot: body.slot,
        imageUrl: body.imageUrl || "",
        url: body.url || "",
        title: body.title || "",
        sortOrder: body.order || 0,
      },
    });
  }
  res.json({ ok: true });
});

adminRouter.delete("/ads/:id", async (req, res) => {
  await prisma.ad.delete({ where: { id: routeId(req) } });
  res.json({ ok: true });
});

adminRouter.post("/settings/ads-rotate", async (req, res) => {
  const sec = Math.max(2, Math.min(60, Math.round(Number((req.body as { sec?: number }).sec) || 5)));
  await prisma.setting.upsert({
    where: { key: "ad_rotate_sec" },
    create: { key: "ad_rotate_sec", value: String(sec) },
    update: { value: String(sec) },
  });
  res.json({ ok: true });
});

adminRouter.post("/games", async (req, res) => {
  const body = req.body as { id?: string; title: string; subtitle: string; imageUrl: string; url: string; order: number };
  if (body.id) {
    await prisma.trendingGame.update({
      where: { id: body.id },
      data: {
        title: body.title,
        subtitle: body.subtitle || "",
        imageUrl: body.imageUrl || "",
        url: body.url || "",
        sortOrder: body.order || 0,
      },
    });
  } else {
    await prisma.trendingGame.create({
      data: {
        id: uid("tg"),
        title: body.title,
        subtitle: body.subtitle || "",
        imageUrl: body.imageUrl || "",
        url: body.url || "",
        sortOrder: body.order || 0,
      },
    });
  }
  res.json({ ok: true });
});

adminRouter.delete("/games/:id", async (req, res) => {
  await prisma.trendingGame.delete({ where: { id: routeId(req) } });
  res.json({ ok: true });
});

adminRouter.post("/providers", async (req, res) => {
  const body = req.body as { id?: string; name: string; imageUrl: string; url: string; rating: number; order: number };
  if (body.id) {
    await prisma.provider.update({
      where: { id: body.id },
      data: {
        name: body.name,
        imageUrl: body.imageUrl || "",
        url: body.url || "",
        rating: body.rating || 0,
        sortOrder: body.order || 0,
      },
    });
  } else {
    await prisma.provider.create({
      data: {
        id: uid("prov"),
        name: body.name,
        imageUrl: body.imageUrl || "",
        url: body.url || "",
        rating: body.rating || 0,
        sortOrder: body.order || 0,
      },
    });
  }
  res.json({ ok: true });
});

adminRouter.delete("/providers/:id", async (req, res) => {
  await prisma.provider.delete({ where: { id: routeId(req) } });
  res.json({ ok: true });
});
