// ===============================================
// CONFIGURACIÓN GLOBAL - QUINIELA MUNDIAL 2026
// ===============================================

const CONFIG = {

    API_URL: window.location.origin + '/api',
    
    // Límite de predicción (minutos antes del partido)
    TIEMPO_LIMITE_PREDICCION: 10,
    
    // Claves de localStorage
    STORAGE_KEYS: {
        USUARIO_ID: 'quiniela_id',
        USUARIO_CODIGO: 'quiniela_usuario',
        USUARIO_NOMBRE: 'quiniela_nombre',
        USUARIO_IS_ADMIN: 'quiniela_isAdmin'
    }
};

window.CONFIG = CONFIG;