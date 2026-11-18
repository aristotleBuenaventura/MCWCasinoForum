# Remaining security risks

Unresolved or partially mitigated items after the 2026-11-19 **priority** remediation pass.

See also: `docs/PRIORITY_REMEDIATION_REPORT.md`, `docs/POST_REMEDIATION_VERIFICATION_REPORT.md`.

## Closed or mitigated this pass

| Item | Status |
|------|--------|
| V-1 `_*.php` helpers in docroot | **Mitigated** — moved to `tools/wordpress/helpers/`; HTTP deny in router/`.htaccess` |
| V-2 `wp-cli.phar` in docroot | **Mitigated** — moved to `tools/wordpress/`; HTTP deny |
| Mutating REST `__return_true` | **Mitigated** — `rest_permission_auth` on mutating/private routes |
| Password reset incomplete | **Mitigated** — hashed one-time tokens, expiry, rate limits, generic forgot |
| Server Turnstile stub | **Partial** — verifies when `MCW_TURNSTILE_SECRET` / `TURNSTILE_SECRET` set |
| Upload PHP via local router | **Mitigated** locally; production nginx/Apache still required |

## High / Medium (follow up)

| Risk | Why it remains | Recommended action |
|------|----------------|--------------------|
| Upload PHP execution on real Apache/nginx | Local `php -S` + router only; deploy snippets not applied to prod | Apply `docs/deploy/nginx-security.conf.example` / `apache-security.conf.example` on staging/prod |
| Turnstile not configured | Secret unset → verify skipped | Set production secret; SPA must send `turnstileToken` |
| Admin MFA not implemented | Privileged accounts are single-factor | Add TOTP/WebAuthn for `mcw_role=admin` — **not claimed enabled** |
| SPA Content-Security-Policy incomplete | API responses get basic headers; Vite/static host may not | Set CSP/HSTS on the static host / Cloudflare |
| Residual spam beyond Content Guard | Guard covers URL policy, duplicates, link caps, soft hold | Turnstile on post; optional `require_local_media`; tune blocklists |
| Legacy `backend/` Node service | May still expose old JWT/auth if deployed | Confirm unused in prod; shut down or harden separately |

## Low / operational

| Risk | Action |
|------|--------|
| Local `.env` / local `wp-config` DB root password | Keep gitignored; rotate if leaked |
| App DB user may be overly privileged locally | Production: dedicated least-privilege MySQL user |
| WP core / third-party plugins (incl. WPML) | Patch regularly; minimize plugins; do not blind-upgrade WPML |
| `error_log` security lines | Ship logs to protected store; do not log secrets |
| Public user enumeration via `/users/{username}` / members | Acceptable for forum UX; keep rate limits |
| Open redirects via stored `mcw_url` / ad URLs | Validate allowlist of schemes/hosts for ads |
| Helpers reintroduced under `wordpress/` | Keep deploy scripts from copying `tools/wordpress/helpers` into docroot |

## Manual hosting actions (cannot fix from repo alone)

Repo preparation: see `docs/deploy/PRODUCTION_SECURITY_CONFIGURATION.md`,  
`docs/deploy/PRODUCTION_DEPLOYMENT_CHECKLIST.md`, and  
`docs/PRODUCTION_INFRASTRUCTURE_REMEDIATION_REPORT.md`. Gate remains **NOT READY** until staging verifies these.

1. Cloudflare WAF rules for auth endpoints.
2. Disable directory listing; block public access to backups, `.sql`, `.env` (examples prepared).
3. **Apply** nginx/Apache upload + helper deny rules from `docs/deploy/` on a real host and probe.
4. TLS certificates + HSTS at edge (only after HTTPS verified).
5. Create DB user from `docs/deploy/database-least-privilege.sql.example`; `SHOW GRANTS`.
6. Schedule encrypted backups per `BACKUP_RESTORE_PROCEDURE.md`; run a restore test.
7. Configure Turnstile secrets + `MCW_TURNSTILE_REQUIRED` / `VITE_TURNSTILE_SITEKEY`.
8. Decide and implement admin MFA separately (or accept single-factor in writing).
9. Confirm Node `backend/` is not publicly exposed.

## Intentionally not done

- Destructive testing against production data.
- Blind major dependency upgrades.
- Deleting users/posts/files as part of the audit.
- Claiming admin MFA is enabled.
- Claiming 100% security.
