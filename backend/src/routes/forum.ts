import { Router } from "express";
import type { PostBody } from "../../../src/types.ts";
import { prisma } from "../lib/prisma.js";
import { uid } from "../lib/ids.js";
import {
  authorsByIds,
  decorateThreads,
  firstImage,
  isTextEmpty,
  mentionUsers,
  notify,
  textFromBody,
  threadStats,
} from "../lib/forum.js";
import { mapComment, mapThread, parseLimit, parsePage, publicUser } from "../lib/serialize.js";
import { assertCanPost, rateLimit } from "../lib/security.js";
import { consumeRate } from "../lib/rateBuckets.js";
import { optionalAuth, requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";

export const forumRouter = Router();

function routeId(req: { params: { id?: string | string[] } }) {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function viewerRow(userId?: string) {
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

forumRouter.patch("/me", requireAuth, async (req, res) => {
  const body = req.body as { displayName?: string; bio?: string; avatar?: string };
  const displayName = body.displayName?.trim().slice(0, 80);
  const bio = body.bio?.slice(0, 2000);
  const avatar = body.avatar?.startsWith("/uploads/") || body.avatar?.startsWith("http") ? body.avatar : undefined;
  await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
    },
  });
  res.json({ ok: true });
});

forumRouter.patch("/me/nameplate", requireAuth, async (_req, res) => {
  return res.status(403).json({ ok: false, error: "Nameplates are assigned by staff." });
});

forumRouter.post("/threads", requireAuth, async (req, res) => {
  const me = await viewerRow(req.user!.userId);
  if (!me) return res.status(401).json({ ok: false, error: "Please log in to create a thread." });
  if (!(await consumeRate(`thread:${me.id}`, 8, 10 * 60_000))) {
    return res.status(429).json({ ok: false, error: "You are posting too fast." });
  }
  const body = req.body as { forumId?: string; title?: string; body?: PostBody; tags?: string[] };
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
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).trim().slice(0, 24)).filter(Boolean).slice(0, 6)
    : [];
  const id = uid("thread");
  const mediaUrl = firstImage(postBody);
  const thread = await prisma.thread.create({
    data: {
      id,
      forumId: forum.id,
      authorId: me.id,
      title,
      content,
      body: postBody,
      mediaUrl,
      mediaType: mediaUrl ? "image" : null,
      tags,
    },
  });
  await mentionUsers(`${title}\n${content}`, me.id, me.username, `/thread/${id}`);
  const stats = await threadStats([id], me.id);
  const authors = await authorsByIds([me.id]);
  res.json({ ok: true, thread: decorateThreads([thread], stats, authors)[0] });
});

