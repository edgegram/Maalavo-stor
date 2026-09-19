(()=>{"use strict";
const CART_KEY="maalavo_cart_v5",FAV_KEY="maalavo_favorites_v5",ORDERS_KEY="maalavo_orders_v5";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],txt=e=>e?.textContent?.trim()||"";
const read=(k)=>{try{const v=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(v)?v:[]}catch{return[]}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let cart=read(CART_KEY),favorites=read(FAV_KEY),currentProduct=null,timer;
function init(){
 const products=$$("#products .product"),categories=$$(".category"),search=$("#searchInput");
 const favPage=$("#favoritesPage"),profilePage=$("#profilePage"),favList=$("#favoritesProducts"),favEmpty=$("#favoritesEmpty"),favSub=$("#favoritesSubtitle"),productPage=$("#productPage");
 const stats=()=>{const a=$("#profileFavoritesCount"),b=$("#profileCartCount");if(a)a.textContent=favorites.length;if(b)b.textContent=cart.length};
 const toast=(a,b="")=>{const t=$("#toast"),x=$("#toastTitle"),y=$("#toastSubtitle");if(!t)return;if(x)x.textContent=a;if(y)y.textContent=b;t.classList.add("show","open","active");clearTimeout(timer);timer=setTimeout(()=>t.classList.remove("show","open","active"),1800)};
 const renderFavorites=()=>{if(!favList)return;favList.innerHTML="";const list=products.filter(p=>favorites.includes(p.dataset.id));list.forEach(p=>{const c=p.cloneNode(true);c.style.display="";favList.appendChild(c)});favList.style.display=list.length?"grid":"none";if(favEmpty)favEmpty.style.display=list.length?"none":"flex";if(favSub)favSub.textContent=list.length?`${list.length} сохранённых товаров`:"Сохранённых товаров пока нет"};
 const sync=()=>{products.forEach(p=>$(".favorite",p)?.classList.toggle("active",favorites.includes(p.dataset.id)));stats();renderFavorites()};
 const filter=()=>{const q=(search?.value||"").trim().toLowerCase(),cat=$(".category.active")?.dataset.category||"all";products.forEach(p=>{const ok=(cat==="all"||p.dataset.category===cat)&&(!q||(p.dataset.search||txt(p)).toLowerCase().includes(q));p.style.display=ok?"":"none"})};
 const screens=(name)=>{favPage?.classList.remove("open");profilePage?.classList.remove("open");favPage?.setAttribute("aria-hidden","true");profilePage?.setAttribute("aria-hidden","true");$("#settingsPage")?.classList.remove("open");$("#settingsPage")?.setAttribute("aria-hidden","true");if(name==="favorites"){favPage?.classList.add("open");favPage?.setAttribute("aria-hidden","false");renderFavorites()}if(name==="profile"){profilePage?.classList.add("open");profilePage?.setAttribute("aria-hidden","false");stats()}if(name==="settings"){$("#settingsPage")?.classList.add("open");$("#settingsPage")?.setAttribute("aria-hidden","false")}};
 const openProduct=p=>{if(!productPage)return;currentProduct=p;const i=$(".product-image img",p),set=(id,v)=>{const e=$(id);if(e)e.textContent=v};const im=$("#productPageImage");if(im)im.src=i?.getAttribute("src")||"";set("#productPageTitle",txt($(".product-title",p)));set("#productPageCategory",txt($(".badge",p)));set("#productPageDescription",p.dataset.fullDescription||txt($(".product-description",p)));set("#productPagePrice",txt($(".price",p)));$("#productPageFavorite")?.classList.toggle("active",favorites.includes(p.dataset.id));productPage.classList.add("open");productPage.setAttribute("aria-hidden","false")};
 const closeProduct=()=>{productPage?.classList.remove("open");productPage?.setAttribute("aria-hidden","true");currentProduct=null};
 const addCart=id=>{if(!id)return;if(cart.includes(id)){toast("Уже в корзине","Этот товар уже добавлен");return}cart.push(id);write(CART_KEY,cart);stats();toast("Добавлено в корзину","Товар сохранён")};
 const toggleFav=id=>{if(favorites.includes(id)){favorites=favorites.filter(x=>x!==id);toast("Удалено из избранного")}else{favorites.push(id);toast("Добавлено в избранное")}write(FAV_KEY,favorites);sync()};
 const modal=(title,body)=>{let m=$("#profileActionModal");if(!m){m=document.createElement("div");m.id="profileActionModal";m.className="profile-modal";m.innerHTML='<div class="profile-modal-card"><div class="profile-modal-top"><h3 class="profile-modal-title"></h3><button class="profile-modal-close" type="button">×</button></div><div class="profile-modal-body"></div></div>';document.body.appendChild(m);m.addEventListener("click",e=>{if(e.target===m)m.classList.remove("open")});$(".profile-modal-close",m).onclick=()=>m.classList.remove("open")}$(".profile-modal-title",m).textContent=title;$(".profile-modal-body",m).innerHTML=body;m.classList.add("open")};
 const cartModal=()=>{if(!cart.length){modal("Корзина",'<div class="profile-modal-empty">Корзина пока пустая.<br>Добавьте товары из каталога.</div>');return}const rows=cart.map(id=>{const p=products.find(x=>x.dataset.id===id);return p?`<div class="profile-modal-row"><strong>${txt($(".product-title",p))}</strong>${txt($(".price",p))}</div>`:""}).join("");modal("Корзина",`<div class="profile-modal-list">${rows}</div><button class="profile-modal-btn" data-order>Оформить заказ</button><button class="profile-modal-btn profile-modal-btn-secondary" data-clear>Очистить корзину</button>`)};
 const ordersModal=()=>{const os=read(ORDERS_KEY);if(!os.length){modal("Мои заказы",'<div class="profile-modal-empty">История заказов пока пустая.</div>');return}modal("Мои заказы",'<div class="profile-modal-list">'+os.slice().reverse().map((o,i)=>`<div class="profile-modal-row"><strong>Заказ #${os.length-i}</strong>${new Date(o.date).toLocaleDateString("ru-RU")} · ${(o.items||[]).length} товар(ов)<br>${(o.items||[]).join(", ")}</div>`).join("")+"</div>")};
 const share=async()=>{try{if(navigator.share){await navigator.share({title:"Maalavo Store",text:"Maalavo Store — цифровые товары и услуги.",url:location.href});return}}catch(e){if(e?.name==="AbortError")return}try{await navigator.clipboard.writeText(location.href);toast("Ссылка скопирована")}catch{modal("Поделиться",'<div class="profile-modal-empty">Ссылка: '+location.href+'</div>')}};
 document.addEventListener("click",e=>{
  const nav=e.target.closest(".nav-item");if(nav){e.preventDefault();$$('.nav-item').forEach(x=>x.classList.toggle('active',x===nav));const page=nav.dataset.page||nav.dataset.nav||"home";if(page==="home")screens("home");else if(page.includes("fav"))screens("favorites");else if(page.includes("profile"))screens("profile");else if(page.includes("settings"))screens("settings");return}
  const cat=e.target.closest(".category");if(cat){$$('.category').forEach(x=>x.classList.remove('active'));cat.classList.add('active');filter();return}
  const fav=e.target.closest(".favorite");if(fav){e.preventDefault();e.stopPropagation();const p=fav.closest('.product');if(p)toggleFav(p.dataset.id);return}
  const cb=e.target.closest('.cart');if(cb){e.preventDefault();e.stopPropagation();const p=cb.closest('.product');if(p)addCart(p.dataset.id);return}
  if(e.target.closest('#productBack')){closeProduct();return}
  if(e.target.closest('#productPageFavorite')){if(currentProduct)toggleFav(currentProduct.dataset.id);return}
  if(e.target.closest('#productPageCart')){if(currentProduct)addCart(currentProduct.dataset.id);return}
  const p=e.target.closest('.product');if(p){openProduct(p);return}
  if(e.target.closest('#profileCartButton')){cartModal();return}
  if(e.target.closest('#profileOrdersButton')){ordersModal();return}
  if(e.target.closest('#profileContactButton')){window.open('https://t.me/maalavo','_blank','noopener,noreferrer');return}
  if(e.target.closest('#profileHelpButton')){modal('Помощь','<div class="profile-modal-list"><div class="profile-modal-row"><strong>Как оформить заказ?</strong>Добавьте товар в корзину и нажмите «Оформить заказ».</div><div class="profile-modal-row"><strong>Нужна помощь?</strong>Нажмите «Связаться», чтобы открыть Telegram.</div></div>');return}
  if(e.target.closest('#profileAboutButton')){modal('О магазине','<div class="profile-modal-row"><strong>Maalavo Store</strong>Магазин цифровых товаров и услуг.</div>');return}
  if(e.target.closest('#profileShareButton')){share();return}
  if(e.target.closest('[data-order]')){const items=cart.map(id=>products.find(p=>p.dataset.id===id)).filter(Boolean).map(p=>txt($('.product-title',p)));const os=read(ORDERS_KEY);os.push({id:'order_'+Date.now(),date:new Date().toISOString(),items});write(ORDERS_KEY,os);window.open('https://t.me/maalavo?text='+encodeURIComponent('Здравствуйте! Хочу оформить заказ в Maalavo Store:\n\n'+items.map(x=>'- '+x).join('\n')),'_blank','noopener,noreferrer');return}
  if(e.target.closest('[data-clear]')){cart=[];write(CART_KEY,cart);stats();$('#profileActionModal')?.classList.remove('open');toast('Корзина очищена');return}
 });
 search?.addEventListener('input',filter);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeProduct();$('#profileActionModal')?.classList.remove('open');$('#legalReader')?.classList.remove('open')}});
 sync();filter();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

