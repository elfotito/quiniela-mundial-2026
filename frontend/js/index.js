// ===============================================
// INDEX.JS - PÁGINA PRINCIPAL (CORREGIDO)
// ===============================================

// Validación temprana de dependencias
if (typeof CONFIG === 'undefined') {
    console.error('❌ CONFIG no está definido. Asegúrate de cargar config.js antes que index.js');
}
if (typeof auth === 'undefined') {
    console.error('❌ auth no está definido. Asegúrate de cargar auth.js antes que index.js');
}

const API_URL = typeof CONFIG !== 'undefined' ? CONFIG.API_URL : '';
let usuarioId = null;

// ===============================================
// INICIALIZACIÓN (UN SOLO LISTENER)
// ===============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar login
    await verificarLogin();

    // Si no está autenticado, no seguimos
    if (!usuarioId) return;

    // Cargar todos los datos
    await cargarDatos();

    // Configurar UI
    configurarMenuMobile();
    duplicarTicker();
    iniciarCountdown();
    inicializarCarrusel();
});

// ===============================================
// VERIFICAR LOGIN
// ===============================================
async function verificarLogin() {
    if (typeof auth === 'undefined') return;

    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const usuario = auth.getUser();
    usuarioId = parseInt(usuario.id);

    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = usuario.nombre;

    const userCampeon = document.getElementById('userCampeon');
    if (userCampeon) userCampeon.textContent = obtenerCampeon(usuario.campeon_elegido);

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

// ===============================================
// CARRUSEL DE NOTICIAS (SWIPER)
// ===============================================
function inicializarCarrusel() {
    if (!document.getElementById('heroSwiper')) return;
    if (typeof Swiper === 'undefined') {
        console.warn('⚠️ Swiper no está cargado. El carrusel no funcionará.');
        return;
    }

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
            },
            init: function () {
                goTo(0);
            }
        }
    });

    const navItems = document.querySelectorAll('.nav-item');
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

        if (progs[activeIdx]) {
            progs[activeIdx].style.transition = 'none';
            progs[activeIdx].style.width = '0%';
        }
        navItems[activeIdx]?.classList.remove('active');

        activeIdx = idx;
        navItems[activeIdx]?.classList.add('active');

        const fill = progs[activeIdx];
        if (fill) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                fill.style.transition = `width ${DURATION}ms linear`;
                fill.style.width = '100%';
            }));
        }

        timer = setTimeout(() => {
            const next = (activeIdx + 1) % navItems.length;
            swiper.slideTo(next);
            goTo(next);
        }, DURATION);
    }

    // Si Swiper ya está inicializado, forzamos el inicio
    if (swiper.initialized) {
        goTo(0);
    }
}

