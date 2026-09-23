/* Maalavo frontend runtime configuration. */
window.MAALAVO_API_URL = "https://maalavo-stor-production-6edd.up.railway.app/api";

/* Telegram Mini App runtime. */
if (!window.Telegram?.WebApp) {
    document.write('<script src="https://telegram.org/js/telegram-web-app.js"><\/script>');
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

async function syncTelegramProfile() {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    try {
        webApp.ready();
        webApp.expand();

        const telegramUser = webApp.initDataUnsafe?.user;
        const initData = String(webApp.initData || "").trim();
        if (!telegramUser?.id || !initData) return;

        const response = await fetch(`${window.MAALAVO_API_URL}/users/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-Init-Data": initData
            },
            body: JSON.stringify({ deviceId: maalavoDeviceId() })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) throw new Error(payload.error || `HTTP ${response.status}`);

        const user = payload.user;
        const name = user.displayName || [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || telegramUser.username || "Гость";
        const username = user.username || telegramUser.username || "";
        const telegramId = String(user.telegramId || telegramUser.id);
        const accountNumber = user.accountNumber ? String(user.accountNumber) : "";
        const avatar = user.avatarUrl || telegramUser.photo_url || "";

        localStorage.setItem("maalavo_user", JSON.stringify({ name, username, id: telegramId, accountNumber, avatar }));

        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        setText("profileDisplayName", name);
        setText("profileUsername", username ? `@${username}` : "@не указан");
        setText("profileUsernameMeta", username ? `@${username}` : "Не указан");
        setText("profileUserId", telegramId);
        setText("profileAccountNumber", accountNumber ? `#${accountNumber}` : "—");

        const image = document.getElementById("profileAvatarImage");
        const fallback = document.getElementById("profileAvatarFallback");
        if (image) {
            if (avatar) {
                image.src = avatar;
                image.alt = `Аватар ${name}`;
                image.hidden = false;
            } else {
                image.hidden = true;
                image.removeAttribute("src");
            }
        }
        if (fallback) fallback.textContent = name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "M";
    } catch (error) {
        console.warn("Telegram profile sync failed:", error);
    }
}

window.addEventListener("DOMContentLoaded", syncTelegramProfile);
