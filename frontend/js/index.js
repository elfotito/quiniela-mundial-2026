// ===============================================
// INDEX.JS - PÁGINA PRINCIPAL
// ===============================================

const API_URL = CONFIG.API_URL;
let usuarioId = null;

// ===============================================
// INICIALIZACIÓN
// ===============================================

document.addEventListener('DOMContentLoaded', async () => {
    await verificarLogin();      
    await cargarDatos();         
    configurarMenuMobile();
    duplicarTicker();
    iniciarCountdown();
    inicializarCarrusel();
    iniciarEasterEgg();
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
        const adminNotiBtn = document.getElementById('adminNoti');
        if (adminNotiBtn) {
            adminNotiBtn.style.display = 'flex';
            adminNotiBtn.onclick = () => window.location.href = 'noticias.html';
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
        cargarRankingTop5(),
        cargarLigaRankingWidget()
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
async function cargarLigaRankingWidget() {
    const container = document.getElementById('ligaRankingWidget');
    const ligaNombre = document.getElementById('ligaWidgetNombre');
    if (!container) return;
 
    try {
        // 1. Obtener la liga del usuario
        const resLigas = await fetch(`${CONFIG.API_URL}/usuarios/${usuarioId}/ligas`);
        if (!resLigas.ok) throw new Error('Sin ligas');
        const ligas = await resLigas.json();
 
        if (!ligas.length) {
            container.innerHTML = '<div class="liga-empty">No estás en ninguna liga</div>';
            return;
        }
 
        // Toma la primera liga del usuario
        const liga = ligas[0];
        if (ligaNombre) {
            ligaNombre.textContent = `${liga.icono || '🏅'} ${liga.nombre}`;
        }
 
        // 2. Obtener ranking completo y filtrar por liga
        const resRanking = await fetch(`${CONFIG.API_URL}/ranking/top`);
        if (!resRanking.ok) throw new Error('Sin ranking');
        const rankingCompleto = await resRanking.json();
 
        // Filtrar usuarios que pertenecen a esta liga
        const rankingLiga = rankingCompleto
            .filter(u => u.ligas && u.ligas.includes(parseInt(liga.id)))
            .sort((a, b) => (b.puntos_totales || 0) - (a.puntos_totales || 0));
 
        if (!rankingLiga.length) {
            container.innerHTML = '<div class="liga-empty">⏳ El torneo aún no ha comenzado</div>';
            return;
        }
 
        const medallas = ['🥇', '🥈', '🥉'];
 
        const filas = rankingLiga.map((user, index) => {
            const posicion = index + 1;
            const esYo = user.usuario_id === parseInt(usuarioId);
            const claseMe = esYo ? 'liga-me' : '';
 
            const pos = posicion <= 3
                ? `<span style="font-size:13px">${medallas[index]}</span>`
                : `<span style="font-size:11px;color:#aaa">${posicion}°</span>`;
 
            const nombre = user.nombre_publico || user.nombre || 'Usuario';
            const nombreCorto = nombre.length > 14 ? nombre.substring(0, 13) + '…' : nombre;
 
            const c9 = user.aciertos_9 ?? '—';
            const c7 = user.aciertos_7 ?? '—';
            const c5 = user.aciertos_5 ?? '—';
            const c2 = user.aciertos_2 ?? '—';
 
            return `
            <tr class="${claseMe}">
                <td class="liga-td-pos left">${pos}</td>
                <td class="liga-td-name left">${nombreCorto}</td>
                <td class="liga-td-col">${c9}</td>
                <td class="liga-td-col">${c7}</td>
                <td class="liga-td-col">${c5}</td>
                <td class="liga-td-col">${c2}</td>
                <td class="liga-td-total">${user.puntos_totales || 0}</td>
            </tr>`;
        }).join('');
 
        container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th class="left">#</th>
                    <th class="left">Jugador</th>
                    <th title="Resultado exacto (+9)">+9</th>
                    <th title="Ganador y diferencia (+7)">+7</th>
                    <th title="Solo el ganador (+5)">+5</th>
                    <th title="Empate correcto (+2)">+2</th>
                    <th title="Puntos totales">P</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>`;
 
    } catch (err) {
        console.error('Error cargando liga ranking widget:', err);
        container.innerHTML = '<div class="liga-empty">No disponible</div>';
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
function iniciarEasterEgg() {
    const memes = [
        { gif: 'img/cucurella.gif',    sound: 'sounds/cucurella.mp3', dur: 2100  },
        { gif: 'img/failshot.gif',     sound: 'sounds/tuco.mp3',      dur: 2300  },
        { gif: 'img/griezman.gif',     sound: 'sounds/67.mp3',        dur: 2800  },
        { gif: 'img/lamine.gif',       sound: 'sounds/ripgranny.mp3', dur: 7900  },
        { gif: 'img/kane.gif',         sound: 'sounds/brainfart.mp3', dur: 5300  },
        { gif: 'img/mbappe-zeki.gif',  sound: 'sounds/mbappe.mp3',    dur: 4700  },
        { gif: 'img/neymar.gif',       sound: 'sounds/ack.mp3',       dur: 4200  },
        { gif: 'img/quemirasbobo.gif', sound: 'sounds/andapaalla.mp3', dur: 7200  },
        { gif: 'img/ronaldosiu.gif',   sound: 'sounds/suii.mp3',      dur: 2700  },
        { gif: 'img/speed.gif',        sound: 'sounds/suwi.mp3',      dur: 4600  },
        { gif: 'img/vinicius.gif',     sound: 'sounds/wearec.mp3',    dur: 6000  },
        { gif: 'img/wirtz.gif',        sound: 'sounds/vine-boom.mp3', dur: 1700 }
    ];
 
    let ultimoIdx  = -1;
    let closeTimer = null;
    let audioActual = null;
 
    const wrap   = document.getElementById('sponsorEasterEgg');
    const logo   = document.getElementById('sponsorLogo');
    const bubble = document.getElementById('memeBubble');
    const gif    = document.getElementById('memeGif');
 
    if (!wrap || !logo || !bubble || !gif) return;
 
    const audios = memes.map(m => {
        const a = new Audio(m.sound);
        a.preload = 'auto';
        return a;
    });
 
    wrap.addEventListener('click',    disparar);
    wrap.addEventListener('touchend', e => { e.preventDefault(); disparar(); });
 
    function posicionarBurbuja() {
        const rect   = logo.getBoundingClientRect();
        const bubbleW = bubble.offsetWidth || 320;
        const bubbleH = bubble.offsetHeight || 240;
        const margin  = 12;
 
        // Centrar sobre el logo
        let left = rect.left + (rect.width / 2) - (bubbleW / 2);
        left = Math.max(margin, Math.min(left, window.innerWidth - bubbleW - margin));
 
        // Encima del logo
        let top = rect.top - bubbleH - 28;
 
        // Si no cabe arriba, poner debajo
        if (top < margin) {
            top = rect.bottom + 28;
            // Mover cola arriba en lugar de abajo
            document.querySelector('.meme-bubble-tail').style.cssText =
                'bottom:auto;top:-14px;border-top:none;border-bottom:14px solid #111;';
        } else {
            document.querySelector('.meme-bubble-tail').style.cssText = '';
        }
 
        bubble.style.left = left + 'px';
        bubble.style.top  = top  + 'px';
    }
 
    function disparar() {
        let idx;
        do { idx = Math.floor(Math.random() * memes.length); } while (idx === ultimoIdx);
        ultimoIdx = idx;
        const m = memes[idx];
 
        logo.classList.remove('shake');
        void logo.offsetWidth;
        logo.classList.add('shake');
 
        gif.src = '';
        gif.src = m.gif;
 
        bubble.classList.remove('show');
        void bubble.offsetWidth;
 
        // Pequeño delay para que el GIF cargue dimensiones antes de posicionar
        setTimeout(() => {
            posicionarBurbuja();
            bubble.classList.add('show');
        }, 30);
 
        if (audioActual) { audioActual.pause(); audioActual.currentTime = 0; }
        audioActual = audios[idx];
        audioActual.currentTime = 0;
        audioActual.play().catch(() => {});
 
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => bubble.classList.remove('show'), m.dur);
    }
 
    document.addEventListener('click', e => {
        if (!wrap.contains(e.target) && !bubble.contains(e.target)) {
            bubble.classList.remove('show');
        }
    });
 
    window.addEventListener('scroll', () => {
        if (bubble.classList.contains('show')) posicionarBurbuja();
    }, { passive: true });
}
// ===============================================
// TICKER INFINITO
// ===============================================

    $(document).ready(function () {
 
      // ── Tus noticias aquí ──
      var noticias = [
        {
          "date": "Febrero 2026",
          "prefix": "📅 Mundial:",
          "heading": "Todos los partidos estan disponible en el calendario.",
          "url": "https://quiniela-mundial-2026-omega.vercel.app/calendario.html"
        },
        {
          "date": "Abril 2026",
          "prefix": "🎯 Quiniela:",
          "heading": "¡Registra tus predicciones antes del inicio del torneo!",
          "url": "https://quiniela-mundial-2026-omega.vercel.app/predicciones.html"
        },
        {
          "date": "Abril 2026",
          "prefix": "👨‍💼 Ligas:",
          "heading": "Vicente es el nuevo presidente de la liga Montesushi.",
          "url": "https://"
        }
      ];
 
      $("#newsTicker3").easyNewsTicker({
        "animation": {
          "effect":   "slide-horizontal",
          "easing":   "easeInOutExpo",
          "duration": 1600,        // ms de la transición
          "delay": 4000        // ms entre cada noticia (opcional, default ~3000)
        },
        "label": {
            "enable": true,
            "text":   "QMTV",
            "background": "#cb2126",
            "color": "#ffffff"
        },
        "data": noticias
      });
 
    });

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