// ===============================================
// ESTADÍSTICAS DEL USUARIO
// ===============================================
async function cargarEstadisticas() {
    try {
        const response = await fetch(`${API_URL}/estadisticas/usuario/${usuarioId}`);
        if (!response.ok) throw new Error('Error cargando estadísticas');

        const stats = await response.json();

        document.getElementById('statPredicciones').textContent = stats.total_predicciones || 0;
        document.getElementById('statPuntos').textContent       = stats.puntos_totales || 0;
        document.getElementById('statPosicion').textContent     = stats.posicion_ranking || '-';

        const total       = stats.total_predicciones || 0;
        const aciertos    = stats.aciertos || 0;
        const efectividad = total > 0 ? Math.round((aciertos / total) * 100) : 0;
        document.getElementById('statEfectividad').textContent = `${efectividad}%`;

    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        ['statPredicciones', 'statPuntos', 'statPosicion', 'statEfectividad'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
    }
}

// ===============================================
// PRÓXIMOS PARTIDOS
// ===============================================
async function cargarProximosPartidos() {
    const container = document.getElementById('proximosPartidosWidget');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/partidos?estado=pendiente&limit=3`);
        if (!response.ok) throw new Error('Error cargando partidos');
        const partidos = await response.json();

        if (partidos.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px 0;font-size:12px;color:#aaa;">No hay partidos pendientes</div>';
            return;
        }

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

// ===============================================
// RANKING TOP 5
// ===============================================
async function cargarRankingTop5() {
    const container = document.getElementById('rankingTop5');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/ranking/top`);
        if (!response.ok) throw new Error('Error cargando ranking');
        const ranking = await response.json();

        if (!ranking.length) {
            container.innerHTML = '<div style="text-align:center;padding:20px 0;font-size:12px;color:#aaa;">No hay datos aún</div>';
            return;
        }

        const medallas = ['🥇', '🥈', '🥉'];

        container.innerHTML = ranking.map((user, index) => {
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

// ===============================================
// ÚLTIMOS RESULTADOS
// ===============================================
async function cargarUltimosResultados() {
    const container = document.getElementById('ultimosResultados');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/partidos?estado=finalizado&limit=3`);
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
// MENÚ MÓVIL (UNIFICADO)
// ===============================================
function configurarMenuMobile() {
    // Menú toggle (el que estaba suelto)
    const btnToggle = document.getElementById('menuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (btnToggle && mobileMenu) {
        let isOpen = false;
        btnToggle.addEventListener('click', () => {
            isOpen = !isOpen;
            mobileMenu.classList.toggle('show');
            const icon = btnToggle.querySelector('i');
            if (icon) {
                icon.className = isOpen ? 'fas fa-times' : 'fas fa-bars';
            }
        });
    }

    // Otro menú mobile alternativo (si existe)
    const btnMenu = document.getElementById('btnMenuMobile');
    const navMobile = document.getElementById('navMobile');
    if (btnMenu && navMobile) {
        btnMenu.addEventListener('click', () => {
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

        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minsEl = document.getElementById('mins');
        const secsEl = document.getElementById('secs');

        if (daysEl) daysEl.textContent = dias;
        if (hoursEl) hoursEl.textContent = horas.toString().padStart(2, '0');
        if (minsEl) minsEl.textContent = minutos.toString().padStart(2, '0');
        if (secsEl) secsEl.textContent = segundos.toString().padStart(2, '0');
    }

    actualizar();
    setInterval(actualizar, 1000);
}

// ===============================================
// UTILIDADES — BANDERAS
// ===============================================
function obtenerBandera(nombre) {
    const banderas = {
        'México': '🇲🇽', 'EE.UU.': '🇺🇸', 'USA': '🇺🇸', 'Canadá': '🇨🇦',
        'Costa Rica': '🇨🇷', 'Panamá': '🇵🇦', 'Jamaica': '🇯🇲', 'Haití': '🇭🇹',
        'Curazao': '🇨🇼', 'Islas de Cabo Verde': '🇨🇻',
        'Brasil': '🇧🇷', 'Argentina': '🇦🇷', 'Uruguay': '🇺🇾', 'Ecuador': '🇪🇨',
        'Colombia': '🇨🇴', 'Paraguay': '🇵🇾', 'Chile': '🇨🇱', 'Perú': '🇵🇪',
        'Venezuela': '🇻🇪', 'Bolivia': '🇧🇴',
        'España': '🇪🇸', 'Alemania': '🇩🇪', 'Francia': '🇫🇷', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'Portugal': '🇵🇹', 'Italia': '🇮🇹', 'Paises Bajos': '🇳🇱', 'Países Bajos': '🇳🇱',
        'Bélgica': '🇧🇪', 'Croacia': '🇭🇷', 'Suiza': '🇨🇭', 'Polonia': '🇵🇱',
        'Austria': '🇦🇹', 'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Noruega': '🇳🇴',
        'Dinamarca': '🇩🇰', 'Turquía': '🇹🇷', 'Ucrania': '🇺🇦', 'Gales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
        'República Checa': '🇨🇿', 'Eslovaquia': '🇸🇰', 'Albania': '🇦🇱', 'Irlanda': '🇮🇪',
        'Bosnia': '🇧🇦', 'Kosovo': '🇽🇰', 'Rumania': '🇷🇴', 'Suecia': '🇸🇪',
        'Macedonia del Norte': '🇲🇰', 'Irlanda del Norte': '🏴󠁧󠁢󠁮󠁩󠁲󠁿',
        'Japón': '🇯🇵', 'Corea del Sur': '🇰🇷', 'Australia': '🇦🇺', 'Irán': '🇮🇷',
        'Arabia Saudí': '🇸🇦', 'Catar': '🇶🇦', 'Uzbekistán': '🇺🇿', 'Jordania': '🇯🇴',
        'Irak': '🇮🇶',
        'Marruecos': '🇲🇦', 'Senegal': '🇸🇳', 'Túnez': '🇹🇳', 'Egipto': '🇪🇬',
        'Argelia': '🇩🇿', 'Ghana': '🇬🇭', 'Cabo Verde': '🇨🇻', 'Sudáfrica': '🇿🇦',
        'Costa de Marfil': '🇨🇮', 'Camerún': '🇨🇲', 'Nigeria': '🇳🇬', 'Congo': '🇨🇬',
        'Nueva Zelanda': '🇳🇿', 'Nueva Caledonia': '🇳🇨',
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