import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { loadState, notify } from "../lib/forum.js";
import { uid } from "../lib/ids.js";
import { assertCanPost, rateLimit } from "../lib/security.js";
import { optionalAuth, requireAuth, requireStaff } from "../middleware/auth.js";
import type { PostBody } from "../../../src/types.ts";

export const forumRouter = Router();

function isTextEmpty(body: PostBody | undefined) {
  if (!Array.isArray(body) || body.length === 0) return true;
  const text = body
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const images = body.filter((b) => b.type === "image" && b.url).length;
  return !text && images === 0;
}

function textFromBody(body: PostBody) {
  return body
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

function firstImage(body: PostBody) {
  return body.find((b) => b.type === "image")?.url ?? null;
}

async function viewerRow(userId?: string) {
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

forumRouter.get("/state", optionalAuth, async (req, res) => {
  const me = await viewerRow(req.user?.userId);
  const state = await loadState(me);
  res.json({ ok: true, state });
});

forumRouter.patch("/me", requireAuth, async (req, res) => {
  const body = req.body as { displayName?: string; bio?: string; avatar?: string };
  await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
    },
  });
  res.json({ ok: true });
});

forumRouter.post("/threads", requireAuth, async (req, res) => {
  const me = await viewerRow(req.user!.userId);
  if (!me) return res.status(401).json({ ok: false, error: "Please log in to create a thread." });
  if (!rateLimit(`thread:${me.id}`, 8, 10 * 60_000)) {
    return res.status(429).json({ ok: false, error: "You are posting too fast." });
  }
  const body = req.body as { forumId?: string; title?: string; body?: PostBody };
  const title = (body.title || "").trim();
  const postBody = body.body || [];
  if (!title) return res.status(400).json({ ok: false, error: "Title is required." });
  if (title.length > 180) return res.status(400).json({ ok: false, error: "Title is too long." });
  if (isTextEmpty(postBody)) return res.status(400).json({ ok: false, error: "Write something or insert an image." });
  const content = textFromBody(postBody);
  const flood = assertCanPost(me.id, me.createdAt, title, content);
  if (flood) return res.status(429).json({ ok: false, error: flood });
  const forum = await prisma.category.findUnique({ where: { id: body.forumId || "" } });
  if (!forum) return res.status(400).json({ ok: false, error: "Choose a community." });
  const id = uid("thread");
  const mediaUrl = firstImage(postBody);
  await prisma.thread.create({
    data: {
      id,
      forumId: forum.id,
      authorId: me.id,
      title,
      content,
      body: postBody,
      mediaUrl,
      mediaType: mediaUrl ? "image" : null,
      tags: [],
    },
  });
  const state = await loadState(me);
  res.json({ ok: true, thread: state.threads.find((t) => t.id === id), state });
});

forumRouter.patch("/threads/:id", requireAuth, async (req, res) => {
  const me = req.user!;
  const thread = await prisma.thread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  if (thread.authorId !== me.userId && me.role === "user") {
    return res.status(403).json({ ok: false, error: "Not allowed." });
  }
  const body = req.body as { title?: string; content?: string; body?: PostBody; mediaUrl?: string | null; mediaType?: string | null };
  const nextBody = body.body;
  const content = nextBody ? textFromBody(nextBody) : body.content;
  const mediaUrl = nextBody ? firstImage(nextBody) : body.mediaUrl;
  await prisma.thread.update({
    where: { id: thread.id },
    data: {
      ...(body.title ? { title: body.title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(nextBody ? { body: nextBody } : {}),
      ...(mediaUrl !== undefined ? { mediaUrl, mediaType: mediaUrl ? "image" : body.mediaType ?? null } : {}),
    },
  });
  res.json({ ok: true });
});

forumRouter.delete("/threads/:id", requireAuth, async (req, res) => {
  const me = req.user!;
  const thread = await prisma.thread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  const can = thread.authorId === me.userId || me.role === "moderator" || me.role === "admin";
  if (!can) return res.status(403).json({ ok: false, error: "Not allowed." });
  await prisma.like.deleteMany({
    where: {
      OR: [
        { targetType: "thread", targetId: thread.id },
        { targetType: "comment", targetId: { in: (await prisma.comment.findMany({ where: { threadId: thread.id }, select: { id: true } })).map((c) => c.id) } },
      ],
    },
  });
  await prisma.thread.delete({ where: { id: thread.id } });
  if (me.role !== "user" && thread.authorId !== me.userId) {
    await notify({
      userId: thread.authorId,
      actorId: me.userId,
      type: "mod",
      message: `Your thread "${thread.title}" was removed by a moderator.`,
      link: "/",
    });
  }
  await prisma.report.updateMany({
    where: { targetType: "thread", targetId: thread.id },
    data: { status: "resolved" },
  });
  res.json({ ok: true });
});

forumRouter.post("/threads/:id/pin", requireAuth, requireStaff, async (req, res) => {
  const thread = await prisma.thread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  await prisma.thread.update({ where: { id: thread.id }, data: { pinned: !thread.pinned } });
  res.json({ ok: true });
});

forumRouter.post("/threads/:id/view", async (req, res) => {
  await prisma.thread.updateMany({
    where: { id: req.params.id },
    data: { views: { increment: 1 } },
  });
  res.json({ ok: true });
});

forumRouter.post("/comments", requireAuth, async (req, res) => {
  const me = await viewerRow(req.user!.userId);
  if (!me) return res.status(401).json({ ok: false, error: "Please log in to comment." });
  if (!rateLimit(`comment:${me.id}`, 20, 10 * 60_000)) {
    return res.status(429).json({ ok: false, error: "You are posting too fast." });
  }
  const body = req.body as { threadId?: string; parentId?: string | null; body?: PostBody };
  const postBody = body.body || [];
  if (isTextEmpty(postBody)) return res.status(400).json({ ok: false, error: "Write something or insert an image." });
  const content = textFromBody(postBody);
  const flood = assertCanPost(me.id, me.createdAt, body.threadId || "", content);
  if (flood) return res.status(429).json({ ok: false, error: flood });
  const thread = await prisma.thread.findUnique({ where: { id: body.threadId || "" } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  const id = uid("comment");
  await prisma.comment.create({
    data: {
      id,
      threadId: thread.id,
      authorId: me.id,
      parentId: body.parentId || null,
      content,
      body: postBody,
    },
  });
  await notify({
    userId: thread.authorId,
    actorId: me.id,
    type: "reply",
    message: `${me.username} replied to your thread`,
    link: `/thread/${thread.id}`,
  });
  if (body.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: body.parentId } });
    if (parent) {
      await notify({
        userId: parent.authorId,
        actorId: me.id,
        type: "reply",
        message: `${me.username} replied to your comment`,
        link: `/thread/${thread.id}`,
      });
    }
  }
  const state = await loadState(me);
  res.json({ ok: true, comment: state.comments.find((x) => x.id === id), state });
});

forumRouter.delete("/comments/:id", requireAuth, async (req, res) => {
  const me = req.user!;
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!comment) return res.status(404).json({ ok: false, error: "Comment not found." });
  if (comment.authorId !== me.userId && me.role === "user") {
    return res.status(403).json({ ok: false, error: "Not allowed." });
  }
  await prisma.like.deleteMany({ where: { targetType: "comment", targetId: comment.id } });
  await prisma.comment.deleteMany({ where: { OR: [{ id: comment.id }, { parentId: comment.id }] } });
  await prisma.report.updateMany({
    where: { targetType: "comment", targetId: comment.id },
    data: { status: "resolved" },
  });
  res.json({ ok: true });
});

