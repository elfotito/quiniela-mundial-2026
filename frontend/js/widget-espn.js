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
      supabaseUrl: 'https://aohnbafexgwkugtryrk.supabase.co',
      supabaseKey: 'sb_publishable_LG2mW2C2kgi_dZrB4C9jgw_cMywfRB8'
    },

    // Estado
    estado: {
      cargando: false,
      ultimaActualizacion: null,
      fuente: 'ninguna' // 'espn', 'supabase', 'localstorage', 'hardcodeado'
    },

    // Array fallback (SIEMPRE disponible)
    noticias_fallback: [
      {
    titulo: "🇪🇸 Desastre: las reacciones en España tras empatar con Cabo Verde",
    imagen_url: "https://a3.espncdn.com/combiner/i?img=%2Fphoto%2F2026%2F0615%2Fr1673627_1296x518_5%2D2.jpg&w=686&h=274&scale=crop&cquality=40&location=center&format=jpg",
    categoria: "PREVIA",
    descripcion: "Las reacciones en los medios ibéricos no tardaron en llegar."
      },
      {
        titulo: "⚽ Japón empata ante Países Bajos en un vibrante partido",
        imagen_url: "https://a4.espncdn.com/combiner/i?img=%2Fphoto%2F2026%2F0612%2Fr1671753_1296x729_16%2D9.jpg&w=1140&cquality=40&format=jpg",
        categoria: "PARTIDO",
        descripcion: "Un gol tardío de Kamada le da un valioso empate a Japón sobre Países Bajos (2-2)."
      },
      {
        titulo: "🇩🇪 Alemania arranca con una contundente goleada de 7-1",
        imagen_url: "https://a4.espncdn.com/combiner/i?img=%2Fphoto%2F2026%2F0612%2Fr1671753_1296x729_16%2D9.jpg&w=1140&cquality=40&format=jpg",
        categoria: "RESULTADOS",
        descripcion: "Alemania demostró su poderío ofensivo al vencer 7-1 a Curazao en su debut."
      },
      {
        titulo: "🇰🇷 Corea del sur le da vuelta a Rep Checa y asegura sus 3 puntos vitales",
        imagen_url: "https://a4.espncdn.com/combiner/i?img=%2Fphoto%2F2026%2F0612%2Fr1671753_1296x729_16%2D9.jpg&w=1140&cquality=40&format=jpg",
        categoria: "PARTIDO",
        descripcion: "Corea del Sur remonta y vence a República Checa",
        url: "#"
      },
      {
        titulo: "🇲🇽 México supera a Sudáfrica y sonríe en el debut",
        imagen_url: "https://a.espncdn.com/combiner/i?img=%2Fphoto%2F2026%2F0611%2Fr1671534_1296x729_16%2D9.jpg",
        categoria: "PARTIDO",
        descripcion: "México inicia su campaña con una victoria",
        url: "#"
      },
      {
        titulo: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 ¿Kane ganara la bota de oro por segunda vez?",
        imagen_url: "https://digitalhub.fifa.com/transform/38f4af27-b519-4fde-a6d0-44d339831b12/Harry-Kane-celebrates-after-England-beat-Serbia-in-European-qualifying-for-the-FIFA-World-Cup-2026?&io=transform:fill,aspectratio:1x1,width:1536&quality=75",
        categoria: "BOTA DE ORO",
        descripcion: "Kane podría ser el primer jugador en ganar dos botas de oro",
        url: "#"
      },
      {
        titulo: "🇲🇽 México ya tiene listo su espectáculo para inaugurar el Mundial 2026",
        imagen_url: "https://i.ibb.co/Z69TCzdP/Getty-Images-2268851671-ee7486.png",
        categoria: "INAUGURACION",
        descripcion: "México prepara una ceremonia espectacular",
        url: "#"
      },
      {
        titulo: "🇧🇪 Bélgica lista para el debut ante Egipto",
        imagen_url: "https://digitalhub.fifa.com/transform/830000c6-7efd-4d70-99a9-7f0b2b111503/Belgium-v-Egypt-Group-G-FIFA-World-Cup-2026?focuspoint=0.52,0.4&io=transform:fill,aspectratio:1x1,width:1536&quality=75",
        categoria: "PARTIDO",
        descripcion: "Bélgica se prepara para enfrentar a Egipto",
        url: "#"
      },
      {
        titulo: "🇪🇸 España busca revancha ante Cabo Verde",
        imagen_url: "https://digitalhub.fifa.com/transform/b09c5893-6c7e-429c-8dfd-536c496e9d63/Spain-v-Cabo-Verde-Group-H-FIFA-World-Cup-2026?focuspoint=0.77,0.22&io=transform:fill,aspectratio:1x1,width:1536&quality=75",
        categoria: "PARTIDO",
        descripcion: "España enfrentará a Cabo Verde en el Grupo H",
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
      // TEMPORALMENTE: Saltamos Supabase y vamos directo al fallback
      // (Supabase necesita CORS configurado)
      
      console.log('💾 Leyendo del array local (fallback)');
      this.estado.fuente = 'hardcodeado';
      return this.noticias_fallback || [];

      /* CÓDIGO SUPABASE DESACTIVADO TEMPORALMENTE
      // Intento 1: Supabase (SI ESTÁ DISPONIBLE)
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
          console.warn('⚠️  Supabase query error:', e.message);
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
      console.log('🔴 Usando array hardcodeado local (fallback)');
      this.estado.fuente = 'hardcodeado';
      return this.noticias_fallback || [];
      */
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