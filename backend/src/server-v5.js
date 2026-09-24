import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { verifyTelegramInitData } from './telegram-auth.js';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const BOT_TOKEN = String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || '').trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const ADMIN_CHAT_ID = String(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || '').trim();

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
  ssl: { rejectUnauthorized: false }
});

const origins = String(process.env.CORS_ORIGINS || '*').split(',').map((v) => v.trim()).filter(Boolean);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || origins.includes('*') || origins.includes(origin)),
  methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Telegram-Init-Data'],
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '100kb' }));

const error = (res, status, message) => res.status(status).json({ ok: false, error: message });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function waitForDatabase() {
  let last;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try { await pool.query('SELECT 1'); return; }
    catch (err) { last = err; await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 500, 3000))); }
  }
  throw last;
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
      description TEXT NOT NULL DEFAULT '',
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
    CREATE TABLE IF NOT EXISTS product_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id VARCHAR(80) NOT NULL REFERENCES products(id),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      text VARCHAR(1200) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(order_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
    CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS reviews_product_idx ON product_reviews(product_id, created_at DESC);
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
      await pool.query('INSERT INTO products(id,title,category,description,price_from,image_url,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING', product);
    }
  }

  if (ADMIN_USERNAME && ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await pool.query(`INSERT INTO admin_users(username,password_hash) VALUES($1,$2)
      ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash,updated_at=NOW()`, [ADMIN_USERNAME, hash]);
  }
}

function adminAuth(req, res, next) {
  const header = String(req.get('authorization') || '');
  if (!header.startsWith('Bearer ')) return error(res, 401, 'Требуется авторизация');
  try { req.admin = jwt.verify(header.slice(7), JWT_SECRET); return next(); }
  catch { return error(res, 401, 'Сессия администратора истекла'); }
}

function getStatusLabel(status) {
  return ({
    new: 'Новый',
    in_progress: 'В работе',
    paid: 'Оплачен',
    completed: 'Получен',
    cancelled: 'Отменён'
  })[status] || status;
}

async function notifyTelegram(text) {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text }),
      signal: controller.signal
    });
  } catch (err) { console.error('Telegram notification failed:', err?.message || err); }
  finally { clearTimeout(timer); }
}

async function resolveUser(req, deviceId = '') {
  const initData = String(req.get('X-Telegram-Init-Data') || '').trim();
  if (initData && BOT_TOKEN) {
    const verified = verifyTelegramInitData(initData, BOT_TOKEN);
    if (!verified.ok) throw Object.assign(new Error('Недействительные данные Telegram'), { statusCode: 401 });
    const tgId = String(verified.user.id);
    const byTelegram = await pool.query('SELECT id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber" FROM users WHERE telegram_id=$1', [tgId]);
    if (byTelegram.rows[0]) return byTelegram.rows[0];
  }
  if (deviceId) {
    const byDevice = await pool.query('SELECT id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber" FROM users WHERE device_id=$1', [deviceId]);
    if (byDevice.rows[0]) return byDevice.rows[0];
  }
  return null;
}

app.get('/health', wrap(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, database: 'ok', service: 'maalavo-store-backend', version: '5.0.0' });
}));

app.get('/api/products', wrap(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT p.id,p.title,p.category,p.description,p.price_from AS "priceFrom",p.image_url AS "imageUrl",p.active,p.sort_order AS "sortOrder",
      COALESCE(rs.review_count,0)::int AS "reviewCount", COALESCE(rs.rating_avg,0)::numeric(3,2) AS "ratingAvg"
    FROM products p
    LEFT JOIN (
      SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS rating_avg
      FROM product_reviews GROUP BY product_id
    ) rs ON rs.product_id=p.id
    WHERE p.active=true ORDER BY p.sort_order,p.id`);
  res.json({ products: rows.map((row) => ({ ...row, priceFrom: Number(row.priceFrom), reviewCount: Number(row.reviewCount), ratingAvg: Number(row.ratingAvg) })) });
}));

app.get('/api/products/:id/reviews', wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT r.id,r.rating,r.text,r.created_at AS "createdAt",
      COALESCE(NULLIF(u.display_name,''),'Покупатель') AS "displayName",
      u.username
    FROM product_reviews r
    JOIN users u ON u.id=r.user_id
    WHERE r.product_id=$1 ORDER BY r.created_at DESC LIMIT 100`, [req.params.id]);
  const stats = await pool.query('SELECT COUNT(*)::int AS count, COALESCE(AVG(rating),0)::numeric(3,2) AS avg FROM product_reviews WHERE product_id=$1', [req.params.id]);
  res.json({ ok:true, reviews:rows, stats:{ count:stats.rows[0].count, average:Number(stats.rows[0].avg) } });
}));

