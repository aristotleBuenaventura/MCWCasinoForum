# MCW Casino Forum — Full Audit Report

**Date:** 30 Oct 2026  
**Scope:** Local app at `http://localhost:5173` + API `http://127.0.0.1:4000`  
**Mode:** Read-only audit. Application code was not changed.  
**Stack:** Vite 8 + React 19 + Express 5 + Prisma 7 + MySQL  

No production host was tested. Findings below are from source inspection plus local, non-destructive API and browser tests.

---

## 1. Overall Assessment

| | |
| --- | --- |
| **Quality score** | **62 / 100** |
| **Production ready?** | **No** |
| **Biggest risks** | Full-forum state dump, demo admin credentials, Cloudflare test Turnstile keys, admin DB wipe, image storage in browser IndexedDB |

This is a credible **BHW-style frontend prototype** with a real server-side auth layer (httpOnly JWT + session table + RBAC). It is **not** a production forum: every page loads the entire database, several account/moderation features are missing or UI-only, and launch config (secrets, captcha, firewall) is still development-default.

**Major concerns**
1. `GET /api/state` returns all users, threads, comments, likes, follows, **all notifications**, and **all reports** to whoever calls it.
2. Seeded demo passwords and Turnstile **test keys** will be live if you deploy as-is.
3. `POST /api/admin/reset` wipes the whole database (admin-only, still a launch hazard).
4. User-uploaded images are rewritten to `idb:` URLs (browser IndexedDB), so they do not actually persist on the server.
5. No automated tests exist.

---

## 2. Security Findings

Severity uses: **Confirmed** vs **Potential**. Confirmed items were verified in code and/or local tests.

### S1 — Excessive data exposure on `/api/state` (notifications + reports)

- **Severity:** High (confirmed)
- **Where:** `backend/src/lib/forum.ts` `loadState()`, `GET /api/state`
- **Description:** Anonymous `GET /api/state` returned 2 notifications belonging to another user (`user_alice`), including messages like “caraspins liked your thread”. Reports are mapped the same way (none were open in this DB). Staff (`moderator`) responses included **every user’s email**.
- **Repro:** `curl http://127.0.0.1:4000/api/state` while logged out. Inspect `state.notifications` / `state.reports`. Login as moderator and inspect `state.users[].email`.
- **Impact:** Cross-user notification leakage; moderation reports would be public; staff get a full email dump.
- **Fix:** Return only the viewer’s notifications. Return reports to staff only. Never send other users’ emails (or DOB). Paginate public resources.

### S2 — Cloudflare Turnstile uses always-pass test keys

- **Severity:** High (confirmed) for any public deploy using current keys
- **Where:** `src/components/TurnstileWidget.tsx` sitekey `1x00000000000000000000AA`; `backend/src/lib/security.ts` default secret `1x0000000000000000000000000000000AA`
- **Description:** `POST /api/auth/register` with token `XXXX.DUMMY.TOKEN.XXXX` returned **200** and created user `faketok99`. Empty token correctly failed (400).
- **Impact:** Bots can register while test keys remain. Login has **no** Turnstile at all.
- **Fix:** Production sitekey + secret. Fail closed if secret is a test key when `NODE_ENV=production`. Add Turnstile on login.

### S3 — Seeded demo credentials in source

- **Severity:** High (confirmed) if deployed without changing them
- **Where:** `src/data/seed.ts`, `backend/prisma/seed.ts`, README
- **Description:** Well-known accounts (`admin` / `admin123`, `moderator` / `moderator123`, `alicewins` / `password123`, etc.). `seedIfEmpty()` in `backend/src/index.ts` reseeds them if the user table is empty.
- **Impact:** Trivial admin takeover on a public droplet.
- **Fix:** Do not seed demo admins in production. Change passwords before any public URL exists.

### S4 — Admin “reset demo data” wipes the database

- **Severity:** High (confirmed capability; not executed)
- **Where:** `POST /api/admin/reset` → `seedForum()` in `backend/src/routes/admin.ts`; Admin UI button
- **Description:** Admin-gated. Deletes all forum tables and reseeds. Tested as anonymous (401) and as normal user (403). **Not invoked** as admin during this audit.
- **Impact:** One stolen admin session can destroy the community.
- **Fix:** Remove from production, or require a separate env flag + typed confirmation.

