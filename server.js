import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.resolve(__dirname, process.env.DB_FILE || './db/maalavo.sqlite');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const ADMIN_ID = Number(process.env.ADMIN_ID || 8721768505);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false';

const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(requireText('./db/schema.sql'));

seed();

function requireText(rel) {
  return fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
}

function seed() {
  const seedFile = path.resolve(__dirname, 'db/seed.sql');

  if (fs.existsSync(seedFile)) {
    db.exec(fs.readFileSync(seedFile, 'utf8'));
  }
}

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: FRONTEND_ORIGIN
    ? FRONTEND_ORIGIN.split(',').map(x => x.trim()).filter(Boolean)
    : true,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function now() {
  return new Date().toISOString();
}

function id(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function telegramValid(initData) {
  if (!BOT_TOKEN || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) return null;

  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const calculated = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(calculated),
    Buffer.from(hash)
  )) {
    return null;
  }

  const authDate = Number(params.get('auth_date') || 0);

  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return null;
  }

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

function upsertUser(user) {
  if (!user?.id) return null;

  db.prepare(`
    INSERT INTO users(
      id,
      username,
      first_name,
      last_name,
      photo_url,
      last_seen_at
    )
    VALUES(?,?,?,?,?,?)

    ON CONFLICT(id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      photo_url=excluded.photo_url,
      last_seen_at=excluded.last_seen_at
  `).run(
    Number(user.id),
    user.username || null,
    user.first_name || '',
    user.last_name || '',
    user.photo_url || '',
    now()
  );

  return db
    .prepare('SELECT * FROM users WHERE id=?')
    .get(Number(user.id));
}

function authUser(req, res, next) {
  const user = telegramValid(
    req.get('x-telegram-init-data') || ''
  );

  if (!user) {
    return res.status(401).json({
      error: 'Telegram authentication required'
    });
  }

  req.user = upsertUser(user);

  next();
}

function adminFromJwt(req) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .filter(Boolean)
      .map(v => {
        const i = v.indexOf('=');

        return [
          v.slice(0, i).trim(),
          decodeURIComponent(v.slice(i + 1))
        ];
      })
  );

  const token =
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
    cookies.admin_token;

  if (!token) return false;

  try {
    const p = jwt.verify(token, JWT_SECRET);

    return (
      Number(p.sub) === ADMIN_ID &&
      p.role === 'admin'
    );
  } catch {
    return false;
  }
}

function adminOnly(req, res, next) {
  if (!adminFromJwt(req)) {
    return res.status(401).json({
      error: 'Admin authentication required'
    });
  }

  next();
}

function products() {
  return db
    .prepare(
      'SELECT * FROM products WHERE active=1 ORDER BY created_at DESC'
    )
    .all();
}

function productById(id) {
  return db
    .prepare(
      'SELECT * FROM products WHERE id=? AND active=1'
    )
    .get(id);
}

function cartForUser(userId) {
  return db.prepare(`
    SELECT
      c.product_id id,
      c.qty,
      p.name,
      p.description desc,
      p.price,
      p.image,
      p.category cat,
      p.tag,
      p.stock

    FROM cart_items c

    JOIN products p
      ON p.id=c.product_id

    WHERE c.user_id=?
      AND p.active=1

    ORDER BY c.updated_at DESC
  `).all(userId);
}

function favsForUser(userId) {
  return db
    .prepare(
      'SELECT product_id FROM favorites WHERE user_id=?'
    )
    .all(userId)
    .map(x => x.product_id);
}


/* =========================
   PUBLIC API
========================= */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: now()
  });
});

app.get('/api/products', (req, res) => {
  const rows = products();

  const cats = [
    ...new Set(rows.map(x => x.category))
  ];

  res.json({
    products: rows,
    categories: cats
  });
});

app.get('/api/about', (req, res) => {
  res.json({
    title:
      db.prepare(
        "SELECT value FROM settings WHERE key='about_title'"
      ).get()?.value || '',

    text:
      db.prepare(
        "SELECT value FROM settings WHERE key='about_text'"
      ).get()?.value || ''
  });
});

