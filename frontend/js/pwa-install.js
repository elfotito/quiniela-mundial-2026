let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Muestra el botón
  document.getElementById('btn-instalar-app').classList.add('show');
});

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-instalar-app');
  
  // Detecta si ya está instalada (modo standalone)
  const yaInstalada = window.matchMedia('(display-mode: standalone)').matches;
  
  if (yaInstalada) {
    // Ya está instalada, no mostrar botón
    console.log('App ya instalada');
    return;
  }
  
  // En móvil, muestra el botón siempre
  // (aunque no haya deferredPrompt todavía)
  const esMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (esMobile) {
    btn.classList.add('show');
  }
  
  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      // Hay prompt disponible, úsalo
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Usuario eligió:', outcome);
      deferredPrompt = null;
      btn.classList.remove('show');
    } else {
      // No hay prompt, detecta si es iOS o Android
      const esIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      if (esIOS) {
        alert('Para instalar:\n1. Toca el botón de compartir (cuadrado con flecha)\n2. Selecciona "Agregar a pantalla de inicio"');
      } else {
        alert('Para instalar:\n1. Toca los 3 puntos (⋮) arriba a la derecha\n2. Selecciona "Agregar a pantalla de inicio"');
      }
    }
  });
});

window.addEventListener('appinstalled', () => {
  document.getElementById('btn-instalar-app').classList.remove('show');
  console.log('✅ App instalada');
});