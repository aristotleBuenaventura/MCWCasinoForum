# MCW Casino Forum — DigitalOcean Droplet

Same layout as MR Database Tool: Nginx + PM2 + local MySQL + Certbot.

App path: `/var/www/MCWCasinoForum`

## 1) Packages

```bash
apt update && apt upgrade -y
apt install -y git curl nginx mysql-server ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
```

## 2) MySQL

```sql
CREATE DATABASE mcwforum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mcw_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON mcwforum.* TO 'mcw_user'@'localhost';
FLUSH PRIVILEGES;
```

## 3) App

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_USERNAME/MCWCasinoForum.git
cd MCWCasinoForum
npm run install:all
cp backend/.env.example backend/.env
nano backend/.env
```

Set production values:

```env
PORT=4000
DATABASE_URL="mysql://mcw_user:YOUR_STRONG_PASSWORD@localhost:3306/mcwforum"
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=mcw_user
DATABASE_PASSWORD=YOUR_STRONG_PASSWORD
DATABASE_NAME=mcwforum
JWT_SECRET=long-random-secret-at-least-32-chars
CORS_ORIGIN=https://yourdomain.com
COOKIE_SECURE=true
TRUST_PROXY=1
NODE_ENV=production
```

```bash
cd /var/www/MCWCasinoForum/backend
npx prisma generate
npx prisma db push
npm run db:seed
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

```bash
cd /var/www/MCWCasinoForum
npm run build
```

## 4) Nginx

`/etc/nginx/sites-available/mcw-casino-forum`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/MCWCasinoForum/dist;
    index index.html;
    client_max_body_size 8m;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
ln -sf /etc/nginx/sites-available/mcw-casino-forum /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d yourdomain.com
pm2 restart mcw-forum-api
```
