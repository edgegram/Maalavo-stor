(() => {
  'use strict';

  const API = String(window.MAALAVO_API_URL || '/api').replace(/\/$/, '');
  const DEVICE = () => localStorage.getItem('maalavo_device_id_v1') || '';
  const TG = () => String(window.Telegram?.WebApp?.initData || '').trim();
  const ACTIVE = new Set(['new', 'in_progress', 'paid']);
  const STATUS = {
    new: ['Новый', '✦', 'new'],
    in_progress: ['В работе', '◷', 'progress'],
    paid: ['Оплачен', '✓', 'paid'],
    completed: ['Получен', '✓', 'completed'],
    cancelled: ['Отменён', '×', 'cancelled']
  };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const headers = () => ({ 'Content-Type': 'application/json', ...(TG() ? { 'X-Telegram-Init-Data': TG() } : {}) });

  async function api(path, options = {}) {
    const r = await fetch(`${API}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) }, cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Ошибка ${r.status}`);
    return data;
  }

  function open(title, html, keepScroll = false) {
    const page = document.getElementById('profileSubpage');
    const titleNode = document.getElementById('profileSubpageTitle');
    const content = document.getElementById('profileSubpageContent');
    const scroll = document.getElementById('profileSubpageScroll');
    if (!page || !titleNode || !content) return;
    const top = scroll?.scrollTop || 0;
    titleNode.textContent = title;
    content.innerHTML = html;
    page.classList.add('open');
    page.setAttribute('aria-hidden', 'false');
    if (scroll) requestAnimationFrame(() => { scroll.scrollTop = keepScroll ? top : 0; });
  }

  function money(v) { return `${Number(v || 0).toLocaleString('ru-RU')} ₽`; }
  function date(v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 'Дата неизвестна' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function loadOrders() {
    const q = new URLSearchParams({ deviceId: DEVICE() });
    const [ordersData, reviewsData] = await Promise.all([
      api(`/orders?${q}`),
      api(`/my/reviews?${q}`).catch(() => ({ reviews: [] }))
    ]);
    const reviewed = new Set((reviewsData.reviews || []).map((r) => `${r.orderId}:${r.productId}`));
    return (ordersData.orders || []).map((order) => ({
      ...order,
      items: (order.items || []).map((item) => ({
        ...item,
        reviewed: reviewed.has(`${order.id}:${item.productId}`) || reviewed.has(`${order.publicId}:${item.productId}`)
      }))
    }));
  }

  function review(order, item) {
    if (item.reviewed) return `<div class="mr-review-done"><i>✓</i><div><b>Отзыв оставлен</b><small>Спасибо за обратную связь ❤️</small></div></div>`;
    return `<form class="mr-review" data-order="${esc(order.publicId)}" data-product="${esc(item.productId)}">
      <div class="mr-review-title"><small>Оцените товар</small><b>${esc(item.title)}</b></div>
      <div class="mr-stars">${[1,2,3,4,5].map((n) => `<button type="button" data-rating="${n}" aria-label="${n} из 5">★</button>`).join('')}</div>
      <textarea maxlength="1200" placeholder="Расскажите, всё ли устроило"></textarea>
      <button type="submit" disabled>Опубликовать отзыв</button><small class="mr-error"></small>
    </form>`;
  }

  function reviews(order) {
    const items = order.items || [];
    if (!items.length) return '';
    if (order.status !== 'completed') return `<section class="mr-locked"><i>★</i><div><b>Отзыв после получения</b><span>Оценить товар можно после статуса «Получен».</span></div></section>`;
    return `<section class="mr-review-section"><div class="mr-review-heading"><b>Ваш отзыв</b><span>Поделитесь впечатлением о покупке</span></div>${items.map((item) => review(order, item)).join('')}</section>`;
  }

  function queue(order) {
    if (!ACTIVE.has(order.status) || !Number(order.queuePosition)) return '';
    return `<div class="mr-queue"><i>↗</i><div><small>Позиция в очереди</small><b>№${Number(order.queuePosition)}</b></div></div>`;
  }

  function card(order) {
    const meta = STATUS[order.status] || [order.statusLabel || 'Статус', '•', 'unknown'];
    return `<article class="mr-order">
      <header><div class="mr-id"><b>#${esc(order.publicId)}</b><small>${esc(date(order.createdAt))}</small></div><span class="mr-status ${meta[2]}"><i>${meta[1]}</i>${esc(meta[0])}</span></header>
      ${queue(order)}
      <div class="mr-items">${(order.items || []).map((item) => `<div><span><b>${esc(item.title)}</b> × ${Number(item.quantity || 1)}</span><strong>${money(Number(item.priceFrom || 0) * Number(item.quantity || 1))}</strong></div>`).join('')}</div>
      <div class="mr-total"><span>Итого</span><b>${money(order.totalFrom)}</b></div>
      ${reviews(order)}
    </article>`;
  }

  let title = 'Мои заказы';
  let filter = () => true;
  let last = '';
  let busy = false;

  async function render(force = false, keepScroll = true) {
    if (busy) return;
    busy = true;
    try {
      const list = (await loadOrders()).filter(filter);
      const sig = JSON.stringify(list.map((o) => ({ id: o.publicId, status: o.status, updated: o.updatedAt, queue: o.queuePosition, items: o.items.map((i) => [i.productId, i.reviewed]) })));
      if (!force && sig === last) return;
      last = sig;
      open(title, list.length ? `<div class="mr-list">${list.map(card).join('')}</div>` : `<div class="mr-empty"><i>◷</i><b>Заказов пока нет</b><span>Здесь появится история ваших заказов.</span></div>`, keepScroll);
    } catch (e) {
      open(title, `<div class="mr-empty"><b>Не удалось загрузить заказы</b><span>${esc(e.message)}</span></div>`, true);
    } finally { busy = false; }
  }

  function showOrders(nextTitle, nextFilter) {
    title = nextTitle;
    filter = nextFilter || (() => true);
    last = '';
    void render(true, false);
  }

  function cart() {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem('maalavo_cart_v5') || '[]'); } catch {}
    const products = [...document.querySelectorAll('#products .product')];
    const items = ids.map((id) => products.find((p) => p.dataset.id === id)).filter(Boolean);
    if (!items.length) return open('Корзина', '<div class="mr-empty"><i>🛒</i><b>Корзина пуста</b><span>Добавьте товар из каталога.</span></div>');
    open('Корзина', `<div class="mr-cart">${items.map((p) => `<div><img src="${esc(p.querySelector('.product-image img')?.src || '')}" alt=""><section><b>${esc(p.querySelector('.product-title')?.textContent.trim() || p.dataset.id)}</b><small>${esc(p.querySelector('.price')?.textContent.trim() || '')}</small></section><button data-remove="${esc(p.dataset.id)}">Удалить</button></div>`).join('')}</div>`);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-profile-screen]');
    if (b) {
      const s = b.dataset.profileScreen;
      if (!['orders','purchases','status','feedback','cart'].includes(s)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (s === 'cart') cart();
      else if (s === 'purchases') showOrders('Мои покупки', (o) => o.status === 'completed');
      else if (s === 'feedback') showOrders('Оценить заказ', (o) => o.status === 'completed');
      else showOrders(s === 'status' ? 'Статус заказа' : 'Мои заказы');
      return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      let ids = [];
      try { ids = JSON.parse(localStorage.getItem('maalavo_cart_v5') || '[]'); } catch {}
      localStorage.setItem('maalavo_cart_v5', JSON.stringify(ids.filter((id) => id !== remove.dataset.remove)));
      cart();
      return;
    }
    const star = e.target.closest('.mr-stars button');
    if (star) {
      const form = star.closest('.mr-review');
      if (!form) return;
      const rating = Number(star.dataset.rating);
      form.dataset.rating = String(rating);
      form.querySelectorAll('.mr-stars button').forEach((x) => x.classList.toggle('active', Number(x.dataset.rating) <= rating));
      form.querySelector('button[type="submit"]').disabled = false;
    }
  }, true);

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('.mr-review');
    if (!form) return;
    e.preventDefault();
    const error = form.querySelector('.mr-error');
    const submit = form.querySelector('button[type="submit"]');
    try {
      const rating = Number(form.dataset.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Выберите оценку');
      submit.disabled = true; submit.textContent = 'Публикуем…'; error.textContent = '';
      await api('/reviews', { method: 'POST', body: JSON.stringify({ deviceId: DEVICE(), orderId: form.dataset.order, productId: form.dataset.product, rating, text: form.querySelector('textarea').value.trim() }) });
      form.outerHTML = `<div class="mr-review-done"><i>✓</i><div><b>Отзыв опубликован</b><small>Спасибо за обратную связь ❤️</small></div></div>`;
      last = '';
      void render(true, true);
    } catch (err) {
      error.textContent = err.message;
      submit.disabled = false; submit.textContent = 'Опубликовать отзыв';
    }
  });

  let currentProduct = '';
  document.addEventListener('click', (e) => { const p = e.target.closest('.product'); if (p) currentProduct = p.dataset.id || ''; }, true);
  const observer = new MutationObserver(() => {
    const page = document.getElementById('productPage');
    const content = page?.querySelector('.product-page-content');
    if (!page?.classList.contains('open') || !currentProduct || !content || content.querySelector('.mr-reviews')) return;
    const box = document.createElement('section'); box.className = 'mr-reviews'; content.appendChild(box);
    api(`/products/${encodeURIComponent(currentProduct)}/reviews`).then((d) => {
      const count = Number(d.stats?.count || 0), avg = Number(d.stats?.average || 0);
      box.innerHTML = `<h3>Отзывы покупателей</h3><small>${count ? `${avg.toFixed(1)} / 5 · ${count}` : 'Пока нет отзывов'}</small>${count ? (d.reviews || []).map((r) => `<article><b>${esc(r.displayName || 'Покупатель')}</b><span>${'★'.repeat(Number(r.rating))}${'☆'.repeat(5 - Number(r.rating))}</span><small>${esc(date(r.createdAt))}</small>${r.text ? `<p>${esc(r.text)}</p>` : ''}</article>`).join('') : '<p>Покупатели ещё не оставляли отзывов.</p>'}`;
    }).catch(() => { box.innerHTML = '<p>Отзывы временно недоступны.</p>'; });
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  setInterval(() => {
    const page = document.getElementById('profileSubpage');
    const current = document.getElementById('profileSubpageTitle')?.textContent || '';
    if (!page?.classList.contains('open') || !['Мои заказы','Статус заказа','Мои покупки','Оценить заказ'].includes(current)) return;
    void render(false, true);
  }, 4000);

  const style = document.createElement('style');
  style.textContent = `
    .mr-list{display:grid;gap:14px;padding-bottom:24px}.mr-order{padding:16px;border:1px solid #ffffff12;border-radius:22px;background:linear-gradient(180deg,#ffffff0d,#ffffff04);box-shadow:0 12px 35px #0003}.mr-order header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mr-id{display:grid;gap:5px;min-width:0}.mr-id b{font-size:17px;word-break:break-all}.mr-id small{font-size:12px;color:#ffffff7a}.mr-status{display:flex;align-items:center;gap:7px;padding:9px 11px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;border:1px solid #ffffff12}.mr-status i{font-style:normal}.mr-status.new{color:#d9ceff;background:#8b70ff1f}.mr-status.progress{color:#ffd39e;background:#ffb15b1f}.mr-status.paid{color:#a9e1ff;background:#5bbcff1f}.mr-status.completed{color:#9affc8;background:#4fe1991f}.mr-status.cancelled{color:#ff9eaf;background:#ff5b771c}.mr-queue{display:flex;align-items:center;gap:11px;margin:14px 0;padding:12px 13px;border:1px solid #ad5cff2c;border-radius:16px;background:linear-gradient(90deg,#9741ff22,#d240ff0d)}.mr-queue>i{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#ae5bff2e;color:#d9a7ff;font-style:normal;font-size:17px}.mr-queue div{display:grid;gap:2px}.mr-queue small{color:#ffffff80;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.mr-queue b{font-size:15px}.mr-items{display:grid;gap:9px;margin-top:12px}.mr-items>div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #ffffff0f}.mr-items>div:last-child{border-bottom:0}.mr-items span{min-width:0;font-size:14px}.mr-items b{font-weight:700}.mr-items strong{white-space:nowrap}.mr-total{display:flex;justify-content:space-between;align-items:center;padding-top:13px;border-top:1px solid #ffffff14}.mr-total span{color:#ffffff8c;font-size:13px}.mr-total b{font-size:18px}.mr-locked{display:flex;gap:11px;align-items:center;margin-top:14px;padding:12px 13px;border:1px solid #ffffff10;border-radius:15px;background:#ffffff08}.mr-locked>i{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#ffc1521c;color:#ffd77c;font-style:normal}.mr-locked div{display:grid;gap:3px}.mr-locked b{font-size:13px}.mr-locked span{font-size:11px;color:#ffffff7a}.mr-review-section{display:grid;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #ffffff14}.mr-review-heading{display:grid;gap:3px}.mr-review-heading b{font-size:14px}.mr-review-heading span{font-size:11px;color:#ffffff73}.mr-review{display:grid;gap:9px;padding:13px;border:1px solid #ffffff10;border-radius:16px;background:#ffffff08}.mr-review-title{display:grid;gap:3px}.mr-review-title small{color:#ffffff73;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.mr-review-title b{font-size:13px}.mr-stars{display:flex;gap:3px}.mr-stars button{width:32px;height:32px;padding:0;border:0;background:none;color:#ffffff33;font-size:25px;cursor:pointer}.mr-stars button.active{color:#ffd166}.mr-review textarea{min-height:76px;resize:vertical;background:#0003;color:inherit;border:1px solid #ffffff17;border-radius:12px;padding:11px;font:inherit;outline:0}.mr-review>button{border:0;border-radius:12px;padding:11px;background:linear-gradient(135deg,#8c36ff,#d13eff);color:#fff;font-weight:800}.mr-review>button:disabled{opacity:.45}.mr-error{min-height:15px;color:#ff9cae;font-size:11px}.mr-review-done{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #4fe1991f;border-radius:14px;background:#4fe1990f}.mr-review-done>i{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#4fe19922;color:#82ffc0;font-style:normal;font-weight:900}.mr-review-done div{display:grid;gap:2px}.mr-review-done b{font-size:12px}.mr-review-done small{font-size:10px;color:#ffffff73}.mr-empty{min-height:220px;display:grid;place-items:center;align-content:center;gap:7px;padding:30px;text-align:center;color:#ffffff7a}.mr-empty>i{display:grid;place-items:center;width:52px;height:52px;border-radius:17px;background:#ad5cff1c;color:#d3a4ff;font-style:normal;font-size:22px}.mr-empty b{color:#fff;font-size:16px}.mr-empty span{font-size:12px}.mr-cart{display:grid;gap:10px}.mr-cart>div{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid #ffffff12;border-radius:15px;background:#ffffff08}.mr-cart img{width:52px;height:52px;border-radius:12px;object-fit:cover}.mr-cart section{display:grid;gap:4px;min-width:0}.mr-cart section small{color:#ffffff80}.mr-cart button{border:1px solid #ff5f7a33;background:#ff5f7a14;color:#ff9eae;border-radius:10px;padding:8px;font-size:11px}.mr-reviews{margin-top:24px;padding-top:18px;border-top:1px solid #ffffff14}.mr-reviews h3{margin:0 0 5px;font-size:17px}.mr-reviews>small{color:#ffffff73}.mr-reviews article{margin-top:9px;padding:12px;border:1px solid #ffffff0d;border-radius:13px;background:#ffffff08}.mr-reviews article span{float:right;color:#ffd166}.mr-reviews article small{display:block;color:#ffffff66;margin-top:4px}.mr-reviews article p{margin:8px 0 0;white-space:pre-wrap;color:#ffffffbf;line-height:1.45;font-size:12px}
  `;
  document.head.appendChild(style);
})();
