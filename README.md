# MCW Casino Forum

Dark casino community forum: homepage hub, nested communities (BlackHatWorld-style), and an admin CMS for ads and featured content.

## Features

- Dark-only UI inspired by the proposed MCW homepage
- Auth: register, login, logout, roles (`user` / `moderator` / `admin`)
- Nested communities → topic → thread list → discussion
- Threads: create, like, comment, share, report, pin
- Image & video uploads on posts
- Profiles, follow / unfollow
- Search, notifications, moderation
- Admin/mod dashboard:
  - Rotating ads (image/GIF + URL, interval in seconds)
  - Trending games
  - Featured communities
  - Top game providers
  - Community CRUD
  - Thread pins, reports, user removal
- Home cards (reviews, bonuses, wins, guides) come from **real forum threads**
- Placeholder images for logos/banners/ads; Facebook-style silhouette avatars

Data is stored in **localStorage** (no backend required for the demo).

## Quick start

```bash
npm install
npm run dev
```

## Demo accounts

| Username   | Password       | Role      |
|------------|----------------|-----------|
| alicewins  | password123    | user      |
| bobdealer  | password123    | user      |
| caraspins  | password123    | user      |
| moderator  | moderator123  | moderator |
| admin      | admin123       | admin     |

Admin and moderator share the same dashboard at `/admin`.

## Stack

- React + Vite + TypeScript
- React Router
- Tailwind CSS v4
- lucide-react icons
