# Post-Remediation Security Verification Report

**Auditor role:** Independent Senior Application Security / Pentest verification  
**Date:** 2026-11-19  
**Target:** MCW Casino Forum (React SPA + WordPress `mcw-forum` + optional Node `backend`)  
**Environment:** Local staging (`php -S 127.0.0.1:8080`, Vite proxy) — **not production**  
**Method:** Source review + HTTP probes with safe fixtures + existing regression suites  
**Constraint:** No destructive tests against production; no modification of real administrator accounts; existing legitimate media left in place  

**Overall assessment:** Prior remediation **materially improved** admin authz, UGC/content-guard, DB query hygiene, and upload validation. Independent retesting **confirmed** most claimed upload/authz controls with live HTTP evidence. The application is **not** “completely secure.” Confirmed residual issues remain, notably **HTTP-reachable installer/helper PHP under the WordPress web root** and **upload-directory execution controls that do not apply to PHP’s built-in server**.

---

## 1. Previous work reviewed vs real code

| Documented claim | Evidence in code | Verdict |
|------------------|------------------|---------|
| Admin routes require admin + `manage_options` | `class-rest.php` `rest_permission_admin` (~597–605); admin routes use it (~399+) | **PASS** (behavior verified) |
| Role / ban / promote locked down | `admin_set_role`, `ban_user`, HTTP probe + PHP/e2e suites | **PASS** |
| Origin/Referer CSRF on mutating cookie auth | `MCW_Forum_Auth::require_same_origin`; upload without Origin → **403** | **PASS** |
| Content Guard anti-spam / URL policy | `class-content-guard.php` + spam suite 22/22 | **PASS** (unit/REST negative tests) |
| DB prepared statements / meta allowlist | `class-db.php` + DB suite 24/24 | **PASS** |
| Upload magic-byte + allowlist + random names | `class-upload.php`, `upload()` ~2325–2379; live multipart | **PASS** |
| Uploads `.htaccess` non-executable | File present with deny rules | **PARTIAL** — ignored by `php -S` |
| Unauthorized attachment delete blocked | `delete_upload` + live probe **403**, foreign file still **200** | **PASS** |
| Frontend alone enforces upload security | `MediaUpload.tsx` only soft-checks `image/*` | **PARTIAL** (bypassable; backend holds) |

Docs that over-claim “verified” without live multipart upload previously are superseded by this report’s HTTP evidence.

---

## 2. File upload security verification

Safe fixtures used under `%TEMP%\mcw_verify` (no weaponized payloads executed).

| Attack class | Test | Result | Classification |
|--------------|------|--------|----------------|
| Anonymous upload | `POST /wp-json/mcw/v1/uploads` + Origin, no cookie | **401** `Please log in.` | **PASS** |
| CSRF / no Origin | Authenticated upload, no Origin | **403** `Missing Origin.` | **PASS** |
| Valid PNG | 1×1 PNG multipart | **200**, stored as `mcw_<hex>.png` under uploads | **PASS** |
| PHP upload | `evil.php` | **400** `File type not allowed.` | **PASS** |
| SVG + script | `evil.svg` | **400** `File type not allowed.` | **PASS** |
| Double ext | `shell.jpg.php` (PNG bytes) | **400** | **PASS** |
| `.php.` in name | `spoof.php.jpg` | **400** | **PASS** |
| HTML / JS names | `x.html` / `x.js` | **400** | **PASS** |
| MIME spoof | PHP body as `looks.png` / `image/png` | **400** | **PASS** |
| Oversized (~6MB) | `big.bin` as `big.jpg` | **400** (rejected; not stored) | **PASS** |
| Path traversal filename | Covered by sanitize + random `mcw_*` name | Randomized URL observed | **PASS** |
| Overwrite existing | Random name `mcw_0580…png` | No collision with prior JPG set | **PASS** |
| Rejected files public | No new `.php`/`.svg`/`.html`/`.js` under uploads after probes | Only expected `index.php` stub | **PASS** |
| Upload dir PHP execution | `.htaccess` present; **`php -S` serves `uploads/index.php` as 200** | **PARTIAL** / infra | **PARTIAL** |
| Core WP media create | `POST /wp-json/wp/v2/media` anon | **401** `rest_cannot_create` | **PASS** |
| File replacement API | No dedicated replace endpoint in `mcw-forum` | **NOT APPLICABLE** |
| Unauthorized delete | Regular user `DELETE /mcw/v1/uploads/{foreignId}` | **403**; file still HTTP **200** | **PASS** |
| Own delete | Uploader deletes own attachment | **200** | **PASS** (expected) |

**Code anchors**

- Validation: `wordpress/wp-content/plugins/mcw-forum/includes/class-upload.php` (e.g. allowlists L12–21, `validate_image_upload` L120–199, magic L216–241)  
- Handler: `class-rest.php` `upload` / `delete_upload` L2325–2404  
- Hardening file: `wordpress/wp-content/uploads/.htaccess`