forumRouter.post("/likes", requireAuth, async (req, res) => {
  const me = req.user!;
  const body = req.body as { targetType?: "thread" | "comment"; targetId?: string };
  if (!body.targetType || !body.targetId) return res.status(400).json({ ok: false, error: "Invalid like." });
  const existing = await prisma.like.findFirst({
    where: { userId: me.userId, targetType: body.targetType, targetId: body.targetId },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return res.json({ ok: true });
  }
  await prisma.like.create({
    data: { id: uid("like"), userId: me.userId, targetType: body.targetType, targetId: body.targetId },
  });
  if (body.targetType === "thread") {
    const t = await prisma.thread.findUnique({ where: { id: body.targetId } });
    if (t) {
      await notify({
        userId: t.authorId,
        actorId: me.userId,
        type: "like",
        message: `${me.username} liked your thread`,
        link: `/thread/${body.targetId}`,
      });
    }
  } else {
    const cm = await prisma.comment.findUnique({ where: { id: body.targetId } });
    if (cm) {
      await notify({
        userId: cm.authorId,
        actorId: me.userId,
        type: "like",
        message: `${me.username} liked your comment`,
        link: `/thread/${cm.threadId}`,
      });
    }
  }
  res.json({ ok: true });
});

forumRouter.post("/follows", requireAuth, async (req, res) => {
  const me = req.user!;
  const userId = (req.body as { userId?: string }).userId || "";
  if (!userId || userId === me.userId) return res.status(400).json({ ok: false, error: "Invalid follow." });
  const existing = await prisma.follow.findFirst({
    where: { followerId: me.userId, followingId: userId },
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return res.json({ ok: true });
  }
  await prisma.follow.create({
    data: { id: uid("follow"), followerId: me.userId, followingId: userId },
  });
  await notify({
    userId,
    actorId: me.userId,
    type: "follow",
    message: `${me.username} started following you`,
    link: `/profile/${me.username}`,
  });
  res.json({ ok: true });
});

forumRouter.post("/reports", requireAuth, async (req, res) => {
  const me = req.user!;
  if (!rateLimit(`report:${me.userId}`, 10, 60 * 60_000)) {
    return res.status(429).json({ ok: false, error: "Too many reports." });
  }
  const body = req.body as { targetType?: "thread" | "comment" | "user"; targetId?: string; reason?: string };
  if (!body.targetType || !body.targetId) return res.status(400).json({ ok: false, error: "Invalid report." });
  await prisma.report.create({
    data: {
      id: uid("report"),
      reporterId: me.userId,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason?.trim() || "No reason provided",
    },
  });
  res.json({ ok: true });
});

forumRouter.post("/notifications/read", requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.userId },
    data: { read: true },
  });
  res.json({ ok: true });
});

forumRouter.post("/mod/reports/:id/resolve", requireAuth, requireStaff, async (req, res) => {
  await prisma.report.update({
    where: { id: req.params.id },
    data: { status: "resolved" },
  });
  res.json({ ok: true });
});

forumRouter.post("/mod/users/:id/ban", requireAuth, requireStaff, async (req, res) => {
  const me = req.user!;
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ ok: false, error: "User not found." });
  if (target.role !== "user" && me.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Only an admin can moderate staff." });
  }
  if (target.role === "admin") return res.status(403).json({ ok: false, error: "Cannot ban an admin." });
  const banned = (req.body as { banned?: boolean }).banned !== false;
  await prisma.user.update({ where: { id: target.id }, data: { banned } });
  if (banned) {
    await prisma.userSession.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.json({ ok: true });
});
