import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 8080);
const production = process.env.NODE_ENV === 'production';
const jwtSecret = String(process.env.JWT_SECRET || '');
const databaseUrl = String(process.env.DATABASE_URL || '');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET должен содержать минимум 32 символа');
if (!databaseUrl) throw new Error('DATABASE_URL не задан');

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  query_timeout: 15000,
  ssl: production ? { rejectUnauthorized: false } : false
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'db', '001_init.sql');

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '*') return raw;
  try { return new URL(raw).origin; } catch { return raw.replace(/\/$/, ''); }
}

const allowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',').map(normalizeOrigin).filter(Boolean);

function corsOrigin(origin) {
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(normalizeOrigin(origin)) ? origin : false;
}

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
  maxAge: 86400
}));
app.use(express.json({ limit: '100kb' }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const userSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  telegramId: z.string().trim().max(64).optional().nullable(),
  username: z.string().trim().max(64).optional().nullable(),
  displayName: z.string().trim().min(1).max(120).optional(),
  avatarUrl: z.string().url().max(2048).optional().nullable()
});
const orderSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  name: z.string().trim().min(2).max(80),
  telegram: z.string().trim().min(2).max(80),
  comment: z.string().trim().max(1000).optional().default(''),
  items: z.array(z.object({ id: z.string().trim().min(1).max(80), quantity: z.number().int().min(1).max(20) })).min(1).max(50)
});
const statusSchema = z.object({ status: z.enum(['new', 'processing', 'paid', 'completed', 'cancelled']) });
const productSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/).optional(),
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(5000),
  priceFrom: z.number().finite().min(0),
  imageUrl: z.string().max(2048).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional()
});

async function migrate() {
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Database migration completed.');
}

async function waitForDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try { await pool.query('SELECT 1'); return; }
    catch (error) {
      lastError = error;
      console.error(`Database connection attempt ${attempt}/20 failed: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1000, 5000)));
    }
  }
  throw lastError;
}

function signAdmin(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username, role: 'admin' }, jwtSecret, { expiresIn: '8h' });
}

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try { req.admin = jwt.verify(token, jwtSecret); return next(); }
  catch { return res.status(401).json({ error: 'Сессия администратора истекла' }); }
}

function publicOrderId() {
  return `M${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(-20);
}

async function notifyTelegram(text) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '');
  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || '');
  if (!token || !chatId) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }), signal: controller.signal
    });
    if (!response.ok) console.error('Telegram notification failed:', response.status, await response.text());
  } catch (error) { console.error('Telegram notification failed:', error.message); }
  finally { clearTimeout(timer); }
}

app.get('/health', asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT NOW() AS now');
  res.json({ ok: true, service: 'maalavo-store-backend', database: 'ok', time: result.rows[0].now });
}));

app.get('/api/products', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder" FROM products WHERE active=true ORDER BY sort_order,id`);
  res.json({ products: rows.map(row => ({ ...row, priceFrom: Number(row.priceFrom) })) });
}));

app.post('/api/users/sync', asyncRoute(async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные профиля', details: parsed.error.flatten() });
  const data = parsed.data;
  const { rows } = await pool.query(`
    INSERT INTO users (device_id,telegram_id,username,display_name,avatar_url)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (device_id) DO UPDATE SET
      telegram_id=COALESCE(EXCLUDED.telegram_id,users.telegram_id),
      username=COALESCE(EXCLUDED.username,users.username),
      display_name=COALESCE(NULLIF(EXCLUDED.display_name,''),users.display_name),
      avatar_url=COALESCE(EXCLUDED.avatar_url,users.avatar_url),
      updated_at=NOW()
    RETURNING id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber",created_at AS "createdAt"
  `, [data.deviceId, data.telegramId || null, data.username || null, data.displayName || 'Гость', data.avatarUrl || null]);
  res.json({ user: rows[0] });
}));

app.post('/api/orders', asyncRoute(async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Проверьте данные заказа', details: parsed.error.flatten() });
  const data = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT id FROM users WHERE device_id=$1', [data.deviceId]);
    const userId = userResult.rows[0]?.id || null;
    const ids = [...new Set(data.items.map(item => item.id))];
    const productResult = await client.query(`SELECT id,title,price_from AS "priceFrom" FROM products WHERE active=true AND id=ANY($1::varchar[])`, [ids]);
    const products = new Map(productResult.rows.map(product => [product.id, product]));
    if (products.size !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Один из товаров больше недоступен' });
    }
    const items = data.items.map(item => ({ ...item, product: products.get(item.id) }));
    const total = items.reduce((sum, item) => sum + Number(item.product.priceFrom) * item.quantity, 0);
    const id = publicOrderId();
    const orderResult = await client.query(`INSERT INTO orders (public_id,user_id,name,telegram,comment,total_from) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,public_id AS "publicId",status,created_at AS "createdAt",total_from AS "totalFrom"`, [id,userId,data.name,data.telegram,data.comment || null,total]);
    const order = orderResult.rows[0];
    for (const item of items) {
      await client.query(`INSERT INTO order_items (order_id,product_id,title,price_from,quantity) VALUES ($1,$2,$3,$4,$5)`, [order.id,item.product.id,item.product.title,item.product.priceFrom,item.quantity]);
    }
    await client.query('COMMIT');
    const telegramText = [
      `Новый заказ #${order.publicId}`,
      `Имя: ${data.name}`,
      `Telegram: ${data.telegram}`,
      '', 'Товары:',
      ...items.map(item => `• ${item.product.title} × ${item.quantity} — от ${Number(item.product.priceFrom).toLocaleString('ru-RU')} ₽`),
      `Итого от: ${total.toLocaleString('ru-RU')} ₽`,
      data.comment ? `Комментарий: ${data.comment}` : ''
    ].filter(Boolean).join('\n');
    void notifyTelegram(telegramText);
    res.status(201).json({ ok: true, order: { ...order, totalFrom: Number(order.totalFrom) } });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Rollback failed:', rollbackError.message); }
    throw error;
  } finally { client.release(); }
}));

