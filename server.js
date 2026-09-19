import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.resolve(__dirname, process.env.DB_FILE || './data/maalavo.sqlite');
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_TG = Number(process.env.ADMIN_TELEGRAM_ID || 0);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@maalavo.store').toLowerCase();
const SUPPORT_URL = process.env.SUPPORT_URL || 'https://t.me/maalavo';

// ---- .env из коробки ----
let jwtSecret = process.env.JWT_SECRET || '';
let adminPassword = process.env.ADMIN_PASSWORD || '';
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  adminPassword = crypto.randomBytes(5).toString('hex');
  fs.writeFileSync(path.join(__dirname, '.env'),
    `PORT=3000\nDB_FILE=./data/maalavo.sqlite\nJWT_SECRET=${jwtSecret}\nADMIN_EMAIL=${ADMIN_EMAIL}\nADMIN_PASSWORD=${adminPassword}\nBOT_TOKEN=\nADMIN_TELEGRAM_ID=\nSUPPORT_URL=${SUPPORT_URL}\n`);
  console.log(`[maalavo] Создан .env — пароль админа: ${adminPassword}  (сохрани, показывается один раз!)`);
}
if (!jwtSecret) jwtSecret = crypto.randomBytes(32).toString('hex');
if (!adminPassword) adminPassword = crypto.randomBytes(5).toString('hex');

// ---- БД ----
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8'));
const seedFile = path.join(__dirname, 'db/seed.sql');
if (fs.existsSync(seedFile)) db.exec(fs.readFileSync(seedFile, 'utf8'));

const now = () => new Date().toISOString();
const uid = p => `${p}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

db.prepare(`INSERT INTO users(email,password_hash,first_name,role,created_at,last_seen_at)
  VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING`)
  .run(ADMIN_EMAIL, bcrypt.hashSync(adminPassword, 10), 'Администратор', 'admin', now(), now());

// ---- rate limit ----
const buckets = new Map();
const rateLimit = ({ windowMs, max, keyPrefix }) => (req, res, next) => {
  const k = keyPrefix + ':' + (req.ip || 'x'), t = Date.now();
  let b = buckets.get(k);
  if (!b || t > b.reset) { b = { count: 0, reset: t + windowMs }; buckets.set(k, b); }
  if (++b.count > max) return res.status(429).json({ error: 'Слишком много попыток. Подожди немного.' });
  if (buckets.size > 5000) buckets.clear();
  next();
};
const authLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: 'auth' });

// ---- helpers ----
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const setCookie = (res, name, value, maxAge) =>
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
const clearCookie = (res, name) => res.setHeader('Set-Cookie', `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);

function telegramUser(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calc = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
    const a = Buffer.from(calc), b = Buffer.from(String(hash));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || Date.now() / 1000 - authDate > 86400) return null;
    return JSON.parse(params.get('user') || 'null');
  } catch { return null; }
}
const qUpsertTg = db.prepare(`INSERT INTO users(telegram_id,username,first_name,last_name,photo_url,role,created_at,last_seen_at)
  VALUES(?,?,?,?,?,?,?,?)
  ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name,
  last_name=excluded.last_name, photo_url=excluded.photo_url, last_seen_at=excluded.last_seen_at`);
