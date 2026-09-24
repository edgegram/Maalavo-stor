/* Maalavo frontend runtime configuration. */
window.MAALAVO_API_URL = "https://maalavo-stor-production-6edd.up.railway.app/api";

/* Telegram Mini App runtime. */
if (!window.Telegram?.WebApp) {
    const telegramScript = document.createElement("script");
    telegramScript.src = "https://telegram.org/js/telegram-web-app.js";
    telegramScript.async = true;
    document.head.appendChild(telegramScript);
}

function maalavoDeviceId() {
    const key = "maalavo_device_id_v1";
    try {
        let id = localStorage.getItem(key);
        if (!id) {
            id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(key, id);
        }
        return id;
    } catch {
        return `guest-${Date.now()}`;
    }
}

function renderTelegramProfile(user) {
    const name = user.name || "Гость";
    const username = user.username || "";
    const telegramId = String(user.id || "");
    const accountNumber = String(user.accountNumber || "");
    const avatar = user.avatar || "";
    localStorage.setItem("maalavo_user", JSON.stringify({ name, username, id: telegramId, accountNumber, avatar }));
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    setText("profileDisplayName", name);
    setText("profileUsername", username ? `@${username}` : "@не указан");
    setText("profileUsernameMeta", username ? `@${username}` : "Не указан");
    setText("profileUserId", telegramId || "Не подключён");
    setText("profileAccountNumber", accountNumber ? `#${accountNumber.replace(/^#/, "")}` : "—");
    const image = document.getElementById("profileAvatarImage");
    const fallback = document.getElementById("profileAvatarFallback");
    if (image) {
        image.onerror = () => { image.hidden = true; image.removeAttribute("src"); };
        if (avatar) { image.src = avatar; image.alt = `Аватар ${name}`; image.hidden = false; }
        else { image.hidden = true; image.removeAttribute("src"); }
    }
    if (fallback) fallback.textContent = name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "M";
    window.dispatchEvent(new CustomEvent("maalavo:telegram-profile", { detail: user }));
}

async function syncTelegramProfile() {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return false;
    try {
        webApp.ready();
        webApp.expand();
        const telegramUser = webApp.initDataUnsafe?.user;
        const initData = String(webApp.initData || "").trim();
        if (!telegramUser?.id || !initData) return false;
        const response = await fetch(`${window.MAALAVO_API_URL}/users/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": initData },
            body: JSON.stringify({ deviceId: maalavoDeviceId() })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) throw new Error(payload.error || `HTTP ${response.status}`);
        const remote = payload.user;
        renderTelegramProfile({
            name: remote.displayName || [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || telegramUser.username || "Гость",
            username: remote.username || telegramUser.username || "",
            id: remote.telegramId || telegramUser.id,
            accountNumber: remote.accountNumber || "",
            avatar: remote.avatarUrl || telegramUser.photo_url || ""
        });
        return true;
    } catch (error) {
        console.warn("Telegram profile sync failed:", error);
        return false;
    }
}

async function waitForTelegramProfile() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        if (await syncTelegramProfile()) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
}

function openMaalavoStore() {
    const welcome = document.getElementById("welcomeScreen");
    const page = document.getElementById("pageScroll");

    if (welcome) {
        welcome.classList.add("hidden");
        welcome.setAttribute("aria-hidden", "true");
        welcome.style.pointerEvents = "none";
        welcome.style.visibility = "hidden";
        welcome.style.opacity = "0";
        welcome.style.display = "none";
    }

    if (page) {
        page.classList.add("active");
        page.removeAttribute("aria-hidden");
        page.style.visibility = "visible";
        page.style.display = "block";
        page.style.opacity = "1";
        page.style.pointerEvents = "auto";
        page.style.zIndex = "20";
    }

    document.body.style.overflow = "hidden";

    const webApp = window.Telegram?.WebApp;
    if (webApp) {
        try {
            webApp.ready();
            webApp.expand();
        } catch (error) {
            console.warn("Telegram WebApp initialization failed:", error);
        }
    }

    void waitForTelegramProfile();
}

function bindWelcomeButton() {
    const button = document.getElementById("welcomeStart");
    if (!button || button.dataset.maalavoWelcomeBound === "true") return;
    button.dataset.maalavoWelcomeBound = "true";

    const enter = (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        }
        openMaalavoStore();
    };

    button.addEventListener("click", enter, { capture: true });
    button.addEventListener("pointerup", enter, { capture: true });
    button.addEventListener("touchend", enter, { capture: true, passive: false });
}

function loadRuntimeEnhancements() {
    if (document.querySelector('script[data-maalavo-runtime-enhancements]')) return;
    const script = document.createElement('script');
    script.src = 'js/remote-catalog.js?v=20260924-2';
    script.defer = true;
    script.dataset.maalavoRuntimeEnhancements = 'true';
    document.head.appendChild(script);
    const reviews = document.createElement('script');
    reviews.src = 'js/orders-reviews.js?v=20260924-3';
    reviews.defer = true;
    reviews.dataset.maalavoOrdersReviews = 'true';
    document.head.appendChild(reviews);
}

window.addEventListener("DOMContentLoaded", () => {
    bindWelcomeButton();
    void waitForTelegramProfile();
    loadRuntimeEnhancements();
});
window.addEventListener("load", () => {
    bindWelcomeButton();
    void waitForTelegramProfile();
    loadRuntimeEnhancements();
});
setTimeout(() => {
    bindWelcomeButton();
    void waitForTelegramProfile();
    loadRuntimeEnhancements();
}, 500);
setTimeout(() => {
    bindWelcomeButton();
    void waitForTelegramProfile();
    loadRuntimeEnhancements();
}, 1500);
setTimeout(() => {
    bindWelcomeButton();
    void waitForTelegramProfile();
    loadRuntimeEnhancements();
}, 3000);