---

## 3. Authorization verification (server-side)

| Scenario | Evidence | Classification |
|----------|----------|----------------|
| Anon admin users/stats/reports | Suites + prior HTTP **401** | **PASS** |
| Regular user self-promote | Live: `POST …/admin/users/1/role` → **401** `rest_forbidden` (permission_callback) | **PASS** |
| Regular user demote/ban admin | Admin suite 19/19 | **PASS** |
| Mass-assignment `/me` | Role/capabilities stripped; suite PASS | **PASS** |
| Foreign attachment delete | Live **403** | **PASS** |
| Upload permission_callback `__return_true` | Auth enforced in `upload()` via `require_user` + `guard` | **PARTIAL** (works, defense-in-depth gap) |
| React-only restrictions | `MediaUpload` accepts `video/*`; backend rejects non-images | **PASS** for security if backend only; **PARTIAL** UX/consistency |

---

## 4. WordPress backend review

| Area | Finding | Classification |
|------|---------|----------------|
| Admin/mod `permission_callback` | Present and effective on privileged routes | **PASS** |
| Mutating non-admin routes | Still `__return_true`; rely on handler `require_user`/`guard` | **PARTIAL** |
| Nonce | Cookie session + Origin check (SPA pattern); no WP nonce | **PASS** for this architecture / **NOT APPLICABLE** classic form nonce |
| Upload validation | Magic + ext + MIME + size + path containment | **PASS** |
| Filename generation | Random `mcw_<24hex>.<ext>` | **PASS** |
| Metadata | `mcw_uploader_id` + `post_author` set on upload | **PASS** |
| Safe delete | Ownership/mod check + uploads path check | **PASS** |
| Error handling | Generic 400/401/403 JSON; no stack traces in probes | **PASS** |

---

## 5. React frontend review

| Area | Finding | Classification |
|------|---------|----------------|
| `src/lib/uploads.ts` | Thin FormData POST to `/api/uploads` (proxied to WP) | OK |
| `MediaUpload.tsx` L28–32, L79–84 | Client allows any `image/*` and UI mentions MP4 / `video/*` | **PARTIAL** — bypassable; backend is source of truth |
| `Admin.tsx` / `Profile.tsx` / `PostComposer.tsx` | Use same `uploadImage` | Same |
| Auth on API | `credentials: 'include'` in `api.ts` | **PASS** |
| Frontend-only bypass risk | Attacker calling REST directly still hits server checks | **PASS** (security) |

---

## 6. Automated tests executed

| Suite | Result |
|-------|--------|
| `npm run test:security:admin` | **19 passed, 0 failed** |
| `npm run test:security:spam` | **22 passed, 0 failed** |
| `npm run test:security:db` | **24 passed, 0 failed** |
| `npm run test:security:upload` | **20 passed, 0 failed** |
| `backend` `src/lib/upload.test.ts` | **5 passed** |
| `src/lib/safeUrl.test.ts` | **2 passed** |
| Playwright `e2e/admin-account-security.spec.ts` | **2 passed** |
| `npm audit` / full `tsc -b` / oxlint | **NOT VERIFIED** this pass |

---

## 7. Missed / out-of-scope vulnerabilities discovered

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| V-1 | **High** (if web-exposed in deploy) | `wordpress/_*.php` installer/WPML helpers are **HTTP 200** | `GET /_check_installer.php` → **200** `settings_type=string` |
| V-2 | **Medium** | `wp-cli.phar` in web tree | Inventory; HTTP not fully fingerprinted this pass → treat as expose risk |
| V-3 | **Medium** (env-dependent) | Upload `.htaccess` **not enforced** by PHP built-in server; `uploads/index.php` executes (empty) | `GET /wp-content/uploads/index.php` → **200** |
| V-4 | **Low** | Frontend advertises video upload; backend rejects | `MediaUpload.tsx` accept `video/*` |
| V-5 | **Info** | `GET /wp-json/wp/v2/media` lists public attachments | Expected WP behavior for public media |
| V-6 | **Info** / residual | No server-side Turnstile; incomplete password-reset handlers; no admin MFA; legacy Node backend if deployed | Matches `SECURITY_REMAINING_RISKS.md` — reconfirmed by absence in WP register/login |

No unrestricted alternate upload handler found inside `mcw-forum` beyond `POST /mcw/v1/uploads`. Node `backend/src/routes/uploads.ts` remains a **second implementation** if that service is deployed.

---

## 8. Independent fix verification matrix (prior findings)

