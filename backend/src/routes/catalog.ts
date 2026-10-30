import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import {
  authorsByIds,
  decorateThreads,
  loadBootstrap,
  loadCategories,
  threadStats,
} from "../lib/forum.js";
import { mapComment, mapNotification, parseLimit, parsePage, publicUser } from "../lib/serialize.js";

export const catalogRouter = Router();

catalogRouter.get("/bootstrap", optionalAuth, async (req, res) => {
  const me = req.user
    ? await prisma.user.findUnique({ where: { id: req.user.userId } })
    : null;
  const bootstrap = await loadBootstrap(me && !me.banned ? me : null);
  res.json({ ok: true, ...bootstrap });
});

catalogRouter.get("/categories", async (_req, res) => {
  const categories = await loadCategories();
  res.json({ ok: true, categories });
});

function forumFilter(forum?: string, childIds: string[] = []) {
  if (!forum) return undefined;
  return { forumId: childIds.length ? { in: [forum, ...childIds] } : forum };
}

catalogRouter.get("/threads", optionalAuth, async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 20, 50);
  const sort = String(req.query.sort || "latest");
  const tag = String(req.query.tag || "").trim();
  const forumParam = String(req.query.forum || req.query.slug || "").trim();
  let forumId = String(req.query.forumId || "").trim();
  let childIds: string[] = [];
  if (forumParam && !forumId) {
    const cat = await prisma.category.findFirst({
      where: { OR: [{ id: forumParam }, { slug: forumParam }] },
    });
    if (cat) {
      forumId = cat.id;
      const children = await prisma.category.findMany({ where: { parentId: cat.id }, select: { id: true } });
      childIds = children.map((c) => c.id);
    }
  }
  const where: Record<string, unknown> = { ...forumFilter(forumId, childIds) };
  if (tag) where.title = { contains: tag };

  if (sort === "saved") {
    if (!req.user) return res.status(401).json({ ok: false, error: "Please log in." });
    const total = await prisma.bookmark.count({ where: { userId: req.user.userId } });
    const rows = await prisma.bookmark.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { thread: true },
    });
    const threads = rows.map((r) => r.thread);
    const stats = await threadStats(threads.map((t) => t.id), req.user.userId);
    const authors = await authorsByIds(threads.map((t) => t.authorId));
    return res.json({
      ok: true,
      page,
      limit,
      total,
      threads: decorateThreads(threads, stats, authors),
    });
  }

  const total = await prisma.thread.count({ where });
  let orderBy: object = [{ pinned: "desc" }, { createdAt: "desc" }];
  if (sort === "popular" || sort === "trending") {
    const grouped = await prisma.like.groupBy({
      by: ["targetId"],
      where: { targetType: "thread" },
      _count: { _all: true },
    });
    const score = new Map(grouped.map((g) => [g.targetId, g._count._all]));
    const all = await prisma.thread.findMany({ where, select: { id: true, createdAt: true, pinned: true } });
    const ranked = all
      .map((t) => {
        const ageH = (Date.now() - t.createdAt.getTime()) / 3.6e6;
        const likes = score.get(t.id) || 0;
        const trending = likes * 2 - ageH;
        return { id: t.id, pinned: t.pinned, score: sort === "popular" ? likes : trending };
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.score - a.score);
    const pageIds = ranked.slice((page - 1) * limit, page * limit).map((r) => r.id);
    const threads = await prisma.thread.findMany({ where: { id: { in: pageIds } } });
    threads.sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id));
    const stats = await threadStats(threads.map((t) => t.id), req.user?.userId);
    const authors = await authorsByIds(threads.map((t) => t.authorId));
    return res.json({
      ok: true,
      page,
      limit,
      total,
      threads: decorateThreads(threads, stats, authors),
    });
  }

  const threads = await prisma.thread.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
  });
  const stats = await threadStats(threads.map((t) => t.id), req.user?.userId);
  const authors = await authorsByIds(threads.map((t) => t.authorId));
  res.json({
    ok: true,
    page,
    limit,
    total,
    threads: decorateThreads(threads, stats, authors),
  });
});

