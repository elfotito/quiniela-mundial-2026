// js/navbar.js - Manejo global del menú móvil
document.addEventListener('DOMContentLoaded', () => {

    const btnMenu = document.getElementById('btnMenuMobile');
    const navMobile = document.getElementById('navMobile');

    if (btnMenu && navMobile) {
        btnMenu.addEventListener('click', () => {
            navMobile.classList.toggle('open');
        });

        // Cerrar menú al hacer click en un link
        navMobile.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMobile.classList.remove('open');
            });
        });

        // Cerrar menú al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!btnMenu.contains(e.target) && !navMobile.contains(e.target)) {
                navMobile.classList.remove('open');
            }
        });
    }
});