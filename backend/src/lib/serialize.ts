import type { Ad, CmsItem, Comment, ForumCategory, GameProvider, Notification, PostBody, Report, Role, Thread, User } from "../../../src/types.ts";
import { parseMembership, parseNameEmblem, parseNameFrame, parseUnlocks } from "../../../src/lib/nameplate.ts";

export function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function dateOnly(value: Date | string | null | undefined) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatar: string;
  role: string;
  membership?: string | null;
  nameFrame?: string | null;
  nameEmblem?: string | null;
  nameUnlocks?: unknown;
  banned: boolean;
  createdAt: Date;
  dateOfBirth: Date | null;
  emailVerifiedAt?: Date | null;
};

export function publicUser(row: UserRow, opts: { self?: boolean } = {}): User {
  const unlocks = parseUnlocks(row.nameUnlocks);
  return {
    id: row.id,
    username: row.username,
    email: opts.self ? row.email : "",
    password: "",
    displayName: row.displayName,
    bio: row.bio || "",
    avatar: row.avatar || "",
    role: row.role as Role,
    membership: parseMembership(row.membership),
    nameFrame: parseNameFrame(row.nameFrame),
    nameEmblem: parseNameEmblem(row.nameEmblem),
    nameUnlocks: opts.self ? unlocks : undefined,
    banned: Boolean(row.banned),
    createdAt: iso(row.createdAt),
    dateOfBirth: opts.self ? dateOnly(row.dateOfBirth) : undefined,
  };
}

export type ThreadRow = {
  id: string;
  forumId: string;
  authorId: string;
  title: string;
  content: string;
  body: unknown;
  mediaUrl: string | null;
  mediaType: string | null;
  pinned: boolean;
  solved: boolean;
  tags: unknown;
  createdAt: Date;
  updatedAt: Date;
  views: number;
};

export function mapThread(t: ThreadRow): Thread {
  return {
    id: t.id,
    forumId: t.forumId,
    authorId: t.authorId,
    title: t.title,
    content: t.content || "",
    body: (Array.isArray(t.body) ? t.body : []) as PostBody,
    mediaUrl: t.mediaUrl,
    mediaType: (t.mediaType as Thread["mediaType"]) ?? null,
    pinned: t.pinned,
    solved: t.solved,
    tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
    views: t.views,
  };
}

export function mapComment(c: {
  id: string;
  threadId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  body: unknown;
  createdAt: Date;
}): Comment {
  return {
    id: c.id,
    threadId: c.threadId,
    authorId: c.authorId,
    parentId: c.parentId,
    content: c.content || "",
    body: (Array.isArray(c.body) ? c.body : []) as PostBody,
    createdAt: iso(c.createdAt),
  };
}

export function mapCategory(
  c: {
    id: string;
    slug: string;
    name: string;
    description: string;
    parentId: string | null;
    featured: boolean;
    sortOrder: number;
  },
  counts: { threadCount: number; postCount: number },
): ForumCategory {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description || "",
    parentId: c.parentId,
    featured: c.featured,
    order: c.sortOrder,
    threadCount: counts.threadCount,
    postCount: counts.postCount,
  };
}

export function mapAd(a: { id: string; slot: string; imageUrl: string; url: string; title: string; sortOrder: number }): Ad {
  return {
    id: a.id,
    slot: a.slot as Ad["slot"],
    imageUrl: a.imageUrl || "",
    url: a.url || "",
    title: a.title || "",
    order: a.sortOrder,
  };
}

export function mapGame(g: { id: string; title: string; subtitle: string; imageUrl: string; url: string; sortOrder: number }): CmsItem {
  return {
    id: g.id,
    title: g.title,
    subtitle: g.subtitle || "",
    imageUrl: g.imageUrl || "",
    url: g.url || "",
    order: g.sortOrder,
  };
}

export function mapProvider(p: {
  id: string;
  name: string;
  imageUrl: string;
  url: string;
  rating: number;
  sortOrder: number;
}): GameProvider {
  return {
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl || "",
    url: p.url || "",
    rating: p.rating,
    order: p.sortOrder,
  };
}

export function mapNotification(n: {
  id: string;
  userId: string;
  type: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: Date;
}): Notification {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type as Notification["type"],
    message: n.message,
    link: n.link || "/",
    read: n.read,
    createdAt: iso(n.createdAt),
  };
}

export function mapReport(r: {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: Date;
}): Report {
  return {
    id: r.id,
    reporterId: r.reporterId,
    targetType: r.targetType as Report["targetType"],
    targetId: r.targetId,
    reason: r.reason,
    status: r.status as Report["status"],
    createdAt: iso(r.createdAt),
  };
}

export function parsePage(value: unknown, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(500, Math.floor(n));
}

export function parseLimit(value: unknown, fallback = 20, max = 50) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}
