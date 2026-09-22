/* =========================================================
   STORAGE
========================================================= */

const CART_KEY = "maalavo_cart_v5";
const FAV_KEY = "maalavo_favorites_v5";
const ORDERS_KEY = "maalavo_orders_v1";
const DEVICE_ID_KEY = "maalavo_device_id_v1";
const PROFILE_KEY = "maalavo_user";
const API_BASE_URL = String(window.MAALAVO_API_URL || "/api").replace(/\/$/, "");

function getDeviceId(){
    try{
        let id = localStorage.getItem(DEVICE_ID_KEY);
        if(!id){
            id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    }catch(error){
        return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
}

async function apiRequest(path, options = {}){
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try{
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                ...(options.body ? {"Content-Type":"application/json"} : {}),
                ...(options.headers || {})
            },
            signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if(!response.ok){
            throw new Error(payload.error || `Ошибка API: ${response.status}`);
        }
        return payload;
    }finally{
        clearTimeout(timeout);
    }
}

function hasRemoteBackend(){
    return Boolean(API_BASE_URL && API_BASE_URL !== "disabled");
}

async function syncProfileWithBackend(){
    if(!hasRemoteBackend()) return;
    const user = readProfileUser();
    try{
        const payload = await apiRequest("/users/sync", {
            method: "POST",
            body: JSON.stringify({
                deviceId: getDeviceId(),
                telegramId: user.id || null,
                username: user.username || null,
                displayName: user.name || "Гость",
                avatarUrl: user.avatar || null
            })
        });
        if(payload.user){
            const remoteUser = {
                name: payload.user.displayName || user.name || "Гость",
                username: payload.user.username || user.username || "",
                id: payload.user.telegramId || user.id || "",
                accountNumber: payload.user.accountNumber ? String(payload.user.accountNumber) : (user.accountNumber || ""),
                avatar: payload.user.avatarUrl || user.avatar || ""
            };
            localStorage.setItem(PROFILE_KEY, JSON.stringify(remoteUser));
            updateProfileStats();
        }
    }catch(error){
        console.warn("Backend profile sync skipped:", error.message);
    }
}

async function loadRemoteOrders(){
    if(!hasRemoteBackend()) return;
    // Public order history is intentionally not exposed without a user session.
    // The local history remains available in the current browser.
}


/** @param {string} key */
function readStorageArray(key){

    try{

        const value =
            JSON.parse(
                localStorage.getItem(key) || "[]"
            );

        return Array.isArray(value)
            ? value
            : [];

    }catch(error){

        console.error(
            `Не удалось прочитать ${key}:`,
            error
        );

        return [];

    }

}


let cart = readStorageArray(CART_KEY);
let favorites = readStorageArray(FAV_KEY);

// Удаляем устаревший товар аккаунта после обновления каталога.
cart = cart.filter(id => id !== "account");
favorites = favorites.filter(id => id !== "account");
try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
} catch (error) {
    console.warn("Не удалось обновить локальные списки:", error);
}


/* =========================================================
   DOM
========================================================= */

const products = [
    ...document.querySelectorAll(
        "#products .product"
    )
];

const categories = [
    ...document.querySelectorAll(
        ".category"
    )
];

const navItems = [
    ...document.querySelectorAll(
        ".nav-item"
    )
];

const pageScroll =
    document.getElementById(
        "pageScroll"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const favoritesPage =
    document.getElementById(
        "favoritesPage"
    );

const favoritesScroll =
    document.getElementById(
        "favoritesScroll"
    );

const favoritesProducts =
    document.getElementById(
        "favoritesProducts"
    );

const favoritesEmpty =
    document.getElementById(
        "favoritesEmpty"
    );

const favoritesSubtitle =
    document.getElementById(
        "favoritesSubtitle"
    );

const profilePage =
    document.getElementById(
        "profilePage"
    );

const profileScroll =
    document.getElementById(
        "profileScroll"
    );

const profileCartButton =
    document.getElementById(
        "profileCartButton"
    );

const profileCartDescription =
    document.getElementById(
        "profileCartDescription"
    );

const profileDisplayName = document.getElementById("profileDisplayName");
const profileUsername = document.getElementById("profileUsername");
const profileUserId = document.getElementById("profileUserId");
const profileUsernameMeta = document.getElementById("profileUsernameMeta");
const profileAccountNumber = document.getElementById("profileAccountNumber");
const profileAvatar = document.getElementById("profileAvatar");
const profileAvatarImage = document.getElementById("profileAvatarImage");
const profileAvatarFallback = document.getElementById("profileAvatarFallback");

const profileActionCards = [
    ...document.querySelectorAll(
        "[data-profile-screen]"
    )
];

const profileSubpage =
    document.getElementById(
        "profileSubpage"
    );

const profileSubpageScroll =
    document.getElementById(
        "profileSubpageScroll"
    );

const profileSubpageBack =
    document.getElementById(
        "profileSubpageBack"
    );

const profileSubpageTitle =
    document.getElementById(
        "profileSubpageTitle"
    );

const profileSubpageContent =
    document.getElementById(
        "profileSubpageContent"
    );

const settingsPage =
    document.getElementById(
        "settingsPage"
    );

const settingsScroll =
    document.getElementById(
        "settingsScroll"
    );

const settingsActionCards = [
    ...document.querySelectorAll(
        "[data-settings-screen]"
    )
];

const toast =
    document.getElementById(
        "toast"
    );

const toastIcon =
    document.getElementById(
        "toastIcon"
    );

const toastTitle =
    document.getElementById(
        "toastTitle"
    );

const toastSubtitle =
    document.getElementById(
        "toastSubtitle"
    );

const productPage =
    document.getElementById(
        "productPage"
    );

const productPageScroll =
    document.getElementById(
        "productPageScroll"
    );

const productPageImage =
    document.getElementById(
        "productPageImage"
    );

const productPageCategory =
    document.getElementById(
        "productPageCategory"
    );

const productPageTitle =
    document.getElementById(
        "productPageTitle"
    );

const productPageDescription =
    document.getElementById(
        "productPageDescription"
    );

const productPagePrice =
    document.getElementById(
        "productPagePrice"
    );

const productPageCart =
    document.getElementById(
        "productPageCart"
    );

const productPageFavorite =
    document.getElementById(
        "productPageFavorite"
    );

const productBack =
    document.getElementById(
        "productBack"
    );

const checkoutPage = document.getElementById("checkoutPage");
const checkoutScroll = document.getElementById("checkoutScroll");
const checkoutBack = document.getElementById("checkoutBack");
const checkoutItems = document.getElementById("checkoutItems");
const checkoutCount = document.getElementById("checkoutCount");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutName = document.getElementById("checkoutName");
const checkoutTelegram = document.getElementById("checkoutTelegram");
const checkoutComment = document.getElementById("checkoutComment");
const checkoutSubmit = document.getElementById("checkoutSubmit");
const checkoutError = document.getElementById("checkoutError");


let currentProduct = null;
let currentProfileScreen = null;
let toastTimer = null;
let touchStartX = 0;
let touchStartY = 0;


/* =========================================================
   TOAST ICONS
========================================================= */

const toastIcons = {

    favoriteAdd: `
        <svg viewBox="0 0 24 24">
            <path d="M20.8 8.9c0 5.5-8.8 10.3-8.8 10.3S3.2 14.4 3.2 8.9A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.8Z"/>
        </svg>
    `,

    favoriteRemove: `
        <svg viewBox="0 0 24 24">
            <path d="M20.8 8.9c0 5.5-8.8 10.3-8.8 10.3S3.2 14.4 3.2 8.9A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.8Z"/>
        </svg>
    `,

    cartAdd: `
        <svg viewBox="0 0 24 24">
            <path d="M6 7h12l1 13H5L6 7Z"/>
            <path d="M9 7a3 3 0 0 1 6 0"/>
        </svg>
    `,

    cartExists: `
        <svg viewBox="0 0 24 24">
            <path d="m5 12 4 4L19 6"/>
        </svg>
    `,

    settings: `
        <svg viewBox="0 0 24 24">
            <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/>
            <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06-1.82 1.82-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65V20h-2.58v-.09a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.06.06-1.82-1.82.06-.06A1.8 1.8 0 0 0 5.4 15a1.8 1.8 0 0 0-1.65-1.08H3.66v-2.58h.09A1.8 1.8 0 0 0 5.4 10.26a1.8 1.8 0 0 0-.36-1.98l-.06-.06L6.8 6.4l.06.06a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 9.92 5.17V5h2.58v.17a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.06-.06 1.82 1.82-.06.06a1.8 1.8 0 0 0 1.65 1.08h.09v2.58h-.09A1.8 1.8 0 0 0 19.4 15Z"/>
        </svg>
    `

};


/* =========================================================
   SAVE STORAGE
========================================================= */

function saveCart(){

    try{

        localStorage.setItem(
            CART_KEY,
            JSON.stringify(cart)
        );

    }catch(error){

        console.error(
            "Не удалось сохранить корзину:",
            error
        );

        showToast(
            "storageError"
        );

    }

}


function saveFavorites(){

    try{

        localStorage.setItem(
            FAV_KEY,
            JSON.stringify(favorites)
        );

    }catch(error){

        console.error(
            "Не удалось сохранить избранное:",
            error
        );

        showToast(
            "storageError"
        );

    }

}


/* =========================================================
   FAVORITES
========================================================= */

function renderFavorites(){

    favoritesProducts.innerHTML = "";

    const favoriteProducts =
        products.filter(
            product =>
                favorites.includes(
                    product.dataset.id
                )
        );


    favoriteProducts.forEach(
        product => {

            const clone =
                product.cloneNode(true);

            clone.style.display = "";

            favoritesProducts.appendChild(
                clone
            );

        }
    );


    if(
        favoriteProducts.length === 0
    ){

        favoritesProducts.style.display =
            "none";

        favoritesEmpty.style.display =
            "flex";

        favoritesSubtitle.textContent =
            "Сохранённых товаров пока нет";

    }else{

        favoritesProducts.style.display =
            "grid";

        favoritesEmpty.style.display =
            "none";

        const count =
            favoriteProducts.length;

        favoritesSubtitle.textContent =
            count === 1
                ? "1 сохранённый товар"
                : count < 5
                    ? `${count} сохранённых товара`
                    : `${count} сохранённых товаров`;

    }

    updateProfileStats();

}


function syncFavorites(){

    products.forEach(
        product => {

            const id =
                product.dataset.id;

            const button =
                product.querySelector(
                    ".favorite"
                );

            if(button){

                button.classList.toggle(
                    "active",
                    favorites.includes(id)
                );

            }

        }
    );


    if(currentProduct){

        productPageFavorite.classList.toggle(
            "active",
            favorites.includes(
                currentProduct.dataset.id
            )
        );

    }


    renderFavorites();

}


/* =========================================================
   PROFILE STATS
========================================================= */

function readProfileUser(){
    const candidates = [];

    try {
        const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if(telegramUser && typeof telegramUser === "object"){
            candidates.push(telegramUser);
        }
    } catch(error) {
        console.warn("Не удалось прочитать Telegram WebApp user:", error);
    }

    for(const key of ["maalavo_user", "maalavo_profile", "user_profile"]){
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            if(value && typeof value === "object"){
                candidates.push(value);
            }
        } catch(error) {
            console.warn(`Не удалось прочитать профиль ${key}:`, error);
        }
    }

    for(const globalName of ["MaalavoUser", "currentUser", "user"]){
        try {
            const value = window[globalName];
            if(value && typeof value === "object"){
                candidates.push(value);
            }
        } catch(error) {
            console.warn(`Не удалось прочитать ${globalName}:`, error);
        }
    }

    const source = candidates.find(item =>
        item && (item.id !== undefined || item.user_id !== undefined || item.username || item.first_name || item.name || item.photo_url || item.avatar)
    ) || {};

    const firstName = String(source.first_name || "").trim();
    const lastName = String(source.last_name || "").trim();
    const nameFromParts = [firstName, lastName].filter(Boolean).join(" ");
    const name = String(source.name || source.display_name || source.nickname || nameFromParts || source.username || "Гость").trim();
    const usernameRaw = String(source.username || source.user_name || "").trim().replace(/^@/, "");
    const id = source.id ?? source.user_id ?? source.telegram_id ?? "";
    const accountNumber = source.account_number ?? source.accountNumber ?? source.bot_account_number ?? source.botAccountNumber ?? source.registration_number ?? source.registrationNumber ?? "";
    const avatar = String(source.photo_url || source.avatar_url || source.avatar || source.photo || "").trim();

    return {
        name: name || "Гость",
        username: usernameRaw,
        id: id === "" || id === null ? "" : String(id),
        accountNumber: accountNumber === "" || accountNumber === null ? "" : String(accountNumber),
        avatar
    };
}

