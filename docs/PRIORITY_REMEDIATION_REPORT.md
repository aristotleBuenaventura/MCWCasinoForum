# Priority Security Remediation Report

**Date:** 2026-11-19  
**Basis:** `POST_REMEDIATION_VERIFICATION_REPORT.md`, `SECURITY_REMAINING_RISKS.md`, `SECURITY_AUDIT_REPORT.md`  
**Environment verified:** Local staging (`php -S` + `router.php`) — not production Apache/nginx  
**Constraint:** No production DB changes; no admin account deletion/credential changes; media not mass-deleted  

**Overall:** High/Medium exposure findings (V-1, V-2) are **PASS** after moving tooling out of the document root and verifying HTTP 404s. Upload execution denial is **PASS** on the local router and **PARTIAL** for production pending ops apply of nginx/Apache snippets. REST mutating routes now use authenticated `permission_callback`s (**PASS**). Password reset is implemented securely (**PASS**). Admin MFA is **not** enabled (**NOT VERIFIED** / not claimed). Turnstile is server-ready when secret is set (**PARTIAL** until configured). npm production audits: **0 vulnerabilities**.

---

## V-1 — Exposed installer / helper PHP

| Field | Detail |
|-------|--------|
| Original severity | **High** |
| Root cause | Dev/WPML/installer one-shots lived under `wordpress/` document root and were HTTP-reachable |
| What they did | CLI helpers: installer diagnostics, WPML install/seed/backfill, provider sync — several read installer options / keys when run |
| Production required? | **No** (CLI maintenance only) |
| Fix | Moved 15× `_*.php` → `tools/wordpress/helpers/`; patched `wp-load` paths; `wordpress/.htaccess` deny; `router.php` deny; docs/package paths updated |
| Files | `tools/wordpress/helpers/*`, `wordpress/router.php`, `wordpress/.htaccess`, `package.json`, `docs/WORDPRESS-HEADLESS.md`, `tools/wordpress/README.md`, `.gitignore` |
| Verification | `GET/HEAD /_check_installer.php` → **404**; encoded / trailing-slash → **404**; webroot count of `_*.php` = **0**; upload suite REVIEW_COUNT **0** |
| Status | **PASS** |
| Remaining risk | Files must not be copied back into `wordpress/` on deploy; edge nginx/Apache rules still required if someone reintroduces them |
| Prod action | Apply `docs/deploy/nginx-security.conf.example` / `apache-security.conf.example` deny rules |

---

## V-2 — wp-cli.phar exposure

| Field | Detail |
|-------|--------|
| Original severity | **Medium** |
| Root cause | `wp-cli.phar` lived inside the public WP tree |
| Fix | Moved to `tools/wordpress/wp-cli.phar`; `npm run wp:cli` / seed scripts updated; HTTP deny in router + `.htaccess` |
| Verification | `GET /wp-cli.phar` → **404**; `Test-Path wordpress/wp-cli.phar` → **False**; `php tools/wordpress/wp-cli.phar --path=wordpress plugin list` works (`mcw-forum` active) |
| Status | **PASS** |
| Remaining risk | Same as V-1 if reintroduced under docroot |
| Prod action | Keep CLI phar outside DocumentRoot |

---

## V-3 — Upload directory PHP execution

| Field | Detail |
|-------|--------|
| Original severity | **Medium** |
| Root cause | `.htaccess` ignored by `php -S`; prior `uploads/index.php` was executable |
| Fix (app) | `router.php` denies `/wp-content/uploads/*.(php|phtml|phar)`; `ensure_uploads_hardened()` writes `index.html` and neutralizes `index.php` to 403 exit; uploads `.htaccess` retained |
| Fix (infra docs) | `docs/deploy/nginx-security.conf.example`, `docs/deploy/apache-security.conf.example` |
| Verification (local) | `GET /wp-content/uploads/index.php` → **404** via router; legitimate JPG media still present |
| Production Apache/nginx | **NOT VERIFIED** (config not applied on a real prod host in this session) |
| Status | **PARTIAL** — local/router **PASS**; production depends on ops applying snippets |
| Prod action | Include deploy snippets in vhost; confirm with a controlled `.php` probe under uploads on staging |