app.post('/api/users/sync', wrap(async (req, res) => {
  const deviceId = String(req.body?.deviceId || '').trim();
  if (!deviceId) return error(res, 400, 'deviceId обязателен');
  const initData = String(req.get('X-Telegram-Init-Data') || req.body?.initData || '').trim();
  let tg = null;
  if (initData) {
    const verified = verifyTelegramInitData(initData, BOT_TOKEN);
    if (!verified.ok) return error(res, 401, 'Недействительные данные Telegram');
    tg = verified.user;
  }
  const telegramId = tg ? String(tg.id) : null;
  const username = tg?.username || null;
  const displayName = tg ? ([tg.first_name, tg.last_name].filter(Boolean).join(' ') || username || 'Гость') : 'Гость';
  let existing = null;
  if (telegramId) {
    const result = await pool.query('SELECT id FROM users WHERE telegram_id=$1', [telegramId]);
    existing = result.rows[0] || null;
  }
  if (existing) {
    const { rows } = await pool.query(`UPDATE users SET device_id=$1,username=$2,display_name=$3,avatar_url=$4,updated_at=NOW() WHERE id=$5
      RETURNING id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber",created_at AS "createdAt"`, [deviceId,username,displayName,tg?.photo_url || null,existing.id]);
    return res.json({ user:rows[0], source:'telegram_verified' });
  }
  const { rows } = await pool.query(`INSERT INTO users(device_id,telegram_id,username,display_name,avatar_url)
    VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(device_id) DO UPDATE SET telegram_id=EXCLUDED.telegram_id,username=EXCLUDED.username,display_name=EXCLUDED.display_name,avatar_url=EXCLUDED.avatar_url,updated_at=NOW()
    RETURNING id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber",created_at AS "createdAt"`, [deviceId,telegramId,username,displayName,tg?.photo_url || null]);
  res.json({ user:rows[0], source:tg ? 'telegram_verified' : 'guest' });
}));

app.post('/api/orders', wrap(async (req, res) => {
  const deviceId = String(req.body?.deviceId || '').trim();
  const name = String(req.body?.name || '').trim();
  const telegram = String(req.body?.telegram || '').trim();
  const comment = String(req.body?.comment || '').trim();
  const input = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!deviceId || !name || !telegram || !input.length) return error(res, 400, 'Некорректные данные заказа');
  if (input.length > 50) return error(res, 400, 'Слишком много товаров');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT id FROM users WHERE device_id=$1', [deviceId]);
    const ids = [...new Set(input.map((item) => String(item?.id || '').trim()).filter(Boolean))];
    const productsResult = await client.query('SELECT id,title,price_from AS "priceFrom" FROM products WHERE active=true AND id=ANY($1::varchar[])', [ids]);
    if (productsResult.rows.length !== ids.length) throw Object.assign(new Error('Один из товаров недоступен'), { statusCode:400 });
    const map = new Map(productsResult.rows.map((product) => [product.id,product]));
    const items = input.map((item) => ({ product:map.get(String(item.id)), quantity:Math.max(1,Math.min(20,Number(item.quantity)||1)) }));
    const total = items.reduce((sum,item) => sum + Number(item.product.priceFrom) * item.quantity,0);
    const publicId = `M${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,7).toUpperCase()}`.slice(0,20);
    const orderResult = await client.query(`INSERT INTO orders(public_id,user_id,name,telegram,comment,total_from) VALUES($1,$2,$3,$4,$5,$6)
      RETURNING id,public_id AS "publicId",status,created_at AS "createdAt",updated_at AS "updatedAt",total_from AS "totalFrom"`, [publicId,user.rows[0]?.id || null,name,telegram,comment || null,total]);
    const order = orderResult.rows[0];
    for (const item of items) await client.query('INSERT INTO order_items(order_id,product_id,title,price_from,quantity) VALUES($1,$2,$3,$4,$5)', [order.id,item.product.id,item.product.title,item.product.priceFrom,item.quantity]);
    await client.query('COMMIT');
    void notifyTelegram([`Новый заказ #${order.publicId}`,`Имя: ${name}`,`Telegram: ${telegram}`,...items.map((item)=>`• ${item.product.title} × ${item.quantity}`),`Итого от: ${total.toLocaleString('ru-RU')} ₽`].join('\n'));
    res.status(201).json({ ok:true, order:{...order,totalFrom:Number(order.totalFrom),statusLabel:getStatusLabel(order.status)} });
  } catch (err) { try { await client.query('ROLLBACK'); } catch {} throw err; }
  finally { client.release(); }
}));

