import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { telegramAuthRequired, verifyTelegramInitData } from './telegram-auth.js';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const JWT_SECRET = String(process.env.JWT_SECRET || '');
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const production = process.env.NODE_ENV === 'production';

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
  ssl: production ? { rejectUnauthorized: false } : false
});

const normalizeOrigin = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '*') return raw;
  try { return new URL(raw).origin; } catch { return raw.replace(/\/$/, ''); }
};
const allowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map(normalizeOrigin).filter(Boolean);

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(value, callback) {
    if (!value || allowedOrigins.length === 0 || allowedOrigins.includes('*')) return callback(null, true);
    return callback(null, allowedOrigins.includes(normalizeOrigin(value)) ? value : false);
  },
  methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Telegram-Init-Data'],
  optionsSuccessStatus: 204,
  maxAge: 86400
}));
app.use(express.json({ limit: '100kb' }));

const errorResponse = (res, status, error, code = undefined) => res.status(status).json(code ? { error, code } : { error });
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

async function waitForDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try { await pool.query('SELECT 1'); return; }
    catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 500, 3000))); }
  }
  throw lastError;
}

async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id VARCHAR(128) UNIQUE NOT NULL,
      telegram_id VARCHAR(64) UNIQUE,
      username VARCHAR(64),
      display_name VARCHAR(120) NOT NULL DEFAULT 'Гость',
      avatar_url TEXT,
      account_number BIGSERIAL UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(80) PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      category VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      price_from NUMERIC(12,2) NOT NULL DEFAULT 0,
      image_url TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      public_id VARCHAR(20) UNIQUE NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(80) NOT NULL,
      telegram VARCHAR(80) NOT NULL,
      comment VARCHAR(1000),
      total_from NUMERIC(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id VARCHAR(80) NOT NULL REFERENCES products(id),
      title VARCHAR(160) NOT NULL,
      price_from NUMERIC(12,2) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(64) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (rows[0].count === 0) {
    const products = [
      ['telegram-bot','Telegram Bot','bots','Готовый Telegram-бот под ваши задачи.',1500,'assets/products/telegram-bot.png',10],
      ['web-app','Веб-приложение','web','Современное адаптивное веб-приложение.',3000,'assets/products/web-app.png',20],
      ['website','Сайт под ключ','sites','Полноценный современный сайт под проект.',5000,'assets/products/website.png',30],
      ['plugin','Telegram Plugin','plugins','Кастомный Telegram-инструмент.',1000,'assets/products/plugin.png',40],
      ['bug-fix','Исправление ошибок','services','Поиск и исправление проблем сайта.',800,'assets/products/bug-fix.png',50],
      ['service','Разработка','services','Индивидуальная разработка цифрового решения.',1000,'assets/products/service.png',60],
      ['landing-page','Лендинг','sites','Одностраничный сайт.',3500,'assets/products/landing-page.png',70],
      ['admin-panel','Админ-панель','web','Управление заказами и товарами.',5000,'assets/products/admin-panel.png',80],
      ['api-integration','API-интеграция','integrations','Подключение внешнего API.',1500,'assets/products/api-integration.png',90],
      ['automation','Автоматизация','automation','Автоматизация процессов.',2000,'assets/products/automation.png',100],
      ['ui-redesign','UI/UX редизайн','design','Переработка интерфейса.',2500,'assets/products/ui-redesign.png',110],
      ['data-tool','Инструмент для данных','automation','Инструмент для обработки данных.',1500,'assets/products/data-tool.png',120]
    ];
    for (const product of products) {
      await pool.query('INSERT INTO products (id,title,category,description,price_from,image_url,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING', product);
    }
  }
}

function adminAuth(req, res, next) {
  const value = req.get('authorization') || '';
  if (!value.startsWith('Bearer ')) return errorResponse(res, 401, 'Требуется авторизация');
  try { req.admin = jwt.verify(value.slice(7), JWT_SECRET); return next(); }
  catch { return errorResponse(res, 401, 'Сессия администратора истекла'); }
}

