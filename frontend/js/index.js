// ===============================================
// INDEX.JS - PÁGINA PRINCIPAL
// ===============================================

const API_URL = CONFIG.API_URL;
let usuarioId = null;

// Instancia global de Chart.js para el gráfico de evolución
let uibEvoChart = null;

// ===============================================
// INICIALIZACIÓN
// ===============================================

document.addEventListener('DOMContentLoaded', async () => {
    await verificarLogin();      
    await cargarDatos();         
    iniciarCountdown();
    inicializarCarrusel();
    iniciarTicker();
    iniciarEasterEgg();
    initUserBanner();
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

    document.querySelectorAll('.user-name-display').forEach(el => {
        el.textContent = usuario.nombre;
    });
    
    const emoji = obtenerCampeon(usuario.campeon_elegido);
    document.querySelectorAll('.user-emoji-display').forEach(el => {
        el.textContent = emoji;
    });

    if (usuario.isAdmin) {
    
        document.querySelectorAll('.btn-admin-display').forEach(btn => {
            btn.style.display = 'flex';
            btn.onclick = () => window.location.href = 'admin.html';
        });
        
        document.querySelectorAll('.btn-noticias-display').forEach(btn => {
            btn.style.display = 'flex';
            btn.onclick = () => window.location.href = 'noticias.html';
        });
    }
}

// ===============================================
// CARGAR DATOS
// ===============================================

async function cargarDatos() {
    await Promise.all([
        cargarProximosPartidos(),
        cargarUltimosResultados(),
        cargarRankingTop5(),
        cargarLigaRankingWidget(),
        cargarNoticiasIndex()
    ]);
}
function renderUibEvo(evaluadas) {
    const canvas = document.getElementById('uibEvoChart');
    console.log('renderUibEvo called, evaluadas:', evaluadas, 'canvas:', canvas);
    if (!canvas || typeof Chart === 'undefined') return;
    
    // Destruir chart anterior de forma segura
    if (uibEvoChart instanceof Chart) { 
        uibEvoChart.destroy(); 
    }

    const datos = evaluadas.map((p, i) => ({ x: i + 1, y: p.puntos_obtenidos }));
    console.log('Chart datos:', datos);

    uibEvoChart = new Chart(canvas, {
        type: 'line',
        data: {
            datasets: [{
                data: datos,
                borderColor: '#FFD700',
                backgroundColor: 'rgba(255,215,0,0.07)',
                borderWidth: 2, fill: true, tension: 0.3,
                pointRadius: datos.length <= 12 ? 3 : 0,
                pointHoverRadius: 5,
                pointBackgroundColor: '#FFD700',
                pointBorderColor: '#111', pointBorderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => `Partido ${ctx.parsed.x}: ${ctx.parsed.y} pts` },
                    backgroundColor: '#1a1a1a', titleColor: '#aaa',
                    bodyColor: '#FFD700', borderColor: '#333', borderWidth: 1
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    ticks: { color: 'rgba(255,255,255,.2)', maxTicksLimit: 5, font: { size: 8 } },
                    grid: { color: 'rgba(255,255,255,.04)' },
                    border: { display: false }
                },
                y: {
                    min: 0, max: 9,
                    ticks: {
                        color: 'rgba(255,255,255,.2)', font: { size: 8 },
                        callback: v => [0,2,5,7,9].includes(v) ? v : ''
                    },
                    grid: {
                        color: ctx => [0,2,5,7,9].includes(ctx.tick.value)
                            ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.02)'
                    },
                    border: { display: false }
                }
            }
        }
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

    swiper.on('init', () => {
        goTo(0);
    });

    if (swiper.initialized) {
        goTo(0);
    }
}


// ===============================================
// PRÓXIMOS PARTIDOS
// ===============================================

async function cargarProximosPartidos() {
    const container = document.getElementById('proximosPartidosWidget');
    if (!container) return;
 
    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos?estado=pendiente&limit=3`);
        if (!response.ok) throw new Error('Error cargando partidos');
        const partidos = await response.json();
 
        if (partidos.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px 0;font-size:12px;color:#aaa;">✅ ¡Todos los partidos han sido jugados!</div>';
            return;
        }
 
        container.innerHTML = partidos.map(p => {
            const fecha = new Date(p.fecha);
            const fechaCorta = fecha.toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            const hora = fecha.toLocaleTimeString('es-ES', {
                hour: '2-digit', minute: '2-digit'
            });
 
            return `
            <div class="ppm-card">
                <div class="ppm-header">
                    <span class="ppm-fase">Fase de Grupos · ${p.fase}</span>
                    <span class="ppm-fecha">${fechaCorta}</span>
                </div>
                <div class="ppm-body">
                    <div class="ppm-teams">
                        <div class="ppm-team-row">
                            <span class="ppm-flag">${obtenerBandera(p.equipo_local)}</span>
                            <span class="ppm-name">${p.equipo_local.toUpperCase()}</span>
                        </div>
                        <div class="ppm-team-row">
                            <span class="ppm-flag">${obtenerBandera(p.equipo_visitante)}</span>
                            <span class="ppm-name">${p.equipo_visitante.toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="ppm-hora-col">
                        <span class="ppm-hora">${hora}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
 
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
                <div class="rank-avatar"><span class="user-emoji-display" id="mobileUserCampeon">👤</span></div>
                <span class="rank-name">${user.nombre}</span>
                <span class="rank-pts">${user.puntos_totales}<span>pts</span></span>
            </div>`;
        }).join('');
 
    } catch (error) {
        console.error('Error cargando ranking:', error);
        container.innerHTML = '<div style="text-align:center;padding:12px 0;font-size:12px;color:#aaa;">No disponible</div>';
    }
}
// ─── NOTICIAS FEED A LO ESPN MAANOOO ───────────────────────────────────────
async function cargarNoticiasIndex() {
    const feed = document.getElementById('noticiasFeed');
    if (!feed) return;

    try {
        const res = await fetch(`${CONFIG.API_URL}/noticias?limit=8`);
        if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
        const noticias = await res.json();

        if (!noticias.length) {
            feed.innerHTML = '<div style="text-align:center;padding:24px;font-size:12px;color:#aaa;">No hay noticias publicadas aún</div>';
            return;
        }

        feed.innerHTML = noticias.map(n => renderNoticia(n)).join('');

    } catch (err) {
        console.error('Error cargando noticias:', err);
        feed.innerHTML = '<div style="text-align:center;padding:24px;font-size:12px;color:#aaa;">No disponible</div>';
    }
}

function renderNoticia(n) {
    const fecha = formatearFechaNoticia(n.created_at);

    if (n.tipo === 'hero') {
        const img = n.imagen_url
            ? `<img style="width:100%;height:200px;object-fit:cover;display:block;" src="${n.imagen_url}" alt="${n.titulo}" onerror="this.style.display='none'">`
            : `<div style="width:100%;height:200px;background:#111;display:flex;align-items:center;justify-content:center;font-size:40px;">⚽</div>`;
        return `
        <div style="background:#fff;border-radius:12px;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 6px rgba(0,0,0,0.08);">
            ${img}
            <div style="padding:14px 16px 16px;">
                <span style="display:inline-block;background:#0066CC;color:#fff;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:20px;margin-bottom:8px;">Destacado</span>
                <div style="font-size:16px;font-weight:800;color:#0a0a0a;line-height:1.35;margin-bottom:7px;">${n.titulo}</div>
                ${n.resena ? `<div style="font-size:13px;color:#555;line-height:1.6;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${n.resena}</div>` : ''}
                <div style="font-size:11px;color:#aaa;font-weight:600;">${fecha}</div>
            </div>
        </div>`;
    }

    if (n.tipo === 'secundaria') {
        const img = n.imagen_url
            ? `<img style="width:100px;height:100%;object-fit:cover;flex-shrink:0;" src="${n.imagen_url}" alt="${n.titulo}" onerror="this.style.display='none'">`
            : `<div style="width:100px;flex-shrink:0;background:#111;display:flex;align-items:center;justify-content:center;font-size:28px;">📰</div>`;
        return `
        <div style="background:#fff;border-radius:12px;overflow:hidden;margin-bottom:12px;display:flex;align-items:stretch;min-height:90px;box-shadow:0 1px 6px rgba(0,0,0,0.07);">
            ${img}
            <div style="padding:12px 14px;display:flex;flex-direction:column;justify-content:center;flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:#0a0a0a;line-height:1.4;margin-bottom:5px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${n.titulo}</div>
                ${n.resena ? `<div style="font-size:12px;color:#777;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:4px;">${n.resena}</div>` : ''}
                <div style="font-size:10px;color:#bbb;font-weight:600;">${fecha}</div>
            </div>
        </div>`;
    }

    if (n.tipo === 'partido') {
        const flagLocal    = typeof obtenerBandera === 'function' ? obtenerBandera(n.equipo_local)     : '🏳️';
        const flagVisitante = typeof obtenerBandera === 'function' ? obtenerBandera(n.equipo_visitante) : '🏳️';
        const imgPartido = n.imagen_url
            ? `<img style="width:100%;height:130px;object-fit:cover;display:block;" src="${n.imagen_url}" alt="" onerror="this.remove()">` : '';
        return `
        <div style="background:#fff;border-radius:12px;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 6px rgba(0,0,0,0.08);">
            <div style="background:#0a0a0a;padding:7px 14px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;color:#FFD700;font-weight:800;letter-spacing:1px;text-transform:uppercase;">⚽ Resultado</span>
                <span style="font-size:10px;color:#666;">${fecha}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:18px 14px 14px;gap:8px;">
                <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
                    <span style="font-size:32px;line-height:1;">${flagLocal}</span>
                    <span style="font-size:11px;font-weight:700;color:#333;text-align:center;text-transform:uppercase;">${n.equipo_local || ''}</span>
                </div>
                <div style="display:flex;align-items:center;gap:3px;">
                    <span style="font-size:34px;font-weight:900;color:#0a0a0a;min-width:32px;text-align:center;">${n.marcador_local ?? 0}</span>
                    <span style="font-size:20px;color:#ccc;">–</span>
                    <span style="font-size:34px;font-weight:900;color:#0a0a0a;min-width:32px;text-align:center;">${n.marcador_visitante ?? 0}</span>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
                    <span style="font-size:32px;line-height:1;">${flagVisitante}</span>
                    <span style="font-size:11px;font-weight:700;color:#333;text-align:center;text-transform:uppercase;">${n.equipo_visitante || ''}</span>
                </div>
            </div>
            ${imgPartido}
            ${n.titulo || n.resena ? `
            <div style="padding:10px 14px 14px;border-top:1px solid #f5f5f5;">
                ${n.titulo ? `<div style="font-size:13px;font-weight:700;color:#0a0a0a;margin-bottom:4px;">${n.titulo}</div>` : ''}
                ${n.resena ? `<div style="font-size:12px;color:#777;line-height:1.5;">${n.resena}</div>` : ''}
            </div>` : ''}
        </div>`;
    }

    return '';
}

function formatearFechaNoticia(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const ahora = new Date();
    const diff = Math.floor((ahora - d) / 60000);
    if (diff < 60) return `hace ${diff}m`;
    if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
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
            container.innerHTML = '<div style="text-align:center;padding:20px 0;font-size:12px;color:#aaa;">⏳ El torneo aún no ha comenzado</div>';
            return;
        }

    container.innerHTML = partidos.map(p => {
        const fecha = new Date(p.fecha);
        const fechaCorta = fecha.toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        return `
            <div class="ppm-card">
                <div class="ppm-header">
                    <span class="ppm-fase">Fase de Grupos · ${p.fase}</span>
                    <div class="ppm-fecha">Finalizado</div>
                </div>
                <div class="ppm-body">
                    <div class="ppm-teams">
                    <div class="ppm-result-label"></div>
                        <div class="ppm-team-row">
                            <span class="ppm-flag">${obtenerBandera(p.equipo_local)}</span>
                            <span class="ppm-name">${p.equipo_local.toUpperCase()}</span>
                        </div>
                        <div class="ppm-team-row">
                            <span class="ppm-flag">${obtenerBandera(p.equipo_visitante)}</span>
                            <span class="ppm-name">${p.equipo_visitante.toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="ppm-result-col">
                        <div class="ppm-result-stack">
                            <span class="ppm-result-num">${p.goles_local !== null && p.goles_local !== undefined ? p.goles_local : '—'}</span>
                            <div class="ppm-result-line"></div>
                            <span class="ppm-result-num">${p.goles_visitante !== null && p.goles_visitante !== undefined ? p.goles_visitante : '—'}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

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
// MEME EASTER EGG
// ===============================================
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
 
function iniciarTicker() {
      var noticias = [
        {
          "prefix": "📅 Seleccion:",
          "heading": "Cuerpo Tecnico: Hemos tomado la difícil decisión de priorizar la comodidad del hogar",
          "url": "noticia1.html"
        },
        {
          "prefix": "📅 Mundial:",
          "heading": "Todos los partidos estan disponible en el calendario",
          "url": "https://quiniela-mundial-2026-omega.vercel.app/calendario.html"
        },
        {
          "prefix": "🎯 Quiniela:",
          "heading": "¡Registra tus predicciones antes del inicio del mundial!",
          "url": "https://quiniela-mundial-2026-omega.vercel.app/predicciones.html"
        },
        {
          "prefix": "👨‍💼 Ligas:",
          "heading": "Vicente es el nuevo presidente de la liga Montesushi",
          "url": ""
        },
        {
          "prefix": "👨‍💼 Ligas:",
          "heading": "Victor es el nuevo presidente de la liga Los Carrisan",
          "url": ""
        },
      ];
 
      $("#newsTicker3").easyNewsTicker({
        "animation": {
            "effect":   "slide-horizontal",
            "easing":   "easeInOutExpo",
            "duration": 1600,        
            "delay": 4000        
        },
        "label": {
            "enable": true,
            "text":   "QM26",
            "background": "#cb2126",
            "color": "#ffffff",
            "fontFamily": "SportsNight",      
            "fontSize":   38,            
            "fontWeight": "700",
            "letter-spacing": "-1px"
        },
        "data": noticias,
        "news": {
            "background": "#ffffff"
        },
      });
 
    };

let uibDonutChart = null;
const TOTAL_PARTIDOS_MUNDIAL = 104;

async function initUserBanner() {
    const usuario = auth.getUser ? auth.getUser() : null;
    if (!usuario) return;

    // ── Nombre y campeón ─────────────────────────────
    const nombre = usuario.nombre_publico || usuario.nombre || usuario.codigo || 'Usuario';
    document.getElementById('uibNombre').textContent = nombre;

    const campeonBandera = typeof obtenerBandera === 'function'
        ? obtenerBandera(usuario.campeon_elegido) : '🏳️';
    document.getElementById('uibCampeon').textContent = campeonBandera;

    // ── Liga ─────────────────────────────────────────
    try {
        const resLiga = await fetch(`${CONFIG.API_URL}/usuarios/${usuario.id}/ligas`);
        const ligas = await resLiga.json();
        document.getElementById('uibLiga').textContent =
            ligas.length ? `${ligas[0].icono || '🏅'} ${ligas[0].nombre}` : '—';
    } catch { document.getElementById('uibLiga').textContent = '—'; }

    // ── Estadísticas del endpoint ─────────────────────
    try {
        const resStats = await fetch(`${CONFIG.API_URL}/estadisticas/usuario/${usuario.id}`);
        const stats = await resStats.json();

        const pts    = stats.puntos_totales       || 0;
        const total  = parseInt(stats.total_predicciones) || 0;
        const aciert = parseInt(stats.aciertos)    || 0;
        const efect  = parseFloat(stats.efectividad) || 0;
        const pos    = stats.posicion_ranking       || '—';

        document.getElementById('uibPuntos').textContent       = pts;
        document.getElementById('uibPredicciones').textContent  = total;
        document.getElementById('uibAciertos').textContent      = aciert;
        document.getElementById('uibEfectividad').textContent   = `${efect}%`;
        document.getElementById('uibPosicion').innerHTML =
            `<i class="bi bi-trophy-fill"></i> ${pos}° lugar`;

        // Barras
        const pctProgreso   = Math.round((total / TOTAL_PARTIDOS_MUNDIAL) * 100);
        const maxPosible    = total * 9;
        const pctRendimiento = maxPosible > 0 ? Math.round((pts / maxPosible) * 100) : 0;

        setTimeout(() => {
            const bP = document.getElementById('uibBarProgreso');
            const bR = document.getElementById('uibBarRendimiento');
            if (bP) bP.style.width = pctProgreso + '%';
            if (bR) bR.style.width = pctRendimiento + '%';
            document.getElementById('uibProgresoVal').textContent =
                `${total} / ${TOTAL_PARTIDOS_MUNDIAL} partidos`;
            document.getElementById('uibRendimientoVal').textContent =
                `${pts} / ${maxPosible} pts`;
        }, 150);

        // Sincronizar IDs originales si existen en la página
        const sync = { statPosicion: pos, statPuntos: pts, statPredicciones: total, statEfectividad: `${efect}%` };
        Object.entries(sync).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });

    } catch (err) {
        console.error('Error stats banner:', err);
    }

    // ── Predicciones para el donut ────────────────────
    // Cargamos las predicciones evaluadas para el desglose
    try {
        const resPred = await fetch(`${CONFIG.API_URL}/predicciones/${usuario.id}`);
        const predicciones = await resPred.json();

        const evaluadas = predicciones.filter(p => p.puntos_obtenidos !== null);
        const exactos     = evaluadas.filter(p => p.puntos_obtenidos === 9).length;
        const ganMar      = evaluadas.filter(p => p.puntos_obtenidos === 7).length;
        const ganador     = evaluadas.filter(p => p.puntos_obtenidos === 5).length;
        const marcador    = evaluadas.filter(p => p.puntos_obtenidos === 2).length;
        const fallados    = evaluadas.filter(p => p.puntos_obtenidos === 0).length;

        // Leyenda
        const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
s('bdExacto',    exactos);
s('bdGanMar',    ganMar);
s('bdGan',       ganador);
s('bdMar',       marcador);
s('bdExactoPts', `${exactos  * 9} pts`);
s('bdGanMarPts', `${ganMar   * 7} pts`);
s('bdGanPts',    `${ganador  * 5} pts`);
s('bdMarPts',    `${marcador * 2} pts`);
s('bdTotal',     `${exactos*9 + ganMar*7 + ganador*5 + marcador*2} pts`);

        // Donut
        renderUibDonut(exactos, ganMar, ganador, marcador, fallados);
        const evaluadasEvo = predicciones
    .filter(p => p.puntos_obtenidos !== null)
    .sort((a, b) => new Date(a.fecha_partido || a.fecha) - new Date(b.fecha_partido || b.fecha));

console.log('evaluadasEvo antes de renderizar:', evaluadasEvo);
setTimeout(() => renderUibEvo(evaluadasEvo), 200);

    } catch (err) {
        console.error('Error predicciones donut:', err);
        renderUibDonut(0, 0, 0, 0, 1); // vacío
    }
}

function renderUibDonut(exactos, ganMar, ganador, marcador, fallados) {
    const canvas = document.getElementById('uibDonutChart');
    if (!canvas || typeof Chart === 'undefined') return;
    
    // Destruir chart anterior de forma segura
    if (uibDonutChart instanceof Chart) { 
        uibDonutChart.destroy(); 
    }

    const total = exactos + ganMar + ganador + marcador + fallados;
    const data  = total > 0
        ? [exactos, ganMar, ganador, marcador, fallados]
        : [0, 0, 0, 0, 1]; // placeholder vacío

    uibDonutChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            datasets: [{
                data,
                backgroundColor: [
                    '#22c55e',  // exacto +9
                    '#FFD700',  // ganador+marcador +7
                    '#a855f7',  // ganador +5
                    '#3b82f6',  // marcador +2
                    total > 0 ? '#ef4444' : '#2a2a2a'  // fallados / vacío
                ],
                borderWidth: 0,
                borderRadius: 3,
                hoverOffset: 4
            }]
        },
        options: {
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: {
                duration: 900,
                easing: 'easeInOutQuart'
            }
        }
    });
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

// ===============================================
// MENÚ MÓVIL
// ===============================================
(function inicializarMenuMovil() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarMenuMovil);
        return;
    }
    const menuBtn    = document.getElementById('menuToggleBtn');
    const menu       = document.getElementById('mobileMenu');
    const backdrop   = document.getElementById('mmoBackdrop');
    const closeBtn   = document.getElementById('mobileMenuClose');
 
    function openMenu() {
        menu.classList.add('show');
        backdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
 
    function closeMenu() {
        menu.classList.remove('show');
        backdrop.classList.remove('show');
        document.body.style.overflow = '';
    }
 
    if (menuBtn) menuBtn.addEventListener('click', () => {
    menu.classList.contains('show') ? closeMenu() : openMenu();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (backdrop) backdrop.addEventListener('click', closeMenu);
 
    // Marcar ítem activo según página actual
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.mbn-item').forEach(item => {
        const href = item.getAttribute('href') || '';
        if (href && href.includes(currentPage)) {
            item.classList.add('active');
        }
    });
})();