| Prior ID | Claimed fix | Independent result |
|----------|-------------|--------------------|
| C1–C3 Admin authz | Implemented | **PASS** |
| C4 Content ownership | Implemented (owner/mod) | **PASS** (code + suites; not re-abused live this pass beyond suites) |
| H1 Origin CSRF | Implemented | **PASS** (live upload) |
| H2 Upload hardening | Implemented beyond original audit | **PASS** (live multipart) |
| H3 Rate limits | Present on upload/auth/comment/thread | **PASS** (code); flood exhaustion **NOT VERIFIED** |
| H4 Mod checks | Implemented | **PASS** |
| M1 Account delete password | Implemented | **PASS** (suite) |
| M2 XSS body | Sanitize + React text nodes | **PASS** with residual admin `post_content` caution |
| M3 Password in JSON | Removed from serialize | **PASS** (grep) |
| M4 permission_callback | Admin/mod only | **PARTIAL** |
| Upload dedicated audit | `MCW_Forum_Upload` | **PASS** with **PARTIAL** execution controls on `php -S` |

---

## 9. Files inspected (primary)

- `docs/SECURITY_AUDIT_REPORT.md`, `SECURITY_REMAINING_RISKS.md`, `SECURITY_UPLOADS.md`, `SECURITY_ANTISPAM.md`, `SECURITY_DATABASE.md`
- `wordpress/wp-content/plugins/mcw-forum/includes/class-upload.php`
- `wordpress/wp-content/plugins/mcw-forum/includes/class-rest.php` (routes, authz, upload/delete)
- `wordpress/wp-content/plugins/mcw-forum/includes/class-auth.php`, `class-content-guard.php`, `class-db.php`, `class-cors.php`
- `wordpress/wp-content/uploads/.htaccess`
- `wordpress/router.php`, `wordpress/_check_installer.php` (HTTP)
- `src/lib/uploads.ts`, `src/lib/api.ts`, `src/components/MediaUpload.tsx`
- `backend/src/lib/upload.ts`, `backend/src/routes/uploads.ts`, `backend/src/app.ts`
- Regression tests under `wordpress/.../tests/*`, `e2e/admin-account-security.spec.ts`

**Files modified during verification phase:** none (verification-only).  

### Post-report safe remediations applied (same session)

| Change | File | Notes |
|--------|------|-------|
| HTTP 404 for `/_*.php` and `wp-cli.phar` | `wordpress/router.php` | Closes V-1/V-2 on `php -S` / router front controller |
| Frontend accept/copy aligned to image allowlist | `src/components/MediaUpload.tsx` | Closes V-4 UX mismatch; backend remains authoritative |

---

## 10. Remaining risks

1. Web-accessible `wordpress/_*.php` and `wp-cli.phar` on any host that maps the WP root publicly.  
2. Upload PHP execution depends on Apache `.htaccess` / nginx rules — **not** on `php -S`.  
3. Defense-in-depth: many mutating routes still use `permission_callback => __return_true`.  
4. No server-side captcha; password reset stubs; no admin MFA.  
5. Legacy Node upload/API surface if co-deployed.  
6. Dependency CVE scan not run this pass.  
7. Public attachment enumeration via `wp/v2/media` (forum-acceptable but informational).

---

## 11. Manual infrastructure checks required

1. Block HTTP to `/_*.php`, `/wp-cli.phar`, and any backup/sql/env paths at reverse proxy.  
2. On nginx/Apache: deny script execution under `/wp-content/uploads/`.  
3. Confirm production does **not** use `php -S` as the public front.  
4. Set `MCW_CORS_ORIGIN`, HTTPS-only cookies, `WP_DEBUG_DISPLAY=false`.  
5. Confirm Node `backend` is not exposed if unused.  
6. Run `npm audit` / Composer audits in CI.

---

## 12. Recommended next actions

1. **Immediate:** Deny web access to `wordpress/_*.php` and `wp-cli.phar` (router and/or edge).  
2. Align frontend `accept` / copy with backend image-only policy.  
3. Optionally tighten upload `permission_callback` to authenticated users.  
4. Add nginx sample config for uploads script denial to docs.  
5. Schedule Turnstile server verify + password-reset implementation.  
6. Re-run this verification after infra changes on a staging host that matches production (Apache/nginx).

---

## 13. Classification summary

| Result | Count (approx.) |
|--------|-----------------|
| **PASS** | Majority of prior Critical/High upload & admin controls |
| **PARTIAL** | `__return_true` mutating routes; frontend video UX; htaccess on `php -S` |
| **FAIL** | Exposed `_*.php` helpers over HTTP in current local web root |
| **NOT VERIFIED** | npm audit, Apache htaccess enforcement, production WAF/TLS |
| **NOT APPLICABLE** | Dedicated file-replacement API; classic WP form nonces for SPA |

**Bottom line:** An attacker **cannot** (in this build) anonymously upload PHP/SVG/executables through `mcw/v1/uploads`, spoof MIME past magic-byte checks, or delete another user’s attachment via the forum delete API — **verified live**. An attacker **can** still reach **developer installer PHP** under the WordPress document root if that tree is publicly served — **verified live** (`/_check_installer.php`). Do not treat the application as fully hardened until that exposure and production upload execution controls are closed.
