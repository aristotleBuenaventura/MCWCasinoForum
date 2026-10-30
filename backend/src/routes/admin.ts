import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { uid } from "../lib/ids.js";
import { slugify } from "../lib/security.js";
import { seedForum } from "../../prisma/seed.js";
import { clearAuthCookie } from "../lib/cookies.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import type { Role } from "../../../src/types.ts";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.post("/users/:id/role", async (req, res) => {
  const role = (req.body as { role?: Role }).role;
  if (!role || !["user", "moderator", "admin"].includes(role)) {
    return res.status(400).json({ ok: false, error: "Invalid role." });
  }
  await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  res.json({ ok: true });
});

adminRouter.post("/reset", async (_req, res) => {
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
  const kids = await prisma.category.count({ where: { parentId: req.params.id } });
  if (kids) return res.status(400).json({ ok: false, error: "Remove nested communities first." });
  const threads = await prisma.thread.count({ where: { forumId: req.params.id } });
  if (threads) return res.status(400).json({ ok: false, error: "This community still has threads." });
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

adminRouter.post("/categories/:id/featured", async (req, res) => {
  const cat = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!cat) return res.status(404).json({ ok: false, error: "Not found." });
  await prisma.category.update({ where: { id: cat.id }, data: { featured: !cat.featured } });
  res.json({ ok: true });
});

adminRouter.post("/ads", async (req, res) => {
  const body = req.body as { id?: string; slot: string; imageUrl: string; url: string; title: string; order: number };
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
  await prisma.ad.delete({ where: { id: req.params.id } });
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
  await prisma.trendingGame.delete({ where: { id: req.params.id } });
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
  await prisma.provider.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
