# Final Production Security Readiness Gate

**Date:** 2026-11-19  
**Auditor role:** Independent production security auditor  
**Application:** MCW Casino Forum (React SPA + WordPress `mcw-forum` + optional Node `backend`)  
**Evidence basis:** `PRIORITY_REMEDIATION_REPORT.md`, `POST_REMEDIATION_VERIFICATION_REPORT.md`, `SECURITY_REMAINING_RISKS.md`, `SECURITY_AUDIT_REPORT.md`, plus live re-verification this session  
**Environment tested:** Local staging (`php -S` + `wordpress/router.php`, Vite) — **not** production Apache/nginx/TLS  
**Constraints honored:** No production DB mutation; no admin credential changes; no mass media deletion  

---

## Gate outcome

# **NOT READY**

Essential production infrastructure controls are **not verified** on a production-like host (TLS/HSTS, real web-server upload/helper deny, DB least privilege, backup/recovery). Per gate rules, the system **must not** be marked READY, and remaining essential unverified controls force **NOT READY** for production traffic.

Application-layer Critical/High findings from prior audits appear remediated and re-confirmed on local staging. That is **necessary but not sufficient** for production.

**This report does not claim 100% security.**

---

## Criteria matrix

| Criterion | Status | Evidence / notes |
|-----------|--------|------------------|
| No public installer/helper PHP | **PASS** (local) | `wordpress/_*.php` count **0**; helpers in `tools/wordpress/helpers/` (15); `GET/HEAD /_check_installer.php` (+ trailing slash, `%5F` encoding) → **404** |
| No downloadable `wp-cli.phar` | **PASS** (local) | Not under `wordpress/`; present in `tools/wordpress/`; `GET/HEAD /wp-cli.phar` → **404** |
| No PHP execution in uploads | **PARTIAL** | Router + uploads `.htaccess` + docs examples; `GET /wp-content/uploads/index.php` → **404** on local router. **Production Apache/nginx deny NOT VERIFIED** |
| Sensitive REST ops have explicit AuthZ | **PASS** | Mutating/private routes use `rest_permission_auth`; admin/mod use dedicated callbacks |
| No privilege escalation | **PASS** (suites + live) | Anon `POST …/admin/users/1/role` → **401**; admin suite privilege cases pass when not rate-limited |
| No unauthorized admin ops | **PASS** | Admin routes require admin + `manage_options` (prior live + suite) |
| No SQLi findings | **PASS** | DB suite **24/24**; prepared statements / allowlists |
| No unresolved Critical/High XSS | **PASS** (residual Low) | Sanitize + React text; admin HTML caution remains Low residual |
| No unrestricted upload/delete | **PASS** | Anon upload **401**; foreign delete **403** (upload suite) |
| No unauthorized content modification | **PASS** | Ownership/mod checks + suites |
| No exposed application secrets | **PASS** (repo hygiene) | `.env` / `backend/.env` gitignored; no helper PHP in docroot. Live prod secret inventory **NOT VERIFIED** |
| No Critical/High npm vulns unaddressed | **PASS** | `npm audit --omit=dev` root + `backend/` → **0 vulnerabilities**. WP core/plugin CVE feed **NOT VERIFIED** |
| HTTPS + secure cookies | **NOT VERIFIED** (prod) | Code sets `secure => is_ssl()`, `httponly`, `SameSite=Lax`. Staging is HTTP so Secure flag off. Prod TLS/HSTS/cookie behavior **not** proven |
| Secure DB permissions | **NOT VERIFIED** | No production MySQL grant review; local often uses privileged user |
| Working backup & recovery | **NOT VERIFIED** | No documented/tested backup-restore procedure found in repo docs |
| Working security logging | **PARTIAL** | `[mcw-security]` `error_log` on role/ban/reset; no verified centralized log shipping/alerting |
| Auth + password reset | **PASS** (app) | Forgot generic **200**; bad reset token **400**; hashed one-time token design verified earlier |
| Admin MFA | **NOT CONFIGURED** | Not implemented; **must not** be claimed enabled |
| Rate limiting / bot protection | **PARTIAL** | Rate limits enforced (suite saw **429** under load); Turnstile secret **unset** → server verify skipped |
| Production build + regression | **PARTIAL** | `npm run build` **success**; spam/db/upload suites green; admin suite **17/19** and Playwright **1/2** failed solely due to register **429** rate-limit saturation in this session (control working; test env contaminated) |

---

## Independent re-verification (this gate)

### Inventory

| Check | Result |
|-------|--------|
| `wordpress/_*.php` | **0** |
| `wordpress/wp-cli.phar` | **absent** |
| `tools/wordpress/helpers/_*.php` | **15** |
| `tools/wordpress/wp-cli.phar` | **present** |
| `uploads/.htaccess` | **present** |
| Deploy snippets | `docs/deploy/nginx-security.conf.example`, `apache-security.conf.example` |

### Live HTTP (staging `127.0.0.1:8080`)

| Request | Result |
|---------|--------|
| `GET/HEAD /_check_installer.php` | **404** |
| `GET/HEAD /_check_installer.php/` | **404** |
| `GET/HEAD /%5Fcheck_installer.php` | **404** |
| `GET/HEAD /wp-cli.phar` | **404** |
| `GET/HEAD /wp-content/uploads/index.php` | **404** |
| `GET /wp-json/mcw/v1/bootstrap` | **200** |
| Anon `POST /uploads` + Origin | **401** |
| `POST /auth/forgot` unknown email | **200** generic message |
| `POST /auth/reset` bad token | **400** invalid/expired |
| Anon `POST /admin/users/1/role` | **401** |
| `MCW_TURNSTILE_SECRET` | **undefined / env-unset** |

