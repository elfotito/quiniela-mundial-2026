// ===============================================
// QUINIELA.JS - VERSIÓN BÁSICA FUNCIONAL
// ===============================================
let usuarioId = null;
let usuario = null;
let estadisticas = null;
let predicciones = [];
let ranking = [];
let filtroFase = 'todas'; 
let filtroActual = 'todas';
let logrosDesbloqueadosDB = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Iniciando quiniela.html');
    
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    usuario = auth.getUser();
    console.log('✅ Usuario autenticado:', usuario);
    usuarioId = usuario.id;
    configurarUI();
    configurarEventos();

    await Promise.all([
        cargarEstadisticas(),
        cargarPredicciones(),
        cargarProximasPredicciones(),
        cargarProximosPartidos(),
    ]);

    inicializarGraficos();
    cargarLogros();
});

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
function configurarEventos() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActual = btn.dataset.filter;
            mostrarPrediccionesFiltradas();
        });
    });
}

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
        const efectividad = stats.efectividad || 0;
        document.getElementById('statEfectividad').textContent = `${efectividad}%`;
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

async function cargarPredicciones() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/predicciones/${usuario.id}`);
        if (!response.ok) throw new Error('Error al cargar predicciones');
        
        predicciones = await response.json();
        console.log('🎯 Predicciones cargadas:', predicciones);
        
        mostrarPrediccionesFiltradas();
    } catch (error) {
        console.error('❌ Error al cargar predicciones:', error);
    }
}

function cambiarFiltroFase(fase) {
    filtroFase = fase;
    
    // Actualizar UI de botones de fase (agregar clase active)
    document.querySelectorAll('.phase-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    mostrarPrediccionesFiltradas();
}

function mostrarPrediccionesFiltradas() {
    const container = document.getElementById('predictionsList');
    
    if (!predicciones || predicciones.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 2rem;">Aún no tienes predicciones</p>';
        return;
    }
    
    let prediccionesFiltradas = predicciones;
    
    // PRIMER FILTRO: Por fase
    if (filtroFase === 'grupos') {
        // Filtrar SOLO fase de grupos (todos los grupos A, B, C, etc.)
        prediccionesFiltradas = prediccionesFiltradas.filter(p => 
            p.fase && p.fase.startsWith('Grupo ')
        );
    } else if (filtroFase === 'final') {
        // Filtrar Final y Tercer Puesto
        prediccionesFiltradas = prediccionesFiltradas.filter(p => 
            p.fase === 'Final' || p.fase === '3er Puesto'
        );
    } else if (filtroFase !== 'todas') {
        // Filtrar por fase específica
        prediccionesFiltradas = prediccionesFiltradas.filter(p => p.fase === filtroFase);
    }
    
    // SEGUNDO FILTRO: Por puntos (dentro de la fase seleccionada)
    switch (filtroActual) {
        case 'exactas':
            prediccionesFiltradas = prediccionesFiltradas.filter(p => p.puntos_obtenidos === 9);
            break;
        case 'parciales7':
            prediccionesFiltradas = prediccionesFiltradas.filter(p => p.puntos_obtenidos === 7);
            break;
        case 'parciales5':
            prediccionesFiltradas = prediccionesFiltradas.filter(p => p.puntos_obtenidos === 5);
            break;
        case 'parciales2':
            prediccionesFiltradas = prediccionesFiltradas.filter(p => p.puntos_obtenidos === 2);
            break;    
        case 'falladas':
            prediccionesFiltradas = prediccionesFiltradas.filter(p => p.puntos_obtenidos === 0);
            break;
        case 'pendientes':
            prediccionesFiltradas = prediccionesFiltradas.filter(p => p.puntos_obtenidos === null);
            break;
    }
    
    // Mostrar mensaje si no hay resultados
    if (prediccionesFiltradas.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 2rem;">No hay predicciones que coincidan con los filtros seleccionados</p>';
        return;
    }
    
    // Renderizar las predicciones filtradas
    container.innerHTML = prediccionesFiltradas.map(p => crearItemPrediccion(p)).join('');
}


function crearItemPrediccion(prediccion) {
    const fechaPartido = new Date(prediccion.fecha_partido || prediccion.fecha);
    const dia = fechaPartido.getDate();
    const mes = fechaPartido.toLocaleDateString('es', { month: 'short' }).toUpperCase();

    const isPending = prediccion.puntos_obtenidos === null;

    const golesLocalReal     = prediccion.goles_local_real     ?? prediccion.goles_local     ?? null;
    const golesVisitanteReal = prediccion.goles_visitante_real ?? prediccion.goles_visitante ?? null;
    const tieneResultado     = golesLocalReal !== null && golesLocalReal !== undefined;

    // ── Determinar ganador ──────────────────────────
    let localGana = false, visitanteGana = false, esEmpate = false;
    if (tieneResultado) {
        if      (golesLocalReal > golesVisitanteReal)  localGana     = true;
        else if (golesVisitanteReal > golesLocalReal)  visitanteGana = true;
        else                                           esEmpate      = true;
    }

    // ── Badge de puntos ─────────────────────────────
    let badgeClass = 'pi-badge-pending';
    let badgeText  = 'Pendiente';
    let ptsDisplay = '—';

    if (!isPending) {
        const pts = prediccion.puntos_obtenidos;
        ptsDisplay = `+${pts}`;
        if      (pts === 9) { badgeClass = 'pi-badge-9'; badgeText = '🔮 GENIO';    }
        else if (pts === 7) { badgeClass = 'pi-badge-7'; badgeText = '🔥 CRACK';    }
        else if (pts === 5) { badgeClass = 'pi-badge-5'; badgeText = '🎉 ÍDOLO';    }
        else if (pts === 2) { badgeClass = 'pi-badge-2'; badgeText = '👻 FANTASMA'; }
        else                { badgeClass = 'pi-badge-0'; badgeText = '🥶 ¿FRÍO?';  ptsDisplay = '0'; }
    }

    // ── Clases de opacidad por resultado ───────────
    const claseLocal     = tieneResultado ? (visitanteGana ? 'pi-team-loser' : '') : '';
    const claseVisitante = tieneResultado ? (localGana     ? 'pi-team-loser' : '') : '';

    return `
    <div class="pi-row">

        <!-- Fecha -->
        <div class="pi-date">
            <span class="pi-date-day">${dia}</span>
            <span class="pi-date-mon">${mes}</span>
        </div>

        <!-- Equipos + marcadores -->
        <div class="pi-match">

            <!-- Local -->
            <div class="pi-team ${claseLocal}">
                <span class="pi-flag">${obtenerBandera(prediccion.equipo_local)}</span>
                <span class="pi-name">${prediccion.equipo_local}</span>
                ${localGana ? '<span class="pi-winner-dot"></span>' : ''}
            </div>

            <!-- Marcador real -->
            <div class="pi-score-real">
                ${tieneResultado ? `
                    <span class="pi-score-num ${localGana ? 'winner' : visitanteGana ? 'loser' : ''}">${golesLocalReal}</span>
                    <span class="pi-score-sep">–</span>
                    <span class="pi-score-num ${visitanteGana ? 'winner' : localGana ? 'loser' : ''}">${golesVisitanteReal}</span>
                ` : `
                    <span class="pi-score-hora">${fechaPartido.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                `}
            </div>

            <!-- Visitante -->
            <div class="pi-team pi-team-right ${claseVisitante}">
                ${visitanteGana ? '<span class="pi-winner-dot"></span>' : ''}
                <span class="pi-name">${prediccion.equipo_visitante}</span>
                <span class="pi-flag">${obtenerBandera(prediccion.equipo_visitante)}</span>
            </div>

        </div>

        <!-- Separador vertical -->
        <div class="pi-vsep"></div>

        <!-- Columna lateral: predicción + puntos -->
        <div class="pi-side">
            <div class="pi-pred-row">
                <span class="pi-pred-lbl">PRED.</span>
                <span class="pi-pred-val">${prediccion.goles_local_pred} – ${prediccion.goles_visitante_pred}</span>
            </div>
            <span class="pi-pts-badge ${badgeClass}">${ptsDisplay}</span>
        </div>

    </div>`;
}

// Nueva función: Calcular desglose de puntos
function calcularDesglosePuntos(pred) {
    if (pred.puntos_obtenidos === null || pred.goles_local_real === null) {
        return { total: 0, items: [] };
    }

    const items = [];
    const predLocal = pred.goles_local_pred;
    const predVisitante = pred.goles_visitante_pred;
    const realLocal = pred.goles_local_real;
    const realVisitante = pred.goles_visitante_real;

    // Resultado exacto (9 puntos)
    if (predLocal === realLocal && predVisitante === realVisitante) {
        items.push({
            icon: '🎯',
            description: 'Resultado exacto',
            points: 9,
            highlight: true
        });
        return { total: 9, items };
    }

    // Determinar ganadores
    const predGanador = predLocal > predVisitante ? 'local' : 
                        predLocal < predVisitante ? 'visitante' : 'empate';
    const realGanador = realLocal > realVisitante ? 'local' : 
                        realLocal < realVisitante ? 'visitante' : 'empate';
    
    const predDiferencia = Math.abs(predLocal - predVisitante);
    const realDiferencia = Math.abs(realLocal - realVisitante);

    // Ganador + diferencia (7 puntos)
    if (predGanador === realGanador && predDiferencia === realDiferencia) {
        items.push({
            icon: '✅',
            description: 'Ganador acertado',
            points: 5,
            highlight: true
        });
        items.push({
            icon: '📊',
            description: 'Diferencia correcta',
            points: 2,
            highlight: true
        });
        return { total: 7, items };
    }

    // Solo ganador (5 puntos)
    if (predGanador === realGanador) {
        items.push({
            icon: '✅',
            description: 'Ganador/empate',
            points: 5,
            highlight: true
        });
        return { total: 5, items };
    }

    // Ambos empate (2 puntos)
    if (predGanador === 'empate' && realGanador === 'empate') {
        items.push({
            icon: '🤝',
            description: 'Empate acertado',
            points: 2,
            highlight: true
        });
        return { total: 2, items };
    }

    // Sin puntos
    return { total: 0, items: [] };
}

async function cargarProximasPredicciones() {
    try {
        const [partidosResponse, prediccionesResponse] = await Promise.all([
            fetch(`${CONFIG.API_URL}/partidos?estado=pendiente&limit=20`),
            fetch(`${CONFIG.API_URL}/predicciones/${usuario.id}`)
        ]);

        const partidos = await partidosResponse.json();
        const misPredicciones = prediccionesResponse.ok ? await prediccionesResponse.json() : [];

        const partidosSinPrediccion = partidos.filter(partido => {
            return !misPredicciones.some(pred => pred.partido_id === partido.id);
        });

        console.log('⚡ Partidos sin predicción:', partidosSinPrediccion);
        
        const container = document.getElementById('upcomingMatches');
        if (partidosSinPrediccion.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 2rem;">¡Ya tienes todas las predicciones al día! 🎉</p>';
        } else {
            container.innerHTML = partidosSinPrediccion.slice(0, 3).map(p => `
                <div class="match-card">
                    <div>${obtenerBandera(p.equipo_local)} ${p.equipo_local} vs ${p.equipo_visitante} ${obtenerBandera(p.equipo_visitante)}</div>
                    <button onclick="window.location.href='predicciones.html'" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: var(--fifa-gold); border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">Predecir</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}
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

