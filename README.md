# MAALAVO STORE — Full Stack

Production-oriented Telegram Mini App store with a Node.js backend, SQLite database, server-side cart/favorites/orders, and protected admin panel.

## Architecture
- Frontend: static HTML/CSS/JS, suitable for GitHub Pages.
- Backend: Node.js + Express, suitable for Railway.
- Database: SQLite. On Railway, use a Volume mounted at `/data` and set `DB_FILE=/data/maalavo.sqlite`.
- Telegram auth: server verifies Telegram WebApp `initData` with `BOT_TOKEN`.
- Admin auth: password login creates an HttpOnly JWT cookie.

## API
- `GET /api/health`
- `GET /api/products`
- `GET /api/about`
- `GET /api/me`
- `GET/PUT/DELETE /api/me/cart...`
- `GET/PUT /api/me/favorites...`
- `GET /api/me/orders`
- `POST /api/orders`
- `/api/admin/*` protected endpoints

## Frontend configuration
Edit `public/config.js` after Railway gives you a public domain:

`window.MAALAVO_API_URL = 'https://YOUR-RAILWAY-DOMAIN/api';`

The profile admin button automatically uses the Railway `/admin` URL.

## Security
Keep all secrets only in Railway Variables or a local `.env` that is ignored by Git. Never put `BOT_TOKEN`, `ADMIN_PASSWORD`, or `JWT_SECRET` into GitHub.
