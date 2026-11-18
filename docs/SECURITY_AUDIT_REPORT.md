# MCW Casino Forum — Security Audit Report

**Date:** 2026-11-19  
**Scope:** React (Vite) frontend + WordPress `mcw-forum` plugin REST API + session auth  
**Mode:** Discovery + Critical/High remediation with verification

## 1. Architecture discovered

| Layer | Location | Notes |
|-------|----------|--------|
| SPA | `src/` | React Router, locale `/` + `/bn`, ForumContext |
| API client | `src/lib/api.ts` | `fetch` + credentials, `?lang=` for BN |
| WP plugin | `wordpress/wp-content/plugins/mcw-forum/` | Custom CPT/tax, REST `mcw/v1`, sessions table |
| Auth | `class-auth.php` | Cookie `mcw_session`, SHA-256 token hash, `last_seen_at` |
| CORS | `class-cors.php` | Single allowed origin (`MCW_CORS_ORIGIN`) |
| Legacy Node backend | `backend/` | Present; SPA uses WP REST via Vite proxy (not primary path audited for runtime) |
| Env | `.env` / `.env.example` | Gitignored; local secrets may exist on disk |

**Skipped / out of runtime path:** commercial WPML zips, WordPress core under `wordpress/**` (gitignored except plugin), `node_modules`.

## 2. Components inspected

- All `mcw-forum` PHP includes (`class-rest`, `auth`, `cors`, `serialize`, `forum`, `translate`, uploads path)
- React auth/admin flows (`ForumContext`, `Admin.tsx`, upload/composer)
- REST route table (`permission_callback` pattern)
- CORS / cookie settings
- File upload handler
- Role / ban / nameplate / CMS admin endpoints
- Public user serialization

## 3. Vulnerabilities identified (pre-fix)

| ID | Severity | Finding | Impact |
|----|----------|---------|--------|
| C1 | **Critical** | `/admin/users/{id}/role` had **no admin check** | Any logged-in user (with Origin) could self-promote to admin |
| C2 | **Critical** | Most `/admin/*` CMS routes only used CORS `guard`, not role checks | Category/ad/game/provider create/delete, ads rotate, nameplate, reset abuse |
| C3 | **Critical** | `/admin/users` + `/admin/reports` had **no authentication** | Full user PII (emails) + reports exposed publicly |
| C4 | **Critical** | `DELETE/PATCH` thread & `DELETE` comment lacked ownership | Any user could edit/delete others’ content |
| H1 | **High** | Mutating requests allowed with **no Origin/Referer** | Cookie CSRF / scripted abuse without browser Origin |
| H2 | **High** | Upload accepted via `media_handle_upload` with weak type checks | Malicious file upload risk |
| H3 | **High** | No login/register/comment/upload rate limits | Brute force / spam |
| H4 | **High** | `ban_user` / `resolve_report` lacked mod checks | Privilege abuse |
| M1 | **Medium** | Account delete without password re-auth | Account wipe if session stolen |
| M2 | **Medium** | Post `mcw_body` blocks stored with limited sanitization | Stored XSS if renderer unsafe |
| M3 | **Medium** | API user payload included empty `password` field | Confusing / leak surface |
| M4 | **Medium** | All routes use `permission_callback => __return_true` | Relies on handler checks (now strengthened) |
| L1 | **Low** | Forgot/reset/verify routes registered without real handlers | Dead/incomplete auth recovery |
| L2 | **Low** | Turnstile verified only client-side (if used) | Bot registration residual risk |

## 4. Fixes implemented

| Area | Change |
|------|--------|
| AuthZ helpers | `require_admin`, `require_mod`, `can_manage_post`, `sanitize_blocks`, `rate_limit` in `class-rest.php` |
| Admin APIs | All admin CMS / role / nameplate / reset / stats / users require **admin** |
| Mod APIs | Reports resolve + ban require **mod/admin**; cannot ban admins/self |
| Role change | Whitelist roles; cannot demote self; `error_log` audit line |
| Content ownership | Patch/delete thread & delete comment: owner **or** mod |
| CORS / CSRF | Mutating requests **must** send matching Origin or Referer |
| Uploads | Allowlist jpg/png/webp/gif; MIME+ext check; `getimagesize`; 5MB; rate limit |
| Auth abuse | Login/register/comment/upload rate limits |
| Body content | `sanitize_blocks` for text/image only |
| Password / account | Min password length; delete account requires password; admins cannot self-delete via API |
| Serialization | Removed `password` key from `public_user` |
| Headers | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, CSP `frame-ancestors` |