function getProfileInitials(name){
    const words = String(name || "Гость").trim().split(/\s+/).filter(Boolean);
    if(!words.length){
        return "M";
    }
    if(words.length === 1){
        return words[0].slice(0, 1).toUpperCase();
    }
    return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

function updateProfileUserCard(){
    if(!profileDisplayName || !profileUsername || !profileUserId || !profileUsernameMeta || !profileAccountNumber){
        return;
    }

    const user = readProfileUser();
    const hasUsername = Boolean(user.username);
    const hasId = Boolean(user.id);
    const hasAccountNumber = Boolean(user.accountNumber);

    profileDisplayName.textContent = user.name;
    profileUsername.textContent = hasUsername ? `@${user.username}` : "@не указан";
    profileUserId.textContent = hasId ? user.id : "Не подключён";
    profileUsernameMeta.textContent = hasUsername ? `@${user.username}` : "Не указан";
    profileAccountNumber.textContent = hasAccountNumber ? `#${user.accountNumber.replace(/^#/, "")}` : "—";

    if(profileAvatarFallback){
        profileAvatarFallback.textContent = getProfileInitials(user.name);
    }

    if(profileAvatarImage){
        if(user.avatar){
            profileAvatarImage.src = user.avatar;
            profileAvatarImage.alt = `Аватар ${user.name}`;
            profileAvatarImage.hidden = false;
            profileAvatarImage.onerror = () => {
                profileAvatarImage.hidden = true;
                profileAvatarImage.removeAttribute("src");
            };
        }else{
            profileAvatarImage.hidden = true;
            profileAvatarImage.removeAttribute("src");
        }
    }
}

function updateProfileStats(){
    updateProfileUserCard();

    if(profileCartDescription){
        const count = cart.length;
        profileCartDescription.textContent =
            count === 0
                ? "Корзина пуста"
                : `${count} ${count === 1 ? "товар" : count < 5 ? "товара" : "товаров"}`;
    }

}


/* =========================================================
   OPEN PRODUCT
========================================================= */

/** @param {HTMLElement|null} product */
function openProduct(product){

    if(!product){
        return;
    }

    currentProduct = product;

    const image =
        product.querySelector(
            ".product-image img"
        );

    const title =
        product.querySelector(
            ".product-title"
        );

    const badge =
        product.querySelector(
            ".badge"
        );

    const price =
        product.querySelector(
            ".price"
        );


    productPageImage.src =
        image?.src || "";

    productPageImage.alt =
        title?.textContent.trim() || "";


    productPageTitle.textContent =
        title?.textContent.trim() || "";


    productPageCategory.textContent =
        badge?.textContent.trim() || "";


    productPageDescription.textContent =
        product.dataset.fullDescription ||
        product.querySelector(
            ".product-description"
        )?.textContent.trim() ||
        "";


    productPagePrice.textContent =
        price?.textContent.trim() || "";


    productPageFavorite.classList.toggle(
        "active",
        favorites.includes(
            product.dataset.id
        )
    );


    productPageScroll.scrollTop = 0;

    document.body.style.overflow = "hidden";

    pageScroll.style.pointerEvents = "none";

    favoritesPage.style.pointerEvents = "none";

    profilePage.style.pointerEvents = "none";

    document.querySelector(
        ".bottom-nav"
    ).style.pointerEvents = "none";


    productPage.classList.add(
        "open"
    );

    productPage.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================================================
   CLOSE PRODUCT
========================================================= */

function closeProduct(){

    productPage.classList.remove(
        "open"
    );

    productPage.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

    pageScroll.style.pointerEvents = "";

    favoritesPage.style.pointerEvents = "";

    profilePage.style.pointerEvents = "";

    document.querySelector(
        ".bottom-nav"
    ).style.pointerEvents = "";

    currentProduct = null;

}


/* =========================================================
   PRODUCT CLICK
========================================================= */

document.addEventListener(
    "click",
    event => {

        const product =
            event.target.closest(
                ".product"
            );

        if(!product){
            return;
        }

        if(
            event.target.closest(
                ".favorite"
            ) ||
            event.target.closest(
                ".cart"
            )
        ){
            return;
        }

        openProduct(product);

    }
);


/* =========================================================
   PRODUCT BACK
========================================================= */

productBack.addEventListener(
    "click",
    closeProduct
);


/* =========================================================
   ESC
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if(event.key === "Escape" && checkoutPage.classList.contains("open")){
            closeCheckout();
            return;
        }

        if(
            event.key === "Escape" &&
            productPage.classList.contains(
                "open"
            )
        ){

            closeProduct();

        }

    }
);


/* =========================================================
   SWIPE BACK
========================================================= */

productPage.addEventListener(
    "touchstart",
    event => {

        if(
            !productPage.classList.contains(
                "open"
            )
        ){
            return;
        }

        const touch =
            event.touches[0];

        touchStartX =
            touch.clientX;

        touchStartY =
            touch.clientY;

    },
    {
        passive:true
    }
);


productPage.addEventListener(
    "touchend",
    event => {

        if(
            !productPage.classList.contains(
                "open"
            )
        ){
            return;
        }

        const touch =
            event.changedTouches[0];

        const deltaX =
            touch.clientX - touchStartX;

        const deltaY =
            touch.clientY - touchStartY;


        if(
            deltaX > 100 &&
            Math.abs(deltaX) >
            Math.abs(deltaY) * 1.35
        ){

            closeProduct();

        }

    },
    {
        passive:true
    }
);


/* =========================================================
   PRODUCT FAVORITE
========================================================= */

productPageFavorite.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        if(!currentProduct){
            return;
        }

        toggleFavorite(
            currentProduct.dataset.id
        );

    }
);


/* =========================================================
   TOGGLE FAVORITE
========================================================= */

/** @param {string|undefined} id */
function toggleFavorite(id){

    if(!id){
        return;
    }


    if(
        favorites.includes(id)
    ){

        favorites =
            favorites.filter(
                item => item !== id
            );

        showToast(
            "favoriteRemove"
        );

    }else{

        favorites.push(id);

        showToast(
            "favoriteAdd"
        );

    }


    saveFavorites();

    syncFavorites();

}


/* =========================================================
   FAVORITE CLICK
========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".favorite"
            );

        if(!button){
            return;
        }

        const product =
            button.closest(
                ".product"
            );

        if(!product){
            return;
        }

        toggleFavorite(
            product.dataset.id
        );

    }
);


/* =========================================================
   ADD CART
========================================================= */

/** @param {string|undefined} id */
function addToCart(id){

    if(!id){
        return;
    }


    if(
        !cart.includes(id)
    ){

        cart.push(id);

        saveCart();

        showToast(
            "cartAdd"
        );

    }else{

        showToast(
            "cartExists"
        );

    }


    updateProfileStats();

}


/* =========================================================
   CART CARD CLICK
========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".cart"
            );

        if(!button){
            return;
        }

        const product =
            button.closest(
                ".product"
            );

        if(!product){
            return;
        }

        addToCart(
            product.dataset.id
        );

    }
);


/* =========================================================
   PRODUCT PAGE CART
========================================================= */

productPageCart.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        if(!currentProduct){
            return;
        }

        addToCart(
            currentProduct.dataset.id
        );

    }
);


checkoutBack.addEventListener("click", closeCheckout);