app.get('/api/orders', wrap(async (req,res) => {
  const deviceId = String(req.query?.deviceId || '').trim();
  const user = await resolveUser(req,deviceId);
  if (!user) return res.json({ok:true,orders:[]});
  const { rows } = await pool.query(`
    SELECT o.id,o.public_id AS "publicId",o.name,o.telegram,o.comment,o.total_from AS "totalFrom",o.status,
      o.created_at AS "createdAt",o.updated_at AS "updatedAt",
      ROW_NUMBER() OVER (ORDER BY o.created_at ASC) AS "queuePosition",
      COALESCE(json_agg(json_build_object('productId',oi.product_id,'title',oi.title,'priceFrom',oi.price_from,'quantity',oi.quantity)) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
    WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`, [user.id]);
  res.json({ok:true,orders:rows.map((row)=>({...row,totalFrom:Number(row.totalFrom),queuePosition:Number(row.queuePosition),statusLabel:getStatusLabel(row.status)}))});
}));

app.get('/api/orders/:publicId', wrap(async (req,res) => {
  const deviceId = String(req.query?.deviceId || '').trim();
  const user = await resolveUser(req,deviceId);
  if (!user) return error(res,401,'Пользователь не найден');
  const { rows } = await pool.query(`
    SELECT o.id,o.public_id AS "publicId",o.name,o.telegram,o.comment,o.total_from AS "totalFrom",o.status,o.created_at AS "createdAt",o.updated_at AS "updatedAt",
      COALESCE(json_agg(json_build_object('productId',oi.product_id,'title',oi.title,'priceFrom',oi.price_from,'quantity',oi.quantity)) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
    WHERE o.public_id=$1 AND o.user_id=$2 GROUP BY o.id`, [req.params.publicId,user.id]);
  if (!rows[0]) return error(res,404,'Заказ не найден');
  const row = rows[0];
  res.json({ok:true,order:{...row,totalFrom:Number(row.totalFrom),statusLabel:getStatusLabel(row.status)}});
}));

app.post('/api/reviews', wrap(async (req,res) => {
  const deviceId = String(req.body?.deviceId || '').trim();
  const orderPublicId = String(req.body?.orderId || '').trim();
  const productId = String(req.body?.productId || '').trim();
  const rating = Number(req.body?.rating);
  const text = String(req.body?.text || '').trim();
  if (!orderPublicId || !productId || !Number.isInteger(rating) || rating < 1 || rating > 5) return error(res,400,'Некорректный отзыв');
  if (text.length > 1200) return error(res,400,'Отзыв слишком длинный');
  const user = await resolveUser(req,deviceId);
  if (!user) return error(res,401,'Пользователь не найден');
  const order = await pool.query(`SELECT o.id,o.status FROM orders o WHERE o.public_id=$1 AND o.user_id=$2`, [orderPublicId,user.id]);
  if (!order.rows[0]) return error(res,404,'Заказ не найден');
  if (order.rows[0].status !== 'completed') return error(res,409,'Отзыв доступен только после получения товара');
  const item = await pool.query('SELECT 1 FROM order_items WHERE order_id=$1 AND product_id=$2', [order.rows[0].id,productId]);
  if (!item.rows[0]) return error(res,403,'Этот товар не входит в заказ');
  const existing = await pool.query('SELECT id FROM product_reviews WHERE order_id=$1 AND product_id=$2', [order.rows[0].id,productId]);
  if (existing.rows[0]) return error(res,409,'Вы уже оставили отзыв на этот товар');
  const { rows } = await pool.query(`INSERT INTO product_reviews(order_id,product_id,user_id,rating,text) VALUES($1,$2,$3,$4,$5)
    RETURNING id,rating,text,created_at AS "createdAt"`, [order.rows[0].id,productId,user.id,rating,text]);
  res.status(201).json({ok:true,review:rows[0]});
}));

