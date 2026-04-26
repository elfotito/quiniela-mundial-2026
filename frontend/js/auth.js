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

    getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-usuario-id': localStorage.getItem('quiniela_id')
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
        if (this.sesionExpirada()) {
            this.logout();
            return false;
        }
        this.registrarActividad();
        return true;
    },

    protegerPaginaAdmin() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        if (this.sesionExpirada()) {
            this.logout();
            return false;
        }
        if (!this.isAdmin()) {
            alert('⛔ Acceso denegado - Solo administradores');
            window.location.href = 'index.html';
            return false;
        }
        this.registrarActividad();
        return true;
    },
    
    registrarActividad() {
        localStorage.setItem('quiniela_ultima_actividad', Date.now());
    },

    sesionExpirada() {
        const ultimaActividad = localStorage.getItem('quiniela_ultima_actividad');
        if (!ultimaActividad) return false;
        const TREINTA_MINUTOS = 30 * 60 * 1000;
        return Date.now() - parseInt(ultimaActividad) > TREINTA_MINUTOS;
    },
};

window.auth = AuthManager;