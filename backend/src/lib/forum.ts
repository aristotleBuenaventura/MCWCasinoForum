import type {
  Ad,
  CmsItem,
  Comment,
  ForumCategory,
  ForumState,
  GameProvider,
  Like,
  Notification,
  Report,
  Role,
  Thread,
  User,
} from "../../../src/types.ts";
import { prisma } from "./prisma.js";
import { uid } from "./ids.js";

export type DbUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatar: string;
  role: string;
  banned: boolean;
  createdAt: Date;
  dateOfBirth: Date | null;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function publicUser(row: DbUser, includeEmail: boolean): User {
  return {
    id: row.id,
    username: row.username,
    email: includeEmail ? row.email : "",
    password: "",
    displayName: row.displayName,
    bio: row.bio || "",
    avatar: row.avatar || "",
    role: row.role as Role,
    banned: Boolean(row.banned),
    createdAt: iso(row.createdAt),
    dateOfBirth: dateOnly(row.dateOfBirth),
  };
}

export async function loadState(viewer: DbUser | null): Promise<ForumState> {
  const [users, categories, threads, comments, likes, follows, notifications, reports, ads, games, providers, settings] =
    await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.thread.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.comment.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.like.findMany(),
      prisma.follow.findMany(),
      prisma.notification.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.report.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.ad.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.trendingGame.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.provider.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.setting.findMany(),
    ]);

  const staff = viewer?.role === "admin" || viewer?.role === "moderator";
  const mappedUsers: User[] = users.map((u) => publicUser(u, staff || viewer?.id === u.id));

  const mappedThreads: Thread[] = threads.map((t) => ({
    id: t.id,
    forumId: t.forumId,
    authorId: t.authorId,
    title: t.title,
    content: t.content || "",
    body: (t.body as Thread["body"]) || [],
    mediaUrl: t.mediaUrl,
    mediaType: (t.mediaType as Thread["mediaType"]) ?? null,
    pinned: t.pinned,
    solved: t.solved,
    tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
    views: t.views,
  }));

  const mappedComments: Comment[] = comments.map((c) => ({
    id: c.id,
    threadId: c.threadId,
    authorId: c.authorId,
    parentId: c.parentId,
    content: c.content || "",
    body: (c.body as Comment["body"]) || [],
    createdAt: iso(c.createdAt),
  }));

  const mappedCategories: ForumCategory[] = categories.map((c) => {
    const catThreads = mappedThreads.filter((t) => t.forumId === c.id);
    const postCount =
      catThreads.length +
      mappedComments.filter((cm) => catThreads.some((t) => t.id === cm.threadId)).length;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description || "",
      parentId: c.parentId,
      featured: c.featured,
      order: c.sortOrder,
      threadCount: catThreads.length,
      postCount,
    };
  });

  const mappedLikes: Like[] = likes.map((l) => ({
    id: l.id,
    userId: l.userId,
    targetType: l.targetType as Like["targetType"],
    targetId: l.targetId,
  }));

  const mappedFollows = follows.map((f) => ({
    id: f.id,
    followerId: f.followerId,
    followingId: f.followingId,
  }));

  const mappedNotifs: Notification[] = notifications.map((n) => ({
    id: n.id,
    userId: n.userId,
    type: n.type as Notification["type"],
    message: n.message,
    link: n.link || "/",
    read: n.read,
    createdAt: iso(n.createdAt),
  }));

  const mappedReports: Report[] = reports.map((r) => ({
    id: r.id,
    reporterId: r.reporterId,
    targetType: r.targetType as Report["targetType"],
    targetId: r.targetId,
    reason: r.reason,
    status: r.status as Report["status"],
    createdAt: iso(r.createdAt),
  }));

  const mappedAds: Ad[] = ads.map((a) => ({
    id: a.id,
    slot: a.slot as Ad["slot"],
    imageUrl: a.imageUrl || "",
    url: a.url || "",
    title: a.title || "",
    order: a.sortOrder,
  }));

  const mappedGames: CmsItem[] = games.map((g) => ({
    id: g.id,
    title: g.title,
    subtitle: g.subtitle || "",
    imageUrl: g.imageUrl || "",
    url: g.url || "",
    order: g.sortOrder,
  }));

  const mappedProviders: GameProvider[] = providers.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl || "",
    url: p.url || "",
    rating: p.rating,
    order: p.sortOrder,
  }));

  const rotate = settings.find((s) => s.key === "ad_rotate_sec")?.value;

  return {
    users: mappedUsers,
    categories: mappedCategories,
    threads: mappedThreads,
    comments: mappedComments,
    likes: mappedLikes,
    follows: mappedFollows,
    notifications: mappedNotifs,
    reports: mappedReports,
    ads: mappedAds,
    adRotateSec: Math.max(2, Math.min(60, Number(rotate || 5))),
    trendingGames: mappedGames,
    providers: mappedProviders,
    currentUserId: viewer && !viewer.banned ? viewer.id : null,
  };
}

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
