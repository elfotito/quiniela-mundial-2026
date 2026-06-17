/**
 * WIDGET NOTICIAS PARSER - Adaptado para As.com + Supabase + Fallbacks
 * Trae noticias del Mundial 2026 desde el feed de As.com
 * Fallback automático: Supabase → localStorage → NOTICIAS_MUNDIAL hardcodeado
 */

(function() {
  'use strict';

  window.widgetESPN = {  // ← Mantenemos el nombre original
    
    // Configuración actualizada para As.com
    config: {
      rssUrl: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/mundial/',
      corsProxy: 'https://api.allorigins.win/get',
      categoriasValidas: ['mundial 2026', 'mundial fútbol', 'fifa'],
      maxNoticias: 15,
      cacheDuracion: 1800000,
      supabaseUrl: 'https://aohnbafexgwkugtfryrk.supabase.co',
      supabaseKey: 'sb_publishable_LG2mW2C2kgi_dZrB4C9jgw_cMywfRB8',
      fallbackImagePath: 'img/' // Carpeta de imágenes locales
    },

    estado: {
      cargando: false,
      ultimaActualizacion: null,
      fuente: 'ninguna'
    },

    // Array fallback (SIEMPRE disponible)
    noticias_fallback: [
      {
        titulo: "Si lees esto, es que estamos trabajando en la plataforma",
        imagen_url: "frontend/img/noticiaquiniela2.png",
        categoria: "MANTENIMIENTO",
        descripcion: "Nos encontramos trabajando arduamente, a la velocidad que nos permita los 2gb de una canaima",
        url: "#"
      },
      {
        titulo: "🇦🇷 Argentina defiende su título como campeona",
        imagen_url: "https://digitalhub.fifa.com/transform/argentina-2026?io=transform:fill,aspectratio:1x1,width:1536&quality=75",
        categoria: "MUNDIAL 2026",
        descripcion: "Argentina buscará defender su título en el Mundial 2026",
        url: "#"
      }
    ],

    /**
     * Traer y parsear RSS de As.com (Mundial 2026)
     * Mantenemos el nombre traeFeedEspn para compatibilidad
     */
    traeFeedEspn: async function() {  // ← Mantenemos nombre original
      this.estado.cargando = true;
      console.log('📡 Trayendo feed de As.com...');

      try {
        const response = await fetch(
          `${this.config.corsProxy}?url=${encodeURIComponent(this.config.rssUrl)}`
        );
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const parser = new DOMParser();
        const xml = parser.parseFromString(data.contents, 'text/xml');

        if (xml.getElementsByTagName('parsererror').length > 0) {
          throw new Error('Error parseando XML');
        }

        const items = xml.querySelectorAll('item');
        let noticias = [];

        items.forEach(item => {
          const titulo = item.querySelector('title')?.textContent?.trim() || '';
          
          // Descripción: priorizar dcterms:alternative
          let descripcion = '';
          const alternativa = item.getElementsByTagNameNS('http://purl.org/dc/terms/', 'alternative')[0];
          if (alternativa && alternativa.textContent?.trim()) {
            descripcion = alternativa.textContent.trim();
          } else {
            descripcion = item.querySelector('description')?.textContent?.trim() || '';
          }
          
          descripcion = descripcion
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/\s+/g, ' ')
            .trim();
          
          const url = item.querySelector('link')?.textContent?.trim() || '#';
          const pubDate = item.querySelector('pubDate')?.textContent?.trim() || new Date().toISOString();
          const autor = item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0]?.textContent?.trim() || '';

          // Extraer imagen
          let imagen = '';
          const mediaContents = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content');
          
          for (let media of mediaContents) {
            const tipo = media.getAttribute('type') || '';
            const url_media = media.getAttribute('url') || '';
            if (tipo.startsWith('image/') && url_media) {
              imagen = url_media;
              break;
            }
          }
          
          if (!imagen) {
            const thumbnail = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0];
            if (thumbnail) {
              imagen = thumbnail.getAttribute('url') || '';
            }
          }

          // Filtrar por categorías
          const categorias = Array.from(item.getElementsByTagName('category'))
            .map(c => c.textContent?.toLowerCase().trim() || '');
          
          const esMundial = categorias.some(c => 
            this.config.categoriasValidas.some(filtro => c.includes(filtro))
          );

          // Categoría principal
          let categoriaPrincipal = 'MUNDIAL 2026';
          const categoriasEspecificas = categorias.filter(c => 
            !['fútbol', 'fifa', 'mundial fútbol', 'mundial 2026'].includes(c)
          );
          if (categoriasEspecificas.length > 0) {
            categoriaPrincipal = categoriasEspecificas[categoriasEspecificas.length - 1].toUpperCase();
          }

          if (esMundial && titulo) {
            noticias.push({
              titulo: titulo.replace(/\s+/g, ' ').trim(),
              descripcion: descripcion,
              imagen_url: imagen || 'img/placeholder-mundial.jpg',
              categoria: categoriaPrincipal,
              url,
              fuente: 'AS',
              autor: autor,
              fecha_publicacion: pubDate
            });
          }
        });

        noticias = noticias.slice(0, this.config.maxNoticias);
        console.log(`✅ Noticias As.com: ${noticias.length} filtradas`);
        
        await this.guardarEnSupabase(noticias);
        this.guardarEnLocal(noticias);
        
        this.estado.ultimaActualizacion = new Date();
        this.estado.fuente = 'as';
        this.estado.cargando = false;

        return noticias;

      } catch (error) {
        console.error('❌ Error trayendo noticias de As.com:', error.message);
        this.estado.cargando = false;
        this.estado.fuente = 'fallback';
        return await this.obtenerDelFallback();
      }
    },

    guardarEnSupabase: async function(noticias) {
  if (!window.supabase) {
    console.warn('⚠️ Supabase no inicializado');
    return false;
  }

  try {
    // Limpiar noticias antiguas de AS
    await window.supabase
      .from('noticias_carrusel')
      .delete()
      .eq('fuente', 'AS');

    // Insertar nuevas - SIN el campo 'autor'
    const { error } = await window.supabase
      .from('noticias_carrusel')
      .insert(noticias.map(n => ({
        titulo: n.titulo,
        descripcion: n.descripcion,
        imagen_url: n.imagen_url,
        categoria: n.categoria,
        url: n.url,
        fuente: n.fuente,
        fecha_publicacion: n.fecha_publicacion,
        tipo_carrusel: 'automatica'
        // autor: n.autor  ← QUITAMOS ESTE CAMPO
      })));

    if (error) throw error;
    console.log('✅ Guardado en Supabase');
    return true;

  } catch (error) {
    console.error('❌ Error Supabase:', error.message);
    return false;
  }
},

    guardarEnLocal: function(noticias) {
      try {
        const backup = {
          noticias,
          timestamp: Date.now(),
          fuente: 'as'
        };
        localStorage.setItem('noticias_mundial_cache', JSON.stringify(backup));
        console.log('💾 Backup en localStorage');
      } catch (error) {
        console.warn('⚠️ localStorage lleno:', error.message);
      }
    },
    
    obtenerNoticias: async function(tipo = 'todas') {
      // Intento 1: Supabase
      if (window.supabase && typeof window.supabase.from === 'function') {
        try {
          const { data, error } = await window.supabase
            .from('noticias_carrusel')
            .select('*')
            .eq('activo', true)
            .order('fecha_publicacion', { ascending: false });

          if (!error && data && data.length > 0) {
            console.log('📚 Leyendo de Supabase:', data.length);
            this.estado.fuente = 'supabase';
            return data;
          }
        } catch (e) {
          console.warn('⚠️ Supabase query error:', e.message);
        }
      }

      // Intento 2: localStorage
      try {
        const cached = localStorage.getItem('noticias_mundial_cache');
        if (cached) {
          const backup = JSON.parse(cached);
          if (backup.noticias && backup.noticias.length > 0) {
            console.log('💾 Leyendo de localStorage:', backup.noticias.length);
            this.estado.fuente = 'localstorage';
            return backup.noticias;
          }
        }
      } catch (e) {
        console.warn('⚠️ localStorage error:', e.message);
      }

      // Intento 3: Fallback hardcodeado
      console.log('🔴 Usando array hardcodeado local (fallback)');
      this.estado.fuente = 'hardcodeado';
      return this.noticias_fallback || [];
    },

    obtenerDelFallback: async function() {
      return await this.obtenerNoticias();
    },

    obtenerParaCarrusel: async function(cantidad = 4) {
      const noticias = await this.obtenerNoticias();
      return noticias.slice(0, cantidad);
    },

    obtenerEstado: function() {
      return {
        ...this.estado,
        tiempoDesdeActualizacion: this.estado.ultimaActualizacion 
          ? Math.round((Date.now() - this.estado.ultimaActualizacion) / 1000) + 's'
          : 'nunca'
      };
    },

    forzarActualizacion: async function() {
      const ahora = Date.now();
      if (this.estado.ultimaActualizacion && 
          (ahora - this.estado.ultimaActualizacion) < 60000) {
        console.warn('⏳ Espera 60s antes de actualizar de nuevo');
        return false;
      }
      return await this.traeFeedEspn();
    }
  };

  console.log('✅ Widget Mundial 2026 (widgetESPN) cargado - Fuente: As.com');
})();