# Production Security Configuration Guide

**Status:** Repository-level preparation. Controls are **not** active on production until applied and verified on a real host.  
**Related:** `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `FINAL_PRODUCTION_SECURITY_READINESS.md`

## Architecture decision (required)

| Component | Production role |
|-----------|-----------------|
| React SPA (`dist/`) | Public static site |
| WordPress + `mcw-forum` | Authoritative API (`/wp-json/mcw/v1`) + uploads |
| Node `backend/` | **Not required** for the default SPA path; exclude from public deploy |
| `tools/wordpress/` | CLI only — **never** copy into DocumentRoot |

Default Vite mode proxies `/api` → WordPress. Express mode (`vite --mode express`) is legacy/dev only.

Historical `docs/DEPLOY-DROPLET.md` describes the old Node+PM2 layout — **superseded** for WordPress-headless production by this guide.

## 1. Web server: choose one

Apply **either** nginx **or** Apache examples — not both on the same edge without a clear split.

| File | Use when |
|------|----------|
| `nginx-security.conf.example` | nginx (+ PHP-FPM for WP) |
| `apache-security.conf.example` | Apache 2.4 (+ PHP-FPM or mod_php) |
| `wordpress/.htaccess` | Apache AllowOverride helper (insufficient alone on some hosts) |
| `wordpress/router.php` | Local `php -S` only |

Must enforce:

- No PHP execution under `/wp-content/uploads/`
- Deny `/_*.php`, `/wp-cli.phar`, `.env*`, `*.sql` / backups, `wp-config.php` HTTP access
- `Options -Indexes` / `autoindex off`
- SPA `/api/` → WP REST rewrite (not Node) when using combined host

**Classification until applied on staging:** PARTIAL (examples ready) / NOT VERIFIED (live host).

## 2. TLS and headers

1. Obtain certificates (Certbot / Cloudflare / LB).  
2. Enable HTTP→HTTPS redirect **after** cert validation.  
3. Then enable HSTS (`max-age` start at 604800). **Do not** enable HSTS on HTTP-only hosts.  
4. WordPress cookie `mcw_session`: `HttpOnly`, `SameSite=Lax`, `Secure` via `is_ssl()` or `MCW_FORCE_SECURE_COOKIES`.  
5. Headers (API + SPA): `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` / CSP `frame-ancestors`, SPA CSP as in nginx example.

Fragment: `wp-config-security.fragment.php.example`.

## 3. Database least privilege

Use `database-least-privilege.sql.example`. Review with `SHOW GRANTS`. No `FILE` / `SUPER` / `GRANT OPTION` / `*.*`.

## 4. Backups

Follow `BACKUP_RESTORE_PROCEDURE.md`. Off-site encrypted dumps; never under DocumentRoot. Quarterly restore test.

## 5. Node backend exposure

| Question | Answer |
|----------|--------|
| Does React require Node in default mode? | **No** — `/api` → WordPress |
| Separate auth/uploads in Node? | Yes (JWT/cookie + `/api/uploads`) — second attack surface |
| Public deploy? | **Exclude** unless explicitly running express mode |

How to exclude:

- Do not run PM2/`backend` on the server  
- Do not `proxy_pass` to `:4000`  
- Firewall deny 4000/tcp from WAN  
- Prefer SPA nginx location `/api/` → WordPress as in examples  

If Node must run: TLS, `COOKIE_SECURE=true`, real `JWT_SECRET`, real Turnstile, `ALLOW_DEMO_*=false`, least-privilege DB, same upload hardening.

## 6. Secrets and env

Templates (no real secrets):

- `.env.production.example`
- `wp-config-security.fragment.php.example`
- `backend/.env.example` (legacy only)

Required production values:

| Variable / define | Purpose |
|-------------------|---------|
| `MCW_CORS_ORIGIN` | Exact SPA origin |
| `DB_*` / least-priv user | Database |
| WordPress salts | Auth hardening |
| `MCW_TURNSTILE_SECRET` + `VITE_TURNSTILE_SITEKEY` | Captcha |
| `MCW_TURNSTILE_REQUIRED=true` | Fail closed |
| `MCW_FORCE_SECURE_COOKIES` | Secure cookie behind TLS proxy |
| `WP_DEBUG_DISPLAY=false` | No error leakage |

## 7. Security logging

Plugin logs `[mcw-security]` events via `MCW_Forum_Security_Log` (no passwords/tokens):

- `login_failed`, `rate_limit`, `unauthorized_admin` / `unauthorized_mod`
- `role_change`, `ban`, `password_reset_*`
- `upload_rejected`, `spam_blocked`, `turnstile_failed`

Ops: ship PHP `error_log` / `WP_DEBUG_LOG` to a protected SIEM; retain ≥ 90 days for authz events; alert on bursts of `unauthorized_admin` / `login_failed` / `rate_limit`.

## 8. Turnstile and admin MFA

**Turnstile (implemented, config-dependent):**

- Server verifies via Cloudflare siteverify when real secret set  
- Test secrets (`1x0000…`) ignored unless `MCW_TURNSTILE_REQUIRED` → then **503**  
- SPA: `TurnstileWidget` uses `VITE_TURNSTILE_SITEKEY`; register + login modal + forgot send `turnstileToken`  

**Admin MFA:** **not implemented**. Options for a future project: TOTP (e.g. WP plugin limited to admins) or WebAuthn. Do **not** claim MFA is active. Do not rotate admin passwords in this workstream.

## 9. Verification commands (local / staging)

```bash
npm run build
npx tsc -b
npm audit --omit=dev
npm run test:security:admin
npm run test:security:spam
npm run test:security:db
npm run test:security:upload
# After nginx/Apache apply on staging:
# nginx -t   OR   apachectl configtest
# curl -I https://staging/.../wp-content/uploads/probe.php   # expect 403/404
```

Never run production deploy commands from this guide alone.
