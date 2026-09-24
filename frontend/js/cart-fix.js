(() => {
  'use strict';

  const CART_KEY = 'maalavo_cart_v5';

  function readCart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : [];
    } catch {
      return [];
    }
  }

  function writeCart(ids) {
    const clean = [...new Set(ids.filter(Boolean))];
    localStorage.setItem(CART_KEY, JSON.stringify(clean));

    try {
      if (typeof cart !== 'undefined' && Array.isArray(cart)) {
        cart.splice(0, cart.length, ...clean);
      }
      if (typeof saveCart === 'function') saveCart();
    } catch (error) {
      console.warn('Cart state sync failed:', error);
    }

    return clean;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function open(title, html) {
    const page = document.getElementById('profileSubpage');
    const titleNode = document.getElementById('profileSubpageTitle');
    const content = document.getElementById('profileSubpageContent');
    const scroll = document.getElementById('profileSubpageScroll');
    if (!page || !titleNode || !content) return;

    titleNode.textContent = title;
    content.innerHTML = html;
    page.classList.add('open');
    page.setAttribute('aria-hidden', 'false');
    if (scroll) requestAnimationFrame(() => { scroll.scrollTop = 0; });
  }

  function items() {
    const products = [...document.querySelectorAll('#products .product')];
    return readCart()
      .map((id) => products.find((product) => product.dataset.id === id))
      .filter(Boolean);
  }

  function renderCart() {
    const selected = items();

    if (!selected.length) {
      open('Корзина', `<div class="mcf-empty">
        <div class="mcf-icon">🛒</div>
        <b>Корзина пуста</b>
        <span>Добавьте товар из каталога.</span>
        <button type="button" data-profile-go-home>Перейти в каталог</button>
      </div>`);
      return;
    }

    const rows = selected.map((product) => {
      const id = product.dataset.id || '';
      const title = product.querySelector('.product-title')?.textContent.trim() || id;
      const price = product.querySelector('.price')?.textContent.trim() || 'Цена по запросу';
      const image = product.querySelector('.product-image img')?.getAttribute('src') || '';

      return `<article class="mcf-item">
        <img src="${esc(image)}" alt="">
        <div><b>${esc(title)}</b><small>${esc(price)}</small></div>
        <button type="button" data-mcf-remove="${esc(id)}">Удалить</button>
      </article>`;
    }).join('');

    open('Корзина', `<div class="mcf-cart">
      ${rows}
      <button class="mcf-checkout" type="button" data-open-checkout>Оформить заказ <span>→</span></button>
    </div>`);
  }

  document.addEventListener('click', (event) => {
    const profile = event.target.closest('[data-profile-screen="cart"]');
    if (profile) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderCart();
      return;
    }

    const remove = event.target.closest('[data-mcf-remove]');
    if (remove) {
      event.preventDefault();
      event.stopImmediatePropagation();
      writeCart(readCart().filter((id) => id !== remove.dataset.mcfRemove));
      renderCart();
    }
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .mcf-cart{display:grid;gap:10px;padding-bottom:24px}
    .mcf-item{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid #ffffff12;border-radius:15px;background:#ffffff08}
    .mcf-item img{width:52px;height:52px;border-radius:12px;object-fit:cover}
    .mcf-item div{display:grid;gap:4px;min-width:0}
    .mcf-item b{font-size:13px;line-height:1.25}
    .mcf-item small{color:#ffffff80;font-size:11px}
    .mcf-item>button{border:1px solid #ff5f7a33;background:#ff5f7a14;color:#ff9eae;border-radius:10px;padding:8px;font-size:11px;cursor:pointer}
    .mcf-checkout,.mcf-empty>button{width:100%;border:0;border-radius:16px;padding:15px 18px;background:linear-gradient(135deg,#8c36ff,#d13eff);color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 10px 28px #a43cff30}
    .mcf-checkout{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:8px}.mcf-checkout span{font-size:20px}
    .mcf-empty{min-height:220px;display:grid;place-items:center;align-content:center;gap:8px;padding:30px;text-align:center;color:#ffffff7a}.mcf-empty b{color:#fff;font-size:16px}.mcf-empty span{font-size:12px}.mcf-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:17px;background:#ad5cff1c;color:#d3a4ff;font-size:22px}
    .mcf-empty>button{max-width:260px;margin-top:8px}
  `;
  document.head.appendChild(style);
})();