app.get('/api/me', (req, res) => {
  const user = telegramValid(
    req.get('x-telegram-init-data') || ''
  );

  if (!user) {
    return res.json({
      authenticated: false,
      user: null,
      isAdmin: false
    });
  }

  const dbUser = upsertUser(user);

  res.json({
    authenticated: true,
    user: dbUser,
    isAdmin: Number(user.id) === ADMIN_ID
  });
});

app.get('/api/me/cart', authUser, (req, res) => {
  res.json({
    items: cartForUser(req.user.id)
  });
});

app.put('/api/me/cart', authUser, (req, res) => {
  const { productId, qty } = req.body || {};

  const q = Math.max(
    0,
    Math.min(99, Number(qty) || 0)
  );

  if (!productById(productId)) {
    return res.status(404).json({
      error: 'Product not found'
    });
  }

  if (q === 0) {
    db.prepare(
      'DELETE FROM cart_items WHERE user_id=? AND product_id=?'
    ).run(req.user.id, productId);
  } else {
    db.prepare(`
      INSERT INTO cart_items(
        user_id,
        product_id,
        qty,
        updated_at
      )
      VALUES(?,?,?,?)

      ON CONFLICT(user_id,product_id)
      DO UPDATE SET
        qty=excluded.qty,
        updated_at=excluded.updated_at
    `).run(
      req.user.id,
      productId,
      q,
      now()
    );
  }

  res.json({
    items: cartForUser(req.user.id)
  });
});

app.delete('/api/me/cart/:id', authUser, (req, res) => {
  db.prepare(
    'DELETE FROM cart_items WHERE user_id=? AND product_id=?'
  ).run(
    req.user.id,
    req.params.id
  );

  res.json({
    items: cartForUser(req.user.id)
  });
});

app.get('/api/me/favorites', authUser, (req, res) => {
  res.json({
    ids: favsForUser(req.user.id)
  });
});

app.put('/api/me/favorites/:id', authUser, (req, res) => {
  if (!productById(req.params.id)) {
    return res.status(404).json({
      error: 'Product not found'
    });
  }

  const exists = db.prepare(`
    SELECT 1
    FROM favorites
    WHERE user_id=? AND product_id=?
  `).get(
    req.user.id,
    req.params.id
  );

  if (exists) {
    db.prepare(`
      DELETE FROM favorites
      WHERE user_id=? AND product_id=?
    `).run(
      req.user.id,
      req.params.id
    );
  } else {
    db.prepare(`
      INSERT INTO favorites(user_id,product_id)
      VALUES(?,?)
    `).run(
      req.user.id,
      req.params.id
    );
  }

  res.json({
    ids: favsForUser(req.user.id)
  });
});

app.get('/api/me/orders', authUser, (req, res) => {
  res.json({
    orders: db
      .prepare(
        'SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC'
      )
      .all(req.user.id)
  });
});

