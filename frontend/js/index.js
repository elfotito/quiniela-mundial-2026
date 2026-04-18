// ===============================================
// INDEX.JS - PÁGINA PRINCIPAL
// ===============================================

const API_URL = CONFIG.API_URL;
let usuarioId = null;

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

    // Countdown al Mundial
    iniciarCountdown();

    // ── Carrusel de noticias (Swiper) ──────────────
    // Se inicializa aquí para garantizar que el DOM
    // ya existe cuando Swiper busca '#heroSwiper'.
    inicializarCarrusel();
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
const btn = document.getElementById('menuToggle');
const menu = document.getElementById('mobileMenu');
if (btn && menu) {
    let isOpen = false;
    btn.addEventListener('click', () => {
        isOpen = !isOpen;
        menu.classList.toggle('show');
        btn.querySelector('i').className = isOpen ? 'fas fa-times' : 'fas fa-bars';
    });
}
// ===============================================
// CARRUSEL DE NOTICIAS (SWIPER)
// ===============================================

function inicializarCarrusel() {
    if (!document.getElementById('heroSwiper')) return;

    const DURATION = 5000;
    let activeIdx = 0;
    let timer = null;

    const swiper = new Swiper('#heroSwiper', {
        slidesPerView: 1,
        speed: 600,
        allowTouchMove: true,
        on: {
            slideChange: function () {
                if (this.activeIndex !== activeIdx) {
                    goTo(this.activeIndex);
                }
            }
        }
    });

    const navItems = document.querySelectorAll('.nav-item');
    // ✅ IDs corregidos: 'p0', 'p1', 'p2', 'p3'
    const progs = [0, 1, 2, 3].map(i => document.getElementById('p' + i));

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.idx);
            swiper.slideTo(idx);
            goTo(idx);
        });
    });

    function goTo(idx) {
        clearTimeout(timer);

        // Resetear barra anterior
        if (progs[activeIdx]) {
            progs[activeIdx].style.transition = 'none';
            progs[activeIdx].style.width = '0%';
        }
        navItems[activeIdx]?.classList.remove('active');

        activeIdx = idx;
        navItems[activeIdx]?.classList.add('active');

        // Animar barra del slide activo
        const fill = progs[activeIdx];
        if (fill) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                fill.style.transition = `width ${DURATION}ms linear`;
                fill.style.width = '100%';
            }));
        }

        // Programar siguiente slide automático
        timer = setTimeout(() => {
            const next = (activeIdx + 1) % navItems.length;
            swiper.slideTo(next);
            goTo(next);
        }, DURATION);
    }

    // ✅ Iniciar el carrusel automáticamente después de que Swiper esté listo
    swiper.on('init', () => {
        goTo(0);
    });

    // Si Swiper ya se inicializó antes de registrar el evento, lo forzamos
    if (swiper.initialized) {
        goTo(0);
    }
}

// ===============================================
// ESTADÍSTICAS DEL USUARIO
// ===============================================

async function cargarEstadisticas() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/estadisticas/usuario/${usuarioId}`);
        if (!response.ok) throw new Error('Error cargando estadísticas');
        const stats = await response.json();
 
        const total      = stats.total_predicciones || 0;
        const aciertos   = stats.aciertos || 0;
        const efectividad = total > 0 ? Math.round((aciertos / total) * 100) : 0;
 
        document.getElementById('statPredicciones').textContent = total;
        document.getElementById('statPuntos').textContent       = stats.puntos_totales || 0;
        document.getElementById('statPosicion').textContent     = stats.posicion_ranking || '—';
        document.getElementById('statEfectividad').textContent  = `${efectividad}%`;
 
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        // Si falla la carga, deja los guiones que ya tiene el HTML por defecto
    }
}

// ===============================================
// PRÓXIMOS PARTIDOS
// ===============================================

// ─── WIDGET: PRÓXIMOS PARTIDOS ───────────────────────────
// Reemplaza tu función cargarProximosPartidos() existente
// El div destino cambió a: #proximosPartidosWidget

async function cargarProximosPartidos() {
    const container = document.getElementById('proximosPartidosWidget');
    if (!container) return;

    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos?estado=pendiente&limit=3`);
        if (!response.ok) throw new Error('Error cargando partidos');
        const partidos = await response.json();

        if (partidos.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px 0;font-size:12px;color:#aaa;">No hay partidos pendientes</div>';
            return;
        }

        // Agrupar por fecha
        const grupos = {};
        partidos.forEach(p => {
            const key = new Date(p.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
            if (!grupos[key]) grupos[key] = [];
            grupos[key].push(p);
        });

        let html = '';
        Object.entries(grupos).forEach(([fecha, lista]) => {
            html += `<div class="match-date-label">${fecha} · ${lista[0].fase}</div>`;
            lista.forEach(p => {
                const hora = new Date(p.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                html += `
                <div class="match-row">
                    <span class="match-team">${obtenerBandera(p.equipo_local)} ${p.equipo_local}</span>
                    <span class="match-time">${hora}</span>
                    <span class="match-team right">${p.equipo_visitante} ${obtenerBandera(p.equipo_visitante)}</span>
                </div>`;
            });
        });

        container.innerHTML = html;

    } catch (err) {
        console.error('Error cargando próximos partidos:', err);
        container.innerHTML = '<div style="text-align:center;padding:12px 0;font-size:12px;color:#aaa;">No disponible</div>';
    }
}

