import crypto from 'node:crypto';

const MAX_AGE_SECONDS = 86400;

function parseInitData(initData) {
  const params = new URLSearchParams(String(initData || ''));
  const data = {};
  for (const [key, value] of params.entries()) data[key] = value;
  return data;
}

export function verifyTelegramInitData(initData, botToken, now = Date.now()) {
  const raw = String(initData || '').trim();
  const token = String(botToken || '').trim();
  if (!raw || !token) return { ok: false, reason: 'missing_init_data_or_bot_token' };

  const params = parseInitData(raw);
  const receivedHash = params.hash;
  const authDate = Number(params.auth_date || 0);
  if (!receivedHash || !Number.isInteger(authDate) || authDate <= 0) {
    return { ok: false, reason: 'invalid_init_data' };
  }

  const age = Math.floor(now / 1000) - authDate;
  if (age < -60 || age > MAX_AGE_SECONDS) {
    return { ok: false, reason: 'expired_init_data' };
  }

  const checkString = Object.keys(params)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  const a = Buffer.from(calculatedHash, 'hex');
  const b = Buffer.from(receivedHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'invalid_hash' };
  }

  let user = null;
  try {
    user = params.user ? JSON.parse(params.user) : null;
  } catch {
    return { ok: false, reason: 'invalid_user_json' };
  }

  if (!user || user.id === undefined || user.id === null) {
    return { ok: false, reason: 'telegram_user_missing' };
  }

  return { ok: true, user, authDate };
}

export function telegramAuthRequired(req, res, next) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  const initData = req.get('X-Telegram-Init-Data') || req.body?.initData || '';
  const result = verifyTelegramInitData(initData, token);

  if (!result.ok) {
    return res.status(401).json({ error: 'Telegram authentication failed', code: result.reason });
  }

  req.telegramUser = result.user;
  req.telegramInitData = initData;
  return next();
}
