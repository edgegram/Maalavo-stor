import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 8080);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET должен быть задан и содержать минимум 32 символа');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === '*') return '*';
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/$/, '');
  }
}

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (configuredOrigins.length === 0 || configuredOrigins.includes('*')) return true;
  return configuredOrigins.includes(normalizeOrigin(origin));
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS origin denied: ${origin}`));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));
app.options('*', cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS origin denied: ${origin}`));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '100kb' }));

const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const publicUserSchema = z.object({
  deviceId: z.string().min(8).max(128),
  telegramId: z.string().max(64).optional().nullable(),
  username: z.string().max(64).optional().nullable(),
  displayName: z.string().min(1).max(120).optional(),
  avatarUrl: z.string().url().max(2048).optional().nullable()
});
const orderSchema = z.object({
  deviceId: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(80),
  telegram: z.string().trim().min(2).max(80),
  comment: z.string().trim().max(1000).optional().default(''),
  items: z.array(z.object({ id: z.string().min(1).max(80), quantity: z.number().int().min(1).max(20) })).min(1).max(50)
});
const statusSchema = z.object({ status: z.enum(['new','processing','paid','completed','cancelled']) });
const productSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(5000),
  priceFrom: z.number().finite().min(0),
  imageUrl: z.string().max(2048).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional()
});

function signAdmin(admin){ return jwt.sign({ sub: admin.id, username: admin.username, role: 'admin' }, jwtSecret, { expiresIn: '8h' }); }
function auth(req,res,next){
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try { req.admin = jwt.verify(token, jwtSecret); next(); }
  catch { return res.status(401).json({ error: 'Сессия администратора истекла' }); }
}

app.get('/health', asyncRoute(async (_req,res) => {
  const result = await pool.query('SELECT NOW() AS now');
  res.json({ ok: true, service: 'maalavo-store-backend', time: result.rows[0].now });
}));

app.get('/api/products', asyncRoute(async (_req,res) => {
  const { rows } = await pool.query(`SELECT id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder" FROM products WHERE active=true ORDER BY sort_order,id`);
  res.json({ products: rows });
}));

app.post('/api/users/sync', asyncRoute(async (req,res) => {
  const parsed = publicUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные профиля', details: parsed.error.flatten() });
  const data = parsed.data;
  const { rows } = await pool.query(`
    INSERT INTO users (device_id,telegram_id,username,display_name,avatar_url)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (device_id) DO UPDATE SET
      telegram_id=COALESCE(EXCLUDED.telegram_id, users.telegram_id),
      username=COALESCE(EXCLUDED.username, users.username),
      display_name=COALESCE(NULLIF(EXCLUDED.display_name,''), users.display_name),
      avatar_url=COALESCE(EXCLUDED.avatar_url, users.avatar_url),
      updated_at=NOW()
    RETURNING id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber",created_at AS "createdAt"`,
    [data.deviceId, data.telegramId || null, data.username || null, data.displayName || 'Гость', data.avatarUrl || null]
  );
  res.json({ user: rows[0] });
}));

app.post('/api/orders', asyncRoute(async (req,res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Проверьте данные заказа', details: parsed.error.flatten() });
  const data = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT id FROM users WHERE device_id=$1', [data.deviceId]);
    const userId = userResult.rows[0]?.id || null;
    const ids = [...new Set(data.items.map(item => item.id))];
    const productsResult = await client.query(`SELECT id,title,price_from FROM products WHERE active=true AND id = ANY($1::varchar[])`, [ids]);
    const byId = new Map(productsResult.rows.map(p => [p.id,p]));
    if (byId.size !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Один из товаров больше недоступен' });
    }
    const items = data.items.map(item => ({ ...item, product: byId.get(item.id) }));
    const total = items.reduce((sum,item) => sum + Number(item.product.price_from) * item.quantity, 0);
    const publicId = `M${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,5).toUpperCase()}`.slice(-16);
    const orderResult = await client.query(`INSERT INTO orders (public_id,user_id,name,telegram,comment,total_from) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,public_id AS "publicId",status,created_at AS "createdAt",total_from AS "totalFrom"`, [publicId,userId,data.name,data.telegram,data.comment || null,total]);
    const order = orderResult.rows[0];
    for (const item of items) {
      await client.query(`INSERT INTO order_items (order_id,product_id,title,price_from,quantity) VALUES ($1,$2,$3,$4,$5)`, [order.id,item.product.id,item.product.title,item.product.price_from,item.quantity]);
    }
    await client.query('COMMIT');
    const telegramText = [
      `Новый заказ #${order.publicId}`,
      `Имя: ${data.name}`,
      `Telegram: ${data.telegram}`,
      '', 'Товары:',
      ...items.map(item => `• ${item.product.title} × ${item.quantity} — от ${Number(item.product.price_from).toLocaleString('ru-RU')} ₽`),
      `Итого от: ${total.toLocaleString('ru-RU')} ₽`,
      data.comment ? `Комментарий: ${data.comment}` : ''
    ].filter(Boolean).join('\n');
    await notifyTelegram(telegramText);
    res.status(201).json({ order: { ...order, publicId: order.publicId, totalFrom: Number(order.totalFrom) }, telegramText });
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
}));

