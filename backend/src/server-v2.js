import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const JWT_SECRET = String(process.env.JWT_SECRET || '');
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

function origin(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '*') return raw;
  try { return new URL(raw).origin; } catch { return raw.replace(/\/$/, ''); }
}

const allowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',').map(origin).filter(Boolean);

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(value, callback) {
    if (!value || allowedOrigins.length === 0 || allowedOrigins.includes('*')) return callback(null, true);
    callback(null, allowedOrigins.includes(origin(value)) ? value : false);
  },
  methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204,
  maxAge: 86400
}));
app.use(express.json({ limit: '100kb' }));

const sendError = (res, status, error) => res.status(status).json({ error });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function dbReady() {
  let last;
  for (let i = 1; i <= 20; i += 1) {
    try { await pool.query('SELECT 1'); return; }
    catch (error) { last = error; await new Promise(r => setTimeout(r, Math.min(i * 500, 3000))); }
  }
  throw last;
}

async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), device_id VARCHAR(128) UNIQUE NOT NULL,
      telegram_id VARCHAR(64) UNIQUE, username VARCHAR(64), display_name VARCHAR(120) NOT NULL DEFAULT 'Гость',
      avatar_url TEXT, account_number BIGSERIAL UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(80) PRIMARY KEY, title VARCHAR(160) NOT NULL, category VARCHAR(80) NOT NULL, description TEXT NOT NULL,
      price_from NUMERIC(12,2) NOT NULL DEFAULT 0, image_url TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), public_id VARCHAR(20) UNIQUE NOT NULL, user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(80) NOT NULL, telegram VARCHAR(80) NOT NULL, comment VARCHAR(1000), total_from NUMERIC(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id VARCHAR(80) NOT NULL REFERENCES products(id), title VARCHAR(160) NOT NULL, price_from NUMERIC(12,2) NOT NULL, quantity INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username VARCHAR(64) UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
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
    for (const p of products) await pool.query('INSERT INTO products (id,title,category,description,price_from,image_url,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)', p);
  }
}

function adminAuth(req, res, next) {
  const value = req.get('authorization') || '';
  if (!value.startsWith('Bearer ')) return sendError(res, 401, 'Требуется авторизация');
  try { req.admin = jwt.verify(value.slice(7), JWT_SECRET); next(); }
  catch { sendError(res, 401, 'Сессия администратора истекла'); }
}

async function telegram(text) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || '').trim();
  if (!token || !chatId) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({chat_id: chatId, text}), signal: controller.signal
    });
  } catch (error) { console.error('Telegram notification:', error.message); }
  finally { clearTimeout(timeout); }
}

app.get('/health', wrap(async (_req, res) => { await pool.query('SELECT 1'); res.json({ok:true, service:'maalavo-store-backend', database:'ok'}); }));

app.get('/api/products', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT id,title,category,description,price_from AS "priceFrom",image_url AS "imageUrl",active,sort_order AS "sortOrder" FROM products WHERE active=true ORDER BY sort_order,id');
  res.json({products: rows.map(r => ({...r, priceFrom:Number(r.priceFrom)}))});
}));

app.post('/api/users/sync', wrap(async (req, res) => {
  const d = req.body || {};
  if (!String(d.deviceId || '').trim()) return sendError(res, 400, 'deviceId обязателен');
  const { rows } = await pool.query(`INSERT INTO users(device_id,telegram_id,username,display_name,avatar_url) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(device_id) DO UPDATE SET telegram_id=COALESCE(EXCLUDED.telegram_id,users.telegram_id),username=COALESCE(EXCLUDED.username,users.username),display_name=COALESCE(NULLIF(EXCLUDED.display_name,''),users.display_name),avatar_url=COALESCE(EXCLUDED.avatar_url,users.avatar_url),updated_at=NOW()
    RETURNING id,telegram_id AS "telegramId",username,display_name AS "displayName",avatar_url AS "avatarUrl",account_number AS "accountNumber",created_at AS "createdAt"`,
    [String(d.deviceId).trim(), d.telegramId || null, d.username || null, d.displayName || 'Гость', d.avatarUrl || null]);
  res.json({user:rows[0]});
}));

