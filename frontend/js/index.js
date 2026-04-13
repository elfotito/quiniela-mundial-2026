// ===============================================
// INDEX.JS - PÁGINA PRINCIPAL
// ===============================================

const API_URL = CONFIG.API_URL;
let usuarioId = null;
const DURATION = 5000;
let timer = null;
let elapsed = 0;
let startTime = null;
let activeIdx = 0;

const swiper = new Swiper('#heroSwiper', {
  slidesPerView: 1,
  speed: 600,
  allowTouchMove: true,
  on: {
    slideChange: function() {
      goTo(this.activeIndex);
    }
  }
});

const navItems = document.querySelectorAll('.nav-item');
const progs = [0,1,2,3].map(i => document.getElementById('prog'+i));

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const idx = parseInt(item.dataset.index);
    swiper.slideTo(idx);
    goTo(idx);
  });
});
t SLIDE_DURATION = 6000; // ms entre slides (6 segundos)
    const TOTAL_SLIDES   = 4;

    let activeIdx  = 0;
    let autoTimer  = null;
    let animFrame  = null;

    /* Inicializar Swiper sin autoplay propio
       (lo manejamos manualmente para sincronizar
       con la barra de progreso inferior) */
    const swiper = new Swiper('#heroSwiper', {
      slidesPerView : 1,
      speed         : 700,
      allowTouchMove: true,
      on: {
        slideChange() { activateSlide(this.activeIndex, false); }
      }
    });

    /* ---- Barra de progreso animada ---- */
    function activateSlide(idx, fromAuto) {
      /* Limpiar estado previo */
      clearTimeout(autoTimer);
      cancelAnimationFrame(animFrame);

      document.querySelectorAll('.nav-item').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
        const fill = document.getElementById('p' + i);
        fill.style.transition = 'none';
        fill.style.width = '0%';
      });

      activeIdx = idx;

      /* Iniciar barra de progreso con animación CSS */
      const fill = document.getElementById('p' + idx);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fill.style.transition = `width ${SLIDE_DURATION}ms linear`;
        fill.style.width = '100%';
      }));

      /* Pasar al siguiente después de SLIDE_DURATION */
      autoTimer = setTimeout(() => {
        const next = (idx + 1) % TOTAL_SLIDES;
        swiper.slideTo(next);
        activateSlide(next, true);
      }, SLIDE_DURATION);
    }

    /* ---- Clic en la barra de navegación ---- */
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        swiper.slideTo(idx);
        activateSlide(idx, false);
      });
    });

    /* ---- Arrancar ---- */
    activateSlide(0, false);
// ===============================================
// INICIALIZACIÓN
// ===============================================

document.addEventListener('DOMContentLoaded', async () => {

    
    // Verificar login
    await verificarLogin();
    
    // Cargar datos
    await cargarDatos();
    
    // Configurar menú móvil
    configurarMenuMobile();
    
    // Duplicar ticker para efecto infinito
    duplicarTicker();
});

// ===============================================
// VERIFICAR LOGIN
// ===============================================

async function verificarLogin() {
    
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    const usuario = auth.getUser();
    usuarioId = parseInt(usuario.id);
    
    // Mostrar nombre de usuario
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = usuario.nombre;
    
    // Mostrar campeón elegido
    const userCampeon = document.getElementById('userCampeon');
    if (userCampeon) userCampeon.textContent = obtenerCampeon(usuario.campeon_elegido);
    
    // Mostrar botón admin si corresponde
    if (usuario.isAdmin) {
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.style.display = 'flex';
            adminBtn.onclick = () => window.location.href = 'admin.html';
        }
    }
}

// ===============================================
// CARGAR DATOS
// ===============================================

async function cargarDatos() {
    await Promise.all([
        cargarEstadisticas(),
        cargarProximosPartidos(),
        cargarUltimosResultados(),
        cargarRankingTop5()
    ]);
}

function goTo(idx) {
  clearInterval(timer);
  progs[activeIdx].style.transition = 'none';
  progs[activeIdx].style.width = '0%';
  navItems[activeIdx].classList.remove('active');
  activeIdx = idx;
  navItems[activeIdx].classList.add('active');
  elapsed = 0;
  startTime = Date.now();
  runProgress();
}

