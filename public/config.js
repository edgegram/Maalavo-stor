// Set this to the public Railway URL of the MAALAVO backend.
// Example: window.MAALAVO_API_URL = 'https://your-app.up.railway.app/api';
window.MAALAVO_API_URL = window.MAALAVO_API_URL || 'https://YOUR-RAILWAY-DOMAIN/api';
window.MAALAVO_ADMIN_URL = window.MAALAVO_ADMIN_URL || window.MAALAVO_API_URL.replace(/\/api\/?$/, '') + '/admin';
