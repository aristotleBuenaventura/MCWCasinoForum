# Production Deployment Security Checklist

Use on **staging that mirrors production** before any production cutover.  
Do **not** mark the forum production-ready until items below are verified.  
This checklist does **not** authorize production deployment by itself.

## A. Pre-flight (repository)

- [ ] Read `FINAL_PRODUCTION_SECURITY_READINESS.md` and `PRODUCTION_SECURITY_CONFIGURATION.md`
- [ ] Confirm `tools/wordpress/helpers` and `wp-cli.phar` are **not** under `wordpress/`
- [ ] Confirm deploy scripts do not copy helpers into DocumentRoot
- [ ] `npm run build` succeeds
- [ ] Security suites green (`test:security:*`) after rate-limit windows clear
- [ ] `npm audit --omit=dev` shows no Critical/High (or documented exceptions)

## B. Web server (pick one)

- [ ] nginx **or** Apache chosen and documented
- [ ] Applied `nginx-security.conf.example` **or** `apache-security.conf.example`
- [ ] `nginx -t` / `apachectl configtest` OK
- [ ] Upload PHP probe denied (controlled file removed after test)
- [ ] `/_check_installer.php` and `/wp-cli.phar` denied even if reintroduced
- [ ] `.env`, `*.sql`, `wp-config.php` not HTTP-reachable
- [ ] Directory listing disabled
- [ ] SPA `/api/` proxies to WordPress REST (**not** Node `:4000`) unless Node is intentionally required

## C. TLS / cookies / headers

- [ ] Valid HTTPS certificate on public hostname
- [ ] HTTP→HTTPS redirect works
- [ ] HSTS enabled **only after** HTTPS verified
- [ ] `mcw_session` Set-Cookie includes `Secure; HttpOnly; SameSite=Lax`
- [ ] `MCW_FORCE_SECURE_COOKIES` / HTTPS detection correct behind proxy
- [ ] Security headers present (nosniff, Referrer-Policy, frame protection, CSP as designed)

## D. Database

- [ ] Dedicated `mcw_app` (or equiv) user created from `database-least-privilege.sql.example`
- [ ] `SHOW GRANTS` reviewed — no FILE/SUPER/GRANT OPTION/`*.*`
- [ ] App functions: login, post, upload, plugin still operational

## E. Backups

- [ ] Encrypted off-site backup job scheduled (DB + uploads)
- [ ] Backups **outside** DocumentRoot
- [ ] SHA256 / integrity check recorded
- [ ] Restore tested on isolated staging within last 90 days
- [ ] RPO/RTO written and accepted

## F. Secrets / config

- [ ] `MCW_CORS_ORIGIN` = exact SPA origin
- [ ] WordPress salts unique (not default sample)
- [ ] `WP_DEBUG_DISPLAY=false`
- [ ] Turnstile sitekey + secret set; `MCW_TURNSTILE_REQUIRED=true` if policy requires CAPTCHA
- [ ] No production secrets in git
- [ ] Node `backend` not publicly exposed (or hardened if required)

## G. Logging / abuse

- [ ] `[mcw-security]` logs collected to protected store
- [ ] Alerts for unauthorized_admin / login_failed bursts / rate_limit
- [ ] Retention policy documented (≥ 90 days recommended for authz)

## H. MFA policy

- [ ] Admin MFA implemented **or** single-factor risk formally accepted in writing
- [ ] Do not claim MFA enabled unless configured and tested

## I. Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| App owner | | | |
| Ops / DevOps | | | |
| Security reviewer | | | |

**Gate expectation:** After A–G verified on staging → re-run production readiness gate. Expected next outcome: **CONDITIONALLY READY** or **READY** depending on MFA acceptance and residual risk.