function runProgress() {
  progs[activeIdx].style.transition = 'none';
  progs[activeIdx].style.width = '0%';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      progs[activeIdx].style.transition = `width ${DURATION}ms linear`;
      progs[activeIdx].style.width = '100%';
    });
  });
  timer = setTimeout(() => {
    const next = (activeIdx + 1) % 4;
    swiper.slideTo(next);
    goTo(next);
  }, DURATION);
}

goTo(0);

// Estadísticas del usuario
async function cargarEstadisticas() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/estadisticas/usuario/${usuarioId}`);
        if (!response.ok) throw new Error('Error cargando estadísticas');
        
        const stats = await response.json();
        
        document.getElementById('statPredicciones').textContent = stats.total_predicciones || 0;
        document.getElementById('statPuntos').textContent = stats.puntos_totales || 0;
        document.getElementById('statPosicion').textContent = stats.posicion_ranking || '-';
        
        // Calcula efectividad
        const total = stats.total_predicciones || 0;
        const aciertos = stats.aciertos || 0;
        const efectividad = total > 0 ? Math.round((aciertos / total) * 100) : 0;
        document.getElementById('statEfectividad').textContent = `${efectividad}%`;
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Próximos 3 partidos
async function cargarProximosPartidos() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos?estado=pendiente&limit=3`);
        if (!response.ok) throw new Error('Error cargando partidos');
        
        const partidos = await response.json();
        const container = document.getElementById('proximosPartidos');
        
        if (partidos.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No hay partidos pendientes</p>';
            return;
        }
        
        container.innerHTML = partidos.map(partido => {
            const fecha = new Date(partido.fecha);
            return `
                <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.85rem; color: #a0a0a0;">${partido.fase}</span>
                        <span style="font-size: 0.85rem; color: #a0a0a0;">${fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong>${obtenerBandera(partido.equipo_local)} ${partido.equipo_local}</strong>
                        <span style="color: #FFD700;">VS</span>
                        <strong>${obtenerBandera(partido.equipo_visitante)} ${partido.equipo_visitante}</strong>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando partidos:', error);
        document.getElementById('proximosPartidos').innerHTML = 
            '<p style="text-align: center; color: #f44336;">Error cargando partidos</p>';
    }
}

// Últimos 3 resultados
async function cargarUltimosResultados() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos?estado=finalizado&limit=3`);
        if (!response.ok) throw new Error('Error cargando resultados');
        
        const partidos = await response.json();
        const container = document.getElementById('ultimosResultados');
        
        if (partidos.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No hay resultados aún</p>';
            return;
        }
        
        container.innerHTML = partidos.map(partido => `
            <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.85rem; color: #a0a0a0;">${partido.fase}</span>
                    <span style="background: #4CAF50; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem;">Finalizado</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${partido.equipo_local}</span>
                    <strong style="color: #FFD700; font-size: 1.25rem;">${partido.goles_local} - ${partido.goles_visitante}</strong>
                    <span>${partido.equipo_visitante}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando resultados:', error);
        document.getElementById('ultimosResultados').innerHTML = 
            '<p style="text-align: center; color: #f44336;">Error cargando resultados</p>';
    }
}

// Top 5 ranking
async function cargarRankingTop5() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/ranking/top`);
        if (!response.ok) throw new Error('Error cargando ranking');
        
        const ranking = await response.json();
        const container = document.getElementById('rankingTop5');
        
        if (ranking.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No hay datos de ranking</p>';
            return;
        }
        
        container.innerHTML = ranking.map((user, index) => {
            const medallas = ['🥇', '🥈', '🥉'];
            const medal = medallas[index] || `${index + 1}°`;
            
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 1.5rem;">${medal}</span>
                        <span style="font-weight: 500;">${user.nombre}</span>
                    </div>
                    <strong style="color: #FFD700; font-size: 1.25rem;">${user.puntos_totales}</strong>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando ranking:', error);
        document.getElementById('rankingTop5').innerHTML = 
            '<p style="text-align: center; color: #f44336;">Error cargando ranking</p>';
    }
}

// ===============================================
// MENÚ MÓVIL
// ===============================================

function configurarMenuMobile() {
    const btnMenu = document.getElementById('btnMenuMobile');
    const navMobile = document.getElementById('navMobile');
    
    if (btnMenu && navMobile) {
        btnMenu.addEventListener('click', function() {
            navMobile.classList.toggle('active');
        });
    }
}
// ===============================================
// CARRUSEL DE NOTICIAS - AGREGAR A index.js
// ===============================================

let currentSlide = 0;
let autoPlayInterval;
const AUTOPLAY_DELAY = 5000; // 5 segundos

function inicializarCarrusel() {
    const slides = document.querySelectorAll('.carousel-slide');
    const thumbnails = document.querySelectorAll('.thumbnail');
    const navPrev = document.getElementById('navPrev');
    const navNext = document.getElementById('navNext');
    
    if (!slides.length) return;
    
    // Navegación manual - Flechas
    if (navPrev) {
        navPrev.addEventListener('click', () => {
            cambiarSlide(currentSlide - 1);
            pausarAutoplay();
        });
    }
    
    if (navNext) {
        navNext.addEventListener('click', () => {
            cambiarSlide(currentSlide + 1);
            pausarAutoplay();
        });
    }
    
    // Navegación manual - Thumbnails
    thumbnails.forEach((thumb, index) => {
        thumb.addEventListener('click', () => {
            cambiarSlide(index);
            pausarAutoplay();
        });
    });
    
    // Auto-play
    iniciarAutoplay();
    
    // Pausar al pasar el mouse
    const carouselMain = document.querySelector('.carousel-main');
    if (carouselMain) {
        carouselMain.addEventListener('mouseenter', pausarAutoplay);
        carouselMain.addEventListener('mouseleave', iniciarAutoplay);
    }
}

function cambiarSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const thumbnails = document.querySelectorAll('.thumbnail');
    
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    
    // Actualizar slides
    slides.forEach(slide => slide.classList.remove('active'));
    slides[index].classList.add('active');
    
    // Actualizar thumbnails
    thumbnails.forEach(thumb => thumb.classList.remove('active'));
    thumbnails[index].classList.add('active');
    
    // Scroll horizontal de thumbnails
    thumbnails[index].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
    });
    
    currentSlide = index;
}