// ─── RANKING TOP 5 ───────────────────────────────────────
async function cargarRankingTop5() {
    const container = document.getElementById('rankingTop5');
    if (!container) return;
 
    try {
        const response = await fetch(`${CONFIG.API_URL}/ranking/top`);
        if (!response.ok) throw new Error('Error cargando ranking');
        const ranking = await response.json();
 
        if (!ranking.length) {
            container.innerHTML = '<div style="text-align:center;padding:20px 0;font-size:12px;color:#aaa;">No hay datos aún</div>';
            return;
        }
 
        const medallas = ['🥇', '🥈', '🥉'];
 
        container.innerHTML = ranking.map((user, index) => {
            // Iniciales para el avatar
            const iniciales = user.nombre
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
 
            const posicion = index < 3
                ? `<span class="rank-medal">${medallas[index]}</span>`
                : `<span class="rank-pos">${index + 1}°</span>`;
 
            return `
            <div class="rank-row">
                ${posicion}
                <div class="rank-avatar">${iniciales}</div>
                <span class="rank-name">${user.nombre}</span>
                <span class="rank-pts">${user.puntos_totales}<span>pts</span></span>
            </div>`;
        }).join('');
 
    } catch (error) {
        console.error('Error cargando ranking:', error);
        container.innerHTML = '<div style="text-align:center;padding:12px 0;font-size:12px;color:#aaa;">No disponible</div>';
    }
}
 