function inicializarGraficos() {
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js no está cargado');
        return;
    }
    
    console.log('📊 Inicializando gráficos...');
    crearGraficoEfectividad();
    crearGraficoEvolucion();
}

function crearGraficoEfectividad() {
    const ctx = document.getElementById('effectivenessChart');
    if (!ctx) return;

    const exactas = predicciones.filter(p => p.puntos_obtenidos === 9).length;
    const ganadorymarcador = predicciones.filter(p => p.puntos_obtenidos === 7).length;
    const empateoganador = predicciones.filter(p => p.puntos_obtenidos === 5).length;
    const solomarcador = predicciones.filter(p => p.puntos_obtenidos === 2).length;
    const falladas = predicciones.filter(p => p.puntos_obtenidos === 0).length;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Exactas (9pts)', 'Ganador + Marcador (7pts)', 'Ganador/Empate (5pts)', 'Solo Marcador (2pts)', 'Falladas (0pts)'],
            datasets: [{
                data: [exactas, ganadorymarcador, empateoganador, solomarcador, falladas],
                backgroundColor: ['rgba(50, 196, 55, 0.8)', 'rgba(255, 215, 0, 0.8)', 'rgba(118, 43, 216, 0.8)', 'rgba(35, 120, 218, 0.8)', 'rgba(244, 67, 54, 0.8)']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    align: 'center',
                    labels: {
                        color: '#a0a0a0',
                        padding: 15,
                        font: {
                            size: 12
                        },
                        boxWidth: 15,
                        boxHeight: 15
                    }
                }
            }
        }
    });
}