async function notifyTelegram(text) {
  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || '').trim();
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal
    });
  } catch (error) {
    console.error('Telegram notification failed:', error?.message || error);
  } finally {
    clearTimeout(timer);
  }
}

app.get('/health', wrap(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'maalavo-store-backend', database: 'ok', telegramAuth: Boolean(TELEGRAM_BOT_TOKEN) });
}));

app.get('/api/products', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder" FROM products WHERE active=true ORDER BY sort_order,id');
  res.json({ products: rows.map((row) => ({ ...row, priceFrom: Number(row.priceFrom) })) });
}));

app.post('/api/users/sync', wrap(async (req, res) => {
  const deviceId = String(req.body?.deviceId || '').trim();
  if (!deviceId) return errorResponse(res, 400, 'deviceId обязателен');

  const initData = String(req.get('X-Telegram-Init-Data') || req.body?.initData || '').trim();
  let telegramUser = null;
  if (initData) {
    const verified = verifyTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
    if (!verified.ok) return errorResponse(res, 401, 'Недействительные данные Telegram', verified.reason);
    telegramUser = verified.user;
  }

  if (telegramUser) {
    const username = telegramUser.username || null;
    const displayName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || username || 'Гость';
    const avatarUrl = telegramUser.photo_url || null;
    const { rows } = await pool.query(`
      INSERT INTO users(device_id,telegram_id,username,display_name,avatar_url)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(device_id) DO UPDATE SET
        telegram_id=EXCLUDED.telegram_id,
        username=EXCLUDED.username,
        display_name=EXCLUDED.display_name,
        avatar_url=EXCLUDED.avatar_url,
        updated_at=NOW()
      RETURNING id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber",created_at AS "createdAt"`,
      [deviceId, String(telegramUser.id), username, displayName, avatarUrl]
    );
    return res.json({ user: rows[0], source: 'telegram_verified' });
  }

  const { rows } = await pool.query(`
    INSERT INTO users(device_id,display_name)
    VALUES($1,'Гость')
    ON CONFLICT(device_id) DO UPDATE SET updated_at=NOW()
    RETURNING id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber",created_at AS "createdAt"`,
    [deviceId]
  );
  return res.json({ user: rows[0], source: 'guest' });
}));

app.post('/api/orders', wrap(async (req, res) => {
  const deviceId = String(req.body?.deviceId || '').trim();
  const name = String(req.body?.name || '').trim();
  const telegram = String(req.body?.telegram || '').trim();
  const comment = String(req.body?.comment || '').trim();
  const itemsInput = req.body?.items;

  if (!deviceId) return errorResponse(res, 400, 'deviceId обязателен');
  if (!name || !telegram) return errorResponse(res, 400, 'Имя и Telegram обязательны');
  if (!Array.isArray(itemsInput) || itemsInput.length === 0) return errorResponse(res, 400, 'Корзина пуста');
  if (itemsInput.length > 50) return errorResponse(res, 400, 'Слишком много товаров');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT id FROM users WHERE device_id=$1', [deviceId]);
    const ids = [...new Set(itemsInput.map((item) => String(item?.id || '').trim()).filter(Boolean))];
    if (!ids.length) { await client.query('ROLLBACK'); return errorResponse(res, 400, 'Некорректная корзина'); }

    const productsResult = await client.query('SELECT id,title,price_from AS "priceFrom" FROM products WHERE active=true AND id=ANY($1::varchar[])', [ids]);
    if (productsResult.rows.length !== ids.length) {
      await client.query('ROLLBACK');
      return errorResponse(res, 400, 'Один из товаров недоступен');
    }

    const products = new Map(productsResult.rows.map((product) => [product.id, product]));
    const items = itemsInput.map((item) => ({
      quantity: Math.max(1, Math.min(20, Number(item?.quantity) || 1)),
      product: products.get(String(item.id))
    }));
    const total = items.reduce((sum, item) => sum + Number(item.product.priceFrom) * item.quantity, 0);
    const publicId = `M${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,7).toUpperCase()}`.slice(0, 20);

    const orderResult = await client.query(`
      INSERT INTO orders(public_id,user_id,name,telegram,comment,total_from)
      VALUES($1,$2,$3,$4,$5,$6)
      RETURNING id,public_id AS "publicId",status,created_at AS "createdAt",total_from AS "totalFrom"`,
      [publicId, userResult.rows[0]?.id || null, name, telegram, comment || null, total]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query('INSERT INTO order_items(order_id,product_id,title,price_from,quantity) VALUES($1,$2,$3,$4,$5)', [order.id, item.product.id, item.product.title, item.product.priceFrom, item.quantity]);
    }

    await client.query('COMMIT');
    void notifyTelegram([
      `Новый заказ #${order.publicId}`,
      `Имя: ${name}`,
      `Telegram: ${telegram}`,
      ...items.map((item) => `• ${item.product.title} × ${item.quantity}`),
      `Итого от: ${total.toLocaleString('ru-RU')} ₽`
    ].join('\n'));

    return res.status(201).json({ ok: true, order: { ...order, totalFrom: Number(order.totalFrom) } });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/admin/login', wrap(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const { rows } = await pool.query('SELECT id,username,password_hash FROM admin_users WHERE username=$1', [username]);
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) return errorResponse(res, 401, 'Неверный логин или пароль');
  const token = jwt.sign({ sub: rows[0].id, username: rows[0].username, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token, admin: { id: rows[0].id, username: rows[0].username } });
}));