catalogRouter.get("/home", optionalAuth, async (req, res) => {
  const tab = String(req.query.tab || "latest");
  const feedRes = await fetchFeed(req.user?.userId, tab, 1, 20);
  const [reviews, guides, wins, weekly] = await Promise.all([
    prisma.thread.findMany({
      where: { forumId: "cat_reviews" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.thread.findMany({
      where: { forumId: "cat_guides" },
      orderBy: { views: "desc" },
      take: 3,
    }),
    prisma.thread.findMany({
      where: { forumId: "cat_bigwins" },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.comment.groupBy({
      by: ["authorId"],
      _count: { _all: true },
      orderBy: { _count: { authorId: "desc" } },
      take: 3,
    }),
  ]);
  const extraIds = [...reviews, ...guides, ...wins].map((t) => t.id);
  const stats = await threadStats(extraIds, req.user?.userId);
  const authors = await authorsByIds([
    ...reviews.map((t) => t.authorId),
    ...guides.map((t) => t.authorId),
    ...wins.map((t) => t.authorId),
    ...weekly.map((w) => w.authorId),
    ...feedRes.threads.map((t) => t.authorId),
  ]);
  const weeklyUsers = await prisma.user.findMany({ where: { id: { in: weekly.map((w) => w.authorId) } } });
  res.json({
    ok: true,
    feed: feedRes,
    reviews: decorateThreads(reviews, stats, authors),
    guides: decorateThreads(guides, stats, authors),
    wins: decorateThreads(wins, stats, authors),
    weekly: weekly.map((w) => ({
      replies: w._count._all,
      user: weeklyUsers.find((u) => u.id === w.authorId) ? publicUser(weeklyUsers.find((u) => u.id === w.authorId)!) : null,
    })),
  });
});

async function fetchFeed(userId: string | undefined, sort: string, page: number, limit: number) {
  const req = {
    user: userId ? { userId } : undefined,
    query: { sort, page, limit },
  };
  void req;
  if (sort === "saved" && userId) {
    const total = await prisma.bookmark.count({ where: { userId } });
    const rows = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { thread: true },
    });
    const threads = rows.map((r) => r.thread);
    const stats = await threadStats(threads.map((t) => t.id), userId);
    const authors = await authorsByIds(threads.map((t) => t.authorId));
    return { page, limit, total, threads: decorateThreads(threads, stats, authors) };
  }
  const where = {};
  const total = await prisma.thread.count({ where });
  const threads = await prisma.thread.findMany({
    where,
    orderBy: sort === "latest" || !sort ? [{ pinned: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
  if (sort === "popular" || sort === "trending") {
    const grouped = await prisma.like.groupBy({
      by: ["targetId"],
      where: { targetType: "thread" },
      _count: { _all: true },
    });
    const score = new Map(grouped.map((g) => [g.targetId, g._count._all]));
    const all = await prisma.thread.findMany({ select: { id: true, createdAt: true, pinned: true } });
    const ranked = all
      .map((t) => {
        const ageH = (Date.now() - t.createdAt.getTime()) / 3.6e6;
        const likes = score.get(t.id) || 0;
        return { id: t.id, pinned: t.pinned, score: sort === "popular" ? likes : likes * 2 - ageH };
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.score - a.score)
      .slice((page - 1) * limit, page * limit)
      .map((r) => r.id);
    const picked = await prisma.thread.findMany({ where: { id: { in: ranked } } });
    picked.sort((a, b) => ranked.indexOf(a.id) - ranked.indexOf(b.id));
    const stats = await threadStats(picked.map((t) => t.id), userId);
    const authors = await authorsByIds(picked.map((t) => t.authorId));
    return { page, limit, total: all.length, threads: decorateThreads(picked, stats, authors) };
  }
  const stats = await threadStats(threads.map((t) => t.id), userId);
  const authors = await authorsByIds(threads.map((t) => t.authorId));
  return { page, limit, total, threads: decorateThreads(threads, stats, authors) };
}

catalogRouter.get("/search", optionalAuth, async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 80);
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 20, 40);
  if (q.length < 2) {
    return res.json({ ok: true, q, page, limit, total: 0, threads: [], users: [], comments: [] });
  }
  const [threads, total, users, comments] = await Promise.all([
    prisma.thread.findMany({
      where: {
        OR: [{ title: { contains: q } }, { content: { contains: q } }],
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.thread.count({
      where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
    }),
    prisma.user.findMany({
      where: {
        banned: false,
        OR: [{ username: { contains: q } }, { displayName: { contains: q } }],
      },
      take: 10,
    }),
    prisma.comment.findMany({
      where: { content: { contains: q } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const stats = await threadStats(threads.map((t) => t.id), req.user?.userId);
  const authors = await authorsByIds(threads.map((t) => t.authorId));
  res.json({
    ok: true,
    q,
    page,
    limit,
    total,
    threads: decorateThreads(threads, stats, authors),
    users: users.map((u) => publicUser(u)),
    comments: comments.map(mapComment),
  });
});

catalogRouter.get("/members", async (req, res) => {
  const key = String(req.query.key || "messages");
  const q = String(req.query.username || "").trim().toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      banned: false,
      ...(q
        ? { OR: [{ username: { contains: q } }, { displayName: { contains: q } }] }
        : {}),
    },
    select: { id: true, username: true, displayName: true, avatar: true, role: true, bio: true, banned: true, createdAt: true, email: true, dateOfBirth: true },
  });
  const [threadCounts, commentCounts, likes] = await Promise.all([
    prisma.thread.groupBy({ by: ["authorId"], _count: { _all: true } }),
    prisma.comment.groupBy({ by: ["authorId"], _count: { _all: true } }),
    prisma.like.findMany({ select: { targetType: true, targetId: true } }),
  ]);
  const threadMap = new Map(threadCounts.map((g) => [g.authorId, g._count._all]));
  const commentMap = new Map(commentCounts.map((g) => [g.authorId, g._count._all]));
  const threadAuthors = await prisma.thread.findMany({ select: { id: true, authorId: true } });
  const commentAuthors = await prisma.comment.findMany({ select: { id: true, authorId: true } });
  const tAuthor = new Map(threadAuthors.map((t) => [t.id, t.authorId]));
  const cAuthor = new Map(commentAuthors.map((c) => [c.id, c.authorId]));
  const reactions = new Map<string, number>();
  for (const like of likes) {
    const author = like.targetType === "thread" ? tAuthor.get(like.targetId) : cAuthor.get(like.targetId);
    if (!author) continue;
    reactions.set(author, (reactions.get(author) || 0) + 1);
  }
  const rows = users.map((u) => ({
    user: publicUser(u),
    messages: (threadMap.get(u.id) || 0) + (commentMap.get(u.id) || 0),
    reactions: reactions.get(u.id) || 0,
    media: 0,
  }));
  rows.sort((a, b) => {
    if (key === "reactions") return b.reactions - a.reactions;
    return b.messages - a.messages;
  });
  res.json({ ok: true, members: rows.slice(0, 50) });
});

catalogRouter.get("/users/:username", optionalAuth, async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { username: String(req.params.username || "").toLowerCase() },
  });
  if (!user || user.banned) return res.status(404).json({ ok: false, error: "User not found." });
  const self = req.user?.userId === user.id;
  const [threads, comments, followers, following, reactionCount] = await Promise.all([
    prisma.thread.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.comment.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.like.count({
      where: {
        OR: [
          { targetType: "thread", targetId: { in: (await prisma.thread.findMany({ where: { authorId: user.id }, select: { id: true } })).map((t) => t.id) } },
        ],
      },
    }),
  ]);
  const isFollowing = req.user
    ? Boolean(
        await prisma.follow.findFirst({
          where: { followerId: req.user.userId, followingId: user.id },
        }),
      )
    : false;
  const stats = await threadStats(threads.map((t) => t.id), req.user?.userId);
  const authors = await authorsByIds([user.id]);
  res.json({
    ok: true,
    user: publicUser(user, { self }),
    followers,
    following,
    isFollowing,
    reactionCount,
    threads: decorateThreads(threads, stats, authors),
    comments: comments.map(mapComment),
  });
});

catalogRouter.get("/notifications", requireAuth, async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 30, 50);
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where: { userId: req.user!.userId } }),
    prisma.notification.count({ where: { userId: req.user!.userId, read: false } }),
  ]);
  res.json({
    ok: true,
    page,
    limit,
    total,
    unreadCount,
    notifications: items.map(mapNotification),
  });
});