**Files modified:**

- `wordpress/wp-content/plugins/mcw-forum/includes/class-rest.php`
- `wordpress/wp-content/plugins/mcw-forum/includes/class-auth.php`
- `wordpress/wp-content/plugins/mcw-forum/includes/class-cors.php`
- `wordpress/wp-content/plugins/mcw-forum/includes/class-serialize.php`
- `docs/SECURITY_AUDIT_REPORT.md` (this file)
- `docs/SECURITY_REMAINING_RISKS.md`

## 5. Verification performed

Against local `http://127.0.0.1:8080/wp-json/mcw/v1`:

| Test | Result |
|------|--------|
| `GET /admin/users` unauthenticated | **401** |
| `GET /admin/stats` unauthenticated | **401** |
| `GET /admin/reports` unauthenticated | **401** |
| `POST /admin/users/1/role` no Origin/cookie | **403** |
| `DELETE /threads/10` no Origin/cookie | **403** |

### Administrator account authorization (dedicated pass)

Server-side controls:

- Forum admin = `mcw_role=admin` **and** WordPress `manage_options` (`MCW_Forum_Auth::is_admin_user`)
- All `/admin/*` routes use `permission_callback` → `rest_permission_admin`
- Role changes only via `admin_set_role` + `apply_forum_role` (whitelist; last-admin protect; session invalidate)
- Register / `PATCH /me` strip role/password mass-assignment
- `change_password` / `delete_account` operate only on the session user; admins cannot self-delete via API
- Origin/Referer required on mutating cookie-auth requests

Regression:

```bash
npm run test:security:admin
# or: php wordpress/wp-content/plugins/mcw-forum/tests/admin-account-security.php
```

Non-destructive suite (throwaway users only; never demotes/deletes/changes real admins): anon + regular-user denial of promote/demote/ban/nameplate/admin APIs; `/me` + register role injection; password target-id injection; account-delete id injection. **19 assertions green** on 2026-11-19.

Playwright mirror: `e2e/admin-account-security.spec.ts` (requires WP on `:8080`).

## 6. Dependencies

- Frontend: `npm audit` not executed in this pass (recommend in CI).
- WordPress core/plugins outside `mcw-forum` are deployment concerns (keep core updated).

## 7. Production deployment checklist

1. Set `MCW_CORS_ORIGIN` to the exact SPA origin (no wildcard).
2. Serve SPA + API over **HTTPS**; set session cookies `secure` when SSL.
3. Confirm Cloudflare/WAF rate limits on `/wp-json/mcw/v1/auth/*`.
4. Disable WP debug display in production (`WP_DEBUG_DISPLAY=false`).
5. Ensure uploads directory is not PHP-executable.
6. Rotate any secrets that may have lived in local `.env`.
7. Re-test admin login + create thread/comment/upload after deploy.
8. Review `SECURITY_REMAINING_RISKS.md` and schedule follow-ups.

## 8. Residual risk summary

See `docs/SECURITY_REMAINING_RISKS.md`. Highest remaining items: server-side Turnstile, MFA for admins, full CSP on the SPA host, implementing password-reset handlers securely, and moving authorization into REST `permission_callback` for defense in depth.

## 9. Anti-spam / malicious-link pass

See `docs/SECURITY_ANTISPAM.md`. `MCW_Forum_Content_Guard` gates threads, comments, profiles, reports, and CMS URLs (sanitize, URL allow/block lists, rate limits, duplicates, soft hold). Regression: `npm run test:security:spam` (**22 passed**; no deletion of existing legitimate content).

## 10. Database security pass

See `docs/SECURITY_DATABASE.md`. Added `MCW_Forum_DB` (typed inserts/updates/deletes, meta allowlists, user-update field filter); fixed `LIMIT` interpolation; hardened like/follow/bookmark targets; admin reports/notifications use prepared column lists. Regression: `npm run test:security:db` (non-destructive).

## 11. Upload / filesystem pass

See `docs/SECURITY_UPLOADS.md`. `MCW_Forum_Upload` enforces magic-byte + MIME allowlist (no SVG), randomized names, uploads `.htaccess` hardening, path containment, and authorized `DELETE /uploads/{id}`. Suspicious web-root helpers documented for manual review (not auto-deleted). Regression: `npm run test:security:upload`.
