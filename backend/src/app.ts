import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { forumRouter } from "./routes/forum.js";
import { adminRouter } from "./routes/admin.js";
import { catalogRouter } from "./routes/catalog.js";
import { uploadsRouter } from "./routes/uploads.js";
import { trustProxyEnabled } from "./lib/securityConfig.js";
import { assertTurnstileConfigured } from "./lib/security.js";
import { requireSameOrigin } from "./lib/origin.js";
import { uploadsDir } from "./lib/upload.js";
import { prisma } from "./lib/prisma.js";
import { publicAppUrl } from "./lib/mail.js";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

assertTurnstileConfigured();

export const app = express();
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

if (trustProxyEnabled()) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", corsOrigin],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
        : false,
  }),
);

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "256kb" }));
app.use(cookieParser());
app.use(requireSameOrigin);
app.use("/uploads", (req, res, next) => {
  if (/\.(php|phtml|phar|html?|svg)(\?|$)/i.test(req.path)) {
    return res.status(404).end();
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  return next();
});
app.use(
  "/uploads",
  express.static(uploadsDir(), {
    maxAge: "7d",
    fallthrough: false,
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
    },
  }),
);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api", catalogRouter);
app.use("/api", forumRouter);

app.get("/", (_req, res) => {
  res.json({ message: "MCW Casino Forum API" });
});

app.get("/sitemap.xml", async (_req, res) => {
  const origin = publicAppUrl();
  const [categories, threads] = await Promise.all([
    prisma.category.findMany({ select: { slug: true }, take: 200 }),
    prisma.thread.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);
  const urls = [
    { loc: `${origin}/`, changefreq: "hourly", priority: "1.0" },
    { loc: `${origin}/communities`, changefreq: "hourly", priority: "0.8" },
    { loc: `${origin}/members`, changefreq: "daily", priority: "0.5" },
    { loc: `${origin}/search`, changefreq: "weekly", priority: "0.3" },
    ...categories.map((c) => ({
      loc: `${origin}/communities/${c.slug}`,
      changefreq: "hourly",
      priority: "0.7",
    })),
    ...threads.map((t) => ({
      loc: `${origin}/thread/${t.id}`,
      lastmod: t.updatedAt.toISOString(),
      changefreq: "daily",
      priority: "0.6",
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    ${"lastmod" in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;
  res.type("application/xml").send(body);
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /notifications
Disallow: /login
Disallow: /register
Disallow: /reset
Disallow: /verify-email
Sitemap: ${publicAppUrl()}/sitemap.xml
`);
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error." });
  },
);
