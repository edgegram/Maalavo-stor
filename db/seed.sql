INSERT INTO products(id,category,tag,name,description,price,image,stock,active,updated_at) VALUES
('p1','bots','БОТЫ','Telegram Bot','Готовый Telegram-бот под ваши задачи.',1500,'bot.jpg','под заказ',1,CURRENT_TIMESTAMP),
('p2','web','ВЕБ','Веб-приложение','Современное веб-приложение с адаптацией под телефон и компьютер.',3000,'app.jpg','под заказ',1,CURRENT_TIMESTAMP),
('p3','sites','САЙТЫ','Сайт под ключ','Полноценный современный сайт под ваш проект.',5000,'site.jpg','под заказ',1,CURRENT_TIMESTAMP),
('p4','plugins','ПЛАГИНЫ','Telegram Plugin','Кастомный плагин с функциями под ваш Telegram.',1000,'plugin.jpg','под заказ',1,CURRENT_TIMESTAMP),
('p5','accounts','АККАУНТЫ','Telegram Account','Аккаунты для различных цифровых задач.',500,'account.jpg','под заказ',1,CURRENT_TIMESTAMP),
('p6','services','СЕРВИСЫ','Разработка','Настройка, доработка и разработка цифровых решений.',1000,'site.jpg','под заказ',1,CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
category=excluded.category,
tag=excluded.tag,
name=excluded.name,
description=excluded.description,
price=excluded.price,
image=excluded.image,
stock=excluded.stock,
active=excluded.active,
updated_at=CURRENT_TIMESTAMP;

INSERT INTO settings(key,value) VALUES
('about_title','Зачем создан магазин'),
('about_text','Магазин создан, чтобы цифровые товары можно было находить и покупать быстро, удобно и без лишней суеты.'),
('support_username','maalavo'),
('welcome_title','Добро пожаловать в Maalavo Store'),
('welcome_text','Рады видеть тебя в магазине. Здесь собраны цифровые товары, готовые решения и услуги для твоих проектов.'),
('profile_mode','telegram'),
('telegram_profile','enabled')
ON CONFLICT(key) DO UPDATE SET value=excluded.value;
