/**
 * WIDGET ESPN PARSER - Robusto con Supabase + Fallbacks
 * Trae noticias de ESPN Deportes RSS, las parsea y las guarda en Supabase
 * Fallback automático: Supabase → localStorage → NOTICIAS_MUNDIAL hardcodeado
 */

(function() {
  'use strict';

  window.widgetESPN = {
    
    // Configuración
    config: {
      rssUrl: 'https://www.espndeportes.espn.com/feeds/rss/futbol.xml',
      corsProxy: 'https://api.allorigins.win/get',
      keywords: ['Copa Mundial 2026', 'FIFA World Cup 2026', 'Mundial de Fútbol 2026', 'Partidos Mundial 2026'],
      maxNoticias: 15,
      cacheDuracion: 1800000, // 30 min en ms
      supabaseUrl: window.SUPABASE_URL,
      supabaseKey: window.SUPABASE_ANON_KEY
    },

    // Estado
    estado: {
      cargando: false,
      ultimaActualizacion: null,
      fuente: 'ninguna' // 'espn', 'supabase', 'localstorage', 'hardcodeado'
    },

    /**
     * Traer y parsear RSS de ESPN
     */
    async traeFeedEspn() {
      this.estado.cargando = true;
      console.log('📡 Trayendo feed ESPN...');

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
          const descripcion = item.querySelector('description')?.textContent?.trim() || '';
          const url = item.querySelector('link')?.textContent?.trim() || '#';
          const pubDate = item.querySelector('pubDate')?.textContent?.trim() || new Date().toISOString();

          // Extraer imagen si existe
          let imagen = '';
          const content = item.querySelector('content:encoded')?.textContent || '';
          const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/);
          if (imgMatch) imagen = imgMatch[1];

          // Filtrar por keywords
          const textoCompleto = (titulo + ' ' + descripcion).toLowerCase();
          const tieneKeyword = this.config.keywords.some(kw => 
            textoCompleto.includes(kw.toLowerCase())
          );

          if (tieneKeyword && titulo) {
            noticias.push({
              titulo,
              descripcion,
              imagen_url: imagen || 'https://via.placeholder.com/600x400?text=ESPN',
              categoria: 'MUNDIAL 2026',
              url,
              fuente: 'ESPN',
              fecha_publicacion: pubDate
            });
          }
        });

        // Limitar a maxNoticias
        noticias = noticias.slice(0, this.config.maxNoticias);

        console.log(`✅ ESPN: ${noticias.length} noticias filtradas`);
        
        // Guardar en Supabase
        await this.guardarEnSupabase(noticias);
        
        // Backup en localStorage
        this.guardarEnLocal(noticias);
        
        this.estado.ultimaActualizacion = new Date();
        this.estado.fuente = 'espn';
        this.estado.cargando = false;

        return noticias;

      } catch (error) {
        console.error('❌ Error en ESPN:', error.message);
        this.estado.cargando = false;
        this.estado.fuente = 'fallback';
        
        // Intentar fallbacks
        return await this.obtenerDelFallback();
      }
    },

    /**
     * Guardar noticias en Supabase
     */
    async guardarEnSupabase(noticias) {
      if (!window.supabase) {
        console.warn('⚠️  Supabase no inicializado');
        return false;
      }

      try {
        // Limpiar noticias antiguas de ESPN
        await window.supabase
          .from('noticias_carrusel')
          .delete()
          .eq('fuente', 'ESPN');

        // Insertar nuevas
        const { error } = await window.supabase
          .from('noticias_carrusel')
          .insert(noticias.map(n => ({
            ...n,
            tipo_carrusel: 'automatica'
          })));

        if (error) throw error;
        console.log('✅ Guardado en Supabase');
        return true;

      } catch (error) {
        console.error('❌ Error Supabase:', error.message);
        return false;
      }
    },

    /**
     * Guardar en localStorage como backup
     */
    guardarEnLocal(noticias) {
      try {
        const backup = {
          noticias,
          timestamp: Date.now(),
          fuente: 'espn'
        };
        localStorage.setItem('noticias_mundial_cache', JSON.stringify(backup));
        console.log('💾 Backup en localStorage');
      } catch (error) {
        console.warn('⚠️  localStorage lleno:', error.message);
      }
    },

    /**
     * Obtener noticias (intenta Supabase → localStorage → hardcodeado)
     */
    async obtenerNoticias(tipo = 'todas') {
      // Intento 1: Supabase
      if (window.supabase) {
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
          console.warn('⚠️  Supabase no disponible:', e.message);
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
        console.warn('⚠️  localStorage error:', e.message);
      }

      // Intento 3: Fallback hardcodeado
      console.log('🔴 Usando NOTICIAS_MUNDIAL (fallback)');
      this.estado.fuente = 'hardcodeado';
      return window.NOTICIAS_MUNDIAL || [];
    },

    /**
     * Obtener del fallback (cuando ESPN falla)
     */
    async obtenerDelFallback() {
      return await this.obtenerNoticias();
    },

    /**
     * Obtener N noticias para un carrusel
     */
    async obtenerParaCarrusel(cantidad = 4) {
      const noticias = await this.obtenerNoticias();
      return noticias.slice(0, cantidad);
    },

    /**
     * Obtener estado actual
     */
    obtenerEstado() {
      return {
        ...this.estado,
        tiempoDesdeActualizacion: this.estado.ultimaActualizacion 
          ? Math.round((Date.now() - this.estado.ultimaActualizacion) / 1000) + 's'
          : 'nunca'
      };
    },

    /**
     * Forzar actualización (con cooldown)
     */
    async forzarActualizacion() {
      const ahora = Date.now();
      if (this.estado.ultimaActualizacion && 
          (ahora - this.estado.ultimaActualizacion) < 60000) {
        console.warn('⏳ Espera 60s antes de actualizar de nuevo');
        return false;
      }
      return await this.traeFeedEspn();
    }
  };

  console.log('✅ Widget ESPN cargado');
})();