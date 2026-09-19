const CART_KEY="maalavo_cart_v5";
const FAV_KEY="maalavo_favorites_v5";

let cart=JSON.parse(
    localStorage.getItem(CART_KEY)||"[]"
);

let favorites=JSON.parse(
    localStorage.getItem(FAV_KEY)||"[]"
);

const products=[
    ...document.querySelectorAll("#products .product")
];

const categories=[
    ...document.querySelectorAll(".category")
];

const searchInput=
    document.getElementById("searchInput");

const pageScroll=
    document.getElementById("pageScroll");

const favoritesPage=
    document.getElementById("favoritesPage");

const favoritesScroll=
    document.getElementById("favoritesScroll");

const favoritesProducts=
    document.getElementById("favoritesProducts");

const favoritesEmpty=
    document.getElementById("favoritesEmpty");

const favoritesSubtitle=
    document.getElementById("favoritesSubtitle");

const profilePage=
    document.getElementById("profilePage");

const profileScroll=
    document.getElementById("profileScroll");

const profileFavoritesCount=
    document.getElementById("profileFavoritesCount");

const profileCartCount=
    document.getElementById("profileCartCount");

const profileCartButton=
    document.getElementById("profileCartButton");

const profileContactButton=
    document.getElementById("profileContactButton");

const profileOrdersButton=
    document.getElementById("profileOrdersButton");

const profileHelpButton=
    document.getElementById("profileHelpButton");

const profileAboutButton=
    document.getElementById("profileAboutButton");

const profileShareButton=
    document.getElementById("profileShareButton");

const toast=
    document.getElementById("toast");

const toastIcon=
    document.getElementById("toastIcon");

const toastTitle=
    document.getElementById("toastTitle");

const toastSubtitle=
    document.getElementById("toastSubtitle");

const productPage=
    document.getElementById("productPage");

const productPageScroll=
    document.getElementById("productPageScroll");

const productPageImage=
    document.getElementById("productPageImage");

const productPageCategory=
    document.getElementById("productPageCategory");

const productPageTitle=
    document.getElementById("productPageTitle");

const productPageDescription=
    document.getElementById("productPageDescription");

const productPagePrice=
    document.getElementById("productPagePrice");

const productPageCart=
    document.getElementById("productPageCart");

const productPageFavorite=
    document.getElementById("productPageFavorite");

const productBack=
    document.getElementById("productBack");

let currentProduct=null;


/* =========================
   TOAST
========================= */

const toastIcons={

    favoriteAdd:`
        <svg viewBox="0 0 24 24">
            <path d="M20.8 8.9c0 5.5-8.8 10.3-8.8 10.3S3.2 14.4 3.2 8.9A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.8Z"/>
        </svg>
    `,

    favoriteRemove:`
        <svg viewBox="0 0 24 24">
            <path d="M20.8 8.9c0 5.5-8.8 10.3-8.8 10.3S3.2 14.4 3.2 8.9A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.8Z"/>
        </svg>
    `,

    cartAdd:`
        <svg viewBox="0 0 24 24">
            <path d="M6 7h12l1 13H5L6 7Z"/>
            <path d="M9 7a3 3 0 0 1 6 0"/>
        </svg>
    `,

    cartExists:`
        <svg viewBox="0 0 24 24">
            <path d="m5 12 4 4L19 6"/>
        </svg>
    `

};


/* =========================
   ИЗБРАННОЕ
========================= */

function renderFavorites(){

    favoritesProducts.innerHTML="";

    const favoriteProducts=
        products.filter(
            product=>
                favorites.includes(
                    product.dataset.id
                )
        );

    favoriteProducts.forEach(
        product=>{

            const clone=
                product.cloneNode(true);

            clone.style.display="";

            favoritesProducts.appendChild(
                clone
            );

        }
    );

    if(favoriteProducts.length===0){

        favoritesProducts.style.display="none";

        favoritesEmpty.style.display="flex";

        favoritesSubtitle.textContent=
            "Сохранённых товаров пока нет";

    }else{

        favoritesProducts.style.display="grid";

        favoritesEmpty.style.display="none";

        const count=
            favoriteProducts.length;

        favoritesSubtitle.textContent=
            count===1
                ? "1 сохранённый товар"
                : count<5
                    ? `${count} сохранённых товара`
                    : `${count} сохранённых товаров`;

    }

    updateProfileStats();

}