function upsertTelegram(tg) {
  if (!tg?.id) return null;
  qUpsertTg.run(Number(tg.id), tg.username || null, tg.first_name || '', tg.last_name || '', tg.photo_url || '',
    ADMIN_TG && Number(tg.id) === ADMIN_TG ? 'admin' : 'user', now(), now());
  return db.prepare('SELECT * FROM users WHERE telegram_id=?').get(Number(tg.id));
}
function userFromSession(req) {
  const t = parseCookies(req).maalavo_session;
  if (!t) return null;
  try {
    const p = jwt.verify(t, jwtSecret);
    return db.prepare('SELECT * FROM users WHERE id=?').get(Number(p.sub)) || null;
  } catch { return null; }
}
function currentUser(req) {
  const u = userFromSession(req);
  if (u) { db.prepare('UPDATE users SET last_seen_at=? WHERE id=?').run(now(), u.id); return u; }
  return upsertTelegram(telegramUser(req.get('x-telegram-init-data') || ''));
}
const publicUser = u => ({
  id: u.id, email: u.email, name: [u.first_name, u.last_name].filter(Boolean).join(' '),
  username: u.username, photoUrl: u.photo_url, role: u.role, telegramId: u.telegram_id
});
function authUser(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Требуется вход' });
  req.user = u; next();
}
function adminOnly(req, res, next) {
  const t = parseCookies(req).maalavo_admin;
  let ok = false;
  if (t) try {
    const p = jwt.verify(t, jwtSecret);
    ok = p.role === 'admin' && !!db.prepare("SELECT 1 FROM users WHERE id=? AND role='admin'").get(Number(p.sub));
  } catch {}
  if (!ok) { const tg = telegramUser(req.get('x-telegram-init-data') || ''); ok = !!(tg && ADMIN_TG && Number(tg.id) === ADMIN_TG); }
  if (!ok) return res.status(401).json({ error: 'Нужен вход администратора' });
  next();
}
// CSRF-защита: мутации с сессионной кукой требуют служебный заголовок
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (parseCookies(req).maalavo_session && req.get('x-requested-with') !== 'XMLHttpRequest')
    return res.status(403).json({ error: 'Bad request' });
  next();
}

// ---- данные ----
const cartItems = userId => db.prepare(`SELECT c.product_id id, c.qty, p.name, p.description, p.price, p.old_price, p.image, p.category, p.tag, p.stock
  FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=? AND p.active=1 ORDER BY c.updated_at DESC`).all(userId);
const favIds = userId => db.prepare('SELECT product_id FROM favorites WHERE user_id=?').all(userId).map(x => x.product_id);
const setting = k => db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value || '';

async function notifyAdmin(orderId, total, user) {
  if (!BOT_TOKEN || !ADMIN_TG) return;
  try {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || '—';
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_TG, text: `🛍 Новый заказ ${orderId}\nСумма: ${total} ₽\nКлиент: ${name}` })
    });
  } catch {}
}

// ---- app ----
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use('/api', csrfGuard);

// public
app.get('/api/health', (req, res) => res.json({ ok: true, time: now() }));
app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active=1 ORDER BY created_at DESC').all();
  res.json({ products: rows, categories: [...new Set(rows.map(p => p.category))] });
});
app.get('/api/about', (req, res) =>
  res.json({ title: setting('about_title'), text: setting('about_text'), supportUrl: setting('support_url') || SUPPORT_URL }));

// auth
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
app.post('/api/auth/register', authLimiter, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim().slice(0, 80);
  if (!emailRe.test(email)) return res.status(400).json({ error: 'Некорректный email' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email))
    return res.status(409).json({ error: 'Этот email уже зарегистрирован' });
  const info = db.prepare(`INSERT INTO users(email,password_hash,first_name,role,created_at,last_seen_at)
    VALUES(?,?,?,?,?,?)`).run(email, bcrypt.hashSync(password, 10), name, 'user', now(), now());
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  setCookie(res, 'maalavo_session', jwt.sign({ sub: user.id, role: 'user' }, jwtSecret, { expiresIn: '7d' }), 7 * 24 * 3600);
  res.status(201).json({ user: publicUser(user) });
});
app.post('/api/auth/login', authLimiter, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user?.password_hash || !bcrypt.compareSync(String(req.body?.password || ''), user.password_hash))
    return res.status(401).json({ error: 'Неверный email или пароль' });
  db.prepare('UPDATE users SET last_seen_at=? WHERE id=?').run(now(), user.id);
  setCookie(res, 'maalavo_session', jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' }), 7 * 24 * 3600);
  res.json({ user: publicUser(user) });
});
app.post('/api/auth/logout', (req, res) => { clearCookie(res, 'maalavo_session'); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  res.json({ authenticated: !!u, user: u ? publicUser(u) : null,
    isAdmin: !!u && (u.role === 'admin' || (ADMIN_TG && u.telegram_id === ADMIN_TG)) });
});