app.post('/api/orders', authUser, (req, res) => {
  const cart = cartForUser(req.user.id);

  if (!cart.length) {
    return res.status(400).json({
      error: 'Cart is empty'
    });
  }

  const total = cart.reduce(
    (s, x) => s + x.price * x.qty,
    0
  );

  const orderId = id('order');

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders(
        id,
        user_id,
        customer_name,
        customer_username,
        total,
        status,
        note,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,'pending','',?,?,?)
    `).run(
      orderId,
      req.user.id,
      [
        req.user.first_name,
        req.user.last_name
      ].filter(Boolean).join(' '),
      req.user.username || '',
      total,
      now(),
      now()
    );

    const ins = db.prepare(`
      INSERT INTO order_items(
        order_id,
        product_id,
        name,
        price,
        qty
      )
      VALUES(?,?,?,?,?)
    `);

    for (const x of cart) {
      ins.run(
        orderId,
        x.id,
        x.name,
        x.price,
        x.qty
      );
    }

    db.prepare(
      'DELETE FROM cart_items WHERE user_id=?'
    ).run(req.user.id);
  });

  tx();

  res.status(201).json({
    id: orderId,
    total,
    status: 'pending',
    items: cart
  });
});


/* =========================
   ADMIN API
========================= */

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};

  if (
    !ADMIN_PASSWORD ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      error: 'Неверный пароль'
    });
  }

  const token = jwt.sign(
    {
      sub: String(ADMIN_ID),
      role: 'admin'
    },
    JWT_SECRET,
    {
      expiresIn: '12h'
    }
  );

  res.setHeader(
    'Set-Cookie',
    `admin_token=${encodeURIComponent(token)}; HttpOnly; SameSite=None; ${COOKIE_SECURE ? 'Secure; ' : ''}Path=/; Max-Age=43200`
  );

  res.json({
    ok: true
  });
});

app.get('/api/admin/me', adminOnly, (req, res) => {
  res.json({
    id: ADMIN_ID,
    role: 'admin'
  });
});

app.get('/api/admin/stats', adminOnly, (req, res) => {
  res.json({
    users: db
      .prepare('SELECT COUNT(*) c FROM users')
      .get().c,

    products: db
      .prepare(
        'SELECT COUNT(*) c FROM products WHERE active=1'
      )
      .get().c,

    orders: db
      .prepare('SELECT COUNT(*) c FROM orders')
      .get().c,

    revenue: db
      .prepare(`
        SELECT COALESCE(SUM(total),0) c
        FROM orders
        WHERE status IN ('paid','completed')
      `)
      .get().c,

    pending: db
      .prepare(`
        SELECT COUNT(*) c
        FROM orders
        WHERE status='pending'
      `)
      .get().c
  });
});

app.get('/api/admin/products', adminOnly, (req, res) => {
  res.json({
    products: db
      .prepare(
        'SELECT * FROM products ORDER BY created_at DESC'
      )
      .all()
  });
});

app.post('/api/admin/products', adminOnly, (req, res) => {
  const b = req.body || {};

  if (!b.name || !b.category) {
    return res.status(400).json({
      error: 'Название и категория обязательны'
    });
  }

  const product = {
    id: b.id || id('prod'),
    category: String(b.category),
    tag: String(
      b.tag || b.category
    ).toUpperCase(),
    name: String(b.name),
    description: String(b.description || ''),
    price: Math.max(
      0,
      Math.round(Number(b.price) || 0)
    ),
    image: String(b.image || ''),
    stock: String(
      b.stock || 'под заказ'
    ),
    active: b.active === false ? 0 : 1
  };

  db.prepare(`
    INSERT INTO products(
      id,
      category,
      tag,
      name,
      description,
      price,
      image,
      stock,
      active,
      created_at,
      updated_at
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    product.id,
    product.category,
    product.tag,
    product.name,
    product.description,
    product.price,
    product.image,
    product.stock,
    product.active,
    now(),
    now()
  );

  res.status(201).json({
    product: db
      .prepare(
        'SELECT * FROM products WHERE id=?'
      )
      .get(product.id)
  });
});

app.put('/api/admin/products/:id', adminOnly, (req, res) => {
  const old = db
    .prepare(
      'SELECT * FROM products WHERE id=?'
    )
    .get(req.params.id);

  if (!old) {
    return res.status(404).json({
      error: 'Товар не найден'
    });
  }

  const b = req.body || {};

  const p = {
    ...old,
    ...b,

    price: Math.max(
      0,
      Math.round(
        Number(b.price ?? old.price) || 0
      )
    ),

    active:
      b.active === false ? 0 : 1
  };

  db.prepare(`
    UPDATE products
    SET
      category=?,
      tag=?,
      name=?,
      description=?,
      price=?,
      image=?,
      stock=?,
      active=?,
      updated_at=?
    WHERE id=?
  `).run(
    p.category,
    p.tag ||
      String(p.category).toUpperCase(),
    p.name,
    p.description || '',
    p.price,
    p.image || '',
    p.stock || 'под заказ',
    p.active,
    now(),
    req.params.id
  );

  res.json({
    product: db
      .prepare(
        'SELECT * FROM products WHERE id=?'
      )
      .get(req.params.id)
  });
});

