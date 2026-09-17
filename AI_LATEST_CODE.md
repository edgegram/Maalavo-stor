# MAALAVO STORE — AI WORKING COPY

This file is maintained as the assistant's working reference for the latest Maalavo Store code and requested UI changes, so the user does not need to resend the same source repeatedly.

## Current task / latest requested behavior
- Product cards open a full-screen product detail view.
- Product detail view must NOT scroll vertically.
- Image, title, description, price, and «Добавить в корзину» must fit into one fixed viewport.
- Price and add-to-cart button must remain visible and must not scroll away.
- No product-detail window/screen may overlap another UI window.
- Home/favorites/card UI should remain unchanged unless required for this behavior.
- Mobile-first; use `100dvh` and safe-area insets.
- Horizontal swipe-back may remain, but vertical scrolling on product detail is disabled.

## Latest recoverable repository baseline
The repository currently contains a different modular implementation than the standalone HTML source used in the latest chat edit:
- Main entry: `public/index.html`
- Store logic: `public/js/store.js`
- The current repository `store.js` uses a sheet-style `openProduct()` overlay, while the latest chat source used a dedicated `.product-page` full-screen detail screen.

## Important workflow rule
For future Maalavo Store edits, use this file as the assistant's working-state marker and update it after each completed code revision. When the exact latest standalone source is available in the conversation or repository, preserve that exact source here (or in a dedicated versioned source file) before making the next change.

## Latest requested fix implementation notes
For the standalone `.product-page` version:
- `.product-page-scroll` should use `overflow:hidden !important` instead of `overflow-y:auto`.
- Use `touch-action: pan-x` (or equivalent) so vertical pan/scroll is disabled while horizontal back gesture can remain.
- Product detail content should be constrained to the viewport with fixed/absolute top and bottom bounds.
- Description should be clamped on small screens so it cannot push the price/button below the viewport.
- `body` scrolling should remain disabled while the product detail is open.
