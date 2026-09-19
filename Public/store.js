const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor('#050507'); tg.setBackgroundColor('#050507'); } catch {} }

const LS_CART = 'maalavo_cart_v2', LS_FAV = 'maalavo_fav_v2';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const money = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(n) || 0) + ' ₽';

let products = [], categories = [], about = { title: '', text: '', supportUrl: '' };
let me = null, isAdmin = false;
let cart = [];                                   // [{id, qty}] — и для гостя, и для юзера
let favs = new Set();
try { cart = JSON.parse(localStorage.getItem(LS_CART) || '[]'); favs = new Set(JSON.parse(localStorage.getItem(LS_FAV) || '[]')); } catch {}

const guest = () => !me;
const saveGuest = () => localStorage.setItem(LS_CART, JSON.stringify(cart)) + localStorage.setItem(LS_FAV, JSON.stringify([...favs]));
const row = id => products.find(p => String(p.id) === String(id));
const qtyOf = id => cart.find(x => String(x.id) === String(id))?.qty || 0;
const cartDetailed = () => cart.map(x => ({ ...x, p: row(x.id) })).filter(x => x.p);
const cartTotal = () => Math.round(cartDetailed().reduce((s, x) => s + x.p.price * x.qty, 0) * 100) / 100;
const cartCount = () => cart.reduce((s, x) => s + x.qty, 0);

