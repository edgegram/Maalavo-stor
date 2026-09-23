(() => {
  'use strict';

  const API = 'https://maalavo-stor-production-6edd.up.railway.app/api';
  const state = { token: localStorage.getItem('maalavo_admin_token') || '', editingId: null };
  const $ = (id) => document.getElementById(id);

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(`${API}${path}`, { ...options, headers });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);
    return data;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function showLogin() {
    $('appView').classList.add('hidden');
    $('loginView').classList.remove('hidden');
  }

  function handleAuthError(error) {
    if (/авториза|сессия|401/i.test(error.message)) {
      state.token = '';
      localStorage.removeItem('maalavo_admin_token');
      showLogin();
      return;
    }
    toast(error.message);
  }

  async function login(event) {
    event.preventDefault();
    $('loginError').textContent = '';
    try {
      const data = await request('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: $('username').value.trim(), password: $('password').value })
      });
      state.token = data.token;
      localStorage.setItem('maalavo_admin_token', state.token);
      $('adminName').textContent = data.admin.username;
      $('loginView').classList.add('hidden');
      $('appView').classList.remove('hidden');
      await loadAll();
    } catch (error) {
      $('loginError').textContent = error.message;
    }
  }

  async function loadAll() {
    const me = await request('/admin/me');
    $('adminName').textContent = me.admin.username;
    await Promise.all([loadStats(), loadOrders(), loadProducts()]);
  }

  async function loadStats() {
    const { stats } = await request('/admin/stats');
    $('sOrders').textContent = stats.orders;
    $('sNew').textContent = '—';
    $('sCompleted').textContent = '—';
    $('sUsers').textContent = stats.users;
    $('sRevenue').textContent = `${Number(stats.revenue).toLocaleString('ru-RU')} ₽`;
  }

  async function loadOrders() {
    const { orders } = await request('/admin/orders');
    const root = $('ordersList');
    root.innerHTML = orders.length ? orders.map((order) => {
      const items = order.items.map((item) => `${esc(item.title)} × ${item.quantity}`).join(', ');
      return `<article class="order">
        <div class="order-head"><div><div class="order-id">#${esc(order.publicId)}</div>
        <div class="meta">${esc(order.name)} · ${esc(order.telegram)} · ${new Date(order.createdAt).toLocaleString('ru-RU')}</div></div>
        <span class="status">${esc(order.status)}</span></div>
        <div class="order-items">${items || 'Без позиций'} · <b>${Number(order.totalFrom).toLocaleString('ru-RU')} ₽</b></div>
        ${order.accountNumber ? `<div class="meta">Аккаунт: #${esc(order.accountNumber)}</div>` : ''}
        ${order.comment ? `<div class="meta">${esc(order.comment)}</div>` : ''}
        <div class="order-actions"><select data-order-id="${esc(order.id)}">
          <option value="new" ${order.status === 'new' ? 'selected' : ''}>Новый</option>
          <option value="in_progress" ${order.status === 'in_progress' ? 'selected' : ''}>В работе</option>
          <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>Оплачен</option>
          <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Выполнен</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Отменён</option>
        </select></div></article>`;
    }).join('') : '<p class="muted">Заказов пока нет.</p>';

    root.querySelectorAll('select[data-order-id]').forEach((select) => {
      select.addEventListener('change', async () => {
        try {
          await request(`/admin/orders/${encodeURIComponent(select.dataset.orderId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: select.value })
          });
          toast('Статус обновлён');
          await loadStats();
        } catch (error) { handleAuthError(error); }
      });
    });
  }

  async function loadProducts() {
    const { products } = await request('/admin/products');
    const root = $('productsList');
    root.innerHTML = products.length ? products.map((product) => `<article class="product">
      <div><div class="product-head"><div><h3>${esc(product.title)}</h3>
      <div class="meta">${esc(product.id)} · ${esc(product.category)} · ${product.active ? 'активен' : 'скрыт'}</div></div>
      <strong>от ${Number(product.priceFrom).toLocaleString('ru-RU')} ₽</strong></div>
      <p class="muted">${esc(product.description)}</p></div>
      <div class="actions"><button class="ghost edit-product" data-id="${esc(product.id)}">Изменить</button>
      <button class="ghost danger delete-product" data-id="${esc(product.id)}">${product.active ? 'Скрыть' : 'Удалить'}</button></div></article>`).join('') : '<p class="muted">Товаров нет.</p>';

    root.querySelectorAll('.edit-product').forEach((button) => button.onclick = () => openEditor(products.find((p) => p.id === button.dataset.id)));
    root.querySelectorAll('.delete-product').forEach((button) => button.onclick = async () => {
      if (!confirm('Скрыть товар из магазина?')) return;
      try {
        await request(`/admin/products/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' });
        toast('Товар скрыт');
        await loadProducts();
      } catch (error) { handleAuthError(error); }
    });
  }

  function openEditor(product = null) {
    state.editingId = product?.id || null;
    $('editorTitle').textContent = product ? 'Изменить товар' : 'Новый товар';
    $('pId').value = product?.id || '';
    $('pId').disabled = Boolean(product);
    $('pTitle').value = product?.title || '';
    $('pCategory').value = product?.category || '';
    $('pDescription').value = product?.description || '';
    $('pPrice').value = product?.priceFrom ?? 0;
    $('pSort').value = product?.sortOrder ?? 0;
    $('pImage').value = product?.imageUrl || '';
    $('pActive').checked = product?.active ?? true;
    $('editorError').textContent = '';
    $('productEditor').classList.remove('hidden');
  }

  async function saveProduct(event) {
    event.preventDefault();
    const product = {
      title: $('pTitle').value.trim(), category: $('pCategory').value.trim(), description: $('pDescription').value.trim(),
      priceFrom: Number($('pPrice').value), imageUrl: $('pImage').value.trim() || null, active: $('pActive').checked, sortOrder: Number($('pSort').value)
    };
    try {
      if (state.editingId) {
        await request(`/admin/products/${encodeURIComponent(state.editingId)}`, { method: 'PATCH', body: JSON.stringify(product) });
      } else {
        product.id = $('pId').value.trim();
        await request('/admin/products', { method: 'POST', body: JSON.stringify(product) });
      }
      $('productEditor').classList.add('hidden');
      toast('Товар сохранён');
      await loadProducts();
    } catch (error) { $('editorError').textContent = error.message; }
  }

  $('loginForm').addEventListener('submit', login);
  $('logout').onclick = () => { state.token = ''; localStorage.removeItem('maalavo_admin_token'); showLogin(); };
  $('refreshOrders').onclick = () => loadOrders().then(loadStats).catch(handleAuthError);
  $('newProduct').onclick = () => openEditor();
  $('closeEditor').onclick = $('cancelEditor').onclick = () => $('productEditor').classList.add('hidden');
  $('productForm').addEventListener('submit', saveProduct);
  document.querySelectorAll('.tab').forEach((tab) => tab.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    tab.classList.add('active');
    $('ordersTab').classList.toggle('hidden', tab.dataset.tab !== 'orders');
    $('productsTab').classList.toggle('hidden', tab.dataset.tab !== 'products');
  });

  if (state.token) {
    $('loginView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    loadAll().catch(handleAuthError);
  }
})();
