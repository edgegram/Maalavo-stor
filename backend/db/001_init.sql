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
  price_from NUMERIC(12,2) NOT NULL CHECK (price_from >= 0),
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
  total_from NUMERIC(12,2) NOT NULL CHECK (total_from >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(80) NOT NULL REFERENCES products(id),
  title VARCHAR(160) NOT NULL,
  price_from NUMERIC(12,2) NOT NULL CHECK (price_from >= 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_products_active_sort ON products(active, sort_order);

INSERT INTO products (id,title,category,description,price_from,image_url,sort_order)
VALUES
('telegram-bot','Telegram Bot','bots','Готовый Telegram-бот под ваши задачи: логика, кнопки, команды, приём заявок и автоматизация процессов.',1500,'assets/products/telegram-bot.png',10),
('web-app','Веб-приложение','web','Современное веб-приложение с адаптацией под телефон, планшет и компьютер.',3000,'assets/products/web-app.png',20),
('website','Сайт под ключ','sites','Полноценный современный сайт под проект: структура, интерфейс, адаптация и интерактивные элементы.',5000,'assets/products/website.png',30),
('plugin','Telegram Plugin','plugins','Кастомный Telegram-инструмент с нужной логикой и функциями под конкретную задачу.',1000,'assets/products/plugin.png',40),
('bug-fix','Исправление ошибок','services','Поиск и исправление проблем на сайтах и веб-приложениях. Работа ведётся в браузерных проектах, без APK/EXE/IPA.',800,'assets/products/bug-fix.png',50),
('service','Разработка','services','Индивидуальная разработка цифрового решения: сайт, веб-приложение, бот или отдельная функция.',1000,'assets/products/service.png',60),
('landing-page','Лендинг','sites','Одностраничный сайт под продукт, услугу, мероприятие или запуск проекта.',3500,'assets/products/landing-page.png',70),
('admin-panel','Админ-панель','web','Веб-админка для управления заказами, товарами, статусами и данными магазина.',5000,'assets/products/admin-panel.png',80),
('api-integration','API-интеграция','integrations','Подключение внешнего API к сайту или веб-приложению с обработкой данных.',1500,'assets/products/api-integration.png',90),
('automation','Автоматизация','automation','Автоматизация повторяющихся процессов на сайте, в веб-приложении или через Telegram.',2000,'assets/products/automation.png',100),
('ui-redesign','UI/UX редизайн','design','Переработка интерфейса сайта или веб-приложения: структура, визуал, мобильная адаптация и удобство.',2500,'assets/products/ui-redesign.png',110),
('data-tool','Инструмент для данных','automation','Небольшой веб-инструмент для обработки, сортировки, преобразования или отображения данных.',1500,'assets/products/data-tool.png',120)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title,
  category=EXCLUDED.category,
  description=EXCLUDED.description,
  price_from=EXCLUDED.price_from,
  image_url=EXCLUDED.image_url,
  sort_order=EXCLUDED.sort_order,
  updated_at=NOW();
