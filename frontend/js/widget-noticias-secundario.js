/**
 * WIDGET NOTICIAS SECUNDARIO (7 noticias)
 * Trae del widget-espn.js y renderiza tarjetas
 */

(function() {
  'use strict';

  async function inicializarWidgetNoticias() {
    console.log('📰 Inicializando widget secundario...');

    try {
      if (!window.widgetESPN) {
        console.error('❌ widgetESPN no cargado');
        return;
      }

      const container = document.getElementById('noticiasFeed');
      if (!container) {
        console.error('❌ #noticiasFeed no encontrado');
        return;
      }

      // Obtener 7 noticias
      const noticias = await window.widgetESPN.obtenerParaCarrusel(7);

      if (!noticias || noticias.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#aaa;">No hay noticias disponibles</p>';
        return;
      }

      // Limpiar contenedor
      container.innerHTML = '';

      // Crear tarjetas
      noticias.forEach((noticia, idx) => {
        const card = document.createElement('div');
        card.className = 'noticia-card';
        card.style.cssText = `
          display: flex;
          gap: 12px;
          padding: 12px;
          border-bottom: 1px solid var(--dark-card);
          cursor: pointer;
          transition: background 0.2s;
        `;
        card.onmouseover = () => card.style.background = 'var(--dark-card)';
        card.onmouseout = () => card.style.background = 'transparent';

        if (noticia.url && noticia.url !== '#') {
          card.style.cursor = 'pointer';
          card.onclick = () => window.open(noticia.url, '_blank');
        }

        card.innerHTML = `
          <div style="flex-shrink: 0; width: 80px; height: 60px; border-radius: 4px; overflow: hidden;">
            <img src="${noticia.imagen_url}" alt="${noticia.titulo}" 
                 style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div style="flex: 1; min-width: 0;">
            <p style="font-size: 11px; color: var(--fifa-gold); margin: 0 0 4px 0; text-transform: uppercase; font-weight: bold;">
              ${noticia.categoria || 'MUNDIAL 2026'}
            </p>
            <h3 style="margin: 0 0 4px 0; font-size: 14px; line-height: 1.3; color: white; 
                       display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${noticia.titulo}
            </h3>
            <p style="font-size: 12px; color: #999; margin: 0;">
              ${formatearFecha(noticia.fecha_publicacion)}
            </p>
          </div>
        `;

        container.appendChild(card);
      });

      console.log(`✅ ${noticias.length} noticias en widget secundario`);

    } catch (error) {
      console.error('❌ Error en widget noticias:', error);
    }
  }

  /**
   * Formatear fecha a texto amigable
   */
  function formatearFecha(fecha) {
    if (!fecha) return 'Hace poco';
    
    try {
      const date = new Date(fecha);
      const ahora = new Date();
      const diff = Math.floor((ahora - date) / 1000); // segundos

      if (diff < 60) return 'Hace unos segundos';
      if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`;
      if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
      if (diff < 604800) return `Hace ${Math.floor(diff / 86400)}d`;

      // Formato: "15 Jun"
      return date.toLocaleDateString('es-ES', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return 'Reciente';
    }
  }

  // Ejecutar cuando esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarWidgetNoticias);
  } else {
    inicializarWidgetNoticias();
  }

  // Exponer globalmente
  window.reinicializarWidgetNoticias = inicializarWidgetNoticias;

})();