function syncFavorites(){

    products.forEach(product=>{

        const id=
            product.dataset.id;

        const button=
            product.querySelector(".favorite");

        if(button){

            button.classList.toggle(
                "active",
                favorites.includes(id)
            );

        }

    });

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


function updateProfileStats(){

    profileFavoritesCount.textContent=
        favorites.length;

    profileCartCount.textContent=
        cart.length;

}


syncFavorites();


/* =========================
   ОТКРЫТЬ ТОВАР
========================= */

function openProduct(product){

    if(!product)
        return;

    currentProduct=product;

    const image=
        product.querySelector(
            ".product-image img"
        );

    const title=
        product.querySelector(
            ".product-title"
        );

    const badge=
        product.querySelector(
            ".badge"
        );

    const price=
        product.querySelector(
            ".price"
        );

    productPageImage.src=
        image?.src || "";

    productPageTitle.textContent=
        title?.textContent.trim() || "";

    productPageCategory.textContent=
        badge?.textContent.trim() || "";

    productPageDescription.textContent=
        product.dataset.fullDescription ||
        product.querySelector(
            ".product-description"
        )?.textContent.trim() ||
        "";

    productPagePrice.textContent=
        price?.textContent.trim() || "";

    productPageFavorite.classList.toggle(
        "active",
        favorites.includes(
            product.dataset.id
        )
    );

    productPageScroll.scrollTop=0;

    document.body.style.overflow="hidden";

    pageScroll.style.pointerEvents="none";

    favoritesPage.style.pointerEvents="none";

    profilePage.style.pointerEvents="none";

    document.querySelector(".bottom-nav")
        .style.pointerEvents="none";

    productPage.classList.add("open");

    productPage.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================
   ЗАКРЫТЬ ТОВАР
========================= */

function closeProduct(){

    productPage.classList.remove(
        "open"
    );

    productPage.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow="";

    pageScroll.style.pointerEvents="";

    favoritesPage.style.pointerEvents="";

    profilePage.style.pointerEvents="";

    document.querySelector(".bottom-nav")
        .style.pointerEvents="";

    currentProduct=null;

}


/* =========================
   КАРТОЧКИ
========================= */

document.addEventListener(
    "click",
    event=>{

        const product=
            event.target.closest(
                ".product"
            );

        if(!product)
            return;

        if(
            event.target.closest(".favorite") ||
            event.target.closest(".cart")
        ){
            return;
        }

        openProduct(product);

    }
);


/* =========================
   НАЗАД
========================= */

productBack.addEventListener(
    "click",
    closeProduct
);


/* =========================
   ESC
========================= */

document.addEventListener(
    "keydown",
    event=>{

        if(
            event.key==="Escape" &&
            productPage.classList.contains(
                "open"
            )
        ){

            closeProduct();

        }

    }
);


/* =========================
   СВАЙП НАЗАД
========================= */

let touchStartX=0;
let touchStartY=0;

productPage.addEventListener(
    "touchstart",
    event=>{

        if(
            !productPage.classList.contains(
                "open"
            )
        ){
            return;
        }

        const touch=
            event.touches[0];

        touchStartX=
            touch.clientX;

        touchStartY=
            touch.clientY;

    },
    {passive:true}
);

productPage.addEventListener(
    "touchend",
    event=>{

        if(
            !productPage.classList.contains(
                "open"
            )
        ){
            return;
        }

        const touch=
            event.changedTouches[0];

        const deltaX=
            touch.clientX-touchStartX;

        const deltaY=
            touch.clientY-touchStartY;

        if(
            deltaX>100 &&
            Math.abs(deltaX)>Math.abs(deltaY)*1.35
        ){

            closeProduct();

        }

    },
    {passive:true}
);


/* =========================
   ИЗБРАННОЕ В ТОВАРЕ
========================= */

productPageFavorite.addEventListener(
    "click",
    event=>{

        event.stopPropagation();

        if(!currentProduct)
            return;

        const id=
            currentProduct.dataset.id;

        if(
            favorites.includes(id)
        ){

            favorites=
                favorites.filter(
                    item=>item!==id
                );

            productPageFavorite.classList.remove(
                "active"
            );

            showToast(
                "favoriteRemove"
            );

        }else{

            favorites.push(id);

            productPageFavorite.classList.add(
                "active"
            );

            showToast(
                "favoriteAdd"
            );

        }

        localStorage.setItem(
            FAV_KEY,
            JSON.stringify(favorites)
        );

        syncFavorites();

    }
);


/* =========================
   КОРЗИНА В ТОВАРЕ
========================= */

productPageCart.addEventListener(
    "click",
    event=>{

        event.stopPropagation();

        if(!currentProduct)
            return;

        addToCart(
            currentProduct.dataset.id
        );

    }
);


/* =========================
   ДОБАВИТЬ В КОРЗИНУ
========================= */

function addToCart(id){

    if(
        !cart.includes(id)
    ){

        cart.push(id);

        localStorage.setItem(
            CART_KEY,
            JSON.stringify(cart)
        );

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


/* =========================
   ИЗБРАННОЕ НА КАРТОЧКАХ
========================= */

document.addEventListener(
    "click",
    event=>{

        const button=
            event.target.closest(
                ".favorite"
            );

        if(!button)
            return;

        const product=
            button.closest(
                ".product"
            );

        if(!product)
            return;

        const id=
            product.dataset.id;

        if(
            favorites.includes(id)
        ){

            favorites=
                favorites.filter(
                    item=>item!==id
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

        localStorage.setItem(
            FAV_KEY,
            JSON.stringify(favorites)
        );

        syncFavorites();

        if(
            currentProduct &&
            currentProduct.dataset.id===id
        ){

            productPageFavorite.classList.toggle(
                "active",
                favorites.includes(id)
            );

        }

    }
);


/* =========================
   КОРЗИНА НА КАРТОЧКАХ
========================= */

document.addEventListener(
    "click",
    event=>{

        const button=
            event.target.closest(
                ".cart"
            );

        if(!button)
            return;

        const product=
            button.closest(
                ".product"
            );

        if(!product)
            return;

        addToCart(
            product.dataset.id
        );

    }
);


/* =========================
   ПОИСК
========================= */

searchInput.addEventListener(
    "input",
    filterProducts
);


/* =========================
   КАТЕГОРИИ
========================= */

categories.forEach(category=>{

    category.addEventListener(
        "click",
        ()=>{

            categories.forEach(
                item=>{
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

});


/* =========================
   ФИЛЬТРАЦИЯ
========================= */

function filterProducts(){

    const query=
        searchInput.value
            .trim()
            .toLowerCase();

    const activeCategory=
        document
            .querySelector(
                ".category.active"
            )
            ?.dataset.category ||
        "all";

    products.forEach(product=>{

        const category=
            product.dataset.category;

        const text=
            product.dataset.search
                .toLowerCase();

        const categoryMatch=
            activeCategory==="all" ||
            category===activeCategory;

        const searchMatch=
            !query ||
            text.includes(query);

        product.style.display=
            categoryMatch &&
            searchMatch
                ? ""
                : "none";

    });

}


/* =========================
   ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
========================= */

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

    pageScroll.style.display="block";
    pageScroll.style.pointerEvents="";

    favoritesPage.style.pointerEvents="";
    profilePage.style.pointerEvents="";

}


function showFavorites(){

    renderFavorites();

    pageScroll.style.display="none";

    profilePage.classList.remove(
        "open"
    );

    profilePage.setAttribute(
        "aria-hidden",
        "true"
    );

    favoritesPage.classList.add(
        "open"
    );

    favoritesPage.setAttribute(
        "aria-hidden",
        "false"
    );

    favoritesPage.style.pointerEvents="";

    profilePage.style.pointerEvents="none";

    favoritesScroll.scrollTo({
        top:0,
        behavior:"smooth"
    });

}


function showProfile(){

    updateProfileStats();

    pageScroll.style.display="none";

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

    profilePage.style.pointerEvents="";

    favoritesPage.style.pointerEvents="none";

    profileScroll.scrollTo({
        top:0,
        behavior:"smooth"
    });

}


/* =========================
   НИЖНЕЕ МЕНЮ
========================= */

document
    .querySelectorAll(".nav-item")
    .forEach(item=>{

        item.addEventListener(
            "click",
            ()=>{

                if(
                    productPage.classList.contains(
                        "open"
                    )
                ){
                    return;
                }

                const page=
                    item.dataset.page;

                document
                    .querySelectorAll(
                        ".nav-item"
                    )
                    .forEach(
                        nav=>{
                            nav.classList.remove(
                                "active"
                            );
                        }
                    );

                item.classList.add(
                    "active"
                );


                if(page==="home"){

                    showHome();

                    return;

                }


                if(page==="favorites"){

                    showFavorites();

                    return;

                }


                if(page==="profile"){

                    showProfile();

                    return;

                }


                if(page==="settings"){

                    showToast(
                        "settings"
                    );

                    return;

                }

            }
        );

    });


/* =========================
   ПРОФИЛЬ → КОРЗИНА
========================= */

profileCartButton.addEventListener(
    "click",
    ()=>{
        openProfileCart();
    }
);


/* =========================
   ПРОФИЛЬ → ЗАКАЗЫ
========================= */

profileOrdersButton.addEventListener(
    "click",
    ()=>{
        openProfileOrders();
    }
);


/* =========================
   ПРОФИЛЬ → TELEGRAM
========================= */

profileContactButton.addEventListener(
    "click",
    ()=>{
        window.open(
            "https://t.me/maalavo",
            "_blank"
        );
    }
);


/* =========================
   ПРОФИЛЬ → ПОМОЩЬ
========================= */

profileHelpButton.addEventListener(
    "click",
    ()=>{
        openProfileModal(
            "Помощь",
            `
            <div class="profile-modal-list">
                <div class="profile-modal-row">
                    <strong>Как оформить заказ?</strong>
                    Откройте нужный товар, добавьте его в корзину и свяжитесь с продавцом для оформления.
                </div>
                <div class="profile-modal-row">
                    <strong>Где мои товары?</strong>
                    Добавленные товары находятся в корзине и сохраняются на этом устройстве.
                </div>
                <div class="profile-modal-row">
                    <strong>Нужна помощь?</strong>
                    Нажмите «Связаться», чтобы открыть Telegram и написать нам.
                </div>
            </div>
            `
        );
    }
);


/* =========================
   ПРОФИЛЬ → О МАГАЗИНЕ
========================= */

profileAboutButton.addEventListener(
    "click",
    ()=>{
        openProfileModal(
            "О магазине",
            `
            <div class="profile-modal-list">
                <div class="profile-modal-row">
                    <strong>Maalavo Store</strong>
                    Магазин цифровых товаров и услуг.
                </div>
                <div class="profile-modal-row">
                    <strong>Что здесь есть?</strong>
                    Боты, веб-приложения, сайты, плагины, аккаунты и другие цифровые услуги.
                </div>
                <div class="profile-modal-row">
                    <strong>Поддержка</strong>
                    По вопросам заказа можно написать напрямую в Telegram.
                </div>
            </div>
            `
        );
    }
);


/* =========================
   ПРОФИЛЬ → ПОДЕЛИТЬСЯ
========================= */

profileShareButton.addEventListener(
    "click",
    async ()=>{

        const data={
            title:"Maalavo Store",
            text:"Maalavo Store — цифровые товары и услуги.",
            url:window.location.href
        };

        if(navigator.share){

            try{
                await navigator.share(data);
                return;
            }catch(error){

                if(
                    error &&
                    error.name==="AbortError"
                ){
                    return;
                }

            }

        }

        try{

            await navigator.clipboard.writeText(
                window.location.href
            );

            showToast(
                "share"
            );

        }catch(error){

            openProfileModal(
                "Поделиться",
                `
                <div class="profile-modal-empty">
                    Скопируйте ссылку на магазин и отправьте её друзьям.
                </div>
                <button
                    class="profile-modal-btn"
                    type="button"
                    onclick="copyProfileLink()"
                >
                    Скопировать ссылку
                </button>
                `
            );

        }

    }
);


/* =========================
   ПРОФИЛЬ — МОДАЛЬНЫЕ ОКНА
========================= */

function ensureProfileModal(){

    let modal=
        document.getElementById(
            "profileActionModal"
        );

    if(modal)
        return modal;

    modal=
        document.createElement(
            "div"
        );

    modal.id=
        "profileActionModal";

    modal.className=
        "profile-modal";

    modal.innerHTML=`
        <div
            class="profile-modal-card"
            role="dialog"
            aria-modal="true"
        >

            <div class="profile-modal-top">

                <h3
                    class="profile-modal-title"
                    id="profileModalTitle"
                ></h3>

                <button
                    class="profile-modal-close"
                    id="profileModalClose"
                    type="button"
                    aria-label="Закрыть"
                >
                    <svg viewBox="0 0 24 24">
                        <path d="M6 6l12 12M18 6 6 18"/>
                    </svg>
                </button>

            </div>

            <div
                id="profileModalBody"
            ></div>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    modal.addEventListener(
        "click",
        event=>{

            if(
                event.target===modal
            ){
                closeProfileModal();
            }

        }
    );

    document
        .getElementById(
            "profileModalClose"
        )
        .addEventListener(
            "click",
            closeProfileModal
        );

    return modal;

}


function openProfileModal(
    title,
    body
){

    const modal=
        ensureProfileModal();

    document
        .getElementById(
            "profileModalTitle"
        )
        .textContent=
            title;

    document
        .getElementById(
            "profileModalBody"
        )
        .innerHTML=
            body;

    modal.classList.add(
        "open"
    );

}


function closeProfileModal(){

    const modal=
        document.getElementById(
            "profileActionModal"
        );

    if(modal){

        modal.classList.remove(
            "open"
        );

    }

}


window.closeProfileModal=
    closeProfileModal;


window.copyProfileLink=
    async function(){

        try{

            await navigator.clipboard.writeText(
                window.location.href
            );

            closeProfileModal();

            showToast(
                "share"
            );

        }catch(error){

            showToast(
                "share"
            );

        }

    };


function openProfileCart(){

    if(
        cart.length===0
    ){

        openProfileModal(
            "Корзина",
            `
            <div class="profile-modal-empty">
                Корзина пока пустая.<br>
                Добавьте товары из каталога, и они появятся здесь.
            </div>
            `
        );

        return;

    }

    const items=
        cart.map(
            id=>{

                const product=
                    products.find(
                        item=>
                            item.dataset.id===id
                    );

                if(!product)
                    return "";

                const title=
                    product
                        .querySelector(
                            ".product-title"
                        )
                        ?.textContent
                        .trim() ||
                    "Товар";

                const price=
                    product
                        .querySelector(
                            ".price"
                        )
                        ?.textContent
                        .trim() ||
                    "";

                return`
                    <div class="profile-modal-row">
                        <strong>${escapeProfileHtml(title)}</strong>
                        ${escapeProfileHtml(price)}
                    </div>
                `;

            }
        )
        .join("");

    openProfileModal(
        "Корзина",
        `
        <div class="profile-modal-list">
            ${items}
        </div>

        <button
            class="profile-modal-btn"
            type="button"
            onclick="profileCheckout()"
        >
            Оформить заказ
        </button>

        <button
            class="profile-modal-btn profile-modal-btn-secondary"
            type="button"
            onclick="clearProfileCart()"
        >
            Очистить корзину
        </button>
        `
    );

}


window.profileCheckout=
    function(){

        if(
            !cart.length
        ){
            return;
        }

        const titles=
            cart.map(
                id=>{

                    const product=
                        products.find(
                            item=>
                                item.dataset.id===id
                        );

                    return product
                        ?.querySelector(
                            ".product-title"
                        )
                        ?.textContent
                        .trim();

                }
            )
            .filter(Boolean);

        const orders=
            JSON.parse(
                localStorage.getItem(
                    "maalavo_orders_v5"
                ) ||
                "[]"
            );

        orders.push({
            id:"order_"+Date.now(),
            date:new Date().toISOString(),
            items:titles
        });

        localStorage.setItem(
            "maalavo_orders_v5",
            JSON.stringify(
                orders
            )
        );

        const text=
            "Здравствуйте! Хочу оформить заказ в Maalavo Store:\\n\\n"+
            titles
                .map(
                    item=>"- "+item
                )
                .join("\\n");

        window.open(
            "https://t.me/maalavo?text="+
            encodeURIComponent(text),
            "_blank"
        );

    };


window.clearProfileCart=
    function(){

        cart=[];

        localStorage.setItem(
            CART_KEY,
            JSON.stringify(cart)
        );

        updateProfileStats();

        closeProfileModal();

        showToast(
            "cartCleared"
        );

    };


function openProfileOrders(){

    const orders=
        JSON.parse(
            localStorage.getItem(
                "maalavo_orders_v5"
            ) ||
            "[]"
        );

    if(
        !orders.length
    ){

        openProfileModal(
            "Мои заказы",
            `
            <div class="profile-modal-empty">
                История заказов пока пустая.<br>
                После оформления заказа он появится здесь.
            </div>
            `
        );

        return;

    }

    const rows=
        orders
            .slice()
            .reverse()
            .map(
                (order,index)=>{

                    const date=
                        new Date(
                            order.date
                        );

                    const items=
                        Array.isArray(
                            order.items
                        )
                            ? order.items
                            : [];

                    return`
                        <div class="profile-modal-row">
                            <strong>
                                Заказ #${orders.length-index}
                            </strong>
                            ${date.toLocaleDateString("ru-RU")}
                            · ${items.length} ${items.length===1?"товар":"товаров"}
                            <br>
                            ${items.map(escapeProfileHtml).join(", ")}
                        </div>
                    `;

                }
            )
            .join("");

    openProfileModal(
        "Мои заказы",
        `
        <div class="profile-modal-list">
            ${rows}
        </div>
        `
    );

}


function escapeProfileHtml(
    value
){

    return String(
        value
    ).replace(
        /[&<>"']/g,
        character=>({
            "&":"&amp;",
            "<":"&lt;",
            ">":"&gt;",
            '"':"&quot;",
            "'":"&#039;"
        }[character])
    );

}


/* =========================
   TOAST
========================= */

let toastTimer=null;

function showToast(type){

    clearTimeout(
        toastTimer
    );

    toastIcon.classList.remove(
        "heart"
    );


    if(type==="favoriteAdd"){

        toastIcon.innerHTML=
            toastIcons.favoriteAdd;

        toastIcon.classList.add(
            "heart"
        );

        toastTitle.textContent=
            "Товар сохранён";

        toastSubtitle.textContent=
            "Добавлено в избранное";

    }

    else if(type==="favoriteRemove"){

        toastIcon.innerHTML=
            toastIcons.favoriteRemove;

        toastTitle.textContent=
            "Товар убран";

        toastSubtitle.textContent=
            "Удалено из избранного";

    }

    else if(type==="cartAdd"){

        toastIcon.innerHTML=
            toastIcons.cartAdd;

        toastTitle.textContent=
            "Добавлено в корзину";

        toastSubtitle.textContent=
            "Товар сохранён в вашей корзине";

    }

    else if(type==="cartExists"){

        toastIcon.innerHTML=
            toastIcons.cartExists;

        toastTitle.textContent=
            "Уже в корзине";

        toastSubtitle.textContent=
            "Этот товар уже добавлен";

    }

    else if(type==="share"){

        toastIcon.innerHTML=
            `
            <svg viewBox="0 0 24 24">
                <path d="m12 3 4 4-4 4"/>
                <path d="M16 7H8a5 5 0 0 0 0 10h8"/>
            </svg>
            `;

        toastTitle.textContent=
            "Готово";

        toastSubtitle.textContent=
            "Ссылка скопирована";

    }

    else if(type==="cartCleared"){

        toastIcon.innerHTML=
            `
            <svg viewBox="0 0 24 24">
                <path d="m5 12 4 4L19 6"/>
            </svg>
            `;

        toastTitle.textContent=
            "Корзина очищена";

        toastSubtitle.textContent=
            "Все товары удалены";

    }

    else if(type==="settings"){

        toastIcon.innerHTML=
            `
            <svg viewBox="0 0 24 24">
                <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/>
                <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06-1.82 1.82-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65V20h-2.58v-.09a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.06.06-1.82-1.82.06-.06A1.8 1.8 0 0 0 5.4 15a1.8 1.8 0 0 0-1.65-1.08H3.66v-2.58h.09A1.8 1.8 0 0 0 5.4 10.26a1.8 1.8 0 0 0-.36-1.98l-.06-.06L6.8 6.4l.06.06a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 9.92 5.17V5h2.58v.17a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.06-.06 1.82 1.82-.06.06a1.8 1.8 0 0 0 1.65 1.08h.09v2.58h-.09A1.8 1.8 0 0 0 19.4 15Z"/>
            </svg>
            `;

        toastTitle.textContent=
            "Настройки";

        toastSubtitle.textContent=
            "Раздел будет доступен позже";

    }


    toast.classList.remove(
        "show"
    );

    requestAnimationFrame(
        ()=>{
            requestAnimationFrame(
                ()=>{
                    toast.classList.add(
                        "show"
                    );
                }
            );
        }
    );

    toastTimer=setTimeout(
        ()=>{
            toast.classList.remove(
                "show"
            );
        },
        2200
    );

}
