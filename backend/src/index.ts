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
import { trustProxyEnabled } from "./lib/securityConfig.js";
import { seedIfEmpty } from "../prisma/seed.js";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const app = express();
const port = Number(process.env.PORT ?? 4000);
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
        "img-src": ["'self'", "data:"],
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
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "8mb" }));
app.use(cookieParser());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api", forumRouter);

app.get("/", (_req, res) => {
  res.json({ message: "MCW Casino Forum API" });
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

async function start() {
  await seedIfEmpty();
  app.listen(port, "0.0.0.0", () => {
    console.log(`MCW API listening on http://127.0.0.1:${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
