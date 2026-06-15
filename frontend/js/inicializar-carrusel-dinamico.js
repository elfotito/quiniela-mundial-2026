

(function() {
  'use strict';

  async function inicializarCarruselDinamico() {
    console.log('🚀 Inicializando carrusel dinámico...');

    try {
      // Esperar a que widgetESPN esté disponible
      if (!window.widgetESPN) {
        console.error('❌ widgetESPN no cargado');
        return;
      }

      // Obtener 4 noticias principales
      const noticias = await window.widgetESPN.obtenerParaCarrusel(4);

      if (!noticias || noticias.length === 0) {
        console.warn('⚠️  No hay noticias disponibles');
        return;
      }

      // Inyectar en Swiper
      const wrapper = document.querySelector('#heroSwiper .swiper-wrapper');
      if (!wrapper) {
        console.error('❌ .swiper-wrapper no encontrado');
        return;
      }

      wrapper.innerHTML = ''; // Limpiar slides existentes

      noticias.forEach((noticia, idx) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
          <div class="slide-inner">
            <div class="slide-text">
              <p class="slide-category">${noticia.categoria || 'MUNDIAL 2026'}</p>
              <h2 class="slide-title">${noticia.titulo}</h2>
              <p class="slide-desc">${noticia.descripcion || ''}</p>
              ${noticia.url && noticia.url !== '#' ? `<a href="${noticia.url}" class="slide-btn">Leer más</a>` : ''}
            </div>
            <div class="slide-img">
              <img src="${noticia.imagen_url}" alt="${noticia.titulo}" loading="lazy">
            </div>
          </div>
        `;
        wrapper.appendChild(slide);
      });

      console.log(`✅ ${noticias.length} slides inyectados en Swiper`);

      // Inyectar en Nav
      const newsNav = document.getElementById('newsNav');
      if (newsNav) {
        newsNav.innerHTML = '';

        noticias.forEach((noticia, idx) => {
          const navItem = document.createElement('div');
          navItem.className = 'nav-item';
          navItem.dataset.idx = idx;
          navItem.innerHTML = `
            <div class="nav-progress-track">
              <div class="nav-progress-fill" id="p${idx}"></div>
            </div>
            <p class="nav-cat">${noticia.categoria || 'MUNDIAL 2026'}</p>
            <p class="nav-title">${noticia.titulo}</p>
          `;
          newsNav.appendChild(navItem);
        });

        console.log(`✅ ${noticias.length} items inyectados en Nav`);
      }

      // Reinicializar Swiper
      // Destruir la instancia anterior si existe
      const swiperInstance = document.querySelector('#heroSwiper').swiper;
      if (swiperInstance) {
        swiperInstance.destroy();
      }

      // Llamar a la función original de inicialización
      if (window.inicializarCarrusel) {
        window.inicializarCarrusel();
        console.log('✅ Carrusel inicializado con datos dinámicos');
      } else {
        console.warn('⚠️  inicializarCarrusel() no encontrada');
      }

      // Log del estado
      const estado = window.widgetESPN.obtenerEstado();
      console.log('📊 Estado:', estado);

    } catch (error) {
      console.error('❌ Error en carrusel dinámico:', error);
    }
  }

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCarruselDinamico);
  } else {
    inicializarCarruselDinamico();
  }

  // Exponer globalmente para acceso manual
  window.reinicializarCarruselDinamico = inicializarCarruselDinamico;

})();