// cart / favorites / orders
app.get('/api/me/cart', authUser, (req, res) => res.json({ items: cartItems(req.user.id) }));
app.put('/api/me/cart', authUser, (req, res) => {
  const q = Math.max(0, Math.min(99, parseInt(req.body?.qty, 10) || 0));
  const p = db.prepare('SELECT id FROM products WHERE id=? AND active=1').get(String(req.body?.productId || ''));
  if (!p) return res.status(404).json({ error: 'Товар не найден' });
  if (q === 0) db.prepare('DELETE FROM cart_items WHERE user_id=? AND product_id=?').run(req.user.id, p.id);
  else db.prepare(`INSERT INTO cart_items(user_id,product_id,qty,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id,product_id) DO UPDATE SET qty=excluded.qty, updated_at=excluded.updated_at`)
    .run(req.user.id, p.id, q, now());
  res.json({ items: cartItems(req.user.id) });
});
app.delete('/api/me/cart', authUser, (req, res) => { db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id); res.json({ items: [] }); });

app.get('/api/me/favorites', authUser, (req, res) => res.json({ ids: favIds(req.user.id) }));
app.put('/api/me/favorites/:id', authUser, (req, res) => {
  const p = db.prepare('SELECT id FROM products WHERE id=? AND active=1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });
  const ex = db.prepare('SELECT 1 FROM favorites WHERE user_id=? AND product_id=?').get(req.user.id, p.id);
  if (ex) db.prepare('DELETE FROM favorites WHERE user_id=? AND product_id=?').run(req.user.id, p.id);
  else db.prepare('INSERT INTO favorites(user_id,product_id,created_at) VALUES(?,?,?)').run(req.user.id, p.id, now());
  res.json({ ids: favIds(req.user.id) });
});

app.get('/api/me/orders', authUser, (req, res) => {
  const q = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  res.json({ orders: db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)
    .map(o => ({ ...o, items: q.all(o.id) })) });
});
app.post('/api/orders', authUser, (req, res) => {
  const note = String(req.body?.note || '').trim().slice(0, 500);
  const cart = cartItems(req.user.id);
  if (!cart.length) return res.status(400).json({ error: 'Корзина пуста' });
  const total = r2(cart.reduce((s, x) => s + x.price * x.qty, 0));
  const orderId = uid('order');
  db.transaction(() => {
    db.prepare(`INSERT INTO orders(id,user_id,customer_name,customer_email,customer_tg,total,status,note,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'pending',?,?,?)`).run(orderId, req.user.id,
      [req.user.first_name, req.user.last_name].filter(Boolean).join(' '), req.user.email || '',
      req.user.username ? '@' + req.user.username : '', total, note, now(), now());
    const ins = db.prepare('INSERT INTO order_items(order_id,product_id,name,price,qty) VALUES(?,?,?,?,?)');
    for (const x of cart) ins.run(orderId, x.id, x.name, r2(x.price), x.qty);
    db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id);
  })();
  notifyAdmin(orderId, total, req.user);
  res.status(201).json({ id: orderId, total, status: 'pending' });
});

// admin
app.post('/api/admin/login', authLimiter, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email=? AND role='admin'").get(email);
  if (!user || !bcrypt.compareSync(String(req.body?.password || ''), user.password_hash || ''))
    return res.status(401).json({ error: 'Неверный email или пароль' });
  setCookie(res, 'maalavo_admin', jwt.sign({ sub: user.id, role: 'admin' }, jwtSecret, { expiresIn: '12h' }), 43200);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { clearCookie(res, 'maalavo_admin'); res.json({ ok: true }); });