forumRouter.get("/threads/:id", optionalAuth, async (req, res) => {
  const thread = await prisma.thread.findUnique({ where: { id: routeId(req) } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  const [forum, stats, authors, history] = await Promise.all([
    prisma.category.findUnique({ where: { id: thread.forumId } }),
    threadStats([thread.id], req.user?.userId),
    authorsByIds([thread.authorId]),
    prisma.threadRevision.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, editorId: true, title: true, createdAt: true },
    }),
  ]);
  if (req.user) {
    await prisma.threadRead.upsert({
      where: { userId_threadId: { userId: req.user.userId, threadId: thread.id } },
      create: { userId: req.user.userId, threadId: thread.id, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }
  res.json({
    ok: true,
    thread: decorateThreads([thread], stats, authors)[0],
    forum: forum ? { id: forum.id, slug: forum.slug, name: forum.name } : null,
    history,
  });
});

forumRouter.get("/threads/:id/comments", optionalAuth, async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 20, 50);
  const threadId = routeId(req);
  const thread = await prisma.thread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  const [total, comments] = await Promise.all([
    prisma.comment.count({ where: { threadId } }),
    prisma.comment.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  const authors = await authorsByIds(comments.map((c) => c.authorId));
  const likeGroups = comments.length
    ? await prisma.like.groupBy({
        by: ["targetId"],
        where: { targetType: "comment", targetId: { in: comments.map((c) => c.id) } },
        _count: { _all: true },
      })
    : [];
  const liked = req.user
    ? await prisma.like.findMany({
        where: { userId: req.user.userId, targetType: "comment", targetId: { in: comments.map((c) => c.id) } },
        select: { targetId: true },
      })
    : [];
  const likeMap = new Map(likeGroups.map((g) => [g.targetId, g._count._all]));
  const likedSet = new Set(liked.map((l) => l.targetId));
  res.json({
    ok: true,
    page,
    limit,
    total,
    comments: comments.map((c) => ({
      ...mapComment(c),
      author: authors.get(c.authorId) || null,
      likeCount: likeMap.get(c.id) || 0,
      liked: likedSet.has(c.id),
    })),
  });
});

forumRouter.patch("/threads/:id", requireAuth, async (req, res) => {
  const me = req.user!;
  const thread = await prisma.thread.findUnique({ where: { id: routeId(req) } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  if (thread.authorId !== me.userId && me.role === "user") {
    return res.status(403).json({ ok: false, error: "Not allowed." });
  }
  const body = req.body as { title?: string; content?: string; body?: PostBody; mediaUrl?: string | null; mediaType?: string | null; tags?: string[] };
  const nextBody = body.body;
  const content = nextBody ? textFromBody(nextBody) : body.content;
  const mediaUrl = nextBody ? firstImage(nextBody) : body.mediaUrl;
  await prisma.threadRevision.create({
    data: {
      id: uid("rev"),
      threadId: thread.id,
      editorId: me.userId,
      title: thread.title,
      content: thread.content,
    },
  });
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).trim().slice(0, 24)).filter(Boolean).slice(0, 6)
    : undefined;
  const updated = await prisma.thread.update({
    where: { id: thread.id },
    data: {
      ...(body.title ? { title: body.title.trim().slice(0, 180) } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(nextBody ? { body: nextBody } : {}),
      ...(mediaUrl !== undefined ? { mediaUrl, mediaType: mediaUrl ? "image" : body.mediaType ?? null } : {}),
      ...(tags ? { tags } : {}),
    },
  });
  if (me.role !== "user") await audit(req, "thread.edit", "thread", thread.id);
  res.json({ ok: true, thread: mapThread(updated) });
});

forumRouter.delete("/threads/:id", requireAuth, async (req, res) => {
  const me = req.user!;
  const thread = await prisma.thread.findUnique({ where: { id: routeId(req) } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  const can = thread.authorId === me.userId || me.role === "moderator" || me.role === "admin";
  if (!can) return res.status(403).json({ ok: false, error: "Not allowed." });
  const commentIds = (await prisma.comment.findMany({ where: { threadId: thread.id }, select: { id: true } })).map((c) => c.id);
  await prisma.like.deleteMany({
    where: {
      OR: [
        { targetType: "thread", targetId: thread.id },
        { targetType: "comment", targetId: { in: commentIds } },
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
    await audit(req, "thread.delete", "thread", thread.id, { title: thread.title });
  }
  await prisma.report.updateMany({
    where: { targetType: "thread", targetId: thread.id },
    data: { status: "resolved" },
  });
  res.json({ ok: true });
});

forumRouter.post("/threads/:id/pin", requireAuth, requireStaff, async (req, res) => {
  const thread = await prisma.thread.findUnique({ where: { id: routeId(req) } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  await prisma.thread.update({ where: { id: thread.id }, data: { pinned: !thread.pinned } });
  await audit(req, "thread.pin", "thread", thread.id, { pinned: !thread.pinned });
  res.json({ ok: true });
});

forumRouter.post("/threads/:id/view", async (req, res) => {
  if (!(await consumeRate(`view:${routeId(req)}:${req.ip || "x"}`, 1, 60_000))) {
    return res.json({ ok: true });
  }
  await prisma.thread.updateMany({
    where: { id: routeId(req) },
    data: { views: { increment: 1 } },
  });
  res.json({ ok: true });
});

forumRouter.post("/threads/:id/bookmark", requireAuth, async (req, res) => {
  const thread = await prisma.thread.findUnique({ where: { id: routeId(req) }, select: { id: true } });
  if (!thread) return res.status(404).json({ ok: false, error: "Thread not found." });
  const existing = await prisma.bookmark.findFirst({
    where: { userId: req.user!.userId, threadId: thread.id },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return res.json({ ok: true, bookmarked: false });
  }
  await prisma.bookmark.create({
    data: { id: uid("bm"), userId: req.user!.userId, threadId: thread.id },
  });
  res.json({ ok: true, bookmarked: true });
});

forumRouter.post("/comments", requireAuth, async (req, res) => {
  const me = await viewerRow(req.user!.userId);
  if (!me) return res.status(401).json({ ok: false, error: "Please log in to comment." });
  if (!(await consumeRate(`comment:${me.id}`, 20, 10 * 60_000))) {
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
  if (body.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: body.parentId } });
    if (!parent || parent.threadId !== thread.id) {
      return res.status(400).json({ ok: false, error: "Invalid reply target." });
    }
  }
  const id = uid("comment");
  const comment = await prisma.comment.create({
    data: {
      id,
      threadId: thread.id,
      authorId: me.id,
      parentId: body.parentId || null,
      content,
      body: postBody,
    },
  });
  await prisma.thread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
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
  await mentionUsers(content, me.id, me.username, `/thread/${thread.id}`);
  res.json({ ok: true, comment: { ...mapComment(comment), author: publicUser(me) } });
});

forumRouter.delete("/comments/:id", requireAuth, async (req, res) => {
  const me = req.user!;
  const comment = await prisma.comment.findUnique({ where: { id: routeId(req) } });
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
  if (me.role !== "user") await audit(req, "comment.delete", "comment", comment.id);
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
    return res.json({ ok: true, liked: false });
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
  res.json({ ok: true, liked: true });
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
    return res.json({ ok: true, following: false });
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
  res.json({ ok: true, following: true });
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
      reason: (body.reason?.trim() || "No reason provided").slice(0, 500),
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
    where: { id: routeId(req) },
    data: { status: "resolved" },
  });
  await audit(req, "report.resolve", "report", routeId(req));
  res.json({ ok: true });
});

forumRouter.post("/mod/users/:id/ban", requireAuth, requireStaff, async (req, res) => {
  const me = req.user!;
  const target = await prisma.user.findUnique({ where: { id: routeId(req) } });
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
  await audit(req, banned ? "user.ban" : "user.unban", "user", target.id);
  res.json({ ok: true });
});
