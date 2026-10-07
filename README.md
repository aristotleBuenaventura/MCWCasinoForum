# MCW Casino Forum

A React forum inspired by classic community layouts (e.g. Dog Forum / XenForo), with Threads-style engagement.

## Features

- Auth: register, login, logout, roles (`user` / `moderator` / `admin`)
- Threads: create, view, like, share, report, delete
- Comments with nested replies
- Image & video uploads on posts
- Profiles, follow / unfollow, followers & following
- Search (threads, members, comments)
- Notifications
- Moderator tools: delete posts/comments, remove users, report queue
- Dark / light mode
- Dog Forum–style home layout (hero stats, feed, top forums, sidebar)

Data is stored in **localStorage** for a zero-config demo (no backend required).

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

## Stack

- React + Vite + TypeScript
- React Router
- Tailwind CSS v4
- lucide-react icons