app.get('/api/my/reviews', wrap(async (req,res) => {
  const user = await resolveUser(req,String(req.query?.deviceId || '').trim());
  if (!user) return res.json({ok:true,reviews:[]});
  const { rows } = await pool.query(`SELECT r.id,r.order_id AS "orderId",r.product_id AS "productId",r.rating,r.text,r.created_at AS "createdAt",p.title
    FROM product_reviews r JOIN products p ON p.id=r.product_id WHERE r.user_id=$1 ORDER BY r.created_at DESC`, [user.id]);
  res.json({ok:true,reviews:rows});
}));

app.post('/api/admin/login', wrap(async (req,res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const { rows } = await pool.query('SELECT id,username,password_hash FROM admin_users WHERE username=$1', [username]);
  if (!rows[0] || !(await bcrypt.compare(password,rows[0].password_hash))) return error(res,401,'Неверный логин или пароль');
  const token = jwt.sign({sub:rows[0].id,username:rows[0].username,role:'admin'},JWT_SECRET,{expiresIn:'12h'});
  res.json({ok:true,token,admin:{username:rows[0].username}});
}));

app.get('/api/admin/me',adminAuth,(req,res)=>res.json({ok:true,admin:req.admin}));

app.get('/api/admin/stats',adminAuth,wrap(async(_req,res)=>{
  const [orders,users,products,revenue,statuses,reviews] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM orders'),
    pool.query('SELECT COUNT(*)::int AS count FROM users'),
    pool.query('SELECT COUNT(*)::int AS count FROM products WHERE active=true'),
    pool.query("SELECT COALESCE(SUM(total_from),0)::numeric AS total FROM orders WHERE status <> 'cancelled'"),
    pool.query('SELECT status,COUNT(*)::int AS count FROM orders GROUP BY status'),
    pool.query('SELECT COUNT(*)::int AS count FROM product_reviews')
  ]);
  const statusCounts = Object.fromEntries(statuses.rows.map((row)=>[row.status,row.count]));
  res.json({ok:true,stats:{orders:orders.rows[0].count,users:users.rows[0].count,products:products.rows[0].count,revenue:Number(revenue.rows[0].total),reviews:reviews.rows[0].count,statuses:statusCounts}});
}));

app.get('/api/admin/orders',adminAuth,wrap(async(_req,res)=>{
  const {rows}=await pool.query(`
    SELECT o.id,o.public_id AS "publicId",o.name,o.telegram,o.comment,o.total_from AS "totalFrom",o.status,
      o.created_at AS "createdAt",o.updated_at AS "updatedAt",u.telegram_id AS "telegramId",u.account_number AS "accountNumber",
      ROW_NUMBER() OVER (PARTITION BY CASE WHEN o.status='cancelled' THEN 1 ELSE 0 END ORDER BY o.created_at ASC) AS "queuePosition",
      COALESCE(json_agg(json_build_object('productId',oi.product_id,'title',oi.title,'priceFrom',oi.price_from,'quantity',oi.quantity)) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN users u ON u.id=o.user_id LEFT JOIN order_items oi ON oi.order_id=o.id
    GROUP BY o.id,u.telegram_id,u.account_number ORDER BY o.created_at DESC`);
  res.json({ok:true,orders:rows.map((row)=>({...row,totalFrom:Number(row.totalFrom),queuePosition:Number(row.queuePosition),statusLabel:getStatusLabel(row.status)}))});
}));