function crearGraficoEvolucion() {
    const ctx = document.getElementById('pointsChart');
    if (!ctx) return;
    
    const prediccionesEvaluadas = predicciones
        .filter(p => p.puntos_obtenidos !== null)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    const datos = prediccionesEvaluadas.map((pred, index) => {
        return { x: index + 1, y: pred.puntos_obtenidos };
    });
    
    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Puntos por Partido',
                data: datos,
                borderColor: 'rgba(255, 215, 0, 1)',
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: 'rgba(255, 215, 0, 1)',
                pointBorderColor: '#1a1a1a',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    labels: { color: '#ffffff' } 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Partido ${context.parsed.x}: ${context.parsed.y} puntos`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Partidos Jugados',
                        color: '#e0e0e0',
                        font: { size: 13, weight: 'bold' }
                    },
                    ticks: { 
                        color: '#a0a0a0',
                        stepSize: 1
                    }, 
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: { 
                    min: 0,
                    max: 9,
                    title: {
                        display: true,
                        text: 'Puntos',
                        color: '#e0e0e0',
                        font: { size: 13, weight: 'bold' }
                    },
                    ticks: { 
                        color: '#a0a0a0',
                        stepSize: 1,
                        callback: function(value) {
                            // Solo mostrar los valores de puntos posibles
                            if ([0, 2, 5, 7, 9].includes(value)) {
                                return value;
                            }
                            return '';
                        }
                    }, 
                    grid: { 
                        color: function(context) {
                            // Resaltar las líneas de puntos posibles
                            if ([0, 2, 5, 7, 9].includes(context.tick.value)) {
                                return 'rgba(255, 255, 255, 0.2)';
                            }
                            return 'rgba(255, 255, 255, 0.05)';
                        }
                    }
                }
            }
        }
    });
}

async function cargarLogrosDesbloqueadosDB() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/usuarios/${usuario.id}/logros`);
        const data = await response.json();
        logrosDesbloqueadosDB = data.logros || [];
    } catch (error) {
        console.error('Error al cargar logros de BD:', error);
        logrosDesbloqueadosDB = [];
    }
}
async function desbloquearLogroEnBD(logroId) {
    try {
        const response = await fetch(`/api/usuarios/${usuario.id}/logros`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logro_id: logroId })
        });
        
        if (response.ok) {
            logrosDesbloqueadosDB.push(logroId);
        }
    } catch (error) {
        console.error('Error al desbloquear logro:', error);
    }
}