function iniciarAutoplay() {
    pausarAutoplay();
    autoPlayInterval = setInterval(() => {
        cambiarSlide(currentSlide + 1);
    }, AUTOPLAY_DELAY);
}

function pausarAutoplay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
    }
}

// Inicializar cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    inicializarCarrusel();
    
    // ... resto de tu código de index.js
});
function obtenerBandera(nombre) {
    const banderas = {
    // Anfitriones y CONCACAF
    'México': '🇲🇽', 'EE.UU.': '🇺🇸', 'USA': '🇺🇸', 'Canadá': '🇨🇦',
    'Costa Rica': '🇨🇷', 'Panamá': '🇵🇦', 'Jamaica': '🇯🇲', 'Haití': '🇭🇹',
    'Curazao': '🇨🇼', 'Islas de Cabo Verde': '🇨🇻',
    
    // Sudamérica (CONMEBOL)
    'Brasil': '🇧🇷', 'Argentina': '🇦🇷', 'Uruguay': '🇺🇾', 'Ecuador': '🇪🇨',
    'Colombia': '🇨🇴', 'Paraguay': '🇵🇾', 'Chile': '🇨🇱', 'Perú': '🇵🇪',
    'Venezuela': '🇻🇪', 'Bolivia': '🇧🇴',
    
    // Europa (UEFA) - Clasificados directos
    'España': '🇪🇸', 'Alemania': '🇩🇪', 'Francia': '🇫🇷', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Portugal': '🇵🇹', 'Italia': '🇮🇹', 'Paises Bajos': '🇳🇱', 'Países Bajos': '🇳🇱',
    'Bélgica': '🇧🇪', 'Croacia': '🇭🇷', 'Suiza': '🇨🇭', 'Polonia': '🇵🇱',
    'Austria': '🇦🇹', 'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Noruega': '🇳🇴',
    
    // Europa (UEFA) - Repechaje (16 equipos)
    'Dinamarca': '🇩🇰', 'Turquía': '🇹🇷', 'Ucrania': '🇺🇦', 'Gales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'República Checa': '🇨🇿', 'Eslovaquia': '🇸🇰', 'Albania': '🇦🇱', 'Irlanda': '🇮🇪',
    'Bosnia': '🇧🇦', 'Kosovo': '🇽🇰', 'Rumania': '🇷🇴', 'Suecia': '🇸🇪',
    'Macedonia del Norte': '🇲🇰', 'Irlanda del Norte': '🏴󠁧󠁢󠁮󠁩󠁲󠁿',
    
    // Asia (AFC)
    'Japón': '🇯🇵', 'Corea del Sur': '🇰🇷', 'Australia': '🇦🇺', 'Irán': '🇮🇷',
    'Arabia Saudí': '🇸🇦', 'Catar': '🇶🇦', 'Uzbekistán': '🇺🇿', 'Jordania': '🇯🇴',
    'Irak': '🇮🇶',
    
    // África (CAF)
    'Marruecos': '🇲🇦', 'Senegal': '🇸🇳', 'Túnez': '🇹🇳', 'Egipto': '🇪🇬',
    'Argelia': '🇩🇿', 'Ghana': '🇬🇭', 'Cabo Verde': '🇨🇻', 'Sudáfrica': '🇿🇦',
    'Costa de Marfil': '🇨🇮', 'Camerún': '🇨🇲', 'Nigeria': '🇳🇬',
    'Congo': '🇨🇬',
    
    // Oceanía (OFC)
    'Nueva Zelanda': '🇳🇿', 'Nueva Caledonia': '🇳🇨',
    
    // Repechaje Intercontinental (adicionales)
    'Surinam': '🇸🇷'
};
    return banderas[nombre] || '🏴';
}
function obtenerCampeon(codigo) {
    const campeon = {
        'GER': '🇩🇪', 'ARG': '🇦🇷', 'AUS': '🇦🇺', 'AUT': '🇦🇹',
        'BEL': '🇧🇪', 'BOL': '🇧🇴', 'BRA': '🇧🇷', 'CPV': '🇨🇻',
        'CAN': '🇨🇦', 'QAT': '🇶🇦', 'COL': '🇨🇴', 'KOR': '🇰🇷',
        'CIV': '🇨🇮', 'CRO': '🇭🇷', 'CUW': '🇨🇼', 'ECU': '🇪🇨',
        'EGY': '🇪🇬', 'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'ESP': '🇪🇸', 'USA': '🇺🇸',
        'FRA': '🇫🇷', 'GHA': '🇬🇭', 'HAI': '🇭🇹', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'IRQ': '🇮🇶', 'IRN': '🇮🇷', 'JAM': '🇯🇲', 'JPN': '🇯🇵',
        'JOR': '🇯🇴', 'MAR': '🇲🇦', 'MEX': '🇲🇽', 'NOR': '🇳🇴',
        'NCL': '🇳🇨', 'NZL': '🇳🇿', 'NED': '🇳🇱', 'PAN': '🇵🇦',
        'PAR': '🇵🇾', 'POR': '🇵🇹', 'COD': '🇨🇩', 'SEN': '🇸🇳',
        'RSA': '🇿🇦', 'SUI': '🇨🇭', 'SUR': '🇸🇷', 'TUN': '🇹🇳',
        'URU': '🇺🇾', 'UZB': '🇺🇿', 'KSA': '🇸🇦', 'ALG': '🇩🇿'
    };
    return campeon[codigo] || '🏴';
}
// ===============================================
// TICKER INFINITO
// ===============================================

function duplicarTicker() {
    const ticker = document.getElementById('tickerContent');
    if (ticker) {
        const clone = ticker.cloneNode(true);
        ticker.parentElement.appendChild(clone);
    }
}

// ===============================================
// LOGOUT
// ===============================================

function logout() {
    if (confirm('¿Cerrar sesión?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// COUNTDOWN
function iniciarCountdown() {
    const fechaMundial = new Date('June 11, 2026 00:00:00').getTime();
    
    function actualizar() {
        const ahora = new Date().getTime();
        const distancia = fechaMundial - ahora;
        
        const dias = Math.floor(distancia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((distancia % (1000 * 60)) / 1000);
        
        document.getElementById('days').textContent = dias;
        document.getElementById('hours').textContent = horas.toString().padStart(2, '0');
        document.getElementById('mins').textContent = minutos.toString().padStart(2, '0');
        document.getElementById('secs').textContent = segundos.toString().padStart(2, '0');
    }
    
    actualizar();
    setInterval(actualizar, 1000);
}

// Llamar al cargar
iniciarCountdown();