---

## P4 — REST API permission callbacks

| Field | Detail |
|-------|--------|
| Original | Mutating routes used `__return_true` (handler auth only) |
| Fix | Added `rest_permission_auth()`; applied to 19 mutating/private routes (create/patch/delete thread & comment, likes, follows, reports, uploads, profile, notifications, logout, password, account). Public GETs + register/login/forgot/reset remain public intentionally |
| Files | `class-rest.php` |
| Verification | Security suites green; anon `POST /uploads` → **401**; admin suites still deny privilege escalation; bootstrap **200** |
| Status | **PASS** |
| Remaining risk | Handler-level checks remain; public view counter POST still public by design |

---

## P5 — Rate limiting & bot protection

| Field | Detail |
|-------|--------|
| Existing | Rate limits on register/login/comment/thread/upload/report/profile |
| Fix | Added rate limits on forgot/reset/verify; `MCW_Forum_Turnstile` server verify when `MCW_TURNSTILE_SECRET` / `TURNSTILE_SECRET` set; wired into register/login/forgot |
| Verification | Forgot returns generic **200**; suites green. Turnstile blocking **NOT VERIFIED** (secret unset locally — by design skips) |
| Status | **PARTIAL** — rate limits **PASS**; Turnstile **PARTIAL** until secret configured in production |
| Prod action | Set real Turnstile secret; send `turnstileToken` from SPA |

---

## P6 — Password reset & admin MFA

| Field | Detail |
|-------|--------|
| Password reset | Implemented: hashed token (`mcw_reset_hash`), 1h expiry, single-use delete, generic forgot response, session invalidate on reset, rate limits |
| Verification | Forgot unknown email → generic success; reset bad token → **400** `Invalid or expired reset token.`; admin password unchanged in admin suite |
| MFA | **Not implemented** — no TOTP/WebAuthn; explicitly **not claimed enabled** |
| Status | Reset **PASS**; MFA **NOT APPLICABLE** / remaining risk |
| Remaining risk | Mail delivery depends on host `wp_mail`; SPA `/reset-password` must post `uid`+`token`+password; enable MFA as follow-up |

---

## P7 — Dependency security

| Field | Detail |
|-------|--------|
| Commands | `npm audit --omit=dev` (root + `backend/`) |
| Result | **found 0 vulnerabilities** (both) |
| Composer / WP plugins | WPML commercial plugins present; no Composer app lock audited beyond WP core |
| Status | npm **PASS**; full WP/plugin CVE feed **NOT VERIFIED** |
| Action | Keep WP core/plugins patched; do not blindly upgrade WPML |

---

## P8 — Verification matrix

| Check | Result |
|-------|--------|
| `test:security:admin` | 19 passed |
| `test:security:spam` | 22 passed |
| `test:security:db` | 24 passed |
| `test:security:upload` | 20 passed (REVIEW_COUNT 0) |
| Playwright admin e2e | 2 passed |
| `npm run build` | success |
| Helper/phar HTTP probes | 404 |
| Uploads PHP via router | 404 |
| Public bootstrap | 200 |
| WP-CLI from tools path | works |

---

## Status summary

| ID | Status |
|----|--------|
| V-1 helpers | **PASS** |
| V-2 wp-cli.phar | **PASS** |
| V-3 uploads execution | **PARTIAL** (local PASS; prod nginx/Apache required) |
| P4 REST perms | **PASS** |
| P5 rate/Turnstile | **PARTIAL** |
| P6 reset / MFA | Reset **PASS**; MFA not enabled |
| P7 npm audit | **PASS** (0 vulns) |

**This report does not claim 100% security.** Production still requires applying `docs/deploy/*-security.conf.example`, configuring Turnstile, and deciding on admin MFA.
