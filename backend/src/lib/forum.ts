import type { ForumCategory, PostBody } from "../../../src/types.ts";
import { prisma } from "./prisma.js";
import { uid } from "./ids.js";
import { mapAd, mapCategory, mapGame, mapProvider, mapThread, publicUser, type UserRow } from "./serialize.js";

export type DbUser = UserRow;

export { publicUser };

export async function notify(input: {
  userId: string;
  type: string;
  message: string;
  link: string;
  actorId?: string;
}) {
  if (!input.userId || input.userId === input.actorId) return;
  await prisma.notification.create({
    data: {
      id: uid("notif"),
      userId: input.userId,
      type: input.type,
      message: input.message,
      link: input.link,
    },
  });
}

export async function mentionUsers(text: string, actorId: string, actorName: string, link: string) {
  const names = [...new Set([...text.matchAll(/@([a-z0-9_]{3,20})/gi)].map((m) => m[1]!.toLowerCase()))];
  if (!names.length) return;
  const users = await prisma.user.findMany({
    where: { username: { in: names } },
    select: { id: true, username: true },
  });
  for (const user of users) {
    await notify({
      userId: user.id,
      actorId,
      type: "mention",
      message: `${actorName} mentioned you`,
      link,
    });
  }
}

export function textFromBody(body: PostBody) {
  return body
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

export function firstImage(body: PostBody) {
  return body.find((b) => b.type === "image")?.url ?? null;
}

export function isTextEmpty(body: PostBody | undefined) {
  if (!Array.isArray(body) || body.length === 0) return true;
  const text = textFromBody(body);
  const images = body.filter((b) => b.type === "image" && b.url).length;
  return !text && images === 0;
}

export async function categoryCounts(): Promise<Map<string, { threadCount: number; postCount: number }>> {
  const [threadGroups, commentGroups] = await Promise.all([
    prisma.thread.groupBy({ by: ["forumId"], _count: { _all: true } }),
    prisma.comment.groupBy({
      by: ["threadId"],
      _count: { _all: true },
    }),
  ]);
  const threadIds = commentGroups.map((g) => g.threadId);
  const threads = threadIds.length
    ? await prisma.thread.findMany({ where: { id: { in: threadIds } }, select: { id: true, forumId: true } })
    : [];
  const threadForum = new Map(threads.map((t) => [t.id, t.forumId]));
  const map = new Map<string, { threadCount: number; postCount: number }>();
  for (const g of threadGroups) {
    map.set(g.forumId, { threadCount: g._count._all, postCount: g._count._all });
  }
  for (const g of commentGroups) {
    const forumId = threadForum.get(g.threadId);
    if (!forumId) continue;
    const cur = map.get(forumId) || { threadCount: 0, postCount: 0 };
    cur.postCount += g._count._all;
    map.set(forumId, cur);
  }
  return map;
}

export async function loadCategories(): Promise<ForumCategory[]> {
  const [rows, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    categoryCounts(),
  ]);
  return rows.map((c) => mapCategory(c, counts.get(c.id) || { threadCount: 0, postCount: 0 }));
}

export async function loadBootstrap(viewer: UserRow | null) {
  const [categories, ads, games, providers, settings, unreadCount, memberCount] = await Promise.all([
    loadCategories(),
    prisma.ad.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.trendingGame.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.provider.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.setting.findMany(),
    viewer
      ? prisma.notification.count({ where: { userId: viewer.id, read: false } })
      : Promise.resolve(0),
    prisma.user.count({ where: { banned: false } }),
  ]);
  const rotate = settings.find((s) => s.key === "ad_rotate_sec")?.value;
  return {
    me: viewer && !viewer.banned ? publicUser(viewer, { self: true }) : null,
    unreadCount,
    memberCount,
    categories,
    ads: ads.map(mapAd),
    trendingGames: games.map(mapGame),
    providers: providers.map(mapProvider),
    adRotateSec: Math.max(2, Math.min(60, Number(rotate || 5))),
  };
}

export async function threadStats(ids: string[], userId?: string) {
  if (!ids.length) {
    return {
      comments: new Map<string, number>(),
      likes: new Map<string, number>(),
      liked: new Set<string>(),
      bookmarked: new Set<string>(),
      unread: new Set<string>(),
    };
  }
  const [commentGroups, likeGroups, likedRows, bookmarkRows, readRows, threads] = await Promise.all([
    prisma.comment.groupBy({ by: ["threadId"], where: { threadId: { in: ids } }, _count: { _all: true } }),
    prisma.like.groupBy({
      by: ["targetId"],
      where: { targetType: "thread", targetId: { in: ids } },
      _count: { _all: true },
    }),
    userId
      ? prisma.like.findMany({
          where: { userId, targetType: "thread", targetId: { in: ids } },
          select: { targetId: true },
        })
      : Promise.resolve([]),
    userId
      ? prisma.bookmark.findMany({ where: { userId, threadId: { in: ids } }, select: { threadId: true } })
      : Promise.resolve([]),
    userId
      ? prisma.threadRead.findMany({ where: { userId, threadId: { in: ids } } })
      : Promise.resolve([]),
    userId
      ? prisma.thread.findMany({ where: { id: { in: ids } }, select: { id: true, updatedAt: true } })
      : Promise.resolve([]),
  ]);
  const comments = new Map(commentGroups.map((g) => [g.threadId, g._count._all]));
  const likes = new Map(likeGroups.map((g) => [g.targetId, g._count._all]));
  const liked = new Set(likedRows.map((r) => r.targetId));
  const bookmarked = new Set(bookmarkRows.map((r) => r.threadId));
  const lastRead = new Map(readRows.map((r) => [r.threadId, r.lastReadAt.getTime()]));
  const unread = new Set<string>();
  if (userId) {
    for (const t of threads) {
      const seen = lastRead.get(t.id) || 0;
      if (t.updatedAt.getTime() > seen) unread.add(t.id);
    }
  }
  return { comments, likes, liked, bookmarked, unread };
}

export function decorateThreads(
  rows: Parameters<typeof mapThread>[0][],
  stats: Awaited<ReturnType<typeof threadStats>>,
  authors: Map<string, ReturnType<typeof publicUser>>,
) {
  return rows.map((row) => {
    const thread = mapThread(row);
    return {
      ...thread,
      replyCount: stats.comments.get(row.id) || 0,
      likeCount: stats.likes.get(row.id) || 0,
      liked: stats.liked.has(row.id),
      bookmarked: stats.bookmarked.has(row.id),
      unread: stats.unread.has(row.id),
      author: authors.get(row.authorId) || null,
    };
  });
}

export async function authorsByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, ReturnType<typeof publicUser>>();
  const users = await prisma.user.findMany({ where: { id: { in: unique } } });
  return new Map(users.map((u) => [u.id, publicUser(u)]));
}
