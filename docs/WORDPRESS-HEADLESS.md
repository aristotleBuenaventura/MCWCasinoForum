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
php wordpress/wp-cli.phar --path=wordpress config create --dbname=mcwforum_wp --dbuser=root --dbpass=password --dbhost=127.0.0.1 --dbprefix=mcw_ --skip-check --force
php wordpress/wp-cli.phar --path=wordpress core install --url=http://127.0.0.1:8080 --title="MCW Casino Forum" --admin_user=admin --admin_password=admin123 --admin_email=admin@mcw.local --skip-email
php wordpress/wp-cli.phar --path=wordpress plugin activate mcw-forum
npm run wp:seed
npm run dev
```

Demo users (same as before): `alicewins` / `password123`, `admin` / `admin123`, etc.

## WPML

The plugin registers WPML-friendly content:

- Taxonomy `mcw_forum` (communities)
- CPTs `mcw_thread`, `mcw_reply`, `mcw_ad`, `mcw_game`, `mcw_provider`

Install [WPML](https://wpml.org/) in WordPress, mark those types/taxonomies as translatable, then have React request the language WPML exposes on REST (e.g. `?lang=en`). UI chrome strings still need React i18n (or WPML String Translation + an endpoint).

## Express fallback

```bash
npm run dev:express
```

Uses Vite `--mode express` and the Node API on port 4000.
