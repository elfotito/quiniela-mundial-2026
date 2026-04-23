// ===============================================
// PREDICCIONES.JS - SIN LÍMITE DE TIEMPO (TESTING)
// ===============================================

let usuario = null;
let partidosPendientes = [];
let prediccionesRealizadas = [];
let filtroFase = 'grupos';
let ordenamiento = 'fechacercana';
let filtroFaseCompleted = 'grupos';        // ← NUEVA
let ordenamientoCompleted = 'fechacercana';    // ← NUEVA

document.addEventListener('DOMContentLoaded', async () => {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    usuario = auth.getUser();
    configurarUI();
    configurarEventos();
    await cargarDatos();
});

    const btnMenu = document.getElementById('btnMenuMobile');
    const navMobile = document.getElementById('navMobile');
    if (btnMenu && navMobile) {
        btnMenu.addEventListener('click', () => {
            navMobile.classList.toggle('open');
        });
    }

function configurarUI() {
    const userCampeon = document.getElementById('userCampeon');
    if (userCampeon) userCampeon.textContent = obtenerCampeon(usuario.campeon_elegido);
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = usuario.nombre || usuario.codigo;
    }

    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn && auth.isAdmin()) {
        adminBtn.style.display = 'flex';
        adminBtn.onclick = () => window.location.href = 'admin.html';
    }

    const btnMenuMobile = document.getElementById('btnMenuMobile');
    const navMobile = document.getElementById('navMobile');
    
    if (btnMenuMobile && navMobile) {
        btnMenuMobile.addEventListener('click', () => {
            navMobile.classList.toggle('active');
        });
    }
}

function configurarEventos() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            cambiarTab(targetTab);
        });
    });

    const filterPhase = document.getElementById('filterPhase');
    const sortBy = document.getElementById('sortBy');

    if (filterPhase) {
        filterPhase.addEventListener('change', (e) => {
            filtroFase = e.target.value;
            renderizarPartidos();
        });
    }

    if (sortBy) {
        sortBy.addEventListener('change', (e) => {
            ordenamiento = e.target.value;
            renderizarPartidos();
        });
    }
    const filterPhaseCompleted = document.getElementById('filterPhaseCompleted');
    const sortByCompleted = document.getElementById('sortByCompleted');

    if (filterPhaseCompleted) {
        filterPhaseCompleted.addEventListener('change', (e) => {
            filtroFaseCompleted = e.target.value;
            renderizarPredicciones();
        });
    }

    if (sortByCompleted) {
        sortByCompleted.addEventListener('change', (e) => {
            ordenamientoCompleted = e.target.value;
            renderizarPredicciones();
        });
    }
}

function cambiarTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

async function cargarDatos() {
    try {
        await cargarPredicciones();
        await cargarPartidos();
        console.log('✅ Datos cargados');
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
    }
}

async function cargarPartidos() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos?estado=pendiente`);
        if (!response.ok) throw new Error('Error cargando partidos');

        const partidos = await response.json();
        
        // SOLO filtrar por predicciones ya hechas (sin límite de tiempo por ahora)
        partidosPendientes = partidos.filter(partido => {
            const tienePrediccion = prediccionesRealizadas.some(p => p.partido_id === partido.id);
            return !tienePrediccion;
        });

        console.log(`⚽ ${partidosPendientes.length} partidos disponibles`);
        renderizarPartidos();

    } catch (error) {
        console.error('❌ Error:', error);
        mostrarError('matchesGrid', 'Error al cargar partidos');
    }
}

async function cargarPredicciones() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/predicciones/${usuario.id}`);
        if (!response.ok) throw new Error('Error cargando predicciones');

        prediccionesRealizadas = await response.json();
        console.log(`📋 ${prediccionesRealizadas.length} predicciones realizadas`);
        renderizarPredicciones();

    } catch (error) {
        console.error('❌ Error:', error);
        mostrarError('completedList', 'Error al cargar predicciones');
    }
}