(()=>{
"use strict";
const AGREEMENT="";
const PRIVACY="";
function injectLegalStyles(){if(document.getElementById("maalavoLegalStylesLink"))return;const l=document.createElement("link");l.id="maalavoLegalStylesLink";l.rel="stylesheet";l.href="legal.css";document.head.appendChild(l)}
function openLegal(title,text){injectLegalStyles();let r=document.getElementById("legalReader");if(!r){r=document.createElement("section");r.id="legalReader";r.innerHTML='<div class="legal-reader"><div class="legal-reader-top"><button class="legal-back" type="button" data-legal-close>← Назад</button><h2 class="legal-reader-title"></h2></div><div class="legal-reader-body"></div></div>';document.body.appendChild(r);r.addEventListener("click",e=>{if(e.target.closest("[data-legal-close]"))r.classList.remove("open")})}r.querySelector(".legal-reader-title").textContent=title;r.querySelector(".legal-reader-body").textContent=text;r.classList.add("open")}
function ensureSettings(){injectLegalStyles();let p=document.getElementById("settingsPage");if(!p){p=document.createElement("section");p.id="settingsPage";p.setAttribute("aria-hidden","true");p.innerHTML='<div class="legal-settings-scroll"><header class="legal-settings-head"><h1 class="legal-settings-title">Настройки</h1><p class="legal-settings-sub">Параметры и документы Maalavo Store</p></header><button class="legal-setting-item" type="button" data-legal="agreement"><div><strong>Пользовательское соглашение</strong><span>Правила использования Maalavo Store</span></div><b class="legal-arrow">›</b></button><button class="legal-setting-item" type="button" data-legal="privacy"><div><strong>Политика конфиденциальности</strong><span>Обработка и защита пользовательских данных</span></div><b class="legal-arrow">›</b></button></div>';document.body.appendChild(p)}}
document.addEventListener("click",e=>{const item=e.target.closest("[data-legal]");if(item)openLegal(item.dataset.legal==="agreement"?"Пользовательское соглашение":"Политика конфиденциальности",item.dataset.legal==="agreement"?AGREEMENT:PRIVACY)});ensureSettings();
})();