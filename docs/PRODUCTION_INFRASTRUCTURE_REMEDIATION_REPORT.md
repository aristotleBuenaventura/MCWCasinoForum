# Production Infrastructure Remediation Report

**Date:** 2026-11-19  
**Role:** Senior DevSecOps / WordPress Infrastructure / Database Security  
**Scope:** Repository + local staging only — **no production deployment**, no production DB changes  
**Basis:** `FINAL_PRODUCTION_SECURITY_READINESS.md` blockers + prior security reports  

**Overall:** Infrastructure security controls are **prepared in-repo** (configs, procedures, app hooks). Live Apache/nginx/TLS/DB grants/backups on a production-like host remain **NOT VERIFIED**. The readiness gate must stay **NOT READY** until staging verification completes. This report does **not** claim production protection is active or that the system is production-ready.

---

## Control classification summary

| Control | Status |
|---------|--------|
| nginx hardening examples | **PARTIAL** |
| Apache hardening examples | **PARTIAL** |
| Local router / `.htaccess` deny rules | **PASS** (local staging) |
| TLS / HSTS preparation | **PARTIAL** (docs; HSTS not enabled prematurely) |
| Secure / HttpOnly / SameSite cookies | **PARTIAL** (code ready; HTTPS prod NOT VERIFIED) |
| Security headers (API baseline) | **PASS** (plugin); SPA CSP **PARTIAL** (nginx example) |
| DB least-privilege SQL + docs | **PARTIAL** |
| Backup / restore procedure | **PARTIAL** |
| Node backend exclusion guidance | **PASS** (documented; SPA default = WP) |
| Secrets templates | **PASS** (no real secrets committed) |
| Security logging expansion | **PASS** (code); shipping/alerting **PARTIAL** |
| Turnstile fail-closed + SPA token | **PARTIAL** (ready; secret unset locally) |
| Admin MFA | **FAIL** / not implemented (documented only) |
| Automated local verification | **PASS** / **PARTIAL** (see matrix) |

---

## Per-control detail

### 1. Apache / nginx hardening

| Field | Detail |
|-------|--------|
| Root cause | Prior snippets incomplete; prod edge never applied |
| Files | `docs/deploy/nginx-security.conf.example`, `apache-security.conf.example`, `wordpress/.htaccess`, `wordpress/router.php` |
| Fix | Expanded deny rules (helpers, phar, env, sql/backups, wp-config), uploads no-PHP, SPA `/api`→WP, headers, PHP-FPM notes; document choose-one server |
| Verification | Local router: helpers/phar/uploads PHP → 404 (prior + this pass). `nginx -t` / Apache configtest → **NOT VERIFIED** (no prod-like host) |
| Status | **PARTIAL** |
| Remaining | Ops must apply and probe on staging |

### 2. TLS and security headers

| Field | Detail |
|-------|--------|
| Files | Deploy examples; `class-cors.php` (existing); `class-auth.php` `cookie_secure()` + `MCW_FORCE_SECURE_COOKIES`; `wp-config-security.fragment.php.example` |
| Fix | Document HTTPS→HSTS order; Secure cookie force behind TLS proxy; header examples including SPA CSP |
| Verification | Cookie Secure on HTTPS **NOT VERIFIED**; HSTS intentionally not claimed |
| Status | **PARTIAL** |

### 3. Database least privilege

| Field | Detail |
|-------|--------|
| Files | `docs/deploy/database-least-privilege.sql.example` |
| Fix | Exact GRANT set without FILE/SUPER/GRANT OPTION; SHOW GRANTS review notes; plugin table list |
| Verification | SQL **not executed** on any shared/prod DB (by design) |
| Status | **PARTIAL** |

### 4. Backup and restore

| Field | Detail |
|-------|--------|
| Files | `docs/deploy/BACKUP_RESTORE_PROCEDURE.md` |
| Fix | Assets, encryption, off-site, retention, integrity, restore steps, RPO/RTO, quarterly test |
| Verification | No backup job run in this session |
| Status | **PARTIAL** |

### 5. Node backend exposure

| Field | Detail |
|-------|--------|
| Evidence | `vite.config.ts` default mode → WordPress; `DEPLOY-DROPLET.md` marked superseded |
| Fix | Document exclude PM2/`proxy_pass :4000`; optional harden path if required |
| Status | **PASS** (guidance). Live exposure on a real droplet **NOT VERIFIED** |

### 6. Secrets / production configuration

| Field | Detail |
|-------|--------|
| Files | `.env.production.example`, updated `.env.example`, `wp-config-security.fragment.php.example`, `PRODUCTION_SECURITY_CONFIGURATION.md` |
| Fix | Templates for CORS, DB, Turnstile, debug, cookies; no real secrets |
| Status | **PASS** (templates). Live secret rotation **NOT VERIFIED** |

### 7. Security logging

| Field | Detail |
|-------|--------|
| Files | `class-security-log.php`; wired into REST authz, login fail, rate limit, role/ban/reset, upload reject, spam block, turnstile fail |
| Fix | Central redacting logger; no passwords/tokens |
| Verification | Code present; SIEM shipping **PARTIAL** |
| Status | **PASS** (app) / **PARTIAL** (ops) |

### 8. Turnstile and admin MFA

| Field | Detail |
|-------|--------|
| Turnstile | `MCW_TURNSTILE_REQUIRED` fail-closed; reject test secrets when required; LoginModal + Register send tokens; `VITE_TURNSTILE_SITEKEY` |
| MFA | Requirements documented only — **not configured** |
| Status | Turnstile **PARTIAL**; MFA **FAIL** (absent) — do not claim enabled |

### 9. Automated verification (this session)

| Check | Result |
|-------|--------|
| `GET /.env`, `/backup.sql`, `/wp-config.php` via router | **404** |
| Helpers / phar / uploads PHP | **404** |
| Bootstrap | **200** |
| `test:security:admin` | **19 passed** |
| `test:security:spam` | **22 passed** |
| `test:security:db` | **24 passed** |
| `test:security:upload` | **20 passed** |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `npm run build` / `tsc -b` | **success** |
| nginx/Apache syntax on real host | **NOT VERIFIED** |
| Production deploy | **Not run** (forbidden) |

---

## Deliverables checklist

| Deliverable | Path |
|-------------|------|
| Security configuration guide | `docs/deploy/PRODUCTION_SECURITY_CONFIGURATION.md` |
| DB least privilege | `docs/deploy/database-least-privilege.sql.example` |
| Backup/restore | `docs/deploy/BACKUP_RESTORE_PROCEDURE.md` |
| Deployment checklist | `docs/deploy/PRODUCTION_DEPLOYMENT_CHECKLIST.md` |
| This report | `docs/PRODUCTION_INFRASTRUCTURE_REMEDIATION_REPORT.md` |
| nginx / Apache examples | `docs/deploy/*-security.conf.example` |
| Env / wp-config templates | `.env.production.example`, `docs/deploy/wp-config-security.fragment.php.example` |

---

## Outstanding before CONDITIONALLY READY / READY

1. Apply web-server examples on staging; prove upload/helper denies.  
2. Terminate TLS; verify Secure cookies; then HSTS.  
3. Create least-privilege DB user; `SHOW GRANTS`.  
4. Schedule encrypted backups; complete one restore test.  
5. Confirm Node not publicly exposed.  
6. Set Turnstile secrets + `MCW_TURNSTILE_REQUIRED` per policy.  
7. Ship security logs + alerts.  
8. MFA implement **or** written acceptance.  
9. Re-run `FINAL_PRODUCTION_SECURITY_READINESS` gate.

**Do not treat configuration examples as active infrastructure protection.**