app.get('/api/orders', auth, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT o.public_id AS "publicId",o.name,o.telegram,o.comment,o.total_from AS "totalFrom",o.status,o.created_at AS "createdAt",
    COALESCE(json_agg(json_build_object('id',oi.product_id,'title',oi.title,'priceFrom',oi.price_from,'quantity',oi.quantity) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200
  `);
  res.json({ orders: rows.map(row => ({ ...row, totalFrom: Number(row.totalFrom) })) });
}));

app.patch('/api/orders/:publicId/status', auth, asyncRoute(async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный статус' });
  const { rows } = await pool.query(`UPDATE orders SET status=$1,updated_at=NOW() WHERE public_id=$2 RETURNING public_id AS "publicId",status,updated_at AS "updatedAt"`, [parsed.data.status,req.params.publicId]);
  if (!rows[0]) return res.status(404).json({ error: 'Заказ не найден' });
  res.json({ order: rows[0] });
}));

app.post('/api/admin/login', asyncRoute(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  const { rows } = await pool.query('SELECT id,username,password_hash FROM admin_users WHERE username=$1', [username]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password,admin.password_hash))) return res.status(401).json({ error: 'Неверный логин или пароль' });
  res.json({ token: signAdmin(admin), admin: { id: admin.id, username: admin.username } });
}));

app.get('/api/admin/me', auth, asyncRoute(async (req, res) => {
  res.json({ admin: { id: req.admin.sub, username: req.admin.username, role: 'admin' } });
}));

app.get('/api/admin/stats', auth, asyncRoute(async (_req, res) => {
  const stats = (await pool.query(`SELECT COUNT(*)::int AS orders,COUNT(*) FILTER (WHERE status='new')::int AS new_orders,COUNT(*) FILTER (WHERE status='processing')::int AS processing_orders,COUNT(*) FILTER (WHERE status='completed')::int AS completed_orders,COALESCE(SUM(total_from) FILTER (WHERE status IN ('paid','completed')),0)::numeric AS revenue_from FROM orders`)).rows[0];
  const users = (await pool.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count;
  res.json({ stats: { orders: stats.orders, newOrders: stats.new_orders, processingOrders: stats.processing_orders, completedOrders: stats.completed_orders, revenueFrom: Number(stats.revenue_from), users } });
}));

app.get('/api/admin/products', auth, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder" FROM products ORDER BY sort_order,id`);
  res.json({ products: rows.map(row => ({ ...row, priceFrom: Number(row.priceFrom) })) });
}));

app.post('/api/admin/products', auth, asyncRoute(async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.id) return res.status(400).json({ error: 'Некорректный товар', details: parsed.error.flatten() });
  const p = parsed.data;
  const { rows } = await pool.query(`INSERT INTO products (id,title,category,description,price_from,image_url,active,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder"`, [p.id,p.title,p.category,p.description,p.priceFrom,p.imageUrl || null,p.active ?? true,p.sortOrder ?? 0]);
  res.status(201).json({ product: { ...rows[0], priceFrom: Number(rows[0].priceFrom) } });
}));

app.patch('/api/admin/products/:id', auth, asyncRoute(async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные товара', details: parsed.error.flatten() });
  const current = (await pool.query('SELECT * FROM products WHERE id=$1',[req.params.id])).rows[0];
  if (!current) return res.status(404).json({ error: 'Товар не найден' });
  const p = parsed.data;
  const { rows } = await pool.query(`UPDATE products SET title=$1,category=$2,description=$3,price_from=$4,image_url=$5,active=$6,sort_order=$7,updated_at=NOW() WHERE id=$8 RETURNING id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder"`, [p.title ?? current.title,p.category ?? current.category,p.description ?? current.description,p.priceFrom ?? Number(current.price_from),p.imageUrl ?? current.image_url,p.active ?? current.active,p.sortOrder ?? current.sort_order,req.params.id]);
  res.json({ product: { ...rows[0], priceFrom: Number(rows[0].priceFrom) } });
}));

app.delete('/api/admin/products/:id', auth, asyncRoute(async (req, res) => {
  const result = await pool.query('UPDATE products SET active=false,updated_at=NOW() WHERE id=$1',[req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Товар не найден' });
  res.json({ ok: true });
}));

app.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
app.use((error, _req, res, _next) => {
  console.error('Unhandled API error:', error);
  if (error?.code === '23505') return res.status(409).json({ error: 'Такая запись уже существует' });
  if (error?.code === '23503') return res.status(400).json({ error: 'Связанная запись не найдена' });
  if (error?.code === '42P01') return res.status(503).json({ error: 'База данных ещё не инициализирована' });
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

async function start() {
  await waitForDatabase();
  await migrate();
  const server = app.listen(port, '0.0.0.0', () => console.log(`Maalavo backend listening on :${port}`));
  const shutdown = signal => server.close(async () => { console.log(`Received ${signal}, shutting down...`); await pool.end(); process.exit(0); });
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

start().catch(async error => { console.error('Backend startup failed:', error); await pool.end(); process.exit(1); });
