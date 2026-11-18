# MCW Casino Forum

Dark casino community forum. **Default local stack: React + headless WordPress** (WPML-ready). Express/Prisma remains available as a fallback.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React, Vite, React Router |
| Backend (default) | WordPress REST (`mcw-forum` plugin) |
| Backend (fallback) | Node.js, Express, Prisma |
| Database | MariaDB/MySQL |
| i18n path | WPML on WordPress CPTs/taxonomies — see [docs/WORDPRESS-HEADLESS.md](docs/WORDPRESS-HEADLESS.md) |

## Local development (WordPress)

1. MariaDB running; PHP 8.3+ with mysqli.
2. WordPress DB `mcwforum_wp` + plugin activated (see docs).
3. Seed + run:

```bash
npm run wp:seed
npm run dev
```

- Web: http://localhost:5173  
- WP API: http://127.0.0.1:8080/wp-json/mcw/v1/health  
- WP admin: http://127.0.0.1:8080/wp-admin/ (`admin` / `admin123`)

Vite proxies `/api` → WordPress so cookies work on localhost.

### Express fallback

```bash
npm run install:all
cp backend/.env.example backend/.env
npm run db:push && npm run db:seed
npm run dev:express
```

## Demo accounts

| Username   | Password       | Role      |
|------------|----------------|-----------|
| alicewins  | password123    | user      |
| bobdealer  | password123    | user      |
| caraspins  | password123    | user      |
| moderator  | moderator123   | moderator |
| admin      | admin123       | admin     |

Change these before a public deploy. Set a real `JWT_SECRET` (32+ chars) in `backend/.env`.

## Production (DigitalOcean)

See [docs/DEPLOY-DROPLET.md](docs/DEPLOY-DROPLET.md) — Nginx + PM2 + local MySQL, same flow as MR Database Tool.
