import bcrypt from "bcryptjs";
import { createSeedState } from "../../src/data/seed.ts";
import { prisma } from "../src/lib/prisma.js";
import { uid } from "../src/lib/ids.js";

export async function seedForum() {
  const state = createSeedState();

  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.like.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.comment.updateMany({ data: { parentId: null } });
  await prisma.comment.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.trendingGame.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.category.updateMany({ data: { parentId: null } });
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  for (const user of state.users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash,
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar,
        role: user.role,
        banned: user.banned,
        createdAt: new Date(user.createdAt),
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth) : null,
      },
    });
  }

  for (const c of state.categories) {
    await prisma.category.create({
      data: {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        parentId: c.parentId,
        featured: c.featured,
        sortOrder: c.order,
      },
    });
  }

  for (const t of state.threads) {
    await prisma.thread.create({
      data: {
        id: t.id,
        forumId: t.forumId,
        authorId: t.authorId,
        title: t.title,
        content: t.content,
        body: t.body,
        mediaUrl: t.mediaUrl,
        mediaType: t.mediaType,
        pinned: t.pinned,
        solved: t.solved,
        tags: t.tags,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
        views: t.views,
      },
    });
  }

  for (const c of state.comments) {
    await prisma.comment.create({
      data: {
        id: c.id,
        threadId: c.threadId,
        authorId: c.authorId,
        parentId: c.parentId,
        content: c.content,
        body: c.body,
        createdAt: new Date(c.createdAt),
      },
    });
  }

  for (const l of state.likes) {
    await prisma.like.create({
      data: {
        id: l.id || uid("like"),
        userId: l.userId,
        targetType: l.targetType,
        targetId: l.targetId,
      },
    });
  }

  for (const f of state.follows) {
    await prisma.follow.create({
      data: {
        id: f.id || uid("follow"),
        followerId: f.followerId,
        followingId: f.followingId,
      },
    });
  }

  for (const n of state.notifications) {
    await prisma.notification.create({
      data: {
        id: n.id || uid("notif"),
        userId: n.userId,
        type: n.type,
        message: n.message,
        link: n.link,
        read: n.read,
        createdAt: new Date(n.createdAt),
      },
    });
  }

  for (const a of state.ads) {
    await prisma.ad.create({
      data: {
        id: a.id,
        slot: a.slot,
        imageUrl: a.imageUrl,
        url: a.url,
        title: a.title,
        sortOrder: a.order,
      },
    });
  }

  for (const g of state.trendingGames) {
    await prisma.trendingGame.create({
      data: {
        id: g.id,
        title: g.title,
        subtitle: g.subtitle,
        imageUrl: g.imageUrl,
        url: g.url,
        sortOrder: g.order,
      },
    });
  }

  for (const p of state.providers) {
    await prisma.provider.create({
      data: {
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        url: p.url,
        rating: p.rating,
        sortOrder: p.order,
      },
    });
  }

  await prisma.setting.create({
    data: { key: "ad_rotate_sec", value: String(state.adRotateSec) },
  });
}

export async function seedIfEmpty() {
  const count = await prisma.user.count();
  if (count > 0) return;
  await seedForum();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedForum()
    .then(async () => {
      console.log("Seeded MCW forum data.");
      await prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
