let deferredPrompt;

console.log('🔍 Script de PWA Install cargado');

// Escucha el evento beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('✅ beforeinstallprompt DISPARADO');
  
  e.preventDefault();
  deferredPrompt = e;
  
  const btnInstalar = document.getElementById('btn-instalar-app');
  console.log('🔎 Buscando botón:', btnInstalar);
  
  if (btnInstalar) {
    console.log('✅ Botón encontrado, agregando clase "show"');
    btnInstalar.classList.add('show');
  } else {
    console.error('❌ Botón NO encontrado (id="btn-instalar-app")');
  }
});

// Click en el botón
document.addEventListener('DOMContentLoaded', () => {
  const btnInstalar = document.getElementById('btn-instalar-app');
  
  if (btnInstalar) {
    btnInstalar.addEventListener('click', async () => {
      console.log('📱 Click en botón instalar');
      console.log('deferredPrompt disponible?', deferredPrompt);
      
      if (!deferredPrompt) {
        console.warn('⚠️ deferredPrompt es null. beforeinstallprompt no se disparó');
        return;
      }
      
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`📊 Usuario eligió: ${outcome}`);
        deferredPrompt = null;
        btnInstalar.classList.remove('show');
      } catch (error) {
        console.error('❌ Error mostrando el prompt:', error);
      }
    });
  }
});

// Si ya está instalada
window.addEventListener('appinstalled', () => {
  console.log('🎉 App instalada correctamente!');
});

// Log inicial
console.log('🌐 Navegador soporta PWA?', 
  'serviceWorker' in navigator && 
  'Notification' in window && 
  'beforeinstallprompt' in window
);