### Suites / build

| Check | Result |
|-------|--------|
| `test:security:spam` | **22 passed** |
| `test:security:db` | **24 passed** |
| `test:security:upload` | **20 passed**, `REVIEW_COUNT 0` |
| `test:security:admin` | **17 passed, 2 failed** (`429` Too many attempts on register — rate limit) |
| Playwright admin e2e | **1 passed, 1 failed** (same register **429**) |
| `npm audit --omit=dev` (root, backend) | **0 vulnerabilities** |
| `npm run build` | **success** |

Rate-limit failures are **not** treated as AuthZ regressions; they confirm abuse controls. Re-run admin/e2e after rate-limit windows clear before using suite green as a release checkbox.

---

## Why not READY or CONDITIONALLY READY

| Outcome | Why not assigned |
|---------|------------------|
| **READY** | Required infrastructure protections (TLS, real web-server upload/helper deny, DB grants, backups) were **not** verified |
| **CONDITIONALLY READY** | Gate definition allows accepted residual risk **with** required mitigations, but **essential** controls here remain **unverified** rather than verified-and-accepted. Until those are applied and re-tested on staging that matches production, cutover is **NOT READY** |

After the mandatory actions below are completed and independently re-verified on production-like staging, expect the next gate to land at **CONDITIONALLY READY** (if MFA/Turnstile residuals are explicitly accepted) or **READY** (if MFA policy + all infra controls are verified).

---

## Outstanding actions before deployment

### Blockers (must complete and verify)

1. **Deploy on Apache or nginx (not `php -S`)** and apply `docs/deploy/nginx-security.conf.example` or `apache-security.conf.example`.
2. **Prove upload script denial** on that stack with a controlled non-weaponized `.php` probe under uploads (expect deny/404; do not leave the probe file).
3. **Prove helper/phar denial** at the edge even if files are accidentally reintroduced (`/_*.php`, `/wp-cli.phar`).
4. **Terminate TLS** end-to-end; enable **HSTS** at edge/CDN; confirm `mcw_session` is issued with **`Secure; HttpOnly; SameSite=Lax`** over HTTPS.
5. **Set production CORS origin** (`MCW_CORS_ORIGIN`) to the real SPA origin only.
6. **Create least-privilege MySQL user** for the app (no `FILE`/`SUPER`/`GRANT`); verify grants.
7. **Implement and test backup + restore** (DB + `wp-content/uploads`) on staging; document RPO/RTO.
8. **Confirm Node `backend/` is not publicly exposed** if unused (or harden it separately if it is).
9. **Ensure deploy never copies** `tools/wordpress/helpers` or `wp-cli.phar` into the public document root.
10. **Set `WP_DEBUG_DISPLAY=false`** (and avoid verbose errors to clients) in production.

### Strongly recommended before public traffic

11. Configure **Cloudflare Turnstile** (`MCW_TURNSTILE_SECRET` / sitekey); confirm SPA sends `turnstileToken`; fail closed in production when unset if policy requires.
12. Ship **`[mcw-security]` logs** to a protected store with retention/alerting (role/ban/reset).
13. Edge **WAF** rules for `/auth/login`, `/auth/register`, `/auth/forgot`, `/uploads`.
14. Patch **WordPress core + plugins** (incl. WPML) from vendor advisories; do not blind-upgrade.
15. Decide **admin MFA** policy: implement TOTP/WebAuthn **or** formally accept single-factor admin risk in writing.
16. Set SPA/static-host **CSP** / security headers beyond API-only headers.
17. Clear rate-limit state and **re-run** `test:security:admin` + Playwright admin e2e to full green before release sign-off.
18. Rotate any secrets that lived in local `.env` / installer options if they may have been exposed historically.

### Explicit residual risks (acceptable only with written acceptance)

| Residual | Severity | Acceptance note |
|----------|----------|-----------------|
| No admin MFA | High operational | Do not claim MFA enabled |
| Turnstile unset until configured | Medium | Bots can hit auth until secret + SPA wired |
| Public member/user enumeration | Low | Forum UX tradeoff |
| WP `wp/v2/media` public listing | Info | Expected WP behavior |
| Incomplete WP plugin CVE continuous scan | Medium | Operational patching required |

---

## Sign-off

| Role | Decision |
|------|----------|
| Independent security gate | **NOT READY** for production deployment |
| Application security (local staging) | Prior Critical/High AuthZ, upload, SQLi, CSRF, ownership controls **re-confirmed** |
| Infrastructure security | **Incomplete** — blockers 1–10 outstanding |

**Re-gate trigger:** After blockers are applied on a staging host that mirrors production web server + TLS, re-run this checklist and update this document with a new outcome date.

---

## Follow-up (2026-11-19 infrastructure prep)

Repository preparation completed under `docs/deploy/` and `docs/PRODUCTION_INFRASTRUCTURE_REMEDIATION_REPORT.md` (nginx/Apache examples, DB SQL, backup procedure, checklist, secrets templates, logging/Turnstile hooks). **Gate outcome remains NOT READY** — examples are not active production controls until staging verification.
