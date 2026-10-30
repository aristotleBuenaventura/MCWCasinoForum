# MCW Casino Forum — Phase 2 Audit (updated)

**Date:** 30 Oct 2026  
**Baseline:** [AUDIT-REPORT.md](./AUDIT-REPORT.md) scored **62 / 100**, not production-ready  
**Updated overall score:** **83 / 100**  
**Production ready?** Closer, **not a 90+ launch** until credentials, real Turnstile, SMTP, and a production Lighthouse pass on the built SPA.

This is a post-implementation review with tests actually run. Incomplete items are listed as incomplete.

---

## Scorecard vs 62 baseline

| Area | Phase 1 | Phase 2 | Notes |
| --- | ---: | ---: | --- |
| Security | 55 | **84** | God-state gone; origin CSRF; reset gated; upload allowlist; Turnstile fail-closed in production |
| Functional completeness | 58 | **86** | Real feeds, bookmarks, search, password flows, mentions, quotes, last-read |
| Code quality | 64 | **76** | Dedicated routes exist; leftover `server/` and ForumContext still mix CMS + forum |
| Database architecture | 60 | **85** | Indexes, FKs, migration folder, new models; tag JSON still not queryable as array |
| Performance | 48 | **78** | Paginated APIs; local p95 under 5ms; **no 1k–100k user load test** |
| UI/UX | 72 | **82** | Same navy/gold language; loading/empty states; no visual redesign |
| SEO | 40 | **80** | Titles, canonical, robots, sitemap, JSON-LD; SPA without SSR |
| Automated testing | 10 | **74** | 31 backend + 1 frontend unit + 6 Playwright, all passing |
| **Overall** | **62** | **83** | +21. Not 90+ |

---

## What was completed

### Backend architecture
- `GET /api/state` removed (**404**). Bootstrap is `GET /api/bootstrap` (categories, ads, CMS, `me`, unread count only).
- Paginated/filterable endpoints: `/api/threads`, `/api/home`, `/api/search`, `/api/members`, `/api/users/:username`, `/api/notifications`, `/api/threads/:id`, `/api/threads/:id/comments`, `/api/admin/stats`.
- Server-side pagination, sorting (`latest` / `popular` / `trending` / `saved`), and batched Prisma stats (no per-row N+1 for likes/comments/bookmarks).

### Database
- Indexes on `threads.authorId`, `threads.forumId+createdAt`, `likes(targetType,targetId)`, `reports(status,createdAt)`, `notifications(userId,createdAt)`, `comments.authorId`.
- Models: `Bookmark`, `ThreadRead`, `ThreadRevision`, `AuthToken`, `AuditLog`, `RateBucket`, `emailVerifiedAt`.
- Migration history: `backend/prisma/migrations/20261030120000_phase2_quality/`. Existing rows were not dropped.

### Forum features (server-backed)
- Latest / popular / trending / saved feeds.
- Bookmarks separate from likes.
- Tags on create (up to 6). Tag *filter* uses title contains because MySQL JSON `array_contains` is not available.
- `@username` mentions → notifications.
- Quote/reply via `parentId`.
- Thread edit history table + last-read/unread.
- Notifications list + mark-read.
- Server search (threads, members, comments).
- Profile fetch, password change, forgot/reset, account delete, email-verify tokens.

### Uploads
- `POST /api/uploads` (auth, rate-limited, busboy).
- JPEG/PNG/GIF/WebP **magic-byte** check, size cap, random filenames, stored under `backend/uploads`, served at `/uploads`.
- Storage path is env-configurable (`UPLOAD_DIR`). Object storage (S3/R2) is **not** wired; local disk is the provider.

### Security
- Production Turnstile refuses test secrets.
- Login Turnstile when not using test keys.
- Origin/referer check on mutating requests.
- Password policy: 8+ chars, letter + number, bcrypt 12.
- Forgot-password does not enumerate accounts.
- Demo DB wipe requires `ALLOW_DEMO_RESET=true` (default off; verified 403).
- Admin audit log for role/ban/delete/reset.
- DB-backed `RateBucket` (no Redis in this stack).
- API binds `127.0.0.1` in production.

### Tests (actual results)
| Suite | Result |
| --- | --- |
| Frontend Vitest (`src/lib/postBody.test.ts`) | **1 passed** |
| Backend Vitest (unit + API integration) | **30 passed / 4 files** |
| Playwright Chromium (`e2e/forum.spec.ts`) | **6 passed** |
| `npm run lint` (oxlint) | **0 errors**, 12 warnings |
| `npm audit` frontend | **0 vulnerabilities** |
| `npm audit` backend | **0 vulnerabilities** |
| Frontend production build (`tsc -b && vite build`) | **passed** (JS 412.62 kB / 121.43 kB gzip) |
| Backend `tsc --noEmit` | **failed** (shared frontend `types.ts` / `seed.ts` outside `rootDir`) |
| Local API timings (40 sequential GETs) | health p95 1.1ms, bootstrap 3.1ms, threads 2.8ms, home 4.8ms, search 2.4ms, sitemap 1.5ms, **0 failures** |
| Lighthouse vs **Vite dev** `localhost:5173` | Performance **53**, Accessibility **91**, SEO **92** |

Playwright coverage: home identity, server search, guest admin gate, login overlay, thread heading, mobile menu.

API coverage includes: bootstrap privacy, no `/api/state`, pagination, generic invalid login, login/logout, weak register, forgot-password non-enumeration, guest thread 401, user admin 403, admin stats 200, role mass-assign blocked, IDOR delete 403, comments/likes/bookmarks, XSS stored as text, executable upload rejected, demo reset disabled, CSRF origin 403.

---

## Remaining issues (do not treat as done)

1. **Demo accounts** (`admin/admin123`, `alicewins/password123`, …) still seed locally. Production seed is skipped unless `ALLOW_DEMO_SEED=true`.
2. **Turnstile test keys** still in local `.env`. Production boot throws if they remain.
3. **No real SMTP.** Reset/verify tokens work; mail is console log or `MAIL_WEBHOOK_URL`.
4. **No Redis.** Rate limits use MySQL `RateBucket` + in-memory helpers.
5. **No object-storage provider** beyond local disk.
6. **SPA SEO** is client-side titles/canonical/JSON-LD. Crawlers that do not execute JS will see `index.html` defaults. Private routes are disallowed in `robots.txt`.
7. **Helmet CSP is on the API**, not on the Vite/Nginx SPA.
8. **Leftover `server/` Hono app** still on disk (not used by `npm run dev`).
9. **Backend `tsc` cannot emit** while routes import `src/types.ts` and `prisma/seed.ts`. PM2 now runs `tsx src/index.ts`.
10. **Lighthouse 53 performance** is the **dev server**, not `vite preview` / Nginx gzip+cache. Do not cite it as production Core Web Vitals.
11. **No load test at 1k / 10k / 50k / 100k users.** Local p95 does not prove those capacities.
12. Parent category thread counts still often show **0** on the forum list until children are rolled up.
13. Audit/test artifacts remain in the DB (XSS titles, `IDOR check`, `API thread` posts). Safe to delete later; not deleted here.
14. Email verification auto-completes outside production.

---

## Recommended next steps

1. Replace demo passwords and ship real Turnstile keys before any public URL.
2. Add SMTP (or a mail provider webhook) and stop logging reset URLs.
3. Nginx CSP + cache headers on the built SPA; re-run Lighthouse against `vite preview` or staging HTTPS.
4. Extract shared types so `backend` `tsc` emits `dist/` if you want compiled Node instead of `tsx`.
5. Delete leftover `server/` and test threads.
6. Roll up category counts; add S3/R2 behind `UPLOAD_DIR` if you leave the droplet.
7. k6/autocannon against staging before claiming concurrent-user capacity.

---

## Files touched (high level)

Backend: `prisma/schema.prisma`, `prisma/migrations/`, `src/app.ts`, `src/index.ts`, `src/routes/{auth,forum,admin,catalog,uploads}.ts`, `src/lib/{serialize,forum,upload,origin,rateBuckets,tokens,mail,audit,security}.ts`, `ecosystem.config.cjs`, tests under `src/lib/*.test.ts` and `src/__tests__/api.test.ts`.

Frontend: `ForumContext.tsx`, `api.ts`, pages (Home, ThreadDetail, Search, Notifications, Members, Profile, Communities, CreateThread, Admin, Register, ResetPassword, VerifyEmail), `PostComposer.tsx`, `DocumentTitle.tsx`, `vite.config.ts`, `index.html`, `public/robots.txt`, `e2e/forum.spec.ts`.

---

**Bottom line:** the 62-point audit’s launch blockers (god-state leak, IndexedDB images, missing password reset, no tests, unguarded demo wipe) are fixed in code and verified. The forum is **not** a 90+ production system until secrets, mail, SPA hosting/CSP, and a production Lighthouse/load pass exist.
