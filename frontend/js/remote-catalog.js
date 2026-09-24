(() => {
    'use strict';

    const API = String(window.MAALAVO_API_URL || '').replace(/\/$/, '');
    const PRODUCT_SELECTOR = '#products .product';

    function money(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return 'Цена по запросу';
        return `от ${amount.toLocaleString('ru-RU')} ₽`;
    }

    function updateProductCard(card, remote) {
        const title = card.querySelector('.product-title');
        const description = card.querySelector('.product-description');
        const price = card.querySelector('.price');
        const image = card.querySelector('.product-image img');
        const badge = card.querySelector('.badge');

        card.dataset.category = remote.category || card.dataset.category || 'services';
        card.dataset.search = [remote.title, remote.category, remote.description, card.dataset.search || '']
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        card.dataset.fullDescription = remote.description || card.dataset.fullDescription || '';

        if (title) title.textContent = remote.title || title.textContent.trim();
        if (description) description.textContent = remote.description || '';
        if (price) price.textContent = money(remote.priceFrom);
        if (badge) badge.textContent = remote.category || badge.textContent.trim();

        if (image && remote.imageUrl) {
            image.src = remote.imageUrl;
            image.onerror = () => image.removeAttribute('src');
        }
    }

    function removeUnavailableFromStorage(activeIds) {
        for (const key of ['maalavo_cart_v5', 'maalavo_favorites_v5']) {
            try {
                const value = JSON.parse(localStorage.getItem(key) || '[]');
                if (!Array.isArray(value)) continue;
                const next = value.filter((id) => activeIds.has(String(id)));
                if (next.length !== value.length) localStorage.setItem(key, JSON.stringify(next));
            } catch (error) {
                console.warn(`Не удалось очистить ${key}:`, error);
            }
        }
    }

    async function refreshCatalog() {
        if (!API) return;

        try {
            const response = await fetch(`${API}/products?ts=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) throw new Error(`Каталог: HTTP ${response.status}`);

            const payload = await response.json();
            const remoteProducts = Array.isArray(payload.products) ? payload.products : [];
            const remoteMap = new Map(remoteProducts.map((product) => [String(product.id), product]));
            const activeIds = new Set(remoteMap.keys());

            document.querySelectorAll(PRODUCT_SELECTOR).forEach((card) => {
                const id = String(card.dataset.id || '');
                const remote = remoteMap.get(id);
                const unavailable = !remote || remote.active === false;

                card.hidden = unavailable;
                card.setAttribute('aria-hidden', unavailable ? 'true' : 'false');

                if (remote) updateProductCard(card, remote);
            });

            removeUnavailableFromStorage(activeIds);

            window.dispatchEvent(new CustomEvent('maalavo:catalog-updated', {
                detail: { products: remoteProducts }
            }));
        } catch (error) {
            console.warn('Remote catalog sync failed:', error);
        }
    }

    function disableCopying() {
        const style = document.createElement('style');
        style.id = 'maalavo-no-copy';
        style.textContent = `
            html, body, body * {
                -webkit-user-select: none !important;
                user-select: none !important;
                -webkit-touch-callout: none !important;
            }
            input, textarea, select, [contenteditable="true"] {
                -webkit-user-select: text !important;
                user-select: text !important;
                -webkit-touch-callout: default !important;
            }
            img, svg { -webkit-user-drag: none !important; user-drag: none !important; }
        `;
        document.head.appendChild(style);

        const isEditable = (target) => {
            const element = target instanceof Element ? target : target?.parentElement;
            return Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'));
        };

        document.addEventListener('contextmenu', (event) => {
            if (!isEditable(event.target)) event.preventDefault();
        }, { capture: true });

        document.addEventListener('copy', (event) => {
            if (!isEditable(event.target)) event.preventDefault();
        }, { capture: true });

        document.addEventListener('cut', (event) => {
            if (!isEditable(event.target)) event.preventDefault();
        }, { capture: true });

        document.addEventListener('dragstart', (event) => event.preventDefault(), { capture: true });
    }

    function start() {
        disableCopying();
        void refreshCatalog();
        window.setInterval(refreshCatalog, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
