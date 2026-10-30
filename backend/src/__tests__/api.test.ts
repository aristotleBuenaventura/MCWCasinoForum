import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";

const origin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

function agent() {
  return request.agent(app);
}

async function login(username: string, password: string) {
  const a = agent();
  const res = await a
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ usernameOrEmail: username, password, stayLoggedIn: true });
  return { a, res };
}

describe("catalog privacy", () => {
  it("bootstrap does not dump other users' notifications", async () => {
    const res = await agent().get("/api/bootstrap");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.notifications).toBeUndefined();
    expect(res.body.reports).toBeUndefined();
    expect(res.body.threads).toBeUndefined();
    expect(Array.isArray(res.body.categories)).toBe(true);
    if (res.body.me) expect(res.body.me.password).toBeFalsy();
  });

  it("does not expose /api/state", async () => {
    const res = await agent().get("/api/state");
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("paginates threads", async () => {
    const res = await agent().get("/api/threads?limit=5&page=1");
    expect(res.status).toBe(200);
    expect(res.body.threads.length).toBeLessThanOrEqual(5);
    expect(typeof res.body.total).toBe("number");
  });

  it("search requires a query and does not leak emails", async () => {
    const res = await agent().get("/api/search?q=alice");
    expect(res.status).toBe(200);
    for (const user of res.body.users || []) {
      expect(user.email).toBe("");
    }
  });
});

describe("authentication", () => {
  it("rejects invalid credentials with a generic error", async () => {
    const res = await agent()
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ usernameOrEmail: "alicewins", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid/);
  });

  it("logs in a seeded user", async () => {
    const { res } = await login("alicewins", "password123");
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("alicewins");
    expect(res.body.user.email).toBeTruthy();
  });

  it("logs out", async () => {
    const { a } = await login("alicewins", "password123");
    const out = await a.post("/api/auth/logout").set("Origin", origin);
    expect(out.status).toBe(200);
    const me = await a.get("/api/bootstrap");
    expect(me.body.me).toBeNull();
  });

  it("rejects weak registration passwords", async () => {
    const res = await agent()
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        username: `weak${Date.now().toString(36)}`,
        email: `weak${Date.now()}@example.com`,
        password: "short",
        dateOfBirth: "1990-01-01",
        turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
      });
    expect(res.status).toBe(400);
  });

  it("forgot password does not enumerate accounts", async () => {
    const missing = await agent()
      .post("/api/auth/forgot")
      .set("Origin", origin)
      .send({ email: "nobody-exists@example.com" });
    const known = await agent()
      .post("/api/auth/forgot")
      .set("Origin", origin)
      .send({ email: "alice@example.com" });
    expect(missing.status).toBe(200);
    expect(known.status).toBe(200);
    expect(missing.body.message).toBe(known.body.message);
  });
});

describe("authorization", () => {
  it("guests cannot create threads", async () => {
    const res = await agent()
      .post("/api/threads")
      .set("Origin", origin)
      .send({ forumId: "cat_rtp", title: "Nope", body: [{ id: "t", type: "text", text: "x" }] });
    expect(res.status).toBe(401);
  });

  it("normal users cannot hit admin stats", async () => {
    const { a } = await login("alicewins", "password123");
    const res = await a.get("/api/admin/stats");
    expect(res.status).toBe(403);
  });

  it("admins can read stats", async () => {
    const { a } = await login("admin", "admin123");
    const res = await a.get("/api/admin/stats");
    expect(res.status).toBe(200);
    expect(res.body.stats.users).toBeGreaterThan(0);
  });

  it("blocks privilege escalation through profile patch", async () => {
    const { a } = await login("alicewins", "password123");
    await a.patch("/api/me").set("Origin", origin).send({ role: "admin", displayName: "Alice" });
    const boot = await a.get("/api/bootstrap");
    expect(boot.body.me.role).toBe("user");
  });

  it("blocks IDOR thread delete", async () => {
    const alice = await login("alicewins", "password123");
    const created = await alice.a
      .post("/api/threads")
      .set("Origin", origin)
      .send({
        forumId: "cat_rtp",
        title: `IDOR check ${Date.now()}`,
        body: [{ id: "t", type: "text", text: "Owned by alice" }],
      });
    if (created.status === 429) return;
    expect(created.status).toBe(200);
    const threadId = created.body.thread.id;
    const bob = await login("bobdealer", "password123");
    const del = await bob.a.delete(`/api/threads/${threadId}`).set("Origin", origin);
    expect(del.status).toBe(403);
  });
});

describe("forum", () => {
  it("creates comments, likes, and bookmarks for the author", async () => {
    const { a, res: loginRes } = await login("bobdealer", "password123");
    expect(loginRes.status).toBe(200);
    const created = await a
      .post("/api/threads")
      .set("Origin", origin)
      .send({
        forumId: "cat_guides",
        title: `API thread ${Date.now()}`,
        body: [{ id: "t", type: "text", text: "Hello @bobdealer from tests" }],
        tags: ["test"],
      });
    if (created.status === 429) return;
    expect(created.status).toBe(200);
    const id = created.body.thread.id;
    const comment = await a
      .post("/api/comments")
      .set("Origin", origin)
      .send({
        threadId: id,
        body: [{ id: "c", type: "text", text: "A reply" }],
      });
    if (comment.status !== 429) expect(comment.status).toBe(200);
    const like = await a.post("/api/likes").set("Origin", origin).send({ targetType: "thread", targetId: id });
    expect(like.status).toBe(200);
    const bookmark = await a.post(`/api/threads/${id}/bookmark`).set("Origin", origin);
    expect(bookmark.status).toBe(200);
    expect(bookmark.body.bookmarked).toBe(true);
    const saved = await a.get("/api/threads?sort=saved");
    expect(saved.body.threads.some((t: { id: string }) => t.id === id)).toBe(true);
  });

  it("home feed returns latest and popular lists", async () => {
    const res = await agent().get("/api/home?tab=latest");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.feed.threads)).toBe(true);
  });
});

describe("security", () => {
  it("blocks cross-origin POST", async () => {
    const res = await agent()
      .post("/api/auth/login")
      .set("Origin", "https://evil.example")
      .send({ usernameOrEmail: "alicewins", password: "password123" });
    expect(res.status).toBe(403);
  });

  it("stores XSS payload as text, not HTML execution surface", async () => {
    const { a } = await login("caraspins", "password123");
    const payload = '<script>window.pwned=1</script>';
    const created = await a
      .post("/api/threads")
      .set("Origin", origin)
      .send({
        forumId: "cat_rtp",
        title: payload,
        body: [{ id: "t", type: "text", text: payload }],
      });
    if (created.status === 429) return;
    expect(created.body.thread.title).toBe(payload);
    expect(created.body.thread.content).toContain("<script>");
  });

  it("rejects executable uploads", async () => {
    const { a } = await login("moderator", "moderator123");
    const res = await a
      .post("/api/uploads")
      .set("Origin", origin)
      .attach("file", Buffer.from("MZ executable"), { filename: "virus.exe", contentType: "application/octet-stream" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("demo reset is disabled without the env flag", async () => {
    const { a } = await login("admin", "admin123");
    const res = await a.post("/api/admin/reset").set("Origin", origin);
    expect(res.status).toBe(403);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