### S5 — Weak password policy / no password change or reset

- **Severity:** Medium (confirmed)
- **Where:** `backend/src/routes/auth.ts` (min length 8); `src/components/LoginModal.tsx` “Forgot your password?” copy
- **Description:** No complexity, no breach check, no change-password endpoint, no reset flow. UI says reset is not enabled.
- **Impact:** Stolen or reused passwords cannot be recovered or rotated in-app.
- **Fix:** Stronger policy, change-password, email reset (or remove the forgot-password control).

### S6 — User images stored as data URLs / IndexedDB, not validated uploads

- **Severity:** Medium (confirmed)
- **Where:** `src/lib/postBody.ts` `persistBodyImages()`, `src/lib/media.ts`, `src/lib/utils.ts` `fileToDataUrl`, `PATCH /api/me` avatar, `JSON_BODY_LIMIT` 8mb
- **Description:** Client converts images to `data:` then to `idb:` keys before POST. Server stores whatever string is in `body` / `avatar` with no MIME/size/type allowlist. JSON body allows 8MB.
- **Impact:** Images don’t work across devices; DB can be filled with huge strings; SVG/data URLs are a stored-content risk if ever rendered unsafely.
- **Fix:** Multipart upload to disk or R2; allowlist jpeg/png/gif/webp; size cap; store HTTPS URLs only.

### S7 — Production config gaps (firewall, cookies, secrets)

- **Severity:** High **if** deployed with current defaults; **potential** until droplet is configured
- **Where:** `backend/src/index.ts` listen `0.0.0.0:4000`; `backend/.env.example`; `backend/src/lib/cookies.ts`
- **Confirmed locally:** Cookie `mcw_session` is **HttpOnly**, **SameSite=Lax**, **no Secure** (expected on HTTP). Helmet headers present on API. HSTS off in development. CORS origin is the configured frontend origin (not reflected from `Origin: https://evil.example`).
- **Not confirmed on a droplet:** Open port 4000, weak `JWT_SECRET`, `COOKIE_SECURE=false` behind HTTPS.
- **Fix:** UFW 22/80/443 only; bind API to localhost; 32+ `JWT_SECRET`; `COOKIE_SECURE=true`; `TRUST_PROXY=1`.

### S8 — Authorization is generally correct (RBAC / IDOR)

- **Severity:** Informational (confirmed pass)
- **Tests:** Anonymous POST thread 401; user PATCH/DELETE another user’s thread 403; user PIN 403; user BAN 403; user `POST /api/admin/*` 403; moderator `POST /api/admin/categories` 403; `PATCH /api/me` with `{ role: "admin" }` left role as `user`.
- **Note:** Moderators **can** edit any thread (`forum.ts` denies only when `role === "user"`). Treat as intended staff power, not IDOR.

### S9 — Stored XSS in thread title/body (HTML)

- **Severity:** Informational (confirmed **not** executing)
- **Where:** `src/components/PostBodyView.tsx`, `src/pages/ThreadDetail.tsx`
- **Test:** Created thread title `<script>alert(1)</script>` and body `<img src=x onerror=alert(1)>`. Browser showed the tags as **text**. React does not use `dangerouslySetInnerHTML` for posts. `document.title` stayed generic (see SEO).
- **Residual risk:** `javascript:` / SVG URLs in `img src` were not exhaustively tested.

### S10 — In-memory rate limits; view counter unauthenticated

- **Severity:** Low / Medium (confirmed)
- **Where:** `backend/src/lib/security.ts` Map; `POST /api/threads/:id/view` has no auth
- **Impact:** Limits reset on process restart and don’t share across hosts. Views can be inflated.
- **Fix:** Redis/DB counters; optional view debounce.

### S11 — JWT also accepted from `Authorization: Bearer`

