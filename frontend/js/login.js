// En tu login.js o donde manejas el login
if (!window.API_URL) {
    window.API_URL = CONFIG.API_URL;
}
async function loginUser(email, password) {
    try {
        // ... tu lógica de login actual ...
        
        // Suponiendo que recibes estos datos del backend
        const userData = {
            id: user.id,
            email: user.email,
            username: user.username,
            isAdmin: user.isadmin,  // ← IMPORTANTE: recibir este campo
            token: user.token
        };
        
        // Guardar en localStorage/sessionStorage
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Redirigir según si es admin o no
        if (userData.isAdmin) {
            window.location.href = 'index.html'; // O admin.html si prefieres
        } else {
            window.location.href = 'index.html';
        }
        
    } catch (error) {
        console.error('Error en login:', error);
    }
}