checkoutItems.addEventListener("click", event => {
    const item = event.target.closest("[data-checkout-product]");
    if(!item) return;
    const product = products.find(productItem => productItem.dataset.id === item.dataset.checkoutProduct);
    if(!product) return;
    closeCheckout();
    openProduct(product);
});

checkoutSubmit.addEventListener("click", async () => {
    const items = getCartProducts();
    if(!items.length){
        closeCheckout();
        showToast("cartEmpty");
        return;
    }

    const name = checkoutName.value.trim();
    const telegram = checkoutTelegram.value.trim();
    const comment = checkoutComment.value.trim();

    if(name.length < 2){
        checkoutError.hidden = false;
        checkoutError.textContent = "Укажите имя, чтобы оформить заказ.";
        checkoutName.focus();
        return;
    }

    if(!telegram){
        checkoutError.hidden = false;
        checkoutError.textContent = "Укажите Telegram для связи по заказу.";
        checkoutTelegram.focus();
        return;
    }

    const localItems = items.map(product => ({
        id: product.dataset.id,
        title: product.querySelector(".product-title")?.textContent.trim() || "Товар",
        price: product.querySelector(".price")?.textContent.trim() || "Цена по запросу"
    }));
    let order;

    checkoutSubmit.disabled = true;
    checkoutError.hidden = true;

    try{
        if(hasRemoteBackend()){
            const payload = await apiRequest("/orders", {
                method: "POST",
                body: JSON.stringify({
                    deviceId: getDeviceId(),
                    name,
                    telegram,
                    comment,
                    items: items.map(product => ({ id: product.dataset.id, quantity: 1 }))
                })
            });
            const remote = payload.order;
            order = {
                id: remote.publicId,
                createdAt: remote.createdAt || new Date().toISOString(),
                status: remote.status === "new" ? "Новый" : remote.status,
                name,
                telegram,
                comment,
                total: Number(remote.totalFrom || getCartTotal()),
                items: localItems
            };
        }else{
            order = {
                id: String(Date.now()).slice(-6),
                createdAt: new Date().toISOString(),
                status: "Новый",
                name, telegram, comment, total: getCartTotal(), items: localItems
            };
        }
    }catch(error){
        checkoutError.hidden = false;
        checkoutError.textContent = `Не удалось отправить заказ на сервер: ${error.message}`;
        return;
    }finally{
        checkoutSubmit.disabled = false;
    }

    const orders = readOrders();
    if(!saveOrders([order, ...orders])) return;

    cart = [];
    saveCart();
    updateProfileStats();
    renderProfileScreen("orders");

    const message = [
        `Новый заказ #${order.id}`,
        `Имя: ${name}`,
        `Telegram: ${telegram}`,
        "",
        "Товары:",
        ...order.items.map(item => `• ${item.title} — ${item.price}`),
        `Итого от: ${formatRubles(order.total)}`,
        comment ? `Комментарий: ${comment}` : ""
    ].filter(Boolean).join("\n");

    const telegramUrl = `https://t.me/maalavo?text=${encodeURIComponent(message)}`;
    closeCheckout();
    showToast("orderCreated");
    window.open(telegramUrl, "_blank", "noopener,noreferrer");
});

/* =========================================================
   SEARCH
========================================================= */

searchInput.addEventListener(
    "input",
    filterProducts
);


/* =========================================================
   CATEGORIES
========================================================= */

categories.forEach(
    category => {

        category.addEventListener(
            "click",
            () => {

                categories.forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                category.classList.add(
                    "active"
                );


                filterProducts();


                pageScroll.scrollTo({
                    top:0,
                    behavior:"smooth"
                });

            }
        );

    }
);


/* =========================================================
   FILTER
========================================================= */

function filterProducts(){

    const query =
        searchInput.value
            .trim()
            .toLowerCase();


    const activeCategory =
        document.querySelector(
            ".category.active"
        )?.dataset.category ||
        "all";


    products.forEach(
        product => {

            const category =
                product.dataset.category;

            const text =
                (
                    product.dataset.search ||
                    ""
                ).toLowerCase();


            const categoryMatch =
                activeCategory === "all" ||
                category === activeCategory;


            const searchMatch =
                !query ||
                text.includes(query);


            product.style.display =
                categoryMatch &&
                searchMatch
                    ? ""
                    : "none";

        }
    );

}


/* =========================================================
   NAV STATE
========================================================= */

/** @param {string|undefined} page */
function setActiveNav(page){

    navItems.forEach(
        item => {

            item.classList.toggle(
                "active",
                item.dataset.page === page
            );

        }
    );

}


/* =========================================================
   SHOW HOME
========================================================= */

function showHome(){

    favoritesPage.classList.remove(
        "open"
    );

    favoritesPage.setAttribute(
        "aria-hidden",
        "true"
    );


    profilePage.classList.remove(
        "open"
    );

    profilePage.setAttribute(
        "aria-hidden",
        "true"
    );

    settingsPage.classList.remove("open");
    settingsPage.setAttribute("aria-hidden", "true");


    pageScroll.style.display =
        "block";

    pageScroll.style.pointerEvents =
        "";


    favoritesPage.style.pointerEvents =
        "";

    profilePage.style.pointerEvents =
        "";

}


/* =========================================================
   SHOW FAVORITES
========================================================= */

function showFavorites(){

    renderFavorites();


    pageScroll.style.display =
        "none";


    profilePage.classList.remove(
        "open"
    );

    profilePage.setAttribute(
        "aria-hidden",
        "true"
    );

    settingsPage.classList.remove("open");
    settingsPage.setAttribute("aria-hidden", "true");


    favoritesPage.classList.add(
        "open"
    );

    favoritesPage.setAttribute(
        "aria-hidden",
        "false"
    );


    favoritesPage.style.pointerEvents =
        "";

    profilePage.style.pointerEvents =
        "none";


    favoritesScroll.scrollTo({
        top:0,
        behavior:"smooth"
    });

}


/* =========================================================
   SHOW PROFILE
========================================================= */

function showProfile(){

    updateProfileStats();


    pageScroll.style.display =
        "none";


    favoritesPage.classList.remove(
        "open"
    );

    favoritesPage.setAttribute(
        "aria-hidden",
        "true"
    );


    profilePage.classList.add(
        "open"
    );

    profilePage.setAttribute(
        "aria-hidden",
        "false"
    );

    settingsPage.classList.remove("open");
    settingsPage.setAttribute("aria-hidden", "true");


    profilePage.style.pointerEvents =
        "";

    favoritesPage.style.pointerEvents =
        "none";


    profileScroll.scrollTo({
        top:0,
        behavior:"smooth"
    });

}



/* =========================================================
   SHOW SETTINGS
========================================================= */

function showSettings(){
    pageScroll.style.display = "none";
    favoritesPage.classList.remove("open");
    favoritesPage.setAttribute("aria-hidden", "true");
    profilePage.classList.remove("open");
    profilePage.setAttribute("aria-hidden", "true");
    settingsPage.classList.add("open");
    settingsPage.setAttribute("aria-hidden", "false");
    settingsScroll.scrollTo({top:0, behavior:"smooth"});
}


/* =========================================================
   OPEN TELEGRAM
========================================================= */

function openTelegram(){

    window.open(
        "https://t.me/maalavo",
        "_blank",
        "noopener,noreferrer"
    );

}


/* =========================================================
   PROFILE FULLSCREEN SCREENS
========================================================= */

const SETTINGS_KEY = "maalavo_settings_v2";

const defaultSettings = {
    orderNotifications: true,
    storeNotifications: true,
    reducedMotion: false,
    largeText: false
};

function readSettings(){
    try{
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
        return {...defaultSettings, ...(saved && typeof saved === "object" ? saved : {})};
    }catch(error){
        console.error("Не удалось прочитать настройки:", error);
        return {...defaultSettings};
    }
}

let settingsState = readSettings();

function saveSettings(){
    try{
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsState));
    }catch(error){
        console.error("Не удалось сохранить настройки:", error);
    }
}

function applySettings(){
    document.body.classList.toggle("settings-reduced-motion", settingsState.reducedMotion);
    document.body.classList.toggle("settings-large-text", settingsState.largeText);
}

function toggleSetting(key){
    if(!(key in settingsState)){
        return;
    }
    settingsState[key] = !settingsState[key];
    saveSettings();
    applySettings();
}

function clearLocalData(mode){
    if(mode === "cart" || mode === "all"){
        cart = [];
        saveCart();
    }

    if(mode === "favorites" || mode === "all"){
        favorites = [];
        saveFavorites();
        syncFavorites();
    }

    updateProfileStats();
    renderProfileScreen("storage");
    showToast("storageCleared");
}

const profileScreenData = {
    cart: {title: "Корзина"},
    orders: {title: "Мои заказы"},
    purchases: {title: "Покупки"},
    notifications: {title: "Уведомления"},
    messages: {title: "Сообщения"},
    services: {title: "Мои услуги"},
    materials: {title: "Материалы"},
    status: {title: "Статус заказа"},
    feedback: {title: "Оценить заказ"},
    appearance: {title: "Внешний вид"},
    notificationsSettings: {title: "Уведомления"},
    privacy: {title: "Приватность"},
    storage: {title: "Данные"},
    accessibility: {title: "Доступность"},
    support: {title: "Поддержка"},
    help: {title: "Помощь"},
    aboutProject: {title: "О проекте"},
    userAgreement: {title: "Пользовательское соглашение"},
    privacyPolicy: {title: "Политика конфиденциальности"}
};

const settingIcon = {
    appearance: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
    notification: `<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>`,
    privacy: `<svg viewBox="0 0 24 24"><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
    data: `<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>`,
    accessibility: `<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><path d="M5 8h14M12 8v12M8 20l4-6 4 6"/></svg>`,
    support: `<svg viewBox="0 0 24 24"><path d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-3v-6h5"/><path d="M4 13v6h3v-6H4Z"/><path d="M12 19h3"/></svg>`,
    help: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.1 1.9c-1.2.9-1.8 1.3-1.8 2.6"/><path d="M12 17.2v.1"/></svg>`,
    about: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7.5v.1"/></svg>`
};

