let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Muestra el botón
  document.getElementById('btn-instalar-app').classList.add('show');
  iniciarTemporizadorBoton();
});
function iniciarTemporizadorBoton() {
  setTimeout(() => {
    const btn = document.getElementById('btn-instalar-app');
    if (btn) {
      // Animación de salida (usa la transición que ya tienes)
      btn.classList.remove('show');
    }
  }, 8000); // 8 segundos
}
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
    iniciarTemporizadorBoton();
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
  // Android sin prompt disponible
  mostrarModalInstalacion();
}
  });
});

function mostrarModalInstalacion() {
  const esIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  const instruccion = esIOS
    ? `<ol style="text-align: left; font-size: 13px; color: #ccc; padding-left: 20px; line-height: 1.8;">
        <li>Toca el botón <strong>compartir</strong> (□↑) abajo</li>
        <li>Selecciona <strong>"Agregar a pantalla de inicio"</strong></li>
        <li>Toca <strong>"Agregar"</strong></li>
      </ol>`
    : `<ol style="text-align: left; font-size: 13px; color: #ccc; padding-left: 20px; line-height: 1.8;">
        <li>Toca los <strong>3 puntos</strong> (⋮) arriba a la derecha</li>
        <li>Selecciona <strong>"Agregar a pantalla de inicio"</strong></li>
        <li>Toca <strong>"Agregar"</strong></li>
      </ol>`;

  // Crea el modal dinámicamente
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div id="modal-instalar" style="
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    ">
      <div style="
        background: #000000;
        border-radius: 16px;
        padding: 28px;
        max-width: 360px;
        width: 100%;
        color: white;
        text-align: center;
      ">
        <div style="font-size: 48px; margin-bottom: 12px;">📱</div>
        <h3 style="color: #ffee00; margin-bottom: 8px;">Al alcance de tus manos</h3>
        <p style="color: #aaa; font-size: 14px; margin-bottom: 16px;">
          Sigue estos pasos para agregar la app a tu pantalla de inicio:
        </p>
        ${instruccion}
        <button onclick="document.getElementById('modal-instalar').remove()" style="
          margin-top: 20px;
          background: #0066CC;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 32px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
        ">Entendido</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

window.addEventListener('appinstalled', () => {
  document.getElementById('btn-instalar-app').classList.remove('show');
  console.log('✅ App instalada');
});