app.post('/api/orders', wrap(async (req, res) => {
  const d = req.body || {};
  if (!String(d.deviceId || '').trim()) return sendError(res,400,'deviceId обязателен');
  if (!String(d.name || '').trim() || !String(d.telegram || '').trim()) return sendError(res,400,'Имя и Telegram обязательны');
  if (!Array.isArray(d.items) || d.items.length === 0) return sendError(res,400,'Корзина пуста');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT id FROM users WHERE device_id=$1',[String(d.deviceId).trim()]);
    const ids = [...new Set(d.items.map(i => String(i.id)))];
    const productsResult = await client.query('SELECT id,title,price_from AS "priceFrom" FROM products WHERE active=true AND id=ANY($1::varchar[])',[ids]);
    if (productsResult.rows.length !== ids.length) { await client.query('ROLLBACK'); return sendError(res,400,'Один из товаров недоступен'); }
    const products = new Map(productsResult.rows.map(p => [p.id,p]));
    const items = d.items.map(i => ({quantity:Math.max(1,Math.min(20,Number(i.quantity)||1)),product:products.get(String(i.id))}));
    const total = items.reduce((sum,i) => sum + Number(i.product.priceFrom)*i.quantity,0);
    const publicId = `M${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,7).toUpperCase()}`.slice(0,20);
    const orderResult = await client.query(`INSERT INTO orders(public_id,user_id,name,telegram,comment,total_from) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,public_id AS "publicId",status,created_at AS "createdAt",total_from AS "totalFrom"`,[publicId,user.rows[0]?.id || null,String(d.name).trim(),String(d.telegram).trim(),String(d.comment || '').trim() || null,total]);
    const order = orderResult.rows[0];
    for (const item of items) await client.query('INSERT INTO order_items(order_id,product_id,title,price_from,quantity) VALUES($1,$2,$3,$4,$5)',[order.id,item.product.id,item.product.title,item.product.priceFrom,item.quantity]);
    await client.query('COMMIT');
    void telegram([`Новый заказ #${order.publicId}`,`Имя: ${d.name}`,`Telegram: ${d.telegram}`,...items.map(i=>`• ${i.product.title} × ${i.quantity}`),`Итого от: ${total.toLocaleString('ru-RU')} ₽`].join('\n'));
    res.status(201).json({ok:true,order:{...order,totalFrom:Number(order.totalFrom)}});
  } catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; }
  finally { client.release(); }
}));

app.post('/api/admin/login', wrap(async (req,res) => {
  const username=String(req.body?.username||'').trim(); const password=String(req.body?.password||'');
  const {rows}=await pool.query('SELECT id,username,password_hash FROM admin_users WHERE username=$1',[username]);
  if(!rows[0] || !(await bcrypt.compare(password,rows[0].password_hash))) return sendError(res,401,'Неверный логин или пароль');
  const token=jwt.sign({sub:rows[0].id,username:rows[0].username,role:'admin'},JWT_SECRET,{expiresIn:'8h'});
  res.json({token,admin:{id:rows[0].id,username:rows[0].username}});
}));

app.get('/api/admin/me',adminAuth,(req,res)=>res.json({admin:{id:req.admin.sub,username:req.admin.username,role:'admin'}}));

app.get('/api/orders',adminAuth,wrap(async(_req,res)=>{
  const {rows}=await pool.query(`SELECT o.public_id AS "publicId",o.name,o.telegram,o.comment,o.total_from AS "totalFrom",o.status,o.created_at AS "createdAt",COALESCE(json_agg(json_build_object('id',oi.product_id,'title',oi.title,'priceFrom',oi.price_from,'quantity',oi.quantity) ORDER BY oi.id) FILTER(WHERE oi.id IS NOT NULL),'[]') AS items FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`);
  res.json({orders:rows.map(r=>({...r,totalFrom:Number(r.totalFrom)}))});
}));

app.patch('/api/orders/:publicId/status',adminAuth,wrap(async(req,res)=>{
  const allowed=['new','processing','paid','completed','cancelled'];
  if(!allowed.includes(req.body?.status)) return sendError(res,400,'Некорректный статус');
  const {rows}=await pool.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE public_id=$2 RETURNING public_id AS "publicId",status,updated_at AS "updatedAt"',[req.body.status,req.params.publicId]);
  if(!rows[0]) return sendError(res,404,'Заказ не найден');
  res.json({order:rows[0]});
}));

app.get('/api/admin/stats',adminAuth,wrap(async(_req,res)=>{
  const s=(await pool.query(`SELECT COUNT(*)::int orders,COUNT(*) FILTER(WHERE status='new')::int new_orders,COUNT(*) FILTER(WHERE status='processing')::int processing_orders,COUNT(*) FILTER(WHERE status='completed')::int completed_orders,COALESCE(SUM(total_from) FILTER(WHERE status IN('paid','completed')),0)::numeric revenue FROM orders`)).rows[0];
  const users=(await pool.query('SELECT COUNT(*)::int count FROM users')).rows[0].count;
  res.json({stats:{orders:s.orders,newOrders:s.new_orders,processingOrders:s.processing_orders,completedOrders:s.completed_orders,revenueFrom:Number(s.revenue),users}});
}));

app.use((req,res)=>res.status(404).json({error:'Маршрут не найден',path:req.path}));
app.use((error,_req,res,_next)=>{ console.error('API error:',error); if(error?.code==='23505') return sendError(res,409,'Такая запись уже существует'); res.status(500).json({error:'Внутренняя ошибка сервера'}); });

await dbReady();
await ensureSchema();
app.listen(PORT,'0.0.0.0',()=>console.log(`Maalavo backend listening on :${PORT}`));
