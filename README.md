# MCW Casino Forum

Dark casino community forum. Same stack as MR Database Tool: React + Express + MySQL + Prisma + Nginx + PM2.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express, JWT httpOnly cookie |
| Database | Local MySQL + Prisma |
| Deploy | Nginx + PM2 + Certbot on a droplet |

## Local development

MySQL must already be running (same as MR Database Tool). Create a separate database:

```sql
CREATE DATABASE mcwforum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then:

```bash
npm run install:all
cp backend/.env.example backend/.env
# edit backend/.env with your local MySQL user/password
cd backend && npx prisma db push && npm run db:seed && cd ..
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000 (`/api/health`)

Vite proxies `/api` to Express so login cookies work on localhost.

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
