# Deploy on Railway

1. Create a Railway service from this folder/repository.
2. Set Variables:
   - `BOT_TOKEN` = token from @BotFather
   - `ADMIN_PASSWORD` = long random admin password
   - `JWT_SECRET` = long random secret
   - `ADMIN_ID` = `8721768505`
   - `FRONTEND_ORIGIN` = your GitHub Pages origin, e.g. `https://edgegram.github.io`
   - `COOKIE_SECURE=true`
3. Add a Railway Volume and mount it at `/data`.
4. Set `DB_FILE=/data/maalavo.sqlite` so the SQLite database survives deploy/restart.
5. Generate a public Railway domain.
6. Put that domain into `public/config.js`:
   `window.MAALAVO_API_URL = 'https://YOUR-RAILWAY-DOMAIN/api';`
7. Deploy.
8. Check `https://YOUR-RAILWAY-DOMAIN/api/health` — it must return JSON with `ok: true`.
9. Host the `public/` folder on GitHub Pages, or keep the whole app on Railway. For GitHub Pages, copy `public/config.js` with your real Railway URL.
10. In BotFather, set the Mini App URL to your GitHub Pages URL (or Railway URL if serving frontend from Railway).

## Important
Do not commit `.env`, bot tokens, admin passwords, JWT secrets, or the SQLite database.
