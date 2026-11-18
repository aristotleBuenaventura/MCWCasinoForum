# File-system & upload security audit

**Date:** 2026-11-19  
**Scope:** WordPress `mcw/v1/uploads`, Node `backend` uploads (legacy), `wp-content/uploads`  
**Constraint:** Existing media inspected and **not** auto-deleted

## Controls implemented

| Control | Implementation |
|---------|----------------|
| Auth required | Session user + Origin CSRF on POST/DELETE |
| Rate limit | 20 uploads / user / hour (WP) |
| Allowlist | JPG / PNG / WEBP / GIF only — **SVG blocked** |
| MIME spoofing | Magic bytes + `wp_check_filetype_and_ext` + `getimagesize` + `finfo` |
| Path traversal | `basename` sanitize; randomized `mcw_*.ext` storage name |
| Overwrite | Random name; Node uses `wx` write flag |
| Executables | Name fragment blocklist (`.php`, `.phar`, …); uploads `.htaccess` denies script exec |
| Storage | Files must `realpath` under uploads basedir or attachment is deleted |
| Deletion auth | `DELETE /uploads/{id}` — uploader or mod/admin only; refuses paths outside uploads |
| MIME filter | Global `upload_mimes` / `wp_check_filetype_and_ext` strip SVG/PHP |

## Non-executable uploads directory

On plugin load / activate, `MCW_Forum_Upload::ensure_uploads_hardened()` writes:

- `wp-content/uploads/.htaccess` — deny PHP/CGI/etc., `Options -Indexes -ExecCGI`
- `wp-content/uploads/index.php` — directory listing stub

Nginx: also add `location ~* /wp-content/uploads/.*\.(php|phtml|phar)$ { deny all; }` at the edge.

## Manual review inventory (do not auto-delete)

These were present at audit time and should be reviewed by an operator:

| Path / pattern | Why review |
|----------------|------------|
| `wordpress/_*.php` (installer / WPML helpers) | Executable PHP in/near web root; remove or block HTTP in production |
| `wordpress/wp-cli.phar` | CLI tool in web tree; deny HTTP access |
| `wordpress/wp-content/uploads/wpml/changelog.txt` | Non-image under uploads (low risk text); confirm expected |
| `public/**/*.svg`, `src/assets/vite.svg` | Static brand assets (no `<script>` found); **not** user uploads — keep SVG out of UGC |
| Existing `uploads/2026/11/*.jpg` | Legitimate media left untouched |

Re-scan anytime:

```bash
npm run test:security:upload
```

The test prints `REVIEW …` lines and never deletes inventory targets.

## Tests

```bash
npm run test:security:upload
npm test --prefix backend -- src/lib/upload.test.ts
```

## Residual recommendations

1. Block HTTP to `wordpress/_*.php` and `wp-cli.phar` at Cloudflare/nginx.
2. Prefer `require_local_media` in content-guard for avatars/images in production.
3. If GIF animation abuse appears, consider dropping GIF from the allowlist.