function verificarLogroPermanente(logroId, condicion) {
    // Si ya fue desbloqueado antes (guardado en BD)
    if (logrosDesbloqueadosDB.includes(logroId)) {
        return true;
    }
    
    // Si se cumple la condición ahora, guardarlo en BD
    if (condicion) {
        desbloquearLogroEnBD(logroId);
        return true;
    }
    
    return false;
}

async function cargarLogros() {
    await cargarLogrosDesbloqueadosDB();
    const container = document.getElementById('achievementsGrid');
    const logros = [
        { 
            id: 'primera_prediccion', 
            imagen: 'img/logros/davito.png', 
            titulo: 'Predictor Novato', 
            descripcion: 'Ganara el que meta más goles',
            rareza: 'bronce',
            desbloqueado: predicciones.length > 0 
        },
                { 
            id: 'predictor_principiante', 
            imagen: 'img/logros/will.png', 
            titulo: 'Predictor Principiante', 
            descripcion: 'No ganaron porque no metieron más goles que el rival',
            rareza: 'plata',
            desbloqueado: predicciones.length >= 20 
        },
        { 
            id: 'predictor_aprendiz', 
            imagen: 'img/logros/vincent.png', 
            titulo: 'Predictor Aprendiz', 
            descripcion: 'En el momento que la pelota cruzó la linea, yo ya supe que era gol',
            rareza: 'bronce',
            desbloqueado: predicciones.length >= 50 
        },
                { 
            id: 'predictor_formidable', 
            imagen: 'img/logros/basta.png', 
            titulo: 'Predictor Engordable', 
            descripcion: 'No nos humilles Jordania',
            rareza: 'plata',
            desbloqueado: predicciones.length >= 72 
        },
                { 
            id: 'predictor_competente', 
            imagen: 'img/logros/mario.png', 
            titulo: 'Predictor Competente', 
            descripcion: 'Esta etapa fue nombrada dieciseisavos por que son 16 partidos',
            rareza: 'oro',
            desbloqueado: predicciones.length >= 88 
        },
                { 
            id: 'predictor_experto', 
            imagen: 'img/logros/davo.png', 
            titulo: 'Predictor Experto', 
            descripcion: 'El que mas sabe de futbol en su casa (vive solo)',
            rareza: 'oro',
            desbloqueado: predicciones.length >= 96 
        },
        { 
            id: 'predictor_maestro', 
            imagen: 'img/logros/maldini.png', 
            titulo: 'Predictor Maestro', 
            descripcion: 'Al terminar el mundial me dedicare a ver la 2da division de Liga FUTVE Apuestas Royal',
            rareza: 'platino',
            desbloqueado: predicciones.length >= 102 
        },
            { 
            id: 'primer0', 
            imagen: 'img/logros/vidal.png', 
            titulo: 'Primera Mufa', 
            descripcion: 'No sumaste puntos en un partido, igual que chile en este mundial',
            rareza: 'bronce',
            desbloqueado: predicciones.some(p => p.puntos_obtenidos === 0) 
        },
                { 
            id: 'primer2', 
            imagen: 'img/logros/nain.png', 
            titulo: '¡Gol es Gol!', 
            descripcion: 'Acierto marcador del equipo perdedor',
            rareza: 'bronce',
            desbloqueado: predicciones.some(p => p.puntos_obtenidos === 2) 
        },
                { 
            id: 'primer7', 
            imagen: 'img/logros/eu7.png', 
            titulo: '¡Eu estou aqui!', 
            descripcion: 'Acierto ganador y marcador de un partido',
            rareza: 'bronce',
            desbloqueado: predicciones.some(p => p.puntos_obtenidos === 9) 
        },
                { 
            id: 'primer9', 
            imagen: 'img/logros/genio.png', 
            titulo: '¡Cierren el estadio!', 
            descripcion: 'Acierto total de un partido, solo los genios hacen eso',
            rareza: 'plata',
            desbloqueado: predicciones.some(p => p.puntos_obtenidos === 9) 
        },
        { 
            id: 'racha_2_consecutivos_9pts', 
            imagen: '/images/logros/goat.png',
            titulo: 'The GOAT', 
            descripcion: 'Consigue 2 predicciones exactas consecutivas',
            rareza: 'oro',
            desbloqueado: (() => {
                const evaluadas = predicciones
                    .filter(p => p.puntos_obtenidos !== null)
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                
                for (let i = 0; i < evaluadas.length - 1; i++) {
                    if (evaluadas[i].puntos_obtenidos === 9 && 
                        evaluadas[i + 1].puntos_obtenidos === 9) {
                        return true;
                    }
                }
                return false;
            })()
        },
        { 
            id: 'racha_2_consecutivos_0pts', 
            imagen: '/images/logros/mike.png',
            titulo: 'Maquina de la Mufa', 
            descripcion: 'Consigue no sumar puntos en 2 predicciones consecutivas',
            rareza: 'oro',
            desbloqueado: (() => {
                const evaluadas = predicciones
                    .filter(p => p.puntos_obtenidos !== null)
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                
                for (let i = 0; i < evaluadas.length - 1; i++) {
                    if (evaluadas[i].puntos_obtenidos === 0 && 
                        evaluadas[i + 1].puntos_obtenidos === 0) {
                        return true;
                    }
                }
                return false;
            })()
        },
        { 
            id: 'racha_2_consecutivos_7pts', 
            imagen: '/images/logros/mike.png',
            titulo: '¡SIIUU!', 
            descripcion: 'Consigue 2 predicciones de ganador y un marcador consecutivas',
            rareza: 'oro',
            desbloqueado: (() => {
                const evaluadas = predicciones
                    .filter(p => p.puntos_obtenidos !== null)
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                
                for (let i = 0; i < evaluadas.length - 1; i++) {
                    if (evaluadas[i].puntos_obtenidos === 7 && 
                        evaluadas[i + 1].puntos_obtenidos === 7) {
                        return true;
                    }
                }
                return false;
            })()
        },
        { 
            id: 'racha_2_consecutivos_5pts', 
            imagen: '/images/logros/mike.png',
            titulo: 'El fútbol no es para bailarinas', 
            descripcion: 'Consigue 2 predicciones de solo ganador o empate consecutivas',
            rareza: 'plata',
            desbloqueado: (() => {
                const evaluadas = predicciones
                    .filter(p => p.puntos_obtenidos !== null)
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                
                for (let i = 0; i < evaluadas.length - 1; i++) {
                    if (evaluadas[i].puntos_obtenidos === 5 && 
                        evaluadas[i + 1].puntos_obtenidos === 5) {
                        return true;
                    }
                }
                return false;
            })()
        },
        { 
            id: 'racha_2_consecutivos_2pts', 
            imagen: '/images/logros/fantasma.png',
            titulo: 'El mas fantasma', 
            descripcion: 'Consigue 2 predicciones sumando con solo un marcador',
            rareza: 'bronce',
            desbloqueado: (() => {
                const evaluadas = predicciones
                    .filter(p => p.puntos_obtenidos !== null)
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                
                for (let i = 0; i < evaluadas.length - 1; i++) {
                    if (evaluadas[i].puntos_obtenidos === 2 && 
                        evaluadas[i + 1].puntos_obtenidos === 2) {
                        return true;
                    }
                }
                return false;
            })()
        },
        { 
            id: 'top_10', 
            imagen: 'img/logros/top10.png', 
            titulo: 'Top 10', 
            descripcion: 'Entraste al top 10 del ranking general',
            rareza: 'bronce',
            desbloqueado: (() => {
                            const enTop10 = ranking.findIndex(u => u.usuario_id === parseInt(usuario.id)) < 11;
                            const tienePrediccionesEvaluadas = predicciones.some(p => p.puntos_obtenidos !== null);
                            return enTop10 && tienePrediccionesEvaluadas;
                                })() 
        },
        { 
            id: 'top_3', 
            imagen: 'img/logros/top3.png', 
            titulo: 'Top 3', 
            descripcion: 'Entraste al top 3 del ranking general',
            rareza: 'plata',
            desbloqueado:  (() => {
                            const enTop10 = ranking.findIndex(u => u.usuario_id === parseInt(usuario.id)) < 4
                            const tienePrediccionesEvaluadas = predicciones.some(p => p.puntos_obtenidos !== null);
                            return enTop10 && tienePrediccionesEvaluadas;
                                })()
        },
        { 
            id: 'top_1', 
            imagen: 'img/logros/prime.png', 
            titulo: 'Estas en tu PRIME', 
            descripcion: 'Haz alcanzado el primer lugar por primera vez',
            rareza: 'oro',
            desbloqueado: verificarLogroPermanente(
                'primer_lugar',
                (() => {
                    const esPrimero = ranking.findIndex(u => u.usuario_id === parseInt(usuario.id)) === 0;
                    const tienePrediccionesEvaluadas = predicciones.some(p => p.puntos_obtenidos !== null);
                    return esPrimero && tienePrediccionesEvaluadas;
                })()
            ) 
        },
        { 
            id: 'ultimo_lugar', 
            imagen: 'img/logros/tenfe.png',
            titulo: 'La fe no se detiene', 
            descripcion: 'Tocaste el fondo de la tabla, habras perdido puntos pero no la fe',
            rareza: 'bronce',
            desbloqueado: verificarLogroPermanente(
                'ultimo_lugar',
                (() => {
                    const esUltimo = ranking.findIndex(u => u.usuario_id === parseInt(usuario.id)) === ranking.length - 1;
                    const tienePrediccionesEvaluadas = predicciones.some(p => p.puntos_obtenidos !== null);
                    return esUltimo && tienePrediccionesEvaluadas;
                })()
            )
        },
    ];
    
    // Calcular logro "Coleccionista"
    const desbloqueados = logros.filter(l => l.desbloqueado && l.id !== 'coleccionista').length;
    const coleccionistaIndex = logros.findIndex(l => l.id === 'coleccionista');
    if (coleccionistaIndex !== -1) {
        logros[coleccionistaIndex].desbloqueado = desbloqueados >= 10;
    }
    
    // Ordenar: desbloqueados primero
    const logrosOrdenados = logros.sort((a, b) => {
        if (a.desbloqueado === b.desbloqueado) return 0;
        return a.desbloqueado ? -1 : 1;
    });
    
container.innerHTML = logrosOrdenados.map(l => {
    const imagenHTML = l.desbloqueado
        ? `<img src="${l.imagen}" alt="${l.titulo}" class="achievement-image"
               onerror="this.style.display='none'">`
        : `<div class="mystery-placeholder">?</div>`;
 
    const descripcionHTML = l.desbloqueado
        ? `<p class="achievement-description">${l.descripcion}</p>`
        : `<p class="achievement-description mystery-text">???</p>`;
 
    return `
    <div class="achievement-card ${l.desbloqueado ? 'unlocked' : 'locked'} rarity-${l.rareza}">
 
        <span class="rarity-badge">${l.rareza}</span>
 
        <div class="achievement-image-wrap">
            <div class="achievement-ring"></div>
            ${imagenHTML}
            ${!l.desbloqueado ? '<div class="achievement-lock-overlay">🔒</div>' : ''}
        </div>
 
        <h3 class="achievement-title">${l.desbloqueado ? l.titulo : '???'}</h3>
        ${descripcionHTML}
 
    </div>`;
}).join('');


    const desbloqueadosCount = logrosOrdenados.filter(l => l.desbloqueado).length;
    const contadorEl = document.getElementById('achievementsCount');
    if (contadorEl) contadorEl.textContent = `${desbloqueadosCount}/${logrosOrdenados.length}`;


function scrollAchievements(dir) {
    const track = document.getElementById('achievementsGrid');
    if (!track) return;
    track.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' });
    }
}

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
const backToTopBtn = document.getElementById('backToTop');

        window.addEventListener('scroll', function() {
            
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

function logout() {
    if (confirm('¿Estás seguro de que quieres salir?')) {
        auth.logout();
    }
}

window.logout = logout;