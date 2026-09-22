# Maalavo Store Backend

Production-ready API for Railway + PostgreSQL. The frontend keeps its current UI; the backend adds persistent users, orders, product management and admin authentication.

## API

- `GET /health` — health check.
- `GET /api/products` — active catalog.
- `POST /api/users/sync` — creates/updates a browser/Telegram user and assigns an account number.
- `POST /api/orders` — validates products against PostgreSQL and creates an order.
- `POST /api/admin/login` — admin login, returns JWT.
- `GET /api/admin/me` — checks admin JWT.
- `GET /api/admin/stats` — store statistics.
- `GET /api/admin/products` — all products.
- `POST /api/admin/products` — create product.
- `PATCH /api/admin/products/:id` — edit product.
- `DELETE /api/admin/products/:id` — soft-delete product.
- `GET /api/orders` — admin order list.
- `PATCH /api/orders/:publicId/status` — admin order status.

## Railway

1. Create a PostgreSQL service in Railway.
2. Deploy this `backend` directory as a separate Railway service.
3. Add variables from `.env.example`.
4. Run once after deployment:

```bash
npm install
npm run migrate
npm run seed-admin
```

Railway should use:

```bash
npm start
```

Health check:

```text
/health
```

## Required variables

- `DATABASE_URL` — Railway PostgreSQL connection string.
- `JWT_SECRET` — random secret, 32+ characters.
- `CORS_ORIGINS` — comma-separated frontend/admin origins.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — admin bootstrap credentials.

Optional Telegram notifications:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`

The API does not process real card payments yet. Orders are stored and can be moved through statuses from the admin panel. A payment provider can be added later without changing the storefront order model.
