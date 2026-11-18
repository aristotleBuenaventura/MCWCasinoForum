# WordPress database security audit

**Date:** 2026-11-19  
**Scope:** `mcw-forum` plugin SQL, meta writes, post mutations, REST DB interactions  
**Constraint:** Regression tests never DROP/TRUNCATE or alter existing forum content

## Findings & remediations

| Issue | Severity | Fix |
|-------|----------|-----|
| `LIMIT {$limit}` string interpolation in bookmarks / weekly contributors | Medium | Bound int + `%d` via `$wpdb->prepare` |
| `$wpdb->insert` / `update` / `delete` without format arrays | Medium | `MCW_Forum_DB` typed helpers |
| Like/follow/bookmark accepted arbitrary targets | Medium | Whitelist types; verify post/user exists; reject self-follow |
| Profile / meta mass-assignment risk | High (residual) | `filter_user_update_fields` + user/post meta allowlists |
| Admin reports `SELECT *` without prepare | Low | Column list + `LIMIT %d` |
| Report resolve id not format-bound | Low | Typed update + id pattern check |
| Local `wp-config.php` uses `root`/`password` | Ops | File under `wordpress/**` (gitignored); use least-privilege DB user in prod |

## Safe patterns (now)

- Dynamic values go through `$wpdb->prepare` or `MCW_Forum_DB::{insert,update,delete}`
- `IN (...)` lists use placeholder expansion (`prepare_in` / existing `%d,%d` builders)
- Schema DDL only in `MCW_Forum_Install::create_tables` via `dbDelta`
- Destructive seed reset remains **admin-only** (`require_admin`)
- Account delete / trash require ownership or mod/admin

## Least-privilege (production)

1. Do **not** use MySQL `root` for the app.
2. Grant the WP DB user: `SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX` on the WP schema only (no `FILE`, `SUPER`, `PROCESS` on other DBs).
3. Keep `DB_*` and salts in `wp-config.php` outside VCS (already covered by `wordpress/**` in `.gitignore`).
4. Prefer `DISALLOW_FILE_EDIT` and disable unused WP DB-admin plugins.

## Plugin tables

`mcw_sessions`, `mcw_likes`, `mcw_follows`, `mcw_bookmarks`, `mcw_notifications`, `mcw_reports`

## Tests

```bash
npm run test:security:db
```

Throwaway user only; cleans its sessions/reports; asserts published thread count unchanged and plugin tables still exist after SQLi-shaped payloads.