function renderizarPartidos() {
    const container = document.getElementById('matchesGrid');
    if (!container) return;

    let partidosFiltrados;
    
    if (filtroFase === 'all') {
        partidosFiltrados = partidosPendientes;
    } else if (filtroFase === 'grupos') {
        // Filtrar SOLO fase de grupos (excluir eliminatorias)
        partidosFiltrados = partidosPendientes.filter(p => 
            p.fase.startsWith('Grupo ')
        );
    } else {
        partidosFiltrados = partidosPendientes.filter(p => p.fase === filtroFase);
    }

    if (ordenamiento === 'fechacercana') {
        partidosFiltrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }
    if (ordenamiento === 'fechalejana') {
        partidosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
    if (partidosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <h3 class="empty-title">No hay partidos disponibles</h3>
                <p class="empty-text">Ya predijiste todos los partidos pendientes</p>
            </div>
        `;
        return;
    }

    container.innerHTML = partidosFiltrados.map(partido => crearCardPartido(partido)).join('');
}

function crearCardPartido(partido) {
    const fecha = new Date(partido.fecha);

    const fechaCorta = fecha.toLocaleDateString('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const hora = fecha.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const estadio = partido.estadio ? ` · ${partido.estadio}` : '';

    return `
        <div class="match-card" id="card-${partido.id}">

            <!-- CABECERA -->
            <div class="mc-header">
                <div>
                    <div class="mc-competition">Copa Mundial FIFA 2026™</div>
                    <div class="mc-subtitle">Fase de Grupos · ${partido.fase}${estadio}</div>
                </div>
                <span class="mc-date">${fechaCorta}</span>
            </div>

            <!-- CUERPO -->
            <div class="mc-body">

                <!-- Equipos + inputs (izquierda) -->
                <div class="mc-teams-inputs">

                <div class="mc-team-row">
                    <span class="mc-flag">${obtenerBandera(partido.equipo_local)}</span>
                    <span class="mc-name">${partido.equipo_local.toUpperCase()}</span>
                    <div class="mc-score-spinner">
                        <div class="mc-spin-arrows">
                        <button class="mc-spin-btn" onclick="cambiarGol('local_${partido.id}', 1)" tabindex="-1">▲</button>
                        <button class="mc-spin-btn" onclick="cambiarGol('local_${partido.id}', -1)" tabindex="-1">▼</button>
                        </div>
                    </div>
                    <input type="number" 
                            class="mc-goal-input" 
                            id="local_${partido.id}" 
                            min="0" max="9" 
                            value="0"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            oninput="this.value=this.value.replace(/[^0-9]/g,''); if(this.value>9)this.value=9; if(this.value<0)this.value=0;">
                    </div>

                <div class="mc-team-row">
                    <span class="mc-flag">${obtenerBandera(partido.equipo_visitante)}</span>
                    <span class="mc-name">${partido.equipo_visitante.toUpperCase()}</span>
                    <div class="mc-score-spinner">
                        <div class="mc-spin-arrows">
                        <button class="mc-spin-btn" onclick="cambiarGol('visitante_${partido.id}', 1)" tabindex="-1">▲</button>
                        <button class="mc-spin-btn" onclick="cambiarGol('visitante_${partido.id}', -1)" tabindex="-1">▼</button>
                        </div>
                    </div>
                    <input type="number" 
                            class="mc-goal-input" 
                            id="visitante_${partido.id}" 
                            min="0" max="9" 
                            value="0"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            oninput="this.value=this.value.replace(/[^0-9]/g,''); if(this.value>9)this.value=9; if(this.value<0)this.value=0;">
                    </div>

            </div>

                <!-- Hora (derecha) -->
                <div class="mc-hora-col">
                    <span class="mc-hora">${hora}</span>
                </div>

            </div>

            <!-- BOTÓN -->
            <button class="mc-btn-predict" onclick="enviarPrediccion(${partido.id})">
                Guardar Predicción
            </button>

        </div>
    `;
}

function cambiarGol(inputId, delta) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let val = parseInt(input.value) || 0;
    val = Math.min(9, Math.max(0, val + delta));
    input.value = val;
}
window.cambiarGol = cambiarGol;

function renderizarPredicciones() {
    const container = document.getElementById('completedList');
    if (!container) return;

    if (prediccionesRealizadas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3 class="empty-title">Aún no tienes predicciones</h3>
                <p class="empty-text">Ve a la pestaña "Por Predecir" para comenzar</p>
            </div>
        `;
        return;
    }

    // Aplicar filtro de fase
    let prediccionesFiltradas;
    
    if (filtroFaseCompleted === 'all') {
        prediccionesFiltradas = prediccionesRealizadas;
    } else if (filtroFaseCompleted === 'grupos') {
        prediccionesFiltradas = prediccionesRealizadas.filter(p => 
            p.fase.startsWith('Grupo ')
        );
    } else {
        prediccionesFiltradas = prediccionesRealizadas.filter(p => 
            p.fase === filtroFaseCompleted
        );
    }

    // Aplicar ordenamiento
    let prediccionesOrdenadas = [...prediccionesFiltradas];
    
    if (ordenamientoCompleted === 'fechacercana') {
        prediccionesOrdenadas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    } else if (ordenamientoCompleted === 'fechalejana') {
        prediccionesOrdenadas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    container.innerHTML = prediccionesOrdenadas.map(pred => crearCardPrediccion(pred)).join('');
}

function crearCardPrediccion(prediccion) {
    const fecha = new Date(prediccion.fecha_partido || prediccion.fecha);
    const esPendiente  = prediccion.puntos_obtenidos === null;
    const esFinalizado = prediccion.estado === 'finalizado';
 
    const fechaCorta = fecha.toLocaleDateString('es', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
 
    const estadio = prediccion.estadio ? ` · ${prediccion.estadio}` : '';
 
    const tieneResultado = esFinalizado &&
        prediccion.goles_local !== null &&
        prediccion.goles_visitante !== null;
 
    // Badge de puntos
    let puntajeBadge = '';
    if (!esPendiente) {
        const pts = prediccion.puntos_obtenidos;
        let badgeClass = 'pts-0';
        if (pts >= 9)      badgeClass = 'pts-9';
        else if (pts >= 7) badgeClass = 'pts-7';
        else if (pts >= 5) badgeClass = 'pts-5';
        else if (pts > 0)  badgeClass = 'pts-2';
 
        puntajeBadge = `<span class="pred-pts-badge ${badgeClass}">${pts > 0 ? '+' : ''}${pts} pts</span>`;
    }
 
    return `
        <div class="pred-card">
 
            <!-- CABECERA -->
            <div class="pred-card-header">
                <div>
                    <div class="pred-card-competition">FIFA World Cup 2026™</div>
                    <div class="pred-card-subtitle">First Stage · ${prediccion.fase}${estadio}</div>
                </div>
                <span class="pred-card-date">${fechaCorta}</span>
            </div>
 
            <!-- CUERPO -->
            <div class="pred-card-body">
 
                <!-- Equipos izquierda -->
                <div class="pred-card-teams">
                    <div class="pred-card-team-row">
                        <span class="pred-card-flag">${obtenerBandera(prediccion.equipo_local)}</span>
                        <span class="pred-card-name">${prediccion.equipo_local.toUpperCase()}</span>
                    </div>
                    <div class="pred-card-team-row">
                        <span class="pred-card-flag">${obtenerBandera(prediccion.equipo_visitante)}</span>
                        <span class="pred-card-name">${prediccion.equipo_visitante.toUpperCase()}</span>
                    </div>
                </div>
 
                <!-- Marcadores derecha -->
                <div class="pred-card-scores">
 
                    <!-- Mi predicción -->
                    <div class="pred-card-score-col pred-col-pred">
                        <div class="pred-card-score-label">Mi predicción</div>
                        <div class="pred-card-result-stack">
                            <span class="pred-card-result-num pred">${prediccion.goles_local_pred}</span>
                            <div class="pred-card-result-line"></div>
                            <span class="pred-card-result-num pred">${prediccion.goles_visitante_pred}</span>
                        </div>
                    </div>
 
                    <!-- Separador vertical -->
                    <div class="pred-card-score-divider"></div>
 
                    <!-- Resultado real -->
                    <div class="pred-card-score-col pred-col-real">
                        <div class="pred-card-score-label">${tieneResultado ? 'Final' : 'Resultado'}</div>
                        ${tieneResultado ? `
                            <div class="pred-card-result-stack">
                                <span class="pred-card-result-num real">${prediccion.goles_local}</span>
                                <div class="pred-card-result-line real-line"></div>
                                <span class="pred-card-result-num real">${prediccion.goles_visitante}</span>
                            </div>
                        ` : `
                            <div class="pred-card-pending-text">
                                ${esPendiente ? 'Por jugar' : '—'}
                            </div>
                        `}
                    </div>
 
                </div>
 
            </div>
 
            <!-- FOOTER -->
            <div class="pred-card-footer">
                <span class="pred-card-status ${esPendiente ? 'pendiente' : 'finalizado'}">
                    ${esPendiente ? '⏳ Pendiente' : '✅ Finalizado'}
                </span>
                ${puntajeBadge}
            </div>
 
        </div>
    `;
}



async function enviarPrediccion(partidoId) {
    const inputLocal = document.getElementById(`local_${partidoId}`);
    const inputVisitante = document.getElementById(`visitante_${partidoId}`);
    const card = document.getElementById(`card-${partidoId}`);
    
    const golesLocal = inputLocal.value;
    const golesVisitante = inputVisitante.value;

    if (golesLocal === '' || golesVisitante === '') {
        mostrarToast('⚠️ Debes ingresar ambos resultados', 'warning');
        return;
    }

    const local = parseInt(golesLocal);
    const visitante = parseInt(golesVisitante);

    if (local < 0 || local > 9 || visitante < 0 || visitante > 9) {
        mostrarToast('⚠️ Los goles deben estar entre 0 y 9', 'warning');
        return;
    }

    try {
        const btnPredict = card.querySelector('.mc-btn-predict');
        btnPredict.disabled = true;
        btnPredict.textContent = 'Guardando...';

        const response = await fetch(`${CONFIG.API_URL}/predicciones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario_id: parseInt(usuario.id),
                partido_id: partidoId,
                goles_local: local,
                goles_visitante: visitante
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error guardando predicción');
        }

        const partido = partidosPendientes.find(p => p.id === partidoId);

        prediccionesRealizadas.push({
            partido_id: partidoId,
            equipo_local: partido.equipo_local,
            equipo_visitante: partido.equipo_visitante,
            fase: partido.fase,
            fecha: partido.fecha,
            goles_local_pred: local,
            goles_visitante_pred: visitante,
            puntos_obtenidos: null
        });

        partidosPendientes = partidosPendientes.filter(p => p.id !== partidoId);

        card.classList.add('removing');

        setTimeout(() => {
            renderizarPartidos();
            renderizarPredicciones();
            mostrarToast(`✅ Predicción guardada: ${local} - ${visitante}`, 'success');
        }, 400);

    } catch (error) {
        console.error('❌ Error:', error);
        mostrarToast(`❌ ${error.message}`, 'error');
        
        const btnPredict = card.querySelector('.btn-predict');
        btnPredict.disabled = false;
        btnPredict.innerHTML = '<span>💾</span><span>Guardar Predicción</span>';
    }
}

window.enviarPrediccion = enviarPrediccion;

function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span class="toast-message">${mensaje}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
    /* ── TABS ────────────────────────────────────────── */
    document.querySelectorAll('.pred-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pred-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.pred-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });
 
    /* ── STATS HERO desde localStorage ──────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        // Rellena los stats del hero si están disponibles en localStorage
        // (los mismos que usa cargarEstadisticas en index.js)
        const pts  = localStorage.getItem('quiniela_puntos');
        const pos  = localStorage.getItem('quiniela_posicion');
        const pred = localStorage.getItem('quiniela_predicciones');
 
        if (pts)  {
            document.getElementById('heroPuntos').textContent    = pts;
            document.getElementById('resumenPuntos').textContent = pts;
        }
        if (pos)  {
            document.getElementById('heroPosicion').textContent   = pos + '°';
            document.getElementById('resumenPosicion').textContent = pos + '°';
        }
        if (pred) {
            document.getElementById('heroTotalPartidos').textContent = pred;
            document.getElementById('resumenTotal').textContent      = pred;
        }
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

function mostrarError(containerId, mensaje) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3 class="empty-title">Error</h3>
                <p class="empty-text">${mensaje}</p>
            </div>
        `;
    }
}

function logout() {
    if (confirm('¿Estás seguro de que quieres salir?')) {
        auth.logout();
    }
}

window.logout = logout;