app.get('/api/admin/me', adminAuth, (req, res) => res.json({ admin: { id: req.admin.sub, username: req.admin.username, role: 'admin' } }));

app.get('/api/orders', adminAuth, wrap(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT o.public_id AS "publicId",o.name,o.telegram,o.comment,o.total_from AS "totalFrom",o.status,o.created_at AS "createdAt",
      COALESCE(json_agg(json_build_object('id',oi.product_id,'title',oi.title,'priceFrom',oi.price_from,'quantity',oi.quantity) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
    GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`);
  res.json({ orders: rows.map((row) => ({ ...row, totalFrom: Number(row.totalFrom) })) });
}));

app.patch('/api/orders/:publicId/status', adminAuth, wrap(async (req, res) => {
  const allowed = ['new','processing','paid','completed','cancelled'];
  if (!allowed.includes(req.body?.status)) return errorResponse(res, 400, 'Некорректный статус');
  const { rows } = await pool.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE public_id=$2 RETURNING public_id AS "publicId",status,updated_at AS "updatedAt"', [req.body.status, req.params.publicId]);
  if (!rows[0]) return errorResponse(res, 404, 'Заказ не найден');
  res.json({ order: rows[0] });
}));

app.get('/api/admin/stats', adminAuth, wrap(async (_req, res) => {
  const stats = (await pool.query(`
    SELECT COUNT(*)::int orders,
      COUNT(*) FILTER(WHERE status='new')::int new_orders,
      COUNT(*) FILTER(WHERE status='processing')::int processing_orders,
      COUNT(*) FILTER(WHERE status='completed')::int completed_orders,
      COALESCE(SUM(total_from) FILTER(WHERE status IN('paid','completed')),0)::numeric revenue
    FROM orders`)).rows[0];
  const users = (await pool.query('SELECT COUNT(*)::int count FROM users')).rows[0].count;
  res.json({ stats: { orders: stats.orders, newOrders: stats.new_orders, processingOrders: stats.processing_orders, completedOrders: stats.completed_orders, revenueFrom: Number(stats.revenue), users } });
}));

app.use((req, res) => res.status(404).json({ error: 'Маршрут не найден', path: req.path }));
app.use((error, _req, res, _next) => {
  console.error('API error:', error);
  if (error?.code === '23505') return errorResponse(res, 409, 'Такая запись уже существует');
  return errorResponse(res, 500, 'Внутренняя ошибка сервера');
});

await waitForDatabase();
await ensureSchema();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Maalavo backend listening on :${PORT}`);
  console.log(`Telegram server-side verification: ${TELEGRAM_BOT_TOKEN ? 'enabled' : 'disabled'}`);
});