function settingRow(label, description, key, icon){
    const enabled = Boolean(settingsState[key]);
    return `
        <button class="profile-screen-row setting-toggle-row" type="button" data-setting-toggle="${escapeHtml(key)}" aria-pressed="${enabled}">
            <span class="profile-screen-row-icon">${icon}</span>
            <span class="profile-screen-row-copy"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span>
            <span class="settings-switch ${enabled ? "active" : ""}" aria-hidden="true"><span></span></span>
        </button>
    `;
}

function actionRow(label, description, action, danger = false){
    return `
        <button class="profile-screen-row settings-action-row ${danger ? "danger" : ""}" type="button" data-settings-action="${escapeHtml(action)}">
            <span class="profile-screen-row-copy"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span>
            <span class="profile-action-arrow"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span>
        </button>
    `;
}

function readOrders(){
    try{
        const value = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
        return Array.isArray(value) ? value : [];
    }catch(error){
        console.error("Не удалось прочитать заказы:", error);
        return [];
    }
}

function saveOrders(orders){
    try{
        localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
        return true;
    }catch(error){
        console.error("Не удалось сохранить заказ:", error);
        showToast("storageError");
        return false;
    }
}

function formatOrderDate(value){
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return "Дата не указана";
    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    }).format(date);
}

function parsePrice(text){
    const match = String(text || "").replace(/\s/g, "").match(/([0-9]+(?:[.,][0-9]+)?)/);
    if(!match) return 0;
    const value = Number(match[1].replace(",", "."));
    return Number.isFinite(value) ? value : 0;
}