app.patch('/api/admin/orders/:id',adminAuth,wrap(async(req,res)=>{
  const status=String(req.body?.status || '').trim();
  const allowed=new Set(['new','in_progress','paid','completed','cancelled']);
  if(!allowed.has(status)) return error(res,400,'Недопустимый статус');
  const {rows}=await pool.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,public_id AS "publicId",status,updated_at AS "updatedAt"',[status,req.params.id]);
  if(!rows[0]) return error(res,404,'Заказ не найден');
  res.json({ok:true,order:{...rows[0],statusLabel:getStatusLabel(rows[0].status)}});
}));

app.get('/api/admin/products',adminAuth,wrap(async(_req,res)=>{
  const {rows}=await pool.query('SELECT id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder" FROM products ORDER BY sort_order,id');
  res.json({ok:true,products:rows.map((row)=>({...row,priceFrom:Number(row.priceFrom)}))});
}));

app.post('/api/admin/products',adminAuth,wrap(async(req,res)=>{
  const id=String(req.body?.id||'').trim(),title=String(req.body?.title||'').trim(),category=String(req.body?.category||'services').trim(),description=String(req.body?.description||'').trim();
  const price=Number(req.body?.priceFrom); const imageUrl=String(req.body?.imageUrl||'').trim()||null; const sortOrder=Number(req.body?.sortOrder)||0;
  if(!id||!title||!description||!Number.isFinite(price)||price<0) return error(res,400,'Некорректные данные товара');
  const {rows}=await pool.query('INSERT INTO products(id,title,category,description,price_from,image_url,sort_order,active) VALUES($1,$2,$3,$4,$5,$6,$7,true) RETURNING id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder"',[id,title,category,description,price,imageUrl,sortOrder]);
  res.status(201).json({ok:true,product:{...rows[0],priceFrom:Number(rows[0].priceFrom)}});
}));

app.patch('/api/admin/products/:id',adminAuth,wrap(async(req,res)=>{
  const fields=[];const values=[];const map={title:'title',category:'category',description:'description',priceFrom:'price_from',imageUrl:'image_url',active:'active',sortOrder:'sort_order'};
  for(const [key,column] of Object.entries(map)) if(req.body?.[key]!==undefined){values.push(req.body[key]);fields.push(`${column}=$${values.length}`);}
  if(!fields.length) return error(res,400,'Нет изменений');
  values.push(req.params.id);
  const {rows}=await pool.query(`UPDATE products SET ${fields.join(',')},updated_at=NOW() WHERE id=$${values.length} RETURNING id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder"`,values);
  if(!rows[0]) return error(res,404,'Товар не найден');
  res.json({ok:true,product:{...rows[0],priceFrom:Number(rows[0].priceFrom)}});
}));

app.delete('/api/admin/products/:id',adminAuth,wrap(async(req,res)=>{
  const {rows}=await pool.query('UPDATE products SET active=false,updated_at=NOW() WHERE id=$1 RETURNING id',[req.params.id]);
  if(!rows[0]) return error(res,404,'Товар не найден');
  res.json({ok:true});
}));

app.get('/api/admin/reviews',adminAuth,wrap(async(_req,res)=>{
  const {rows}=await pool.query(`SELECT r.id,r.rating,r.text,r.created_at AS "createdAt",p.id AS "productId",p.title,u.display_name AS "displayName",u.username,o.public_id AS "orderId"
    FROM product_reviews r JOIN products p ON p.id=r.product_id JOIN users u ON u.id=r.user_id JOIN orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 500`);
  res.json({ok:true,reviews:rows});
}));

app.get('/api/admin/users',adminAuth,wrap(async(_req,res)=>{
  const {rows}=await pool.query('SELECT id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber",created_at AS "createdAt" FROM users ORDER BY created_at DESC LIMIT 500');
  res.json({ok:true,users:rows});
}));

app.use((err,_req,res,_next)=>{
  console.error(err);
  const status=Number(err?.statusCode)||500;
  if(res.headersSent) return;
  res.status(status).json({ok:false,error:status===500?'Внутренняя ошибка сервера':String(err.message||'Ошибка')});
});

await waitForDatabase();
await ensureSchema();
app.listen(PORT,'0.0.0.0',()=>console.log(`Maalavo backend v5 listening on :${PORT}`));