// ─── ÚLTIMOS RESULTADOS ──────────────────────────────────
async function cargarUltimosResultados() {
    const container = document.getElementById('ultimosResultados');
    if (!container) return;
 
    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos?estado=finalizado&limit=3`);
        if (!response.ok) throw new Error('Error cargando resultados');
        const partidos = await response.json();
 
        if (!partidos.length) {
            container.innerHTML = '<div style="text-align:center;padding:20px 0;font-size:12px;color:#aaa;">No hay resultados aún</div>';
            return;
        }
 
        container.innerHTML = partidos.map(partido => `
            <div class="result-row">
                <div class="result-meta">
                    <span class="result-fase">${partido.fase}</span>
                    <span class="result-badge">Finalizado</span>
                </div>
                <div class="result-teams">
                    <span class="result-team">${obtenerBandera(partido.equipo_local)} ${partido.equipo_local}</span>
                    <span class="result-score">${partido.goles_local} – ${partido.goles_visitante}</span>
                    <span class="result-team right">${partido.equipo_visitante} ${obtenerBandera(partido.equipo_visitante)}</span>
                </div>
            </div>`
        ).join('');
 
    } catch (error) {
        console.error('Error cargando resultados:', error);
        container.innerHTML = '<div style="text-align:center;padding:12px 0;font-size:12px;color:#aaa;">No disponible</div>';
    }
}


// ===============================================
// MENÚ MÓVIL
// ===============================================

function configurarMenuMobile() {
    const btnMenu  = document.getElementById('btnMenuMobile');
    const navMobile = document.getElementById('navMobile');

    if (btnMenu && navMobile) {
        btnMenu.addEventListener('click', function () {
            navMobile.classList.toggle('active');
        });
    }
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

// ===============================================
// COUNTDOWN AL MUNDIAL
// ===============================================

function iniciarCountdown() {
    const fechaMundial = new Date('June 11, 2026 00:00:00').getTime();

    function actualizar() {
        const distancia = fechaMundial - new Date().getTime();

        const dias     = Math.floor(distancia / (1000 * 60 * 60 * 24));
        const horas    = Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos  = Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((distancia % (1000 * 60)) / 1000);

        document.getElementById('days').textContent  = dias;
        document.getElementById('hours').textContent = horas.toString().padStart(2, '0');
        document.getElementById('mins').textContent  = minutos.toString().padStart(2, '0');
        document.getElementById('secs').textContent  = segundos.toString().padStart(2, '0');
    }

    actualizar();
    setInterval(actualizar, 1000);
}

// ===============================================
// UTILIDADES — BANDERAS
// ===============================================

function obtenerBandera(nombre) {
    const banderas = {
        // Anfitriones y CONCACAF
        'México': '🇲🇽', 'EE.UU.': '🇺🇸', 'USA': '🇺🇸', 'Canadá': '🇨🇦',
        'Costa Rica': '🇨🇷', 'Panamá': '🇵🇦', 'Jamaica': '🇯🇲', 'Haití': '🇭🇹',
        'Curazao': '🇨🇼', 'Islas de Cabo Verde': '🇨🇻',
        // Sudamérica
        'Brasil': '🇧🇷', 'Argentina': '🇦🇷', 'Uruguay': '🇺🇾', 'Ecuador': '🇪🇨',
        'Colombia': '🇨🇴', 'Paraguay': '🇵🇾', 'Chile': '🇨🇱', 'Perú': '🇵🇪',
        'Venezuela': '🇻🇪', 'Bolivia': '🇧🇴',
        // Europa
        'España': '🇪🇸', 'Alemania': '🇩🇪', 'Francia': '🇫🇷', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'Portugal': '🇵🇹', 'Italia': '🇮🇹', 'Paises Bajos': '🇳🇱', 'Países Bajos': '🇳🇱',
        'Bélgica': '🇧🇪', 'Croacia': '🇭🇷', 'Suiza': '🇨🇭', 'Polonia': '🇵🇱',
        'Austria': '🇦🇹', 'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Noruega': '🇳🇴',
        'Dinamarca': '🇩🇰', 'Turquía': '🇹🇷', 'Ucrania': '🇺🇦', 'Gales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
        'República Checa': '🇨🇿', 'Eslovaquia': '🇸🇰', 'Albania': '🇦🇱', 'Irlanda': '🇮🇪',
        'Bosnia': '🇧🇦', 'Kosovo': '🇽🇰', 'Rumania': '🇷🇴', 'Suecia': '🇸🇪',
        'Macedonia del Norte': '🇲🇰', 'Irlanda del Norte': '🏴󠁧󠁢󠁮󠁩󠁲󠁿',
        // Asia
        'Japón': '🇯🇵', 'Corea del Sur': '🇰🇷', 'Australia': '🇦🇺', 'Irán': '🇮🇷',
        'Arabia Saudí': '🇸🇦', 'Catar': '🇶🇦', 'Uzbekistán': '🇺🇿', 'Jordania': '🇯🇴',
        'Irak': '🇮🇶',
        // África
        'Marruecos': '🇲🇦', 'Senegal': '🇸🇳', 'Túnez': '🇹🇳', 'Egipto': '🇪🇬',
        'Argelia': '🇩🇿', 'Ghana': '🇬🇭', 'Cabo Verde': '🇨🇻', 'Sudáfrica': '🇿🇦',
        'Costa de Marfil': '🇨🇮', 'Camerún': '🇨🇲', 'Nigeria': '🇳🇬', 'Congo': '🇨🇬',
        // Oceanía
        'Nueva Zelanda': '🇳🇿', 'Nueva Caledonia': '🇳🇨',
        // Repechaje
        'Surinam': '🇸🇷'
    };
    return banderas[nombre] || '🏴';
}

// ===============================================
// UTILIDADES — CAMPEÓN ELEGIDO
// ===============================================

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