app.get('/api/orders', auth, asyncRoute(async (req,res) => {
  const { rows } = await pool.query(`SELECT o.public_id AS "publicId",o.name,o.telegram,o.comment,o.total_from AS "totalFrom",o.status,o.created_at AS "createdAt",COALESCE(json_agg(json_build_object('id',oi.product_id,'title',oi.title,'priceFrom',oi.price_from,'quantity',oi.quantity)) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`);
  res.json({ orders: rows.map(row => ({...row,totalFrom:Number(row.totalFrom)})) });
}));

app.patch('/api/orders/:publicId/status', auth, asyncRoute(async (req,res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный статус' });
  const { rows } = await pool.query(`UPDATE orders SET status=$1,updated_at=NOW() WHERE public_id=$2 RETURNING public_id AS "publicId",status,updated_at AS "updatedAt"`, [parsed.data.status, req.params.publicId]);
  if (!rows[0]) return res.status(404).json({ error: 'Заказ не найден' });
  res.json({ order: rows[0] });
}));

app.post('/api/admin/login', asyncRoute(async (req,res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  const { rows } = await pool.query('SELECT id,username,password_hash FROM admin_users WHERE username=$1', [username]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json({ error: 'Неверный логин или пароль' });
  res.json({ token: signAdmin(admin), admin: { id: admin.id, username: admin.username } });
}));

app.get('/api/admin/me', auth, asyncRoute(async (req,res) => {
  res.json({ admin: { id: req.admin.sub, username: req.admin.username, role: 'admin' } });
}));

app.get('/api/admin/stats', auth, asyncRoute(async (_req,res) => {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS orders, COUNT(*) FILTER (WHERE status='new')::int AS new_orders, COUNT(*) FILTER (WHERE status='processing')::int AS processing_orders, COUNT(*) FILTER (WHERE status='completed')::int AS completed_orders, COALESCE(SUM(total_from) FILTER (WHERE status IN ('paid','completed')),0)::numeric AS revenue_from FROM orders`);
  const users = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  res.json({ stats: { ...rows[0], revenueFrom: Number(rows[0].revenue_from), users: users.rows[0].count } });
}));

app.get('/api/admin/products', auth, asyncRoute(async (_req,res) => {
  const { rows } = await pool.query(`SELECT id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder" FROM products ORDER BY sort_order,id`);
  res.json({ products: rows });
}));

app.post('/api/admin/products', auth, asyncRoute(async (req,res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный товар', details: parsed.error.flatten() });
  const id = String(req.body.id || '').trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(id)) return res.status(400).json({ error: 'ID товара должен содержать 2-80 символов: a-z, 0-9, _ или -' });
  const p = parsed.data;
  const { rows } = await pool.query(`INSERT INTO products (id,title,category,description,price_from,image_url,active,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder"`, [id,p.title,p.category,p.description,p.priceFrom,p.imageUrl || null,p.active ?? true,p.sortOrder ?? 0]);
  res.status(201).json({ product: rows[0] });
}));

app.patch('/api/admin/products/:id', auth, asyncRoute(async (req,res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные товара', details: parsed.error.flatten() });
  const p = parsed.data;
  const current = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!current.rows[0]) return res.status(404).json({ error: 'Товар не найден' });
  const old = current.rows[0];
  const { rows } = await pool.query(`UPDATE products SET title=$1,category=$2,description=$3,price_from=$4,image_url=$5,active=$6,sort_order=$7,updated_at=NOW() WHERE id=$8 RETURNING id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder"`, [p.title ?? old.title,p.category ?? old.category,p.description ?? old.description,p.priceFrom ?? Number(old.price_from),p.imageUrl ?? old.image_url,p.active ?? old.active,p.sortOrder ?? old.sort_order,req.params.id]);
  res.json({ product: rows[0] });
}));

app.delete('/api/admin/products/:id', auth, asyncRoute(async (req,res) => {
  const result = await pool.query('UPDATE products SET active=false,updated_at=NOW() WHERE id=$1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Товар не найден' });
  res.json({ ok: true });
}));

async function notifyTelegram(text){
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({chat_id:chatId,text}) });
    if (!response.ok) console.error('Telegram notification failed:', response.status, await response.text());
  } catch (error) { console.error('Telegram notification error:', error.message); }
}

app.use((req,res) => res.status(404).json({ error: 'Маршрут не найден' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  const message = process.env.NODE_ENV === 'production' ? 'Внутренняя ошибка сервера' : error.message;
  res.status(500).json({ error: message });
});

const server = app.listen(port, () => console.log(`Maalavo backend listening on :${port}`));
const shutdown = async () => { server.close(async () => { await pool.end(); process.exit(0); }); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
