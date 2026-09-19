const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const money = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(n) || 0) + ' ₽';

function toast(t) { $('toast').textContent = t; $('toast').classList.add('show'); clearTimeout(window.tt); window.tt = setTimeout(() => $('toast').classList.remove('show'), 1800); }
async function api(url, opt = {}) {
  opt.headers = { ...(opt.headers || {}), 'X-Requested-With': 'XMLHttpRequest' };
  opt.credentials = 'same-origin';
  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Ошибка сервера');
  return d;
}
async function login() {
  try {
    await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('lEmail').value.trim(), password: $('lPass').value }) });
    show();
  } catch (e) { toast(e.message); }
}
async function logout() { try { await api('/api/admin/logout', { method: 'POST' }); } catch {} location.reload(); }
async function show() {
  try { await api('/api/admin/me'); $('login').classList.add('hidden'); $('app').classList.remove('hidden'); await loadAll(); }
  catch { $('app').classList.add('hidden'); $('login').classList.remove('hidden'); }
}
function tab(name, el) {
  document.querySelectorAll('.tab').forEach(x => x.classList.add('hidden'));
  $(name).classList.remove('hidden');
  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
}
async function loadAll() {
  const s = await api('/api/admin/stats');
  $('sUsers').textContent = s.users; $('sProducts').textContent = s.products; $('sOrders').textContent = s.orders;
  $('sRevenue').textContent = money(s.revenue); $('sPending').textContent = s.pending;
  $('pendingPill').textContent = s.pending ? `⏳ ${s.pending} новых заказов` : 'всё обработано';
  renderProducts((await api('/api/admin/products')).products);
  renderOrders((await api('/api/admin/orders')).orders);
  renderUsers((await api('/api/admin/users')).users);
  const a = await api('/api/me').catch(() => null);
  const ab = await fetch('/api/about').then(r => r.json());
  $('aboutTitle').value = ab.title; $('aboutText').value = ab.text; $('aboutUrl').value = ab.supportUrl || '';
}
function renderProducts(list) {
  $('productsList').innerHTML = list.map(p => `<div class="row">
    ${p.image ? `<img class="thumb" src="${esc(p.image)}">` : '<div class="thumb"></div>'}
    <div style="flex:1;min-width:0"><b>${esc(p.name)}</b>
    <div class="meta">${money(p.price)}${p.old_price ? ` · <s>${money(p.old_price)}</s>` : ''} · ${esc(p.category)} · ${esc(p.stock)} · ${p.active ? 'активен' : 'скрыт'}</div></div>
    <div class="actions"><button class="btn" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Изменить</button>
    ${p.active ? `<button class="btn danger" onclick="deleteProduct('${p.id}')">Скрыть</button>`
               : `<button class="btn" onclick="restoreProduct('${p.id}')">Вернуть</button>`}</div></div>`).join('') || '<p style="color:var(--muted)">Товаров нет.</p>';
}
async function uploadImageIfAny(productId) {
  const f = $('pFile').files[0];
  if (!f) return null;
  const fd = new FormData(); fd.append('image', f);
  const d = await api('/api/admin/products/' + encodeURIComponent(productId) + '/image', { method: 'POST', headers: {}, body: fd });
  return d.image;
}
async function addProduct() {
  try {
    const b = { name: $('pName').value, category: $('pCat').value, price: Number($('pPrice').value),
      old_price: $('pOld').value === '' ? null : Number($('pOld').value), tag: $('pTag').value,
      description: $('pDesc').value, image: $('pImage').value, stock: $('pStock').value };
    const d = await api('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    try { const img = await uploadImageIfAny(d.product.id); if (img) { b.image = img; await api('/api/admin/products/' + d.product.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); } } catch (e) { toast('Товар создан, но картинка не загрузилась: ' + e.message); }
    ['pName', 'pPrice', 'pOld', 'pTag', 'pDesc', 'pImage', 'pStock', 'pFile'].forEach(id => $(id).value = '');
    toast('Товар добавлен'); await loadAll();
  } catch (e) { toast(e.message); }
}
function editProduct(p) {
  $('mbox').innerHTML = `<h2>Редактировать товар</h2>
  <div class="form" style="margin-top:14px">
  <div class="field"><label>Название</label><input id="eName" value="${esc(p.name)}"></div>
  <div class="field"><label>Категория</label><input id="eCat" value="${esc(p.category)}"></div>
  <div class="field"><label>Метка</label><input id="eTag" value="${esc(p.tag)}"></div>
  <div class="field"><label>Цена ₽</label><input id="ePrice" type="number" step="0.01" value="${p.price}"></div>
  <div class="field"><label>Старая цена</label><input id="eOld" type="number" step="0.01" value="${p.old_price ?? ''}"></div>
  <div class="field"><label>Наличие</label><input id="eStock" value="${esc(p.stock)}"></div>
  <div class="field full"><label>Описание</label><textarea id="eDesc">${esc(p.description)}</textarea></div>
  <div class="field full"><label>Картинка URL</label><input id="eImage" value="${esc(p.image)}"></div></div>
  <div class="actions"><button class="btn primary" onclick="saveProduct('${p.id}')">Сохранить</button>
  <button class="btn" onclick="$('modal').classList.remove('show')">Отмена</button></div>`;
  $('modal').classList.add('show');
}
async function saveProduct(id) {
  try {
    const b = { name: $('eName').value, category: $('eCat').value, tag: $('eTag').value,
      price: Number($('ePrice').value), old_price: $('eOld').value === '' ? null : Number($('eOld').value),
      description: $('eDesc').value, image: $('eImage').value, stock: $('eStock').value };
    await api('/api/admin/products/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    $('modal').classList.remove('show'); toast('Сохранено'); await loadAll();
  } catch (e) { toast(e.message); }
}
async function deleteProduct(id) { if (!confirm('Скрыть товар из каталога?')) return; try { await api('/api/admin/products/' + id, { method: 'DELETE' }); toast('Скрыт'); await loadAll(); } catch (e) { toast(e.message); } }
async function restoreProduct(id) {
  try { await api('/api/admin/products/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) }); toast('Вернён в каталог'); await loadAll(); } catch (e) { toast(e.message); }
}
function renderOrders(list) {
  const st = { pending: 'Ожидает', paid: 'Оплачен', processing: 'В работе', completed: 'Готов', cancelled: 'Отменён' };
  $('ordersList').innerHTML = list.map(o => `<div class="row"><div style="flex:1;min-width:0">
    <b>${esc(o.id)}</b> · ${money(o.total)}<div class="meta">${esc(o.customer_name || 'Без имени')} ${esc(o.customer_email || '')} ${esc(o.customer_tg)}</div>
    <div class="meta">${new Date(o.created_at).toLocaleString('ru-RU')} · ${o.items.map(i => esc(i.name) + ' × ' + i.qty).join(', ')}</div></div>
    <select onchange="setStatus('${o.id}',this.value)" style="background:#09070d;color:#fff;border:1px solid #352248;border-radius:10px;padding:8px">
    ${Object.entries(st).map(([v, n]) => `<option value="${v}" ${o.status === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('')
    || '<p style="color:var(--muted)">Заказов нет.</p>';
}
async function setStatus(id, status) { try { await api('/api/admin/orders/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); toast('Статус обновлён'); await loadAll(); } catch (e) { toast(e.message); } }
function renderUsers(list) {
  $('usersList').innerHTML = list.map(u => `<div class="row"><div><b>${esc([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Без имени')}</b>
    <div class="meta">ID ${u.id} · ${esc(u.email || '')} · ${u.username ? '@' + esc(u.username) : ''} ${u.telegram_id ? '· TG ' + u.telegram_id : ''} ${u.role === 'admin' ? '· 👑' : ''}</div></div>
    <div><b>${u.orders}</b> заказов<div class="meta">${money(u.spent)}</div></div></div>`).join('') || '<p style="color:var(--muted)">Пользователей нет.</p>';
}
async function saveAbout() {
  try { await api('/api/admin/about', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: $('aboutTitle').value, text: $('aboutText').value, supportUrl: $('aboutUrl').value }) }); toast('Сохранено'); } catch (e) { toast(e.message); }
}
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') $('modal').classList.remove('show'); });
show();