app.delete('/api/admin/products/:id', adminOnly, (req, res) => {
  db.prepare(`
    UPDATE products
    SET
      active=0,
      updated_at=?
    WHERE id=?
  `).run(
    now(),
    req.params.id
  );

  res.json({
    ok: true
  });
});

app.get('/api/admin/orders', adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT
      o.*,
      u.username,
      u.first_name,
      u.last_name

    FROM orders o

    LEFT JOIN users u
      ON u.id=o.user_id

    ORDER BY o.created_at DESC
  `).all();

  const items = db
    .prepare('SELECT * FROM order_items')
    .all();

  const by = new Map();

  for (const i of items) {
    if (!by.has(i.order_id)) {
      by.set(i.order_id, []);
    }

    by.get(i.order_id).push(i);
  }

  res.json({
    orders: rows.map(o => ({
      ...o,
      items: by.get(o.id) || []
    }))
  });
});

app.put('/api/admin/orders/:id', adminOnly, (req, res) => {
  const statuses = [
    'pending',
    'paid',
    'processing',
    'completed',
    'cancelled'
  ];

  if (!statuses.includes(req.body?.status)) {
    return res.status(400).json({
      error: 'Неверный статус'
    });
  }

  db.prepare(`
    UPDATE orders
    SET
      status=?,
      updated_at=?
    WHERE id=?
  `).run(
    req.body.status,
    now(),
    req.params.id
  );

  res.json({
    order: db
      .prepare(
        'SELECT * FROM orders WHERE id=?'
      )
      .get(req.params.id)
  });
});

app.get('/api/admin/users', adminOnly, (req, res) => {
  res.json({
    users: db.prepare(`
      SELECT
        u.*,
        COUNT(DISTINCT o.id) orders,
        COALESCE(
          SUM(
            CASE
              WHEN o.status IN ('paid','completed')
              THEN o.total
              ELSE 0
            END
          ),
          0
        ) spent

      FROM users u

      LEFT JOIN orders o
        ON o.user_id=u.id

      GROUP BY u.id

      ORDER BY u.last_seen_at DESC
    `).all()
  });
});

app.get('/api/admin/about', adminOnly, (req, res) => {
  res.json({
    title:
      db.prepare(
        "SELECT value FROM settings WHERE key='about_title'"
      ).get()?.value || '',

    text:
      db.prepare(
        "SELECT value FROM settings WHERE key='about_text'"
      ).get()?.value || ''
  });
});

app.put('/api/admin/about', adminOnly, (req, res) => {
  const set = db.prepare(`
    INSERT INTO settings(key,value)
    VALUES(?,?)

    ON CONFLICT(key)
    DO UPDATE SET value=excluded.value
  `);

  set.run(
    'about_title',
    String(req.body?.title || '')
  );

  set.run(
    'about_text',
    String(req.body?.text || '')
  );

  res.json({
    ok: true
  });
});


/* =========================
   STATIC FILES
========================= */

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);

/*
 * ВАЖНО:
 * Админка должна раздаваться ДО SPA fallback.
 */
app.use(
  '/admin',
  express.static(
    path.join(__dirname, 'admin'),
    {
      index: false
    }
  )
);

app.get(
  '/admin',
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        'admin',
        'index.html'
      )
    );
  }
);

/*
 * Только после /admin идёт fallback магазина.
 */
app.get(
  /.*/,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        'public',
        'index.html'
      )
    );
  }
);

app.listen(
  PORT,
  () => console.log(
    `MAALAVO STORE listening on :${PORT}`
  )
);