function formatRubles(value){
    return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function getCartProducts(){
    return cart.map(id => products.find(product => product.dataset.id === id)).filter(Boolean);
}

function getCartTotal(){
    return getCartProducts().reduce((sum, product) => {
        const price = product.querySelector(".price")?.textContent || "";
        return sum + parsePrice(price);
    }, 0);
}

function openCheckout(){
    const items = getCartProducts();
    if(items.length === 0){
        showToast("cartEmpty");
        return;
    }

    renderCheckout();
    checkoutPage.classList.add("open");
    checkoutPage.setAttribute("aria-hidden", "false");
    checkoutScroll.scrollTop = 0;
    document.body.style.overflow = "hidden";
}

function closeCheckout(){
    checkoutPage.classList.remove("open");
    checkoutPage.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function renderCheckout(){
    const items = getCartProducts();
    const total = getCartTotal();
    checkoutCount.textContent = `${items.length} ${items.length === 1 ? "товар" : items.length < 5 ? "товара" : "товаров"}`;
    checkoutTotal.textContent = `от ${formatRubles(total)}`;
    checkoutItems.innerHTML = items.map(product => {
        const id = product.dataset.id || "";
        const title = product.querySelector(".product-title")?.textContent.trim() || "Товар";
        const price = product.querySelector(".price")?.textContent.trim() || "Цена по запросу";
        const image = product.querySelector(".product-image img")?.getAttribute("src") || "";
        return `<button class="checkout-item" type="button" data-checkout-product="${escapeHtml(id)}">
            <img src="${escapeHtml(image)}" alt="">
            <span class="checkout-item-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(price)}</small></span>
            <span class="checkout-item-arrow">›</span>
        </button>`;
    }).join("");
    checkoutError.hidden = true;
    checkoutError.textContent = "";
}

function renderOrders(){
    const orders = readOrders();
    if(!orders.length){
        return {
            icon: `<svg viewBox="0 0 24 24"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
            heading: "Здесь появятся ваши заказы",
            text: "После оформления первого заказа история будет доступна на этом экране."
        };
    }
    const rows = orders.map(order => {
        const names = Array.isArray(order.items) ? order.items.map(item => item.title).slice(0, 2) : [];
        const extra = Array.isArray(order.items) && order.items.length > 2 ? ` + ещё ${order.items.length - 2}` : "";
        return `<div class="profile-screen-row order-row">
            <span class="profile-screen-row-icon">${toastIcons.cartAdd}</span>
            <span class="profile-screen-row-copy"><strong>Заказ #${escapeHtml(order.id)}</strong><small>${escapeHtml(names.join(", ") + extra)} · ${escapeHtml(formatOrderDate(order.createdAt))}</small></span>
            <span class="order-status">${escapeHtml(order.status || "Новый")}</span>
        </div>`;
    }).join("");
    return {
        icon: toastIcons.cartAdd,
        heading: "История заказов",
        text: "Оформленные заказы сохраняются на этом устройстве.",
        rowsMarkup: rows
    };
}

function renderPurchases(){
    const orders = readOrders();
    if(!orders.length){
        return {
            icon: `<svg viewBox="0 0 24 24"><path d="M5 8h14v11H5z"/><path d="M8 8a4 4 0 0 1 8 0"/><path d="M9 13h6"/></svg>`,
            heading: "Покупки ещё не оформлялись",
            text: "После оформления заказа информация о покупке появится здесь."
        };
    }
    return {
        icon: toastIcons.cartAdd,
        heading: `${orders.length} оформленных ${orders.length === 1 ? "заказ" : "заказа"}`,
        text: "Здесь отображается история созданных заказов.",
        rowsMarkup: orders.map(order => `<div class="profile-screen-row order-row"><span class="profile-screen-row-icon">${toastIcons.cartAdd}</span><span class="profile-screen-row-copy"><strong>Заказ #${escapeHtml(order.id)}</strong><small>${escapeHtml(formatOrderDate(order.createdAt))}</small></span><span class="order-status">${escapeHtml(order.status || "Новый")}</span></div>`).join("")
    };
}

function renderProfileScreen(type){
    if(!profileSubpageContent){
        return;
    }

    if(type === "cart"){
        const items = cart.map(id => products.find(product => product.dataset.id === id)).filter(Boolean);
        if(items.length === 0){
            profileSubpageContent.innerHTML = `
                <div class="profile-screen-hero">
                    <div class="profile-screen-icon">${toastIcons.cartAdd}</div>
                    <h2>Корзина пока пустая</h2>
                    <p>Добавьте товар из каталога — он появится здесь.</p>
                    <button class="profile-screen-button" type="button" data-profile-go-home>Перейти в каталог</button>
                </div>`;
            return;
        }
        const productsMarkup = items.map(product => {
            const id = product.dataset.id || "";
            const title = product.querySelector(".product-title")?.textContent?.trim() || "Товар";
            const price = product.querySelector(".price")?.textContent?.trim() || "Цена по запросу";
            const image = product.querySelector(".product-image img")?.getAttribute("src") || "";
            return `<button class="profile-cart-product" type="button" data-cart-product="${escapeHtml(id)}"><img src="${escapeHtml(image)}" alt=""><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(price)}</small></span><span class="profile-action-arrow"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></button>`;
        }).join("");
        profileSubpageContent.innerHTML = `
            <div class="profile-screen-hero"><div class="profile-screen-icon">${toastIcons.cartAdd}</div><h2>${items.length} ${items.length === 1 ? "товар" : items.length < 5 ? "товара" : "товаров"}</h2><p>Откройте товар, проверьте детали и оформите заказ.</p></div>
            <div class="profile-screen-list">${productsMarkup}</div>
            <button class="profile-screen-button cart-checkout-button" type="button" data-open-checkout>Оформить заказ <span>→</span></button>`;
        return;
    }

    const content = {
        orders: renderOrders(),
        purchases: renderPurchases(),
        notifications: {
            icon: settingIcon.notification,
            heading: "Новых уведомлений нет",
            text: "Здесь будут статусы заказов, важные обновления и сообщения магазина."
        },
        messages: {
            icon: `<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 3V5Z"/><path d="M8 9h8M8 12h5"/></svg>`,
            heading: "Сообщения по заказам",
            text: "Здесь будут отображаться ответы и сообщения, связанные с вашими заказами."
        },
        services: {
            icon: `<svg viewBox="0 0 24 24"><path d="M5 7h14v12H5z"/><path d="M8 7V5h8v2M9 11h6M9 15h4"/></svg>`,
            heading: "Мои услуги",
            text: "Здесь будут отображаться заявки на разработку сайтов, веб-приложений, интеграций и других цифровых решений."
        },
        materials: {
            icon: `<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h4"/></svg>`,
            heading: "Материалы заказов",
            text: "Файлы и результаты выполненных заказов будут собираться здесь."
        },
        status: {
            icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>`,
            heading: "Статус заказа",
            text: "Когда появится оформленный заказ, здесь можно будет быстро посмотреть его текущий статус."
        },
        feedback: {
            icon: `<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>`,
            heading: "Оценка заказа",
            text: "После завершения заказа здесь можно будет оставить оценку и короткий отзыв."
        },
        appearance: {
            icon: settingIcon.appearance,
            heading: "Настрой интерфейс под себя",
            text: "Основная тема магазина остаётся тёмной, а эти параметры управляют удобством интерфейса.",
            rowsMarkup: settingRow("Плавность интерфейса", "Убрать анимации и переходы", "reducedMotion", settingIcon.appearance) + settingRow("Крупный текст", "Увеличить основной текст интерфейса", "largeText", settingIcon.about)
        },
        notificationsSettings: {
            icon: settingIcon.notification,
            heading: "Управление уведомлениями",
            text: "Эти параметры определяют, какие события приложение будет показывать в интерфейсе.",
            rowsMarkup: settingRow("Статусы заказов", "Изменения по оформленным заказам", "orderNotifications", settingIcon.notification) + settingRow("Обновления магазина", "Новости, новые товары и изменения сервиса", "storeNotifications", settingIcon.notification)
        },
        privacy: {
            icon: settingIcon.privacy,
            heading: "Приватность без лишнего",
            text: "Магазин работает без обязательной регистрации. Корзина, избранное и параметры интерфейса сохраняются локально в браузере этого устройства.",
            rowsMarkup: `<div class="profile-screen-row"><span class="profile-screen-row-icon">${settingIcon.privacy}</span><span class="profile-screen-row-copy"><strong>Локальное хранение</strong><small>Данные интерфейса не требуют аккаунта и синхронизации между устройствами.</small></span></div><div class="profile-screen-row"><span class="profile-screen-row-icon">${settingIcon.data}</span><span class="profile-screen-row-copy"><strong>Что хранится</strong><small>Корзина, избранное и настройки приложения.</small></span></div>`
        },
        storage: {
            icon: settingIcon.data,
            heading: "Управление локальными данными",
            text: "Здесь можно посмотреть состояние корзины и избранного или очистить их без удаления самого приложения.",
            rowsMarkup: `<div class="profile-screen-row"><span class="profile-screen-row-icon">${settingIcon.data}</span><span class="profile-screen-row-copy"><strong>Корзина</strong><small>${cart.length} ${cart.length === 1 ? "товар" : cart.length < 5 ? "товара" : "товаров"} сохранено</small></span></div><div class="profile-screen-row"><span class="profile-screen-row-icon">${settingIcon.privacy}</span><span class="profile-screen-row-copy"><strong>Избранное</strong><small>${favorites.length} ${favorites.length === 1 ? "товар" : favorites.length < 5 ? "товара" : "товаров"} сохранено</small></span></div>` + actionRow("Очистить корзину", "Удалить только сохранённые товары из корзины", "clearCart", true) + actionRow("Очистить избранное", "Удалить сохранённые товары из избранного", "clearFavorites", true) + actionRow("Очистить все локальные данные", "Корзина, избранное и настройки интерфейса", "clearAll", true)
        },
        accessibility: {
            icon: settingIcon.accessibility,
            heading: "Удобство использования",
            text: "Параметры сделаны для телефона: можно уменьшить движение интерфейса и увеличить текст, не меняя структуру магазина.",
            rowsMarkup: settingRow("Уменьшить движение", "Отключить анимации и переходы", "reducedMotion", settingIcon.accessibility) + settingRow("Крупный текст", "Увеличить текст карточек и экранов", "largeText", settingIcon.about)
        },
        support: {
            icon: settingIcon.support,
            heading: "Поддержка Maalavo",
            text: "Выберите, с чем нужна помощь. После выбора откроется действие для связи с Maalavo.",
            rowsMarkup: `
                <div class="settings-choice-grid" aria-label="Тема обращения">
                    <button class="settings-choice-card" type="button" data-support-topic="Заказ" aria-pressed="false">
                        <span class="settings-choice-icon">${settingIcon.data}</span>
                        <span><strong>Заказ</strong><small>Оформление и статус</small></span>
                        <span class="settings-choice-check" aria-hidden="true">✓</span>
                    </button>
                    <button class="settings-choice-card" type="button" data-support-topic="Оплата" aria-pressed="false">
                        <span class="settings-choice-icon">${settingIcon.privacy}</span>
                        <span><strong>Оплата</strong><small>Стоимость и расчёт</small></span>
                        <span class="settings-choice-check" aria-hidden="true">✓</span>
                    </button>
                    <button class="settings-choice-card" type="button" data-support-topic="Товар" aria-pressed="false">
                        <span class="settings-choice-icon">${settingIcon.about}</span>
                        <span><strong>Товар</strong><small>Вопрос по продукту</small></span>
                        <span class="settings-choice-check" aria-hidden="true">✓</span>
                    </button>
                    <button class="settings-choice-card" type="button" data-support-topic="Разработка" aria-pressed="false">
                        <span class="settings-choice-icon">${settingIcon.support}</span>
                        <span><strong>Разработка</strong><small>Сайт, бот или сервис</small></span>
                        <span class="settings-choice-check" aria-hidden="true">✓</span>
                    </button>
                </div>
                <div class="support-selected" id="supportSelected" aria-live="polite">Сначала выберите тему обращения.</div>
                <button class="profile-screen-button support-telegram-button" type="button" data-open-telegram disabled>Выберите тему</button>
            `
        },
        help: {
            icon: settingIcon.help,
            heading: "Помощь по магазину",
            text: "Нажмите на любой вопрос — ответ откроется прямо здесь.",
            rowsMarkup: `
                <div class="help-faq">
                    <button class="help-faq-card" type="button" data-help-toggle="order" aria-expanded="false"><span class="help-faq-main"><strong>Как заказать товар?</strong><small>Оформление заказа в несколько шагов</small></span><span class="help-faq-arrow">+</span></button>
                    <div class="help-faq-answer" data-help-answer="order" hidden>Откройте карточку товара, добавьте его в корзину и перейдите к оформлению.</div>
                    <button class="help-faq-card" type="button" data-help-toggle="cart" aria-expanded="false"><span class="help-faq-main"><strong>Где хранится корзина?</strong><small>Локальное хранение на устройстве</small></span><span class="help-faq-arrow">+</span></button>
                    <div class="help-faq-answer" data-help-answer="cart" hidden>Корзина хранится локально в браузере на этом устройстве. Она не требует обязательного аккаунта.</div>
                    <button class="help-faq-card" type="button" data-help-toggle="development" aria-expanded="false"><span class="help-faq-main"><strong>Можно заказать разработку?</strong><small>Боты, сайты и веб-приложения</small></span><span class="help-faq-arrow">+</span></button>
                    <div class="help-faq-answer" data-help-answer="development" hidden>Да. Для цифровой задачи можно обратиться в поддержку и описать, что нужно сделать.</div>
                    <button class="help-faq-card" type="button" data-help-toggle="problem" aria-expanded="false"><span class="help-faq-main"><strong>Что делать, если возникла проблема?</strong><small>Свяжитесь с поддержкой</small></span><span class="help-faq-arrow">+</span></button>
                    <div class="help-faq-answer" data-help-answer="problem" hidden>Откройте «Поддержка» в настройках, выберите тему и перейдите в Telegram.</div>
                </div>
            `
        },
        userAgreement: {
            icon: settingIcon.data,
            heading: "Пользовательское соглашение",
            text: "Условия использования Maalavo Store.",
            rowsMarkup: `<div class="settings-document"><div class="settings-document-text">${escapeHtml("MAALAVO STORE\nПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ\n\nДата редакции: 20 сентября 2026 года\n\n1. ОБЩИЕ ПОЛОЖЕНИЯ\n1.1. Настоящее Пользовательское соглашение регулирует использование Maalavo Store.\n1.2. Используя магазин, пользователь подтверждает, что ознакомился с настоящим соглашением.\n1.3. Если пользователь не согласен с условиями, он должен прекратить использование сервиса.\n\n2. ТЕРМИНЫ\n2.1. «Maalavo Store» — цифровой магазин и сервис Maalavo.\n2.2. «Пользователь» — лицо, использующее магазин.\n2.3. «Товар» — цифровой товар, услуга, бот, инструмент, аккаунт или иной цифровой продукт, представленный в магазине.\n\n3. РЕГИСТРАЦИЯ И ПРОФИЛЬ\n3.1. Пользователь может создавать и использовать профиль, если такая функция доступна.\n3.2. Пользователь несет ответственность за сохранность данных своего профиля.\n3.3. Запрещается выдавать себя за другое лицо или использовать чужой профиль без разрешения.\n\n4. КАТАЛОГ ТОВАРОВ\n4.1. В магазине могут размещаться Telegram-боты, Telegram-инструменты, аватары, сайты, веб-приложения, программные продукты, обучение с использованием ИИ, Telegram-аккаунты, настройка feedback-ботов и другие цифровые услуги.\n4.2. Описание и характеристики товара указываются в карточке товара.\n4.3. Ассортимент и цены могут изменяться.\n\n5. ЗАКАЗЫ\n5.1. Заказ оформляется способом, указанным в интерфейсе магазина.\n5.2. Для связи по покупке может использоваться Telegram-контакт Maalavo.\n5.3. Перед оплатой пользователь должен проверить выбранный товар и его условия.\n\n6. ОПЛАТА\n6.1. Способ оплаты определяется для конкретного товара или услуги.\n6.2. Цена указывается в карточке или сообщении при оформлении заказа.\n6.3. Дополнительные комиссии сторонних сервисов, если они возникают, могут не входить в цену товара.\n\n7. ПЕРЕДАЧА ЦИФРОВЫХ ТОВАРОВ\n7.1. После подтверждения заказа цифровой товар передается способом, согласованным сторонами.\n7.2. Пользователь обязан предоставить корректные данные, необходимые для передачи товара.\n7.3. Ошибки в предоставленных пользователем данных могут повлиять на возможность передачи товара.\n\n8. УСЛУГИ\n8.1. Для индивидуальных услуг сроки и результат согласуются отдельно.\n8.2. Технические требования и объем работ могут фиксироваться в переписке.\n8.3. Изменения первоначального задания могут потребовать дополнительного согласования.\n\n9. TELEGRAM И ВНЕШНИЕ СЕРВИСЫ\n9.1. Maalavo Store может использовать Telegram и другие внешние сервисы для связи, передачи товаров или оказания услуг.\n9.2. Работа сторонних сервисов регулируется их собственными правилами.\n9.3. Maalavo не контролирует изменения правил, доступности или работы сторонних платформ.\n\n10. ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ\n10.1. Пользователь отвечает за законность материалов и данных, которые он передает сервису.\n10.2. Запрещается передавать вредоносные, незаконные или нарушающие права третьих лиц материалы.\n\n11. ЗАПРЕЩЕННЫЕ ДЕЙСТВИЯ\n11.1. Запрещается пытаться нарушить работу магазина.\n11.2. Запрещается использовать уязвимости, автоматизированные атаки или иные способы обхода ограничений.\n11.3. Запрещается использовать полученные товары для незаконных целей.\n\n12. ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ\n12.1. Дизайн, программный код, тексты, графика, логотипы и другие материалы Maalavo защищаются применимым законодательством.\n12.2. Передача цифрового товара не означает автоматическую передачу исключительных прав на него, если иное прямо не согласовано.\n\n13. ЛИЦЕНЗИИ\n13.1. Условия использования конкретного цифрового товара могут определяться отдельной лицензией.\n13.2. При наличии специальной лицензии ее условия имеют значение для соответствующего товара.\n\n14. ВОЗВРАТЫ И ОТМЕНА\n14.1. Условия возврата определяются законодательством и условиями конкретного товара или услуги.\n14.2. Для цифровых товаров возможность возврата может зависеть от того, был ли товар уже передан или активирован.\n14.3. Спорные ситуации рассматриваются индивидуально.\n\n15. ОТВЕТСТВЕННОСТЬ\n15.1. Стороны несут ответственность в пределах, установленных применимым законодательством.\n15.2. Maalavo не отвечает за сбои сторонних сервисов, которые находятся вне его контроля.\n\n16. ДОСТУПНОСТЬ СЕРВИСА\n16.1. Магазин может временно быть недоступен из-за обновлений, технических работ или обстоятельств, не зависящих от Maalavo.\n16.2. Внешний вид и функциональность магазина могут изменяться.\n\n17. ЛОКАЛЬНОЕ ХРАНЕНИЕ\n17.1. Некоторые данные интерфейса, профиля, корзины или избранного могут храниться локально на устройстве пользователя.\n17.2. Очистка данных браузера или устройства может удалить локально сохраненную информацию.\n\n18. ИЗМЕНЕНИЕ СОГЛАШЕНИЯ\n18.1. Maalavo может обновлять настоящее соглашение.\n18.2. Новая редакция вступает в силу после ее публикации, если иное не указано отдельно.\n\n19. РАЗРЕШЕНИЕ СПОРОВ\n19.1. Стороны стремятся урегулировать спор путем связи и переговоров.\n19.2. При невозможности урегулирования спор разрешается в порядке, предусмотренном применимым законодательством.\n\n20. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ\n20.1. Настоящее соглашение действует в отношении использования Maalavo Store.\n20.2. Если отдельное положение признано недействительным, остальные положения сохраняют силу.\n20.3. По вопросам, не урегулированным соглашением, применяется действующее законодательство.\n\nКонтакт Maalavo Store: Telegram — @maalavo\n")}</div></div>`
        },
        privacyPolicy: {
            icon: settingIcon.privacy,
            heading: "Политика конфиденциальности",
            text: "Информация об обработке данных при использовании Maalavo Store.",
            rowsMarkup: `<div class="settings-document"><div class="settings-document-text">${escapeHtml("MAALAVO STORE\nПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ\n\nДата редакции: 20 сентября 2026 года\n\n1. ОБЩИЕ ПОЛОЖЕНИЯ\n1.1. Настоящая политика описывает обработку данных при использовании Maalavo Store.\n1.2. Политика применяется к данным, которые пользователь предоставляет непосредственно или которые технически создаются при использовании магазина.\n\n2. КАКИЕ ДАННЫЕ МОГУТ ОБРАБАТЫВАТЬСЯ\n2.1. Данные профиля: имя/никнейм, аватар и иная информация, которую пользователь самостоятельно указывает.\n2.2. Данные заказа: выбранные товары, сведения о заказе и переписка по его выполнению.\n2.3. Технические данные могут включать сведения, необходимые для работы сайта и сохранения пользовательских настроек.\n\n3. ПРОФИЛЬ\n3.1. При наличии профиля данные профиля используются для отображения и работы соответствующих функций.\n3.2. Пользователь самостоятельно определяет, какую дополнительную информацию размещать в профиле.\n\n4. КОРЗИНА\n4.1. Сведения о товарах в корзине могут сохраняться локально на устройстве.\n4.2. Эти данные используются для работы корзины и оформления заказа.\n\n5. ИЗБРАННОЕ\n5.1. Список избранных товаров может храниться локально.\n5.2. Избранное используется для удобства пользователя.\n\n6. ЗАКАЗЫ\n6.1. Информация о заказе используется для его обработки и связи с пользователем.\n6.2. Данные могут сохраняться в объеме, необходимом для исполнения заказа и разрешения спорных ситуаций.\n\n7. TELEGRAM\n7.1. При обращении через Telegram пользователь взаимодействует со сторонней платформой Telegram.\n7.2. Обработка данных Telegram регулируется также правилами и политикой конфиденциальности Telegram.\n\n8. ВНЕШНИЕ СЕРВИСЫ\n8.1. Maalavo Store может использовать внешние сервисы для хостинга, аналитики, связи, доставки цифровых товаров и других технических задач.\n8.2. Такие сервисы могут обрабатывать технические данные в соответствии со своими правилами.\n\n9. ЛОКАЛЬНОЕ ХРАНЕНИЕ\n9.1. Часть функций может работать без серверной базы данных за счет localStorage, cookies или иных механизмов хранения в браузере.\n9.2. Такие данные находятся на устройстве пользователя и могут быть удалены при очистке данных браузера.\n\n10. ЦЕЛИ ОБРАБОТКИ\n10.1. Обработка данных может осуществляться для работы магазина.\n10.2. Для оформления и выполнения заказов.\n10.3. Для связи с пользователем.\n10.4. Для обеспечения безопасности и предотвращения злоупотреблений.\n10.5. Для улучшения интерфейса и функциональности.\n\n11. ПРАВОВЫЕ ОСНОВАНИЯ\n11.1. Обработка осуществляется на основании согласия пользователя, необходимости исполнения запроса или иных применимых правовых оснований.\n11.2. Конкретное основание зависит от характера данных и выполняемой операции.\n\n12. ПЕРЕДАЧА ДАННЫХ\n12.1. Данные не должны передаваться третьим лицам без соответствующего основания.\n12.2. Передача может осуществляться техническим подрядчикам или сервисам, когда это необходимо для работы магазина или исполнения заказа.\n\n13. БЕЗОПАСНОСТЬ\n13.1. Принимаются разумные технические и организационные меры для защиты данных.\n13.2. Ни один способ хранения или передачи данных через интернет не может гарантировать абсолютную безопасность.\n\n14. СРОК ХРАНЕНИЯ\n14.1. Данные хранятся столько, сколько необходимо для соответствующей цели, исполнения обязательств или соблюдения требований законодательства.\n14.2. Локальные данные могут существовать до их удаления пользователем или браузером.\n\n15. УДАЛЕНИЕ ДАННЫХ\n15.1. Пользователь может удалить доступные ему локальные данные через настройки браузера или соответствующие функции магазина.\n15.2. Для данных, которые находятся у Maalavo или технического подрядчика, запрос может быть направлен через контактный канал.\n\n16. ПРАВА ПОЛЬЗОВАТЕЛЯ\n16.1. В зависимости от применимого законодательства пользователь может иметь право на доступ, исправление, удаление, ограничение обработки или иные права в отношении своих данных.\n16.2. Запросы рассматриваются с учетом требований законодательства и возможности подтвердить личность заявителя.\n\n17. ДЕТИ\n17.1. Пользователь должен соблюдать возрастные ограничения, установленные применимым законодательством и условиями соответствующего сервиса.\n17.2. Если законодательство требует согласия законного представителя, оно должно быть получено.\n\n18. ИЗМЕНЕНИЯ ПОЛИТИКИ\n18.1. Политика может периодически обновляться.\n18.2. Актуальная редакция публикуется вместе с указанием даты обновления.\n\n19. КОНТАКТЫ\n19.1. По вопросам обработки данных пользователь может обратиться через официальный контакт Maalavo.\n19.2. Основной контакт: Telegram — @maalavo.\n\n20. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ\n20.1. Политика действует в отношении обработки данных при использовании Maalavo Store.\n20.2. Если отдельное положение становится неприменимым, остальные положения сохраняют силу.\n20.3. Использование сервиса после обновления политики означает ознакомление с ее новой редакцией в той мере, в какой это допускается применимым законодательством.\n")}</div></div>`
        },
        aboutProject: {
            icon: settingIcon.about,
            heading: "Проект для людей в цифровом мире",
            text: "Maalavo Store создан для помощи людям, которым сложно разобраться в программировании и цифровых технологиях. Идея проекта — сделать цифровые задачи понятнее и доступнее: от готовых товаров до разработки решения под конкретную ситуацию.",
            rowsMarkup: `<div class="profile-screen-row"><span class="profile-screen-row-icon">${settingIcon.help}</span><span class="profile-screen-row-copy"><strong>Для кого</strong><small>Для людей без опыта в программировании и цифровых сервисах.</small></span></div><div class="profile-screen-row"><span class="profile-screen-row-icon">${settingIcon.data}</span><span class="profile-screen-row-copy"><strong>Что делаем</strong><small>Боты, сайты, веб-приложения, плагины и другие цифровые решения.</small></span></div><div class="profile-screen-row"><span class="profile-screen-row-icon">${settingIcon.support}</span><span class="profile-screen-row-copy"><strong>Главная идея</strong><small>Помогать решать цифровые задачи без необходимости разбираться во всём программировании самостоятельно.</small></span></div>`
        }
    }[type];

    if(!content){
        return;
    }

    profileSubpageContent.innerHTML = `
        <div class="profile-screen-hero">
            <div class="profile-screen-icon">${content.icon}</div>
            <h2>${escapeHtml(content.heading)}</h2>
            <p>${escapeHtml(content.text)}</p>
        </div>
        ${content.rowsMarkup ? `<div class="profile-screen-list">${content.rowsMarkup}</div>` : `<div class="profile-screen-empty"><strong>Пока пусто</strong><span>${escapeHtml(content.text)}</span></div>`}
    `;
}

/** @param {string} value */
function escapeHtml(value){
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/** @param {string} type */
function openProfileScreen(type){

    const data = profileScreenData[type];

    if(!data || !profileSubpage){
        return;
    }

    currentProfileScreen = type;
    renderProfileScreen(type);

    profileSubpageTitle.textContent = data.title;
    profileSubpage.classList.add("open");
    profileSubpage.setAttribute("aria-hidden", "false");
    profileSubpageScroll.scrollTo({top:0, behavior:"smooth"});
}

function closeProfileScreen(){

    if(!profileSubpage){
        return;
    }

    profileSubpage.classList.remove("open");
    profileSubpage.setAttribute("aria-hidden", "true");
    currentProfileScreen = null;
}

profileActionCards.forEach(button => {
    button.addEventListener("click", () => {
        const type = button.dataset.profileScreen;
        if(type){
            openProfileScreen(type);
        }
    });
});

settingsActionCards.forEach(button => {
    button.addEventListener("click", () => {
        const type = button.dataset.settingsScreen;
        if(type){
            openProfileScreen(type);
        }
    });
});

if(profileSubpageBack){
    profileSubpageBack.addEventListener("click", closeProfileScreen);
}

profileSubpageContent?.addEventListener("click", event => {
    const cartProduct = event.target.closest("[data-cart-product]");
    if(cartProduct){
        const id = cartProduct.dataset.cartProduct;
        const product = products.find(item => item.dataset.id === id);
        if(product){
            closeProfileScreen();
            openProduct(product);
        }
        return;
    }

    if(event.target.closest("[data-open-checkout]")){
        openCheckout();
        return;
    }

    const telegramTarget = event.target.closest("[data-open-telegram]");
    if(telegramTarget){
        if(telegramTarget.disabled){
            return;
        }
        openTelegram();
        return;
    }

    const toggle = event.target.closest("[data-setting-toggle]");
    if(toggle){
        const key = toggle.dataset.settingToggle;
        if(key){
            toggleSetting(key);
            if(currentProfileScreen){
                renderProfileScreen(currentProfileScreen);
            }
        }
        return;
    }

    const settingsAction = event.target.closest("[data-settings-action]");
    if(settingsAction){
        const action = settingsAction.dataset.settingsAction;
        if(action === "clearCart"){
            clearLocalData("cart");
        }else if(action === "clearFavorites"){
            clearLocalData("favorites");
        }else if(action === "clearAll"){
            clearLocalData("all");
            settingsState = {...defaultSettings};
            saveSettings();
            applySettings();
            renderProfileScreen("storage");
        }
        return;
    }

    const supportTopic = event.target.closest("[data-support-topic]");
    if(supportTopic){
        const topic = supportTopic.dataset.supportTopic || "";
        const selected = profileSubpageContent.querySelector("#supportSelected");
        const telegramButton = profileSubpageContent.querySelector("[data-open-telegram]");

        profileSubpageContent.querySelectorAll("[data-support-topic]").forEach(button => {
            const active = button === supportTopic;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        if(selected){
            selected.textContent = `Выбрана тема: ${topic}. Нажмите «Открыть Telegram», чтобы написать в поддержку.`;
        }

        if(telegramButton){
            telegramButton.disabled = false;
            telegramButton.textContent = "Открыть Telegram";
            telegramButton.dataset.supportTopic = topic;
        }
        return;
    }

    const helpToggle = event.target.closest("[data-help-toggle]");
    if(helpToggle){
        const key = helpToggle.dataset.helpToggle;
        const answer = profileSubpageContent.querySelector(`[data-help-answer="${key}"]`);
        if(!answer){
            return;
        }
        const expanded = helpToggle.getAttribute("aria-expanded") === "true";
        helpToggle.setAttribute("aria-expanded", String(!expanded));
        answer.hidden = expanded;
        helpToggle.classList.toggle("active", !expanded);
        const arrow = helpToggle.querySelector(".help-faq-arrow");
        if(arrow){
            arrow.textContent = expanded ? "+" : "−";
        }
        return;
    }

    const target = event.target.closest("[data-profile-go-home]");
    if(!target){
        return;
    }
    closeProfileScreen();
    setActiveNav("home");
    showHome();
});


/* =========================================================
   BOTTOM NAV
========================================================= */

navItems.forEach(
    item => {

        item.addEventListener(
            "click",
            () => {

                if(
                    productPage.classList.contains(
                        "open"
                    )
                ){
                    return;
                }


                const page =
                    item.dataset.page;


                setActiveNav(
                    page
                );


                if(page === "home"){

                    showHome();

                    return;

                }


                if(page === "favorites"){

                    showFavorites();

                    return;

                }


                if(page === "profile"){

                    showProfile();

                    return;

                }


                if(page === "settings"){

                    showSettings();

                }

            }
        );

    }
);


/* =========================================================
   TOAST
========================================================= */

/** @param {string} type */
function showToast(type){

    clearTimeout(
        toastTimer
    );


    toastIcon.classList.remove(
        "heart"
    );


    if(type === "favoriteAdd"){

        toastIcon.innerHTML =
            toastIcons.favoriteAdd;

        toastIcon.classList.add(
            "heart"
        );

        toastTitle.textContent =
            "Товар сохранён";

        toastSubtitle.textContent =
            "Добавлено в избранное";

    }


    else if(type === "favoriteRemove"){

        toastIcon.innerHTML =
            toastIcons.favoriteRemove;

        toastTitle.textContent =
            "Товар убран";

        toastSubtitle.textContent =
            "Удалено из избранного";

    }


    else if(type === "cartAdd"){

        toastIcon.innerHTML =
            toastIcons.cartAdd;

        toastTitle.textContent =
            "Добавлено в корзину";

        toastSubtitle.textContent =
            "Товар сохранён в вашей корзине";

    }


    else if(type === "cartExists"){

        toastIcon.innerHTML =
            toastIcons.cartExists;

        toastTitle.textContent =
            "Уже в корзине";

        toastSubtitle.textContent =
            "Этот товар уже добавлен";

    }


    else if(type === "cartEmpty"){

        toastIcon.innerHTML =
            toastIcons.cartExists;

        toastTitle.textContent =
            "Корзина пуста";

        toastSubtitle.textContent =
            "Добавьте товар из каталога";

    }


    else if(type === "orderCreated"){
        toastIcon.innerHTML = toastIcons.cartExists;
        toastTitle.textContent = "Заказ оформлен";
        toastSubtitle.textContent = "Откроем Telegram для согласования деталей";
    }

    else if(type === "cartOpen"){

        toastIcon.innerHTML =
            toastIcons.cartAdd;

        toastTitle.textContent =
            "Корзина";

        toastSubtitle.textContent =
            `${cart.length} ${cart.length === 1 ? "товар" : cart.length < 5 ? "товара" : "товаров"} в заказе`;

    }


    else if(type === "storageError"){

        toastIcon.innerHTML =
            toastIcons.settings;

        toastTitle.textContent =
            "Ошибка сохранения";

        toastSubtitle.textContent =
            "Браузер не разрешил сохранить данные";

    }


    else if(type === "storageCleared"){

        toastIcon.innerHTML =
            toastIcons.settings;

        toastTitle.textContent =
            "Данные очищены";

        toastSubtitle.textContent =
            "Изменения сохранены на этом устройстве";

    }


    toast.classList.remove(
        "show"
    );


    requestAnimationFrame(
        () => {

            requestAnimationFrame(
                () => {

                    toast.classList.add(
                        "show"
                    );

                }
            );

        }
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2200
        );

}


/* =========================================================
   INIT
========================================================= */

function init(){

    syncFavorites();
    applySettings();

    updateProfileStats();

    filterProducts();

    setActiveNav(
        "home"
    );

}


/* =========================================================
   WELCOME SCREEN
========================================================= */

function initWelcomeScreen(){
    const welcomeScreen = document.getElementById("welcomeScreen");
    const welcomeStart = document.getElementById("welcomeStart");

    if(!welcomeScreen || !welcomeStart){
        return;
    }

    const WELCOME_SESSION_KEY = "maalavoWelcomeShown";

    syncProfileWithBackend();

function closeWelcome(){
        sessionStorage.setItem(WELCOME_SESSION_KEY, "1");
        welcomeScreen.classList.add("is-hidden");
        welcomeScreen.setAttribute("aria-hidden", "true");
        document.body.classList.remove("welcome-open");
    }

    document.body.classList.add("welcome-open");

    if(sessionStorage.getItem(WELCOME_SESSION_KEY) === "1"){
        welcomeScreen.classList.add("is-hidden");
        welcomeScreen.setAttribute("aria-hidden", "true");
        document.body.classList.remove("welcome-open");
        return;
    }

    welcomeStart.addEventListener("click", closeWelcome);
}


initWelcomeScreen();
init();


// V19/V20: settings documents — UI-native, no external file viewer.
(function () {
  const docs = {"agreement": {"title": "Пользовательское соглашение", "body": "MAALAVO STORE\nПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ\n\nДата редакции: 20 сентября 2026 года\n\n1. ОБЩИЕ ПОЛОЖЕНИЯ\n1.1. Настоящее Пользовательское соглашение регулирует использование Maalavo Store.\n1.2. Используя магазин, пользователь подтверждает, что ознакомился с настоящим соглашением.\n1.3. Если пользователь не согласен с условиями, он должен прекратить использование сервиса.\n\n2. ТЕРМИНЫ\n2.1. «Maalavo Store» — цифровой магазин и сервис Maalavo.\n2.2. «Пользователь» — лицо, использующее магазин.\n2.3. «Товар» — цифровой товар, услуга, бот, инструмент, аккаунт или иной цифровой продукт, представленный в магазине.\n\n3. РЕГИСТРАЦИЯ И ПРОФИЛЬ\n3.1. Пользователь может создавать и использовать профиль, если такая функция доступна.\n3.2. Пользователь несет ответственность за сохранность данных своего профиля.\n3.3. Запрещается выдавать себя за другое лицо или использовать чужой профиль без разрешения.\n\n4. КАТАЛОГ ТОВАРОВ\n4.1. В магазине могут размещаться Telegram-боты, Telegram-инструменты, аватары, сайты, веб-приложения, программные продукты, обучение с использованием ИИ, Telegram-аккаунты, настройка feedback-ботов и другие цифровые услуги.\n4.2. Описание и характеристики товара указываются в карточке товара.\n4.3. Ассортимент и цены могут изменяться.\n\n5. ЗАКАЗЫ\n5.1. Заказ оформляется способом, указанным в интерфейсе магазина.\n5.2. Для связи по покупке может использоваться Telegram-контакт Maalavo.\n5.3. Перед оплатой пользователь должен проверить выбранный товар и его условия.\n\n6. ОПЛАТА\n6.1. Способ оплаты определяется для конкретного товара или услуги.\n6.2. Цена указывается в карточке или сообщении при оформлении заказа.\n6.3. Дополнительные комиссии сторонних сервисов, если они возникают, могут не входить в цену товара.\n\n7. ПЕРЕДАЧА ЦИФРОВЫХ ТОВАРОВ\n7.1. После подтверждения заказа цифровой товар передается способом, согласованным сторонами.\n7.2. Пользователь обязан предоставить корректные данные, необходимые для передачи товара.\n7.3. Ошибки в предоставленных пользователем данных могут повлиять на возможность передачи товара.\n\n8. УСЛУГИ\n8.1. Для индивидуальных услуг сроки и результат согласуются отдельно.\n8.2. Технические требования и объем работ могут фиксироваться в переписке.\n8.3. Изменения первоначального задания могут потребовать дополнительного согласования.\n\n9. TELEGRAM И ВНЕШНИЕ СЕРВИСЫ\n9.1. Maalavo Store может использовать Telegram и другие внешние сервисы для связи, передачи товаров или оказания услуг.\n9.2. Работа сторонних сервисов регулируется их собственными правилами.\n9.3. Maalavo не контролирует изменения правил, доступности или работы сторонних платформ.\n\n10. ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ\n10.1. Пользователь отвечает за законность материалов и данных, которые он передает сервису.\n10.2. Запрещается передавать вредоносные, незаконные или нарушающие права третьих лиц материалы.\n\n11. ЗАПРЕЩЕННЫЕ ДЕЙСТВИЯ\n11.1. Запрещается пытаться нарушить работу магазина.\n11.2. Запрещается использовать уязвимости, автоматизированные атаки или иные способы обхода ограничений.\n11.3. Запрещается использовать полученные товары для незаконных целей.\n\n12. ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ\n12.1. Дизайн, программный код, тексты, графика, логотипы и другие материалы Maalavo защищаются применимым законодательством.\n12.2. Передача цифрового товара не означает автоматическую передачу исключительных прав на него, если иное прямо не согласовано.\n\n13. ЛИЦЕНЗИИ\n13.1. Условия использования конкретного цифрового товара могут определяться отдельной лицензией.\n13.2. При наличии специальной лицензии ее условия имеют значение для соответствующего товара.\n\n14. ВОЗВРАТЫ И ОТМЕНА\n14.1. Условия возврата определяются законодательством и условиями конкретного товара или услуги.\n14.2. Для цифровых товаров возможность возврата может зависеть от того, был ли товар уже передан или активирован.\n14.3. Спорные ситуации рассматриваются индивидуально.\n\n15. ОТВЕТСТВЕННОСТЬ\n15.1. Стороны несут ответственность в пределах, установленных применимым законодательством.\n15.2. Maalavo не отвечает за сбои сторонних сервисов, которые находятся вне его контроля.\n\n16. ДОСТУПНОСТЬ СЕРВИСА\n16.1. Магазин может временно быть недоступен из-за обновлений, технических работ или обстоятельств, не зависящих от Maalavo.\n16.2. Внешний вид и функциональность магазина могут изменяться.\n\n17. ЛОКАЛЬНОЕ ХРАНЕНИЕ\n17.1. Некоторые данные интерфейса, профиля, корзины или избранного могут храниться локально на устройстве пользователя.\n17.2. Очистка данных браузера или устройства может удалить локально сохраненную информацию.\n\n18. ИЗМЕНЕНИЕ СОГЛАШЕНИЯ\n18.1. Maalavo может обновлять настоящее соглашение.\n18.2. Новая редакция вступает в силу после ее публикации, если иное не указано отдельно.\n\n19. РАЗРЕШЕНИЕ СПОРОВ\n19.1. Стороны стремятся урегулировать спор путем связи и переговоров.\n19.2. При невозможности урегулирования спор разрешается в порядке, предусмотренном применимым законодательством.\n\n20. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ\n20.1. Настоящее соглашение действует в отношении использования Maalavo Store.\n20.2. Если отдельное положение признано недействительным, остальные положения сохраняют силу.\n20.3. По вопросам, не урегулированным соглашением, применяется действующее законодательство.\n\nКонтакт Maalavo Store: Telegram — @maalavo\n"}, "privacy": {"title": "Политика конфиденциальности", "body": "MAALAVO STORE\nПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ\n\nДата редакции: 20 сентября 2026 года\n\n1. ОБЩИЕ ПОЛОЖЕНИЯ\n1.1. Настоящая политика описывает обработку данных при использовании Maalavo Store.\n1.2. Политика применяется к данным, которые пользователь предоставляет непосредственно или которые технически создаются при использовании магазина.\n\n2. КАКИЕ ДАННЫЕ МОГУТ ОБРАБАТЫВАТЬСЯ\n2.1. Данные профиля: имя/никнейм, аватар и иная информация, которую пользователь самостоятельно указывает.\n2.2. Данные заказа: выбранные товары, сведения о заказе и переписка по его выполнению.\n2.3. Технические данные могут включать сведения, необходимые для работы сайта и сохранения пользовательских настроек.\n\n3. ПРОФИЛЬ\n3.1. При наличии профиля данные профиля используются для отображения и работы соответствующих функций.\n3.2. Пользователь самостоятельно определяет, какую дополнительную информацию размещать в профиле.\n\n4. КОРЗИНА\n4.1. Сведения о товарах в корзине могут сохраняться локально на устройстве.\n4.2. Эти данные используются для работы корзины и оформления заказа.\n\n5. ИЗБРАННОЕ\n5.1. Список избранных товаров может храниться локально.\n5.2. Избранное используется для удобства пользователя.\n\n6. ЗАКАЗЫ\n6.1. Информация о заказе используется для его обработки и связи с пользователем.\n6.2. Данные могут сохраняться в объеме, необходимом для исполнения заказа и разрешения спорных ситуаций.\n\n7. TELEGRAM\n7.1. При обращении через Telegram пользователь взаимодействует со сторонней платформой Telegram.\n7.2. Обработка данных Telegram регулируется также правилами и политикой конфиденциальности Telegram.\n\n8. ВНЕШНИЕ СЕРВИСЫ\n8.1. Maalavo Store может использовать внешние сервисы для хостинга, аналитики, связи, доставки цифровых товаров и других технических задач.\n8.2. Такие сервисы могут обрабатывать технические данные в соответствии со своими правилами.\n\n9. ЛОКАЛЬНОЕ ХРАНЕНИЕ\n9.1. Часть функций может работать без серверной базы данных за счет localStorage, cookies или иных механизмов хранения в браузере.\n9.2. Такие данные находятся на устройстве пользователя и могут быть удалены при очистке данных браузера.\n\n10. ЦЕЛИ ОБРАБОТКИ\n10.1. Обработка данных может осуществляться для работы магазина.\n10.2. Для оформления и выполнения заказов.\n10.3. Для связи с пользователем.\n10.4. Для обеспечения безопасности и предотвращения злоупотреблений.\n10.5. Для улучшения интерфейса и функциональности.\n\n11. ПРАВОВЫЕ ОСНОВАНИЯ\n11.1. Обработка осуществляется на основании согласия пользователя, необходимости исполнения запроса или иных применимых правовых оснований.\n11.2. Конкретное основание зависит от характера данных и выполняемой операции.\n\n12. ПЕРЕДАЧА ДАННЫХ\n12.1. Данные не должны передаваться третьим лицам без соответствующего основания.\n12.2. Передача может осуществляться техническим подрядчикам или сервисам, когда это необходимо для работы магазина или исполнения заказа.\n\n13. БЕЗОПАСНОСТЬ\n13.1. Принимаются разумные технические и организационные меры для защиты данных.\n13.2. Ни один способ хранения или передачи данных через интернет не может гарантировать абсолютную безопасность.\n\n14. СРОК ХРАНЕНИЯ\n14.1. Данные хранятся столько, сколько необходимо для соответствующей цели, исполнения обязательств или соблюдения требований законодательства.\n14.2. Локальные данные могут существовать до их удаления пользователем или браузером.\n\n15. УДАЛЕНИЕ ДАННЫХ\n15.1. Пользователь может удалить доступные ему локальные данные через настройки браузера или соответствующие функции магазина.\n15.2. Для данных, которые находятся у Maalavo или технического подрядчика, запрос может быть направлен через контактный канал.\n\n16. ПРАВА ПОЛЬЗОВАТЕЛЯ\n16.1. В зависимости от применимого законодательства пользователь может иметь право на доступ, исправление, удаление, ограничение обработки или иные права в отношении своих данных.\n16.2. Запросы рассматриваются с учетом требований законодательства и возможности подтвердить личность заявителя.\n\n17. ДЕТИ\n17.1. Пользователь должен соблюдать возрастные ограничения, установленные применимым законодательством и условиями соответствующего сервиса.\n17.2. Если законодательство требует согласия законного представителя, оно должно быть получено.\n\n18. ИЗМЕНЕНИЯ ПОЛИТИКИ\n18.1. Политика может периодически обновляться.\n18.2. Актуальная редакция публикуется вместе с указанием даты обновления.\n\n19. КОНТАКТЫ\n19.1. По вопросам обработки данных пользователь может обратиться через официальный контакт Maalavo.\n19.2. Основной контакт: Telegram — @maalavo.\n\n20. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ\n20.1. Политика действует в отношении обработки данных при использовании Maalavo Store.\n20.2. Если отдельное положение становится неприменимым, остальные положения сохраняют силу.\n20.3. Использование сервиса после обновления политики означает ознакомление с ее новой редакцией в той мере, в какой это допускается применимым законодательством.\n"}};
  const screen = document.getElementById("settingsDocumentScreen");
  const title = document.getElementById("settingsDocumentTitle");
  const body = document.getElementById("settingsDocumentBody");
  const back = document.getElementById("settingsDocumentBack");
  if (!screen || !title || !body || !back) return;

  document.querySelectorAll("[data-settings-document]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-settings-document");
      const doc = docs[key];
      if (!doc) return;
      title.textContent = doc.title;
      body.textContent = doc.body;
      screen.classList.add("is-open");
      screen.setAttribute("aria-hidden", "false");
      document.body.classList.add("settings-document-open");
    });
  });

  function closeDocument() {
    screen.classList.remove("is-open");
    screen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("settings-document-open");
  }

  back.addEventListener("click", closeDocument);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && screen.classList.contains("is-open")) closeDocument();
  });
})();

