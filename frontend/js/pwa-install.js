let deferredPrompt; // Almacena el evento de instalación

// Captura el evento 'beforeinstallprompt'
window.addEventListener('beforeinstallprompt', (e) => {
  // Previene que se muestre el mini-cartel automático
  e.preventDefault();
  
  // Guarda el evento para usarlo después
  deferredPrompt = e;
  
  // Muestra tu botón personalizado
  const btnInstalar = document.getElementById('btn-instalar-app');
  if (btnInstalar) {
    btnInstalar.style.display = 'block'; // Era hidden por defecto
  }
});

// Cuando el usuario hace click en tu botón
document.getElementById('btn-instalar-app')?.addEventListener('click', async () => {
  if (!deferredPrompt) {
    console.log('Install prompt no disponible');
    return;
  }
  
  // Muestra el diálogo nativo de instalación
  deferredPrompt.prompt();
  
  // Espera a ver qué eligió el usuario
  const { outcome } = await deferredPrompt.userChoice;
  
  console.log(`User response: ${outcome}`); // 'accepted' o 'dismissed'
  
  // Limpia el evento
  deferredPrompt = null;
  
  // Esconde el botón
  document.getElementById('btn-instalar-app').style.display = 'none';
});

// Si la app ya está instalada (o el navegador no soporta)
window.addEventListener('appinstalled', () => {
  console.log('✅ App instalada correctamente');
  deferredPrompt = null;
  // Aquí podrías mostrar un mensaje de éxito
});