- **Severity:** Low (code review)
- **Where:** `backend/src/lib/cookies.ts` `readAuthToken`
- **Description:** Cookie is primary. Bearer is extra surface (token theft via non-cookie channels).
- **Fix:** Cookie-only if the SPA never uses Bearer.

### S12 — Dependencies

- **Severity:** Informational
- **Result:** `npm audit` (frontend) **0** vulnerabilities. `npm audit` (backend) **0** vulnerabilities. Ran 30 Oct 2026.

No SQL injection vectors found (Prisma only, no raw SQL in app routes). No `.env` committed (`.gitignore` includes `.env` and `backend/.env`). Example env files contain placeholders only.

---

## 3. Functional QA Results

| Feature | Result | Notes |
| --- | --- | --- |
| Registration (valid path) | **NEEDS IMPROVEMENT** | Works with test Turnstile dummy token; 18+, duplicate, empty Turnstile, weak password all rejected in API tests |
| Login / logout | **PASS** | Browser login as `alicewins`; cookie session; logout then POST thread → 401 |
| Stay logged in | **PASS** (API) | `Max-Age=28800` when true; checkbox exposed as readonly in a11y tree |
| Forgot password / reset | **NOT IMPLEMENTED** | UI message only |
| Email verification | **NOT IMPLEMENTED** | |
| Session / idle timeout | **NOT TESTED** (code present) | 30 min idle in `securityConfig.ts`; not waited out |
| Duplicate registration | **PASS** | 409 |
| Invalid / empty login | **PASS** | 401 generic message |
| Profile view / edit / avatar | **NEEDS IMPROVEMENT** | Edit works via `/api/me`; avatar is data URL / IndexedDB, not hosting |
| Password change | **NOT IMPLEMENTED** | |
| Account settings / delete | **NOT IMPLEMENTED** | |
| Roles | **NEEDS IMPROVEMENT** | API `POST /api/admin/users/:id/role` exists; **no Admin UI** uses `setRole` |
| Create thread | **PASS** | Login gate; empty title 400; XSS payload stored as text |
| Edit / delete own thread | **NOT TESTED** in UI | API IDOR 403 for others |
| Categories (admin) | **PASS** (API staff check) | Moderator 403; UI exists on Admin |
| Comments / nested replies | **NEEDS IMPROVEMENT** | Create + parentId exist; thread UI has reply composer; deep nesting / invalid parentId not fully tested |
| Likes | **PASS** (API) | Invalid body 400; home upvote requires login (toast) |
| Bookmarks / saved | **NEEDS IMPROVEMENT** | “Saved” = liked threads; home feed still `slice(0, 3)` |
| Search | **PASS** | Client-side filter of dumped state; `/search?q=mahjong` returned 2 threads |
| Pagination | **NEEDS IMPROVEMENT** | Comments paginate (`PER_PAGE = 10`); home shows 3 hardcoded spotlight threads for “latest” |
| Tags / filters | **NEEDS IMPROVEMENT** | Seed threads have tags; new threads save `tags: []`; reviews “Filter” is a link, not a real filter |
| Notifications | **NEEDS IMPROVEMENT** | User sees own list in UI; API leaks others’ notifications globally |
| Mentions | **NOT IMPLEMENTED** | |
| Reports | **NEEDS IMPROVEMENT** | Endpoint exists + rate limit; UI report on thread; reports dumped in `/api/state` |
| Admin dashboard | **PASS** (gate) | Alice saw “Admin access required.” Admin CMS not click-tested (avoided reset) |
| User management / roles UI | **NOT IMPLEMENTED** | API only |
| Moderation (ban, pin, resolve) | **PASS** (API authz) | UI lives under Admin → Moderation; old `/moderation` redirects to `/admin` |
| Post approval queue | **NOT IMPLEMENTED** | Posts go live immediately |
| Follow | **PASS** (code + UI) | Self-follow rejected in code (`400`) |

**Home feed bug (confirmed):** `src/pages/Home.tsx` for `tab === 'latest'` returns three hardcoded IDs (`thread_mahjong`, `thread_cashout`, `thread_olympus`), then `list.slice(0, 3)`. The default home is a showcase, not a real latest/popular feed.

**Image persistence bug (confirmed in code):** `persistBodyImages` writes `idb:` URLs into the payload stored in MySQL. Other browsers/devices cannot resolve them.

---

## 4. UI/UX Improvements

Preserve the existing navy + gold BHW direction. Do not restyle into generic cards/gradients.

Confirmed in browser (desktop + ~390px emulation):

- Direction is consistent: dark navy, gold headings, XenForo-like login overlay, member cards.
- Desktop home is dense and on-brand. Header search truncates (“Search discussions, gar…”).
- Mobile: hamburger + bell + avatar; left/right rails hidden (`hidden lg:`). Header is usable. Content stacked.
- Footer “Company / Press / FAQ / Terms / Privacy” are **non-links** (dead chrome).
- Register/login forms are labeled; overlay has `aria-modal`. Stay-logged-in checkbox is `readonly` in the accessibility tree.
- Loading state exists (“Loading forum…”). Empty search has a hint. Boot error tells the user to start MySQL.
- Home “Active members 6” includes the audit-created `faketok99`.
- Category cards are logo tiles with mixed alt text; many decorative images have empty `alt` (17 of 26 on home).
- Admin “Reset demo data” is one confirm() from destroying production data — too prominent.
- No per-page titles; every route is “MCW Casino Forum”.
- Left rail “Saved” / feed tabs are easy to miss versus the marketing home modules.

---

## 5. Performance Findings

**Measured (local, ~6 users, 20 threads):**

| Check | Result |
| --- | --- |
| `GET /api/state` | ~3–13 ms, **~24–25 KB** JSON |
| `GET /api/health` | 200, ~20 ms |
| Frontend `npm audit` | 0 vulns |
| Backend `npm audit` | 0 vulns |
| Automated tests | **None** (no Vitest/Playwright/Jest files) |
| Lighthouse / CWV | **Not run** (no Lighthouse CLI in project; not installed for this audit) |
| Production bundle size | **Not measured** (build not run, to avoid extra artifacts) |

**Architecture (will not scale as-is):**

- Every navigation that calls `refresh()` reloads **all tables** (`users`, `threads`, `comments`, `likes`, `follows`, `notifications`, `reports`, ads, games, providers, settings).
- Category `threadCount` / `postCount` are computed in JS with nested filters (O(categories × threads × comments)).
- Search, leaderboards, and home stats all run in the browser on the full dump.
- No query pagination except comment pages in the UI.
- Indexes exist for sessions, threads by forum/createdAt, comments by thread, notifications by user. Missing useful indexes: `threads.authorId`, `likes.targetId`, `reports.status`.
- User images as data URLs inside JSON will explode payload size long before user count does.
- In-memory rate-limit maps grow until process restart.

**Scale (evidence-based, not a claim of capacity):**

| Users | Likely behavior with current `/api/state` |
| --- | --- |
| 1,000 | Usable if posts stay small; payload already heavy with images |
| 10,000 | State JSON and in-browser search become slow; MySQL full-table reads on every page |
| 50,000–100,000 | Not viable without splitting list/detail endpoints, pagination, and CDN images |

oxlint: **14 warnings, 0 errors** (impure render `Date.now`, hook deps, Fast Refresh on `useForum`).

---

## 6. Missing Features (modern forum)

- Email verification, password reset/change, account deletion
- Real Turnstile (production keys) on login
- Server-side search, pagination, sort
- Bookmarks distinct from likes
- Mentions, quotes, BBCode/Markdown with sanitization
- Unread thread tracking, last-read
- Image/file hosting
- Post edit history
- User role UI, timed suspensions (only boolean `banned`)
- 2FA
- Terms/privacy actual pages
- SEO: unique titles, meta description, OG, sitemap, robots.txt, canonical
- CSRF token (mitigated today by SameSite=Lax + origin CORS; still no SPA CSP)
- Automated test suite
- Prisma migration history (project uses `db push`)

**Dead / leftover code**

- `server/` (old Hono stack, `package-lock.json` without `package.json`)
- `src/pages/Forums.tsx` unused (`/forums` redirects to `/communities`)
- `src/pages/Moderation.tsx` unused (`/moderation` redirects to `/admin`)

---

## 7. Prioritized Action Plan

### P0 — Launch blockers (do before any public URL)

1. Replace demo admin/user passwords; disable seed of known credentials in production.
2. Real Cloudflare Turnstile sitekey + secret; refuse to boot if test keys in production.
3. Droplet: strong DB password, 32+ `JWT_SECRET`, `COOKIE_SECURE=true`, `CORS_ORIGIN` = real HTTPS origin, UFW, API not public on :4000.
4. Remove or hard-disable `POST /api/admin/reset`.
5. Filter `/api/state`: viewer-only notifications; staff-only reports; no emails/DOB for other users.

### P1 — Must fix before calling it a real forum

1. Replace god-endpoint with paginated thread list + thread detail + `/api/me`.
2. Fix image pipeline (`idb:` / data URLs → real URLs).
3. Password change; either implement reset or remove the control.
4. Home feed should list real latest/popular threads, not 3 hardcoded IDs.
5. Production CSP on the **static site** (Helmet on JSON API does not protect the SPA).

### P2 — Important after launch-shape is right

1. Email verification; disposable-email list is tiny.
2. Login Turnstile + server-side rate limits that survive restart.
3. Role management UI; hide Reset in Admin.
4. Server search; indexes; drop leftover `server/` and unused pages.
5. Footer legal pages; image alts; per-route document titles.

### P3 — Nice-to-have

1. Mentions, bookmarks, post approval, 2FA, edit history, CDN images.
2. Vitest + Playwright smoke (auth, create thread, IDOR).
3. Lighthouse pass; Open Graph; sitemap.

---

## 8. Final Recommendation

**Is it ready for production?** No.

**Biggest risks:** Dumping the whole community (including other people’s notifications) on every load; shipping test captcha and demo admin; admin wipe; images that never really leave the uploader’s browser.

**Must fix before launch:** P0 list (credentials, Turnstile, droplet hardening, disable reset, lock down `/api/state`).

**Improve after launch:** Pagination/API split, real image hosting, password reset, tests, SEO.

**What is already in good shape:** Server-side login-to-post, admin-only CMS gate, IDOR checks on edit/delete, bcrypt, httpOnly session cookie, helmet/CORS basics, React text rendering (no HTML XSS on posts), navy/gold UI direction.

---

## Appendix — Tests run

| Test | Result |
| --- | --- |
| `GET /api/health` | 200 `{ ok: true }` |
| `GET /api/state` anonymous | 200, ~24.8 KB, 5–6 users, notifications leaked |
| `POST /api/threads` anonymous | 401 |
| `POST /api/admin/reset` anonymous | 401 |
| `POST /api/admin/reset` as user | 403 |
| Invalid / empty login | 401 |
| Login `alicewins` | 200, HttpOnly cookie |
| Mass-assign `role: admin` via `PATCH /api/me` | Role stayed `user` |
| IDOR PATCH/DELETE/PIN/BAN as user | 403 |
| Register duplicate / underage / weak / no token | 409 / 400 / 400 / 400 |
| Register dummy Turnstile token | **200** (test keys) |
| Moderator admin CMS | 403 |
| Moderator `/api/state` emails | All 6 user emails present |
| CORS `Origin: https://evil.example` | ACAO stayed `http://localhost:5173` (browser would block) |
| Helmet on API | CSP, `X-Frame-Options: SAMEORIGIN`, `nosniff` |
| Browser login, home, thread, admin gate, search, communities, profile, notifications, create, members, mobile header | Exercised |
| `npm audit` root + backend | 0 vulnerabilities |
| `npx oxlint src backend/src` | 14 warnings, 0 errors |
| Unit/E2E suite | **Does not exist** |
| Lighthouse | **Not run** |

**Audit artifacts left in local DB (not deleted, per instructions):** user `faketok99`; thread `thread_7506a43ae31e` with XSS-as-text title. Safe to delete later.

**Not tested:** real SMTP, droplet Nginx, Cloudflare production keys, 30-minute idle expiry, multi-tab session revoke, file-upload malware, Lighthouse scores, 1k+ user load.
