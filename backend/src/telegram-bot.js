import 'dotenv/config';

const BOT_TOKEN = String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
const STORE_URL = String(process.env.STORE_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN || ''}`).trim();

if (!BOT_TOKEN) {
  console.warn('[telegram-bot] BOT_TOKEN is not configured; bot is disabled.');
  process.exit(0);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
let offset = 0;
let stopping = false;

const welcome = (firstName = '') => `Добро пожаловать в Maalavo Store${firstName ? `, ${firstName}` : ''}! 👋\n\nМы — Maalavo Store — магазин цифровых товаров и решений. Здесь собран наш актуальный ассортимент: цифровые продукты, боты, сайты, веб-приложения, автоматизация и другие товары.\n\n🛍 Чтобы посмотреть ассортимент и купить нужный товар, просто нажми «Открыть магазин».\n\nВыбирай товар, оформляй заказ и получай его удобным способом. Все доступные товары и актуальные цены находятся прямо в магазине.`;

async function telegram(method, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.description || `Telegram API error: ${method}`);
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

async function sendWelcome(chatId, firstName) {
  const keyboard = STORE_URL && !STORE_URL.endsWith('://')
    ? { inline_keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url: STORE_URL } }]] }
    : { inline_keyboard: [[{ text: '🛍 Открыть магазин', callback_data: 'store_unavailable' }]] };

  return telegram('sendMessage', {
    chat_id: chatId,
    text: welcome(firstName),
    reply_markup: keyboard,
    disable_web_page_preview: true
  });
}

async function sendText(chatId, text) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url: STORE_URL } }]] },
    disable_web_page_preview: true
  });
}

async function handleUpdate(update) {
  const message = update?.message;
  if (!message?.chat?.id) return;
  const text = String(message.text || '').trim();
  const firstName = String(message.from?.first_name || '').trim();

  if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    await sendWelcome(message.chat.id, firstName);
    return;
  }

  if (/^\/(help|shop)(?:@\w+)?$/i.test(text)) {
    await sendText(message.chat.id, 'Нажми «Открыть магазин» — там находится весь актуальный ассортимент Maalavo Store.');
  }
}

async function poll() {
  while (!stopping) {
    try {
      const updates = await telegram('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message']
      });
      for (const update of updates || []) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        try {
          await handleUpdate(update);
        } catch (error) {
          console.error('[telegram-bot] update failed:', error?.message || error);
        }
      }
    } catch (error) {
      if (!stopping) {
        console.error('[telegram-bot] polling failed:', error?.message || error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
}

async function main() {
  await telegram('deleteWebhook', { drop_pending_updates: false });
  const me = await telegram('getMe', {});
  console.log(`[telegram-bot] @${me.username} started; store=${STORE_URL}`);
  await poll();
}

function stop() {
  stopping = true;
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

main().catch((error) => {
  console.error('[telegram-bot] fatal:', error?.message || error);
  process.exit(1);
});
