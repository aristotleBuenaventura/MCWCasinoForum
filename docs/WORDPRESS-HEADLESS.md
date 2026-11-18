# React + WordPress (headless) + WPML

The default local stack is **React (Vite) + WordPress REST**, not Express.

| Layer | URL |
| --- | --- |
| React UI | http://localhost:5173 |
| WordPress API | http://127.0.0.1:8080/wp-json/mcw/v1/ |
| WP admin | http://127.0.0.1:8080/wp-admin/ (`admin` / `admin123`) |

Vite proxies `/api/*` → `/wp-json/mcw/v1/*` so the existing React client keeps calling `/api/...`.

## Setup

1. MariaDB running; database `mcwforum_wp` (created during install).
2. PHP 8.3+ with `mysqli`, `pdo_mysql`, `curl`, `openssl`, `mbstring`.
3. From repo root:

```bash
# if wp-config is missing, recreate + install:
php tools/wordpress/wp-cli.phar --path=wordpress config create --dbname=mcwforum_wp --dbuser=root --dbpass=password --dbhost=127.0.0.1 --dbprefix=mcw_ --skip-check --force
php tools/wordpress/wp-cli.phar --path=wordpress core install --url=http://127.0.0.1:8080 --title="MCW Casino Forum" --admin_user=admin --admin_password=admin123 --admin_email=admin@mcw.local --skip-email
php tools/wordpress/wp-cli.phar --path=wordpress plugin activate mcw-forum
npm run wp:seed
npm run dev
```

Demo users (same as before): `alicewins` / `password123`, `admin` / `admin123`, etc.

## WPML + Bengali (`/bn`)

- Languages: English (default) + Bengali (`bn`)
- React routes: `/` (EN) and `/bn/...` (BN) via Vite `basename`
- API: React appends `?lang=bn` on `/api/*` when under `/bn`
- UI chrome: `src/i18n/` (header, rails, footer, home hero)
- Content: translate threads/taxonomies in WPML admin (or `php tools/wordpress/helpers/_wpml_seed_bn.php` for demo BN posts)

Setup helpers (local only, gitignored under `wordpress/_*.php`):

```bash
php tools/wordpress/helpers/_wpml_setup_bn.php
php tools/wordpress/helpers/_wpml_seed_bn.php
```

CPTs/taxonomies marked translatable: `mcw_thread`, `mcw_reply`, `mcw_ad`, `mcw_game`, `mcw_provider`, `mcw_forum`.

### Comment translations (once, reused)

Replies stay on one shared thread. On create (and lazy on first read), MCW stores `mcw_body_en` + `mcw_body_bn`. Viewers get the version for `?lang=`.

- Default engine: MyMemory (free). Optional: set `MCW_DEEPL_KEY` for DeepL.
- Override: WordPress filter `mcw_translate_text`.
- Backfill: `php tools/wordpress/helpers/_wpml_backfill_comment_i18n.php`

## Express fallback

```bash
npm run dev:express
```

Uses Vite `--mode express` and the Node API on port 4000.