app.get('/api/admin/me', adminOnly, (req, res) => res.json({ ok: true }));
app.get('/api/admin/stats', adminOnly, (req, res) => res.json({
  users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  products: db.prepare('SELECT COUNT(*) c FROM products WHERE active=1').get().c,
  orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
  revenue: r2(db.prepare("SELECT COALESCE(SUM(total),0) c FROM orders WHERE status IN ('paid','completed')").get().c),
  pending: db.prepare("SELECT COUNT(*) c FROM orders WHERE status='pending'").get().c
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: (req, file, cb) => cb(null, uid('img') + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Допустимы только изображения'), ok);
  }
});

app.get('/api/admin/products', adminOnly, (req, res) =>
  res.json({ products: db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() }));

function productBody(b, old = {}) {
  const name = String(b.name ?? old.name ?? '').trim();
  const category = String(b.category ?? old.category ?? '').trim().toLowerCase();
  if (!name || !category) return null;
  return {
    category, tag: String(b.tag ?? old.tag ?? category).trim().slice(0, 30).toUpperCase() || category.toUpperCase(),
    name: name.slice(0, 120), description: String(b.description ?? old.description ?? '').slice(0, 2000),
    price: Math.max(0, r2(b.price ?? old.price ?? 0)),
    old_price: b.old_price === null || b.old_price === '' ? null : Math.max(0, r2(b.old_price)),
    image: String(b.image ?? old.image ?? '').slice(0, 500),
    stock: String(b.stock ?? old.stock ?? 'под заказ').slice(0, 40),
    active: b.active === false || b.active === 0 ? 0 : 1
  };
}
app.post('/api/admin/products', adminOnly, (req, res) => {
  const p = productBody(req.body || {});
  if (!p) return res.status(400).json({ error: 'Название и категория обязательны' });
  const id = req.body?.id || uid('prod');
  db.prepare(`INSERT INTO products(id,category,tag,name,description,price,old_price,image,stock,active,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET category=excluded.category, tag=excluded.tag, name=excluded.name,
    description=excluded.description, price=excluded.price, old_price=excluded.old_price,
    image=excluded.image, stock=excluded.stock, active=excluded.active, updated_at=excluded.updated_at`)
    .run(id, p.category, p.tag, p.name, p.description, p.price, p.old_price, p.image, p.stock, p.active, now(), now());
  res.status(201).json({ product: db.prepare('SELECT * FROM products WHERE id=?').get(id) });
});
app.put('/api/admin/products/:id', adminOnly, (req, res) => {
  const old = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Товар не найден' });
  const p = productBody(req.body || {}, old);
  if (!p) return res.status(400).json({ error: 'Название и категория обязательны' });
  db.prepare(`UPDATE products SET category=?,tag=?,name=?,description=?,price=?,old_price=?,image=?,stock=?,active=?,updated_at=? WHERE id=?`)
    .run(p.category, p.tag, p.name, p.description, p.price, p.old_price, p.image, p.stock, p.active, now(), req.params.id);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id) });
});
app.post('/api/admin/products/:id/image', adminOnly, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });
  upload.single('image')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    db.prepare('UPDATE products SET image=?, updated_at=? WHERE id=?').run('/uploads/' + req.file.filename, now(), req.params.id);
    res.json({ image: '/uploads/' + req.file.filename });
  });
});
app.delete('/api/admin/products/:id', adminOnly, (req, res) => {
  db.prepare('UPDATE products SET active=0, updated_at=? WHERE id=?').run(now(), req.params.id);
  res.json({ ok: true });
});
app.get('/api/admin/orders', adminOnly, (req, res) => {
  const q = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  res.json({ orders: db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all()
    .map(o => ({ ...o, items: q.all(o.id) })) });
});
app.put('/api/admin/orders/:id', adminOnly, (req, res) => {
  const st = String(req.body?.status || '');
  if (!['pending', 'paid', 'processing', 'completed', 'cancelled'].includes(st))
    return res.status(400).json({ error: 'Неверный статус' });
  db.prepare('UPDATE orders SET status=?, updated_at=? WHERE id=?').run(st, now(), req.params.id);
  res.json({ order: db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id) });
});
app.get('/api/admin/users', adminOnly, (req, res) =>
  res.json({ users: db.prepare(`SELECT u.id,u.email,u.first_name,u.last_name,u.username,u.telegram_id,u.role,u.created_at,u.last_seen_at,
    COUNT(DISTINCT o.id) orders, COALESCE(SUM(CASE WHEN o.status IN ('paid','completed') THEN o.total ELSE 0 END),0) spent
    FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.last_seen_at DESC`).all() }));
app.put('/api/admin/about', adminOnly, (req, res) => {
  const set = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  set.run('about_title', String(req.body?.title || '').slice(0, 200));
  set.run('about_text', String(req.body?.text || '').slice(0, 2000));
  set.run('support_url', String(req.body?.supportUrl || '').slice(0, 300));
  res.json({ ok: true });
});

// static + SPA
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/admin', express.static(path.join(__dirname, 'admin'), { maxAge: '1h' }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(err.status || 500).json({ error: 'Ошибка сервера' }); });
app.listen(PORT, () => console.log(`MAALAVO STORE → http://localhost:${PORT}  |  Админка: http://localhost:${PORT}/admin`));