async function api(path, opt = {}) {
  const r = await fetch('/api' + path, { ...opt, credentials: 'same-origin', headers: {
    'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest',
    ...(tg?.initData ? { 'X-Telegram-Init-Data': tg.initData } : {}), ...(opt.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Ошибка сервера');
  return d;
}
function toast(t) { const x = $('toast'); x.textContent = t; x.classList.add('show'); clearTimeout(window._tt); window._tt = setTimeout(() => x.classList.remove('show'), 1900); }
function openSupport() { const u = about.supportUrl || 'https://t.me/maalavo'; if (tg?.openTelegramLink) tg.openTelegramLink(u); else window.open(u, '_blank'); }

// ---------- корзина ----------
async function setQty(id, qty) {
  qty = Math.max(0, Math.min(99, qty | 0));
  try {
    if (guest()) {
      cart = qty === 0 ? cart.filter(x => String(x.id) !== String(id))
        : (cart.find(x => String(x.id) === String(id)) ? cart.map(x => String(x.id) === String(id) ? { ...x, qty } : x) : [...cart, { id, qty }]);
      saveGuest();
    } else {
      const d = await api('/me/cart', { method: 'PUT', body: JSON.stringify({ productId: id, qty }) });
      cart = d.items.map(x => ({ id: x.id, qty: x.qty }));
    }
  } catch (e) { return toast(e.message); }
  renderBadges();
  if ($('sheet').dataset.mode === 'cart') openCart();
}
async function addCart(id) { await setQty(id, qtyOf(id) + 1); if (qtyOf(id)) toast('Добавлено в корзину 🛒'); }

async function toggleFav(id) {
  try {
    if (guest()) { favs.has(id) ? favs.delete(id) : favs.add(id); saveGuest(); }
    else { const d = await api('/me/favorites/' + encodeURIComponent(id), { method: 'PUT' }); favs = new Set(d.ids); }
    toast(favs.has(id) ? 'В избранном ♥' : 'Убрано из избранного');
  } catch (e) { toast(e.message); }
  renderProducts(); renderFavs(); renderBadges(); renderProfile();
}

// ---------- рендер ----------
function card(p, i) {
  return `<article class="card" style="--i:${i}" onclick="openProduct('${esc(p.id)}')">
    <button class="favHeart ${favs.has(p.id) ? 'on' : ''}" onclick="event.stopPropagation();toggleFav('${esc(p.id)}')">${favs.has(p.id) ? '♥' : '♡'}</button>
    <div class="pimg">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : '<span class="pph">✦</span>'}</div>
    <div class="cbody"><div class="tag">${esc(p.tag)}</div><div class="name">${esc(p.name)}</div>
      <div class="priceRow">${p.old_price ? `<s>${money(p.old_price)}</s>` : ''}<b>${money(p.price)}</b></div>
      <button class="add" onclick="event.stopPropagation();addCart('${esc(p.id)}')">${qtyOf(p.id) ? `В корзине · ${qtyOf(p.id)} ✓` : 'В корзину'}</button>
    </div></article>`;
}
function renderCategories() {
  const active = document.querySelector('.cat.active')?.dataset.cat || 'all';
  $('cats').innerHTML = ['all', ...categories].map(c =>
    `<button class="cat ${c === active ? 'active' : ''}" data-cat="${esc(c)}">${c === 'all' ? 'Все' : esc(c)}</button>`).join('');
  document.querySelectorAll('.cat').forEach(b => b.onclick = () => { document.querySelectorAll('.cat').forEach(x => x.classList.remove('active')); b.classList.add('active'); renderProducts(); });
}
function renderProducts() {
  const q = ($('search')?.value || '').toLowerCase().trim();
  const active = document.querySelector('.cat.active')?.dataset.cat || 'all';
  const list = products.filter(p => (active === 'all' || p.category === active) && (!q || `${p.name} ${p.description} ${p.tag}`.toLowerCase().includes(q)));
  $('products').innerHTML = list.length ? list.map(card).join('') : '<p class="muted" style="grid-column:1/-1">Ничего не найдено.</p>';
}
function renderFavs() {
  const list = products.filter(p => favs.has(p.id));
  $('favGrid').innerHTML = list.length ? list.map(card).join('') : '<p class="muted">Пока пусто ♡ — нажми на сердечко у товара.</p>';
}
function renderBadges() {
  const n = cartCount(), b = $('cartBadge');
  b.textContent = n; b.classList.toggle('hidden', !n);
  $('stCart').textContent = n; $('mCart').textContent = n;
  $('stFavs').textContent = favs.size; $('mFavs').textContent = favs.size;
}
function renderProfile() {
  if (!me) {
    $('pAvatar').textContent = 'Г'; $('pName').textContent = 'Гость';
    $('pSub').textContent = 'Войди, чтобы сохранять корзину и заказы';
    $('pStatus').textContent = tg?.initData ? 'Telegram подключён' : 'Гостевой режим';
    $('authRow').style.display = ''; $('logoutRow').style.display = 'none';
    $('adminRow').style.display = 'none'; $('stOrders').textContent = 0; $('mOrders').textContent = 0;
    return;
  }
  const name = me.name || me.username || 'Пользователь';
  $('pAvatar').innerHTML = me.photoUrl ? `<img src="${esc(me.photoUrl)}" alt="">` : esc((name || 'П').slice(0, 1).toUpperCase());
  $('pName').textContent = name;
  $('pSub').textContent = me.email || (me.username ? '@' + me.username : '');
  $('pStatus').textContent = isAdmin ? 'Администратор' : 'Аккаунт активен';
  $('authRow').style.display = 'none'; $('logoutRow').style.display = '';
  $('adminRow').style.display = isAdmin ? '' : 'none';
  loadOrderCount();
}
async function loadOrderCount() {
  if (!me) return;
  try { const n = (await api('/me/orders')).orders.length; $('stOrders').textContent = n; $('mOrders').textContent = n; } catch {}
}
function renderAll() { renderProducts(); renderFavs(); renderBadges(); renderProfile(); }

// ---------- экраны ----------
function screen(which) {
  closeOverlay();
  $('homePage').style.display = which === 'home' ? 'block' : 'none';
  $('favPage').style.display = which === 'favs' ? 'block' : 'none';
  $('profilePage').style.display = which === 'profile' ? 'block' : 'none';
  $('navHome').classList.toggle('active', which === 'home');
  $('navFav').classList.toggle('active', which === 'favs');
  $('navProfile').classList.toggle('active', which === 'profile');
  window.scrollTo(0, 0);
}
function openFavs() { screen('favs'); renderFavs(); }
function enterStore() { $('splash').classList.add('hide'); sessionStorage.setItem('maalavo_seen', '1'); }

// ---------- шит ----------
function openOverlay(html, mode) { const s = $('sheet'); s.dataset.mode = mode || ''; s.innerHTML = html; $('overlay').classList.add('show'); }
function closeOverlay() { $('overlay').classList.remove('show'); }

function openProduct(id) {
  const p = row(id); if (!p) return;
  openOverlay(`<div class="shTop"><div><div class="tag">${esc(p.tag)}</div><h2>${esc(p.name)}</h2></div><button class="close" onclick="closeOverlay()">×</button></div>
    <div class="pimg" style="height:200px;border-radius:16px">${p.image ? `<img src="${esc(p.image)}" alt="">` : '<span class="pph">✦</span>'}</div>
    <p class="note" style="margin-top:14px">${esc(p.description)}</p>
    <div class="priceRow" style="margin-bottom:14px">${p.old_price ? `<s>${money(p.old_price)}</s>` : ''}<b style="font-size:22px">${money(p.price)}</b><span class="muted">· ${esc(p.stock)}</span></div>
    <button class="btn" onclick="addCart('${esc(p.id)}')">Добавить в корзину 🛒</button>`, 'product');
}

function openCart() {
  const rows = cartDetailed();
  const html = `<div class="shTop"><div><div class="tag">MAALAVO STORE</div><h2>Корзина</h2></div><button class="close" onclick="closeOverlay()">×</button></div>` +
    (rows.length ? rows.map(x => `<div class="crow"><div><b>${esc(x.p.name)}</b><div class="muted" style="font-size:12px">${money(x.p.price)} × ${x.qty}</div>
      <div class="qty"><button onclick="setQty('${esc(x.id)}',${x.qty - 1})">−</button><span>${x.qty}</span><button onclick="setQty('${esc(x.id)}',${x.qty + 1})">+</button></div></div>
      <b>${money(x.p.price * x.qty)}</b></div>`).join('') +
      `<div class="total"><span>Итого</span><b>${money(cartTotal())}</b></div>
       ${guest() ? '<p class="note">Войди, чтобы оформить заказ — гостевая корзина сохранится.</p>' : ''}
       <button class="btn" onclick="${guest() ? 'openAuth()' : 'openCheckout()'}">${guest() ? 'Войти и оформить' : 'Оформить заказ'}</button>`
    : '<p class="muted">Корзина пуста. Загляни в каталог ✨</p>');
  openOverlay(html, 'cart');
}

function openCheckout() {
  openOverlay(`<div class="shTop"><div><div class="tag">ОФОРМЛЕНИЕ</div><h2>Заказ · ${money(cartTotal())}</h2></div><button class="close" onclick="closeOverlay()">×</button></div>
    <div class="field"><label>Комментарий к заказу (необязательно)</label><textarea id="orderNote" placeholder="Например: способ связи, пожелания..."></textarea></div>
    <button class="btn" onclick="placeOrder()">Подтвердить заказ ✓</button>`, 'checkout');
}
async function placeOrder() {
  try {
    const o = await api('/orders', { method: 'POST', body: JSON.stringify({ note: $('orderNote')?.value || '' }) });
    cart = []; renderBadges(); loadOrderCount();
    toast(`Заказ ${o.id} создан!`);
    openOrders();
  } catch (e) { toast(e.message); }
}

async function openOrders() {
  if (guest()) return openAuth();
  try {
    const { orders } = await api('/me/orders');
    const stName = { pending: 'Ожидает', paid: 'Оплачен', processing: 'В работе', completed: 'Готов', cancelled: 'Отменён' };
    openOverlay(`<div class="shTop"><div><div class="tag">АККАУНТ</div><h2>Мои заказы</h2></div><button class="close" onclick="closeOverlay()">×</button></div>` +
      (orders.length ? orders.map(o => `<div class="order"><b>${esc(o.id)}</b> <span class="status ${esc(o.status)}">${stName[o.status] || o.status}</span>
        <div class="meta">${new Date(o.created_at).toLocaleString('ru-RU')}</div>
        <div class="meta">${o.items.map(i => esc(i.name) + ' × ' + i.qty).join(', ')}</div>
        <div class="meta"><b>${money(o.total)}</b></div></div>`).join('')
      : '<p class="muted">Заказов пока нет.</p>'), 'orders');
  } catch (e) { toast(e.message); }
}

// ---------- авторизация ----------
function openAuth(mode = 'login') {
  openOverlay(`<div class="shTop"><div><div class="tag">АККАУНТ</div><h2 id="authTitle">${mode === 'login' ? 'Вход' : 'Регистрация'}</h2></div><button class="close" onclick="closeOverlay()">×</button></div>
    <div class="tabs"><button id="tabL" class="${mode === 'login' ? 'active' : ''}" onclick="openAuth('login')">Вход</button><button id="tabR" class="${mode === 'register' ? 'active' : ''}" onclick="openAuth('register')">Регистрация</button></div>
    <div id="nameField" class="field" style="display:${mode === 'register' ? '' : 'none'}"><label>Имя</label><input id="authName" placeholder="Как к тебе обращаться"></div>
    <div class="field"><label>Email</label><input id="authEmail" type="email" placeholder="you@example.com" autocomplete="email"></div>
    <div class="field"><label>Пароль (мин. 6 символов)</label><input id="authPass" type="password" autocomplete="current-password"></div>
    <button class="btn" onclick="submitAuth('${mode}')">${mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
    ${tg?.initData ? '<p class="note" style="margin-top:10px">Telegram-аккаунт подхватывается автоматически.</p>' : ''}`, 'auth');
}
async function submitAuth(mode) {
  try {
    const body = { email: $('authEmail').value.trim(), password: $('authPass').value, name: $('authName')?.value.trim() };
    const d = await api('/auth/' + mode, { method: 'POST', body: JSON.stringify(body) });
    me = d.user; isAdmin = d.user.role === 'admin';
    await afterLogin();
  } catch (e) { toast(e.message); }
}
async function afterLogin() {
  try { // слить гостевую корзину/избранное на сервер
    for (const x of cart) await api('/me/cart', { method: 'PUT', body: JSON.stringify({ productId: x.id, qty: x.qty }) });
    for (const f of favs) await api('/me/favorites/' + encodeURIComponent(f), { method: 'PUT' });
  } catch {}
  cart = []; favs = new Set(); saveGuest();
  try {
    const [c, f] = await Promise.all([api('/me/cart'), api('/me/favorites')]);
    cart = c.items.map(x => ({ id: x.id, qty: x.qty })); favs = new Set(f.ids);
  } catch {}
  closeOverlay(); renderCategories(); renderAll();
  toast('С возвращением! 👋');
}
async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  me = null; isAdmin = false; cart = []; favs = new Set();
  screen('home'); renderAll(); toast('Вы вышли');
}

// ---------- init ----------
async function init() {
  try {
    const [p, a, m] = await Promise.all([api('/products'), api('/about'), api('/auth/me')]);
    products = p.products; categories = p.categories; about = a;
    me = m.authenticated ? m.user : null; isAdmin = m.isAdmin;
    if (me) {
      const [c, f] = await Promise.all([api('/me/cart'), api('/me/favorites')]);
      cart = c.items.map(x => ({ id: x.id, qty: x.qty })); favs = new Set(f.ids);
      if (!c.items.length && localStorage.getItem(LS_CART)) afterLogin(); // автослияние гостевой корзины
    }
  } catch (e) { console.warn('API недоступен:', e.message); }
  $('aboutTitle').textContent = about.title; $('aboutText').textContent = about.text;
  renderCategories(); renderAll();
  if (sessionStorage.getItem('maalavo_seen')) $('splash').classList.add('hide');
}
$('search').addEventListener('input', renderProducts);
$('overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeOverlay(); });
init();