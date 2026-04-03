// ===============================================
// GESTOR DE AUTENTICACIÓN - FRONTEND
// ===============================================

const AuthManager = {

    isAuthenticated() {
        return !!localStorage.getItem('quiniela_id');
    },

    isAdmin() {
        return localStorage.getItem('quiniela_isAdmin') === 'true';
    },

    getUser() {
        return {
            id: localStorage.getItem('quiniela_id'),
            nombre: localStorage.getItem('quiniela_nombre'),
            codigo: localStorage.getItem('quiniela_usuario'),
            campeon_elegido: localStorage.getItem('quiniela_campeon'),
            isAdmin: this.isAdmin()
        };
    },

    setUser(usuario) {
        localStorage.setItem('quiniela_id',      usuario.id);
        localStorage.setItem('quiniela_usuario',  usuario.codigo);
        localStorage.setItem('quiniela_nombre',   usuario.nombre);
        localStorage.setItem('quiniela_isAdmin',  usuario.isAdmin);
        localStorage.setItem('quiniela_campeon', usuario.campeon_elegido);
        console.log('✅ Sesión guardada:', this.getUser());
    },

    logout() {
        localStorage.clear();
        window.location.href = 'login.html';
    },

    protegerPagina() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    protegerPaginaAdmin() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        if (!this.isAdmin()) {
            alert('⛔ Acceso denegado - Solo administradores');
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }
};

window.auth = AuthManager;