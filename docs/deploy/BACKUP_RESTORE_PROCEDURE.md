# Backup and Restore Procedure — MCW Casino Forum

**Scope:** WordPress database, `wp-content/uploads`, custom plugins/themes, config templates  
**Rule:** Never store backups inside the public document root (`wordpress/`, `dist/`).  
**Rule:** Do not delete existing backups as part of automation without an explicit retention job and operator approval.

## What to back up

| Asset | Path / source | Criticality |
|-------|---------------|-------------|
| MySQL database | `mcwforum` (or `DB_NAME`) | Critical |
| Media uploads | `wordpress/wp-content/uploads/` | Critical |
| Custom plugin | `wordpress/wp-content/plugins/mcw-forum/` | High (also in git) |
| Custom theme (if any) | `wordpress/wp-content/themes/*` custom | High |
| WP config template | `wp-config` values (not committed secrets) | Critical — secrets via vault |
| SPA build inputs | git repo (`src/`, `package-lock.json`) | High |
| TLS certs | Let’s Encrypt / load balancer | High — usually provider-managed |
| Node `backend/` | Only if still deployed | Medium — prefer exclude |

Do **not** back up into `wordpress/`, `wordpress/wp-content/uploads/`, or any URL-reachable path.

## Recommended layout (off-host)

```text
/secure-backups/mcw/                 # NOT under DocumentRoot; preferably another volume/host
  daily/
  weekly/
  VERIFY/                            # restore-test scratch (destroy after test)
```

Encrypt at rest (examples):

- `gpg --symmetric --cipher-algo AES256 backup.tar.gz`
- Or object storage with SSE-KMS (S3/Spaces) + private bucket ACL

## RPO / RTO targets (recommended starting point)

| Metric | Target | Notes |
|--------|--------|-------|
| RPO | ≤ 24h (daily); ≤ 1h if binlog + hourly DB dump | Tighten for high-traffic |
| RTO | ≤ 4h for full site restore on staging-sized host | Practice quarterly |

## Daily backup (example — staging/local; adapt for prod)

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
ROOT=/var/www/mcw
OUT=/secure-backups/mcw/daily
mkdir -p "$OUT"

# DB dump (use least-privilege dump user or admin backup role — not world-readable)
mysqldump --single-transaction --routines --triggers \
  -u mcw_app -p"$DB_PASSWORD" mcwforum \
  | gzip -c > "$OUT/db-$STAMP.sql.gz"

# Uploads + plugin (exclude cache junk)
tar -C "$ROOT/wordpress/wp-content" -czf "$OUT/uploads-plugins-$STAMP.tar.gz" \
  uploads plugins/mcw-forum

# Optional: encrypt
gpg --batch --yes --symmetric --cipher-algo AES256 \
  -o "$OUT/db-$STAMP.sql.gz.gpg" "$OUT/db-$STAMP.sql.gz"
shred -u "$OUT/db-$STAMP.sql.gz"  # keep only ciphertext if policy requires

# Integrity
sha256sum "$OUT"/*"$STAMP"* > "$OUT/SHA256-$STAMP.txt"

# Off-site sync (example)
# rclone copy "$OUT" remote:mcw-backups/daily --checksum
```

Retention example: keep 7 daily, 4 weekly, 6 monthly. Prune with an allowlisted script; never `rm -rf` the backup root blindly.

## Integrity verification

1. Confirm `sha256sum -c SHA256-….txt` on the backup host.  
2. Confirm object-store ETag/checksum after sync.  
3. Monthly: restore DB + uploads to an isolated staging DB/host (below).

## Restore procedure (staging first)

1. **Freeze writes** on the broken environment if still partially live (maintenance page).  
2. Provision empty DB: `CREATE DATABASE mcwforum_restore …`  
3. Decrypt if needed, then:

```bash
gunzip -c db-YYYYMMDD.sql.gz | mysql -u mcw_app -p mcwforum_restore
```

4. Extract uploads to a **non-public** staging path, then move into staging `wp-content/uploads` with correct ownership (`www-data`).  
5. Point staging `wp-config.php` at `mcwforum_restore` and staging URLs (`WP_HOME` / `WP_SITEURL` / `MCW_CORS_ORIGIN`).  
6. Smoke-test: bootstrap, login, upload image, admin deny for anon.  
7. Only then promote to production with a documented change window.

## Recovery test checklist (quarterly)

- [ ] Restore DB to isolated instance  
- [ ] Restore uploads; open a known media URL  
- [ ] Login as non-admin; create a thread  
- [ ] Confirm helpers/`wp-cli.phar` still outside docroot  
- [ ] Record elapsed time → update RTO evidence  
- [ ] Destroy restore scratch data

## Application configuration backup

- Store **templates** in git (`docs/deploy/wp-config-security.fragment.php.example`, `.env.production.example`).  
- Store **live secrets** in a secrets manager / sealed ops vault — never in the backup tarball next to public media without encryption.  
- After restore, re-apply salts/keys from vault; rotate session cookies if compromise suspected.

## What this repo does **not** claim

Automated encrypted off-site backups are **not** running until ops schedules the job on a real host. This document prepares the procedure; status remains **PARTIAL** until a restore test is executed.
