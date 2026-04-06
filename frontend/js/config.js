// ===============================================
// CONFIGURACIÓN GLOBAL - QUINIELA MUNDIAL 2026
// ===============================================

const CONFIG = {

    // En producción apunta a Render, en local apunta a localhost
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api'
        : 'https://quinielamundial2026.onrender.com/api',

    TIEMPO_LIMITE_PREDICCION: 10,

    STORAGE_KEYS: {
        USUARIO_ID: 'quiniela_id',
        USUARIO_CODIGO: 'quiniela_usuario',
        USUARIO_NOMBRE: 'quiniela_nombre',
        USUARIO_IS_ADMIN: 'quiniela_isAdmin'
    }
};

window.CONFIG = CONFIG;