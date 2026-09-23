/* Maalavo frontend runtime configuration. */
window.MAALAVO_API_URL = "https://maalavo-stor-production-6edd.up.railway.app/api";

/* Load the official Telegram Mini App runtime before app.js executes. */
if (!window.Telegram?.WebApp) {
    document.write('<script src="https://telegram.org/js/telegram-web-app.js"><\/script>');
}

window.addEventListener("DOMContentLoaded", () => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    try {
        webApp.ready();
        webApp.expand();
    } catch (error) {
        console.warn("Telegram WebApp initialization failed:", error);
    }
});
