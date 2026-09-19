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

const profileFavoritesButton=
    document.getElementById("profileFavoritesButton");

const profileCartButton=
    document.getElementById("profileCartButton");

const profileContactButton=
    document.getElementById("profileContactButton");

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
   ПРОФИЛЬ → ИЗБРАННОЕ
========================= */

profileFavoritesButton.addEventListener(
    "click",
    ()=>{

        document
            .querySelectorAll(
                ".nav-item"
            )
            .forEach(
                nav=>{
                    nav.classList.toggle(
                        "active",
                        nav.dataset.page==="favorites"
                    );
                }
            );

        showFavorites();

    }
);


/* =========================
   ПРОФИЛЬ → КОРЗИНА
========================= */

profileCartButton.addEventListener(
    "click",
    ()=>{

        if(cart.length===0){

            showToast(
                "cartExists"
            );

            return;

        }

        showToast(
            "cartAdd"
        );

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




/* =========================
   ПРОФИЛЬ — РАБОЧИЕ КНОПКИ
========================= */

(function(){
    let profileToastTimer = null;

    function profileToast(text){
        let el = document.getElementById('profileToast');
        if(!el){
            el = document.createElement('div');
            el.id = 'profileToast';
            el.className = 'profile-toast';
            el.innerHTML = '<span class="profile-toast-dot"></span><span id="profileToastText"></span>';
            document.body.appendChild(el);
        }
        document.getElementById('profileToastText').textContent = text;
        el.classList.add('show');
        clearTimeout(profileToastTimer);
        profileToastTimer = setTimeout(function(){
            el.classList.remove('show');
        }, 2200);
    }

    function profileBusy(button){
        if(!button) return;
        button.classList.add('is-busy');
        setTimeout(function(){ button.classList.remove('is-busy'); }, 500);
    }

    window.profileOpenOrders = function(button){
        profileBusy(button);

        /* Используем существующее хранилище заказов, если оно есть. */
        let orders = [];
        try{
            orders = JSON.parse(localStorage.getItem('maalavo_v5_orders') || '[]');
        }catch(e){ orders = []; }

        if(typeof window.openOrders === 'function'){
            window.openOrders();
            return;
        }

        if(typeof window.showOrders === 'function'){
            window.showOrders();
            return;
        }

        profileToast(
            orders.length
            ? 'Заказов: ' + orders.length
            : 'История заказов пока пуста'
        );
    };

    window.profileOpenHelp = function(button){
        profileBusy(button);

        if(typeof window.openHelp === 'function'){
            window.openHelp();
            return;
        }

        if(typeof window.showHelp === 'function'){
            window.showHelp();
            return;
        }

        profileToast('Помощь пока готовится');
    };

    window.profileOpenAbout = function(button){
        profileBusy(button);

        if(typeof window.openAbout === 'function'){
            window.openAbout();
            return;
        }

        if(typeof window.showAbout === 'function'){
            window.showAbout();
            return;
        }

        profileToast('Maalavo Store — магазин цифровых товаров');
    };

    window.profileShare = async function(button){
        profileBusy(button);

        const shareData = {
            title: 'Maalavo Store',
            text: 'Загляни в Maalavo Store — цифровые товары и услуги.',
            url: window.location.href
        };

        if(navigator.share){
            try{
                await navigator.share(shareData);
                return;
            }catch(e){
                /* Пользователь мог закрыть системное окно — это не ошибка интерфейса. */
                if(e && e.name === 'AbortError') return;
            }
        }

        try{
            await navigator.clipboard.writeText(window.location.href);
            profileToast('Ссылка скопирована');
            return;
        }catch(e){}

        profileToast('Скопируй ссылку из адресной строки');
    };

    /* Обновление счётчиков профиля из текущего localStorage. */
    window.updateProfileCounters = function(){
        const fav = document.getElementById('profileFavoritesCount');
        const cart = document.getElementById('profileCartCount');

        function readArray(keys){
            for(const key of keys){
                try{
                    const raw = localStorage.getItem(key);
                    if(!raw) continue;
                    const data = JSON.parse(raw);
                    if(Array.isArray(data)) return data.length;
                    if(data && Array.isArray(data.items)) return data.items.length;
                }catch(e){}
            }
            return 0;
        }

        if(fav) fav.textContent = readArray([
            'maalavo_v5_favs',
            'maalavo_v5_favorites',
            'maalavo_favorites'
        ]);

        if(cart) cart.textContent = readArray([
            'maalavo_v5_cart',
            'maalavo_cart'
        ]);
    };

    document.addEventListener('DOMContentLoaded', function(){
        updateProfileCounters();

        window.addEventListener('storage', updateProfileCounters);

        /* Перехватываем смену localStorage через события магазина, если они используются. */
        setInterval(updateProfileCounters, 1500);
    });
})();
