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
    
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    usuario = auth.getUser();
    usuarioId = usuario.id;
    
    // Añade esta línea ANTES de configurarUI
    await verificarLogin();
    
    configurarUI();
    configurarEventos();

    await Promise.all([
        cargarEstadisticas(),
        cargarPredicciones(),
        cargarProximasPredicciones(),
        cargarProximosPartidos(),
    ]);

    inicializarGraficos();
    await cargarLogros();
});

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
        // Esperar a que el DOM esté listo para estos elementos
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
        
        // ✅ Función interna para no repetir
        function setVal(id, val) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }
        
        setVal('statPredicciones', stats.total_predicciones || 0);
        setVal('statPuntos', stats.puntos_totales || 0);
        setVal('statPosicion', stats.posicion_ranking || '-');
        setVal('statEfectividad', (stats.efectividad || 0) + '%');
        
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
        
        const container = document.getElementById('upcomingMatches');
        
        if (partidosSinPrediccion.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 2rem;">¡Ya tienes todas las predicciones al día! 🎉</p>';
        } else {
            container.innerHTML = partidosSinPrediccion.slice(0, 3).map(p => {
                // Mueve estas líneas DENTRO del .map()
                const fecha = new Date(p.fecha);
                const fechaCorta = fecha.toLocaleDateString('es-ES', {
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric'
                });
                const hora = fecha.toLocaleTimeString('es-ES', {
                    hour: '2-digit', 
                    minute: '2-digit'
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
                            <button onclick="window.location.href='predicciones.html'" 
                                    style="margin-top: 0.5rem; padding: 0.5rem 0.5rem; background: var(--fifa-gold); border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                                Predecir
                            </button>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}
async function cargarProximosPartidos() {
    const container = document.getElementById('proximosPartidos');
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

    // Destruir gráfico anterior si existe
    if (window.efectividadChart) {
        window.efectividadChart.destroy();
    }

    window.efectividadChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Exactas', 'Ganador + Marcador', 'Ganador o Empate', 'Solo Marcador', 'Falladas'],
            datasets: [{
                data: [exactas, ganadorymarcador, empateoganador, solomarcador, falladas],
                backgroundColor: [
                    'rgba(50, 196, 55, 0.85)',
                    'rgba(255, 215, 0, 0.85)',
                    'rgba(118, 43, 216, 0.85)',
                    'rgba(35, 120, 218, 0.85)',
                    'rgba(244, 67, 54, 0.85)'
                ],
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 3,
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f3f4f6',
                    bodyColor: '#d1d5db',
                    borderColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 6,
                    displayColors: true,
                    boxPadding: 3,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.parsed;
                            const percentage = total > 0 ? ((value * 100) / total).toFixed(1) : 0;
                            return ` ${value} predicciones (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Crear leyenda personalizada
    crearLeyendaPersonalizada([
        { label: 'Exactas', color: 'rgba(50, 196, 55, 0.85)', puntos: `${exactas}` },
        { label: 'Ganador + Marcador', color: 'rgba(255, 215, 0, 0.85)', puntos: `${ganadorymarcador}` },
        { label: 'Ganador o Empate', color: 'rgba(118, 43, 216, 0.85)', puntos: `${empateoganador}` },
        { label: 'Solo Marcador', color: 'rgba(35, 120, 218, 0.85)', puntos: `${solomarcador}` },
        { label: 'Falladas', color: 'rgba(244, 67, 54, 0.85)', puntos: `${falladas}` }
    ]);
}

function crearLeyendaPersonalizada(items) {
    // Buscar o crear el contenedor de la leyenda
    let legendContainer = document.getElementById('efectividadLegend');
    if (!legendContainer) {
        legendContainer = document.createElement('div');
        legendContainer.id = 'efectividadLegend';
        legendContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 20px;
            padding: 0 10px;
        `;
        
        // Insertar después del canvas
        const canvas = document.getElementById('effectivenessChart');
        canvas.parentNode.insertBefore(legendContainer, canvas.nextSibling);
    }
    
    // Limpiar y reconstruir
    legendContainer.innerHTML = '';
    
    items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 0;
        `;
        
        const leftSide = document.createElement('div');
        leftSide.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const colorBox = document.createElement('span');
        colorBox.style.cssText = `
            display: inline-block;
            width: 10px;
            height: 10px;
            background-color: ${item.color};
            border-radius: 2px;
            flex-shrink: 0;
        `;
        
        const label = document.createElement('span');
        label.textContent = item.label;
        label.style.cssText = `
            color: #000000;
            font-size: 12px;
            font-family: 'Yolk', 'Segoe UI', sans-serif;
            font-weight: 400;
        `;
        
        const puntos = document.createElement('span');
        puntos.textContent = item.puntos;
        puntos.style.cssText = `
            color: #000000;
            font-size: 12px;
            font-family: 'Yolk', 'Segoe UI', sans-serif;
            font-weight: 900;
            margin-left: auto;
        `;
        
        leftSide.appendChild(colorBox);
        leftSide.appendChild(label);
        row.appendChild(leftSide);
        row.appendChild(puntos);
        legendContainer.appendChild(row);
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
    
    // Calcular estadísticas para el tooltip y promedio
    const totalPuntos = datos.reduce((sum, d) => sum + d.y, 0);
    const promedio = datos.length > 0 ? (totalPuntos / datos.length).toFixed(1) : 0;
    
    // Destruir gráfico anterior si existe
    if (window.evolucionChart) {
        window.evolucionChart.destroy();
    }
    
    window.evolucionChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Puntos por Partido',
                data: datos,
                borderColor: 'rgba(255, 215, 0, 0.9)',
                backgroundColor: 'rgba(255, 215, 0, 0.08)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: '#1a1a1a',
                pointBorderColor: 'rgba(255, 215, 0, 0.9)',
                pointBorderWidth: 2.5,
                pointHoverBackgroundColor: 'rgba(255, 215, 0, 1)',
                pointHoverBorderColor: '#1a1a1a',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: { 
                legend: { 
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f3f4f6',
                    bodyColor: '#d1d5db',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    titleFont: {
                        size: 13,
                        weight: '600',
                        family: "'Inter', 'Segoe UI', sans-serif"
                    },
                    bodyFont: {
                        size: 12,
                        weight: '400',
                        family: "'Inter', 'Segoe UI', sans-serif"
                    },
                    callbacks: {
                        title: function(context) {
                            return `Partido #${context[0].parsed.x}`;
                        },
                        label: function(context) {
                            const puntos = context.parsed.y;
                            let tipoPrediccion = '';
                            
                            switch(puntos) {
                                case 9: tipoPrediccion = 'Resultado exacto'; break;
                                case 7: tipoPrediccion = 'Ganador + marcador'; break;
                                case 5: tipoPrediccion = 'Ganador o empate'; break;
                                case 2: tipoPrediccion = 'Solo marcador'; break;
                                case 0: tipoPrediccion = 'Fallada'; break;
                            }
                            
                            return [`Puntos: ${puntos}`, `Tipo: ${tipoPrediccion}`];
                        }
                    }
                }
            },
            scales: {
                x: { 
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Partidos',
                        color: '#9ca3af',
                        font: { 
                            size: 11, 
                            weight: '500',
                            family: "'Inter', 'Segoe UI', sans-serif"
                        }
                    },
                    ticks: { 
                        color: '#6b7280',
                        stepSize: 1,
                        font: {
                            size: 10,
                            family: "'Inter', 'Segoe UI', sans-serif"
                        },
                        padding: 8
                    }, 
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false,
                        lineWidth: 1
                    },
                    border: {
                        display: false
                    }
                },
                y: { 
                    min: 0,
                    max: 9,
                    title: {
                        display: true,
                        text: 'Puntos',
                        color: '#9ca3af',
                        font: { 
                            size: 11, 
                            weight: '500',
                            family: "'Inter', 'Segoe UI', sans-serif"
                        }
                    },
                    ticks: { 
                        color: '#6b7280',
                        stepSize: 1,
                        font: {
                            size: 10,
                            family: "'Inter', 'Segoe UI', sans-serif"
                        },
                        padding: 8,
                        callback: function(value) {
                            if ([0, 2, 5, 7, 9].includes(value)) {
                                return value;
                            }
                            return '';
                        }
                    }, 
                    grid: { 
                        color: function(context) {
                            if ([0, 2, 5, 7, 9].includes(context.tick.value)) {
                                return 'rgba(255, 255, 255, 0.1)';
                            }
                            return 'rgba(255, 255, 255, 0.03)';
                        },
                        drawBorder: false,
                        lineWidth: 1
                    },
                    border: {
                        display: false
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
        const response = await fetch(`${CONFIG.API_URL}/api/usuarios/${usuario.id}/logros`, {
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
    if (logrosDesbloqueadosDB.includes(logroId)) {
        return true;
    }
    
    if (condicion) {
        desbloquearLogroEnBD(logroId);
        return true;
    }
    
    return false;
}

async function cargarLogros() {
    await cargarLogrosDesbloqueadosDB();

    try {
        const res = await fetch(`${CONFIG.API_URL}/ranking/top`);
        if (res.ok) ranking = await res.json();
    } catch(e) {
        console.warn('No se pudo cargar ranking para logros:', e);
    }

const LOGROS = [
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
 
const RARITY_DOTS = { bronce:1, plata:2, oro:3, platino:4 };
const RARITY_LABELS = { bronce:'Bronce', plata:'Plata', oro:'Oro', platino:'Platino' };
 
function buildCard(l) {
  const dots = Array(RARITY_DOTS[l.rareza])
    .fill('<div class="rdot"></div>').join('');

  // ✅ Usa imagen si existe, si no muestra el ? de bloqueado
  const artContent = l.desbloqueado
    ? `<img src="${l.imagen}" alt="${l.titulo}" class="card-img" onerror="this.style.display='none'">`
    : `<div class="card-back-pattern"></div><div class="card-lock-icon">🔒</div>`;

  const holoEl = l.rareza === 'platino'
    ? `<div class="card-holo-border"></div>` : '';

  const title = l.desbloqueado
    ? `<p class="card-title">${l.titulo}</p>`
    : `<p class="card-title mystery">???</p>`;

  // ✅ descripcion, no desc
  const desc = l.desbloqueado
    ? `<p class="card-desc">${l.descripcion}</p>`
    : `<p class="card-desc mystery">• • • • •</p>`;

  return `
    <div class="lcard r-${l.rareza} ${l.desbloqueado ? 'unlocked' : 'locked'}"
       data-id="${l.id}">
    ${holoEl}
    <div class="lcard-inner">
      <div class="card-art">${artContent}</div>
      <div class="card-rarity-band">
        <span>${RARITY_LABELS[l.rareza]}</span>
        <div class="rarity-dots">${dots}</div>
      </div>
      <div class="card-body">
        ${title}
        ${desc}
      </div>
    </div>
  </div>`;
}
 
function renderLogros(logros) {
  const grid = document.getElementById('achievementsGrid');
  const sorted = [...logros].sort((a,b) => b.desbloqueado - a.desbloqueado);
  grid.innerHTML = sorted.map(buildCard).join('');
 
  const count = logros.filter(l => l.desbloqueado).length;
  document.getElementById('achievementsCount').textContent =
    `${count}/${logros.length}`;

  grid.addEventListener('mousemove', (e) => {
        const card = e.target.closest('.lcard');
        if (card) tiltCard(e, card);
    });

    grid.addEventListener('mouseleave', (e) => {
        const card = e.target.closest('.lcard');
        if (card) resetCard(card);
    }, true); // true = capture phase para que mouseleave funcione en hijos

    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.lcard');
        if (card) clickCard(e, card);
    });
}
 
/* ── 3D TILT ─────────────────────────────────────────── */
function tiltCard(e, el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  const dx = (e.clientX - cx) / (rect.width / 2);
  const dy = (e.clientY - cy) / (rect.height / 2);
  el.style.transform =
    `perspective(600px) rotateY(${dx * 12}deg) rotateX(${-dy * 12}deg) scale(1.06)`;
  el.style.zIndex = '10';
}
function resetCard(el) {
  el.style.transform = '';
  el.style.zIndex = '';
}
 
/* ── CLICK / AUDIO ───────────────────────────────────── */
function clickCard(e, card) {
  /* Ripple */
  const r = document.createElement('div');
  r.className = 'card-ripple';
  const rect = card.getBoundingClientRect();
  r.style.left = (e.clientX - rect.left - 10) + 'px';
  r.style.top  = (e.clientY - rect.top  - 10) + 'px';
  card.querySelector('.lcard-inner').appendChild(r);
  setTimeout(() => r.remove(), 600);
 
  /* Audio */
  const id = card.dataset.id;
  reproducirSonido(id);
}
 
function reproducirSonido(logroId) {
  const audio = new Audio(`/audio/logros/${logroId}.mp3`);
  audio.volume = 0.7;
  audio.play().catch(() => {
    /* Fallback beep Web Audio API */
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 720;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch(err) {}
  });
}
 
/* ── SCROLL ──────────────────────────────────────────── */
function scrollAchievements(dir) {
  document.getElementById('achievementsGrid')
    .scrollBy({ left: dir === 'right' ? 150 : -150, behavior: 'smooth' });
}
 

    renderLogros(LOGROS);
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
// ===============================================
// TOASTTTT
// ===============================================

function mostrarToast(mensaje, opcionesOTipo = {}) {
  let icon = '🔧';
  let duracion = 4000;
  let tipo = null;
  let usarBootstrapIcons = false;

  // Detectar si viene como string (tipo) o como objeto (opciones)
  if (typeof opcionesOTipo === 'string') {
    // Modo: mostrarToast(mensaje, 'success')
    tipo = opcionesOTipo;
    usarBootstrapIcons = true;
  } else {
    // Modo: mostrarToast(mensaje, { icon: '🏗️', duracion: 4000 })
    icon = opcionesOTipo.icon || '🔧';
    duracion = opcionesOTipo.duracion || 4000;
  }

  const container = document.getElementById('toast-container');
  if (!container) {
    console.error('Toast container no encontrado');
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast-construccion';
  
  let iconHTML = icon;
  if (usarBootstrapIcons) {
    let iconClass = 'bi-check2';
    if (tipo === 'error')   iconClass = 'bi-x-lg';
    if (tipo === 'warning') iconClass = 'bi-exclamation-triangle';
    iconHTML = `<i class="bi ${iconClass}"></i>`;
  }

  toast.innerHTML = `
    <span class="toast-icon">${iconHTML}</span>
    <div class="toast-text">${mensaje}</div>
    <span class="toast-close">✕</span>
  `;

  container.appendChild(toast);

  const cerrar = () => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 400);
  };

  toast.querySelector('.toast-close').addEventListener('click', (e) => {
    e.stopPropagation();
    cerrar();
  });

  toast.addEventListener('click', cerrar);

  setTimeout(cerrar, duracion);

  // Limitar a 3 toasts
  const toasts = container.querySelectorAll('.toast-construccion');
  if (toasts.length > 3) {
    const oldest = toasts[0];
    oldest.classList.add('exit');
    setTimeout(() => oldest.remove(), 400);
  }
}

// ── Listeners para diferentes tipos de notificaciones ──
setTimeout(() => {
  // Construcción
  document.querySelectorAll('a[data-construccion]').forEach(enlace => {
    enlace.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mostrarToast('Estamos trabajando aquí, vuelve más tarde 👷', {
        icon: '🏗️',
        duracion: 4000
      });
    });
  });

  // Proximamente
  document.querySelectorAll('a[data-proximamente], button[data-proximamente]').forEach(enlace => {
    enlace.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mostrarToast('Esta función llegará muy pronto 🚀', {
        icon: '⏳',
        duracion: 4000
      });
    });
  });

  // En mantenimiento
  document.querySelectorAll('a[data-mantenimiento]').forEach(enlace => {
    enlace.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mostrarToast('Estamos en mantenimiento, intenta más tarde ⚙️', {
        icon: '🔧',
        duracion: 4000
      });
    });
  });

  // Premium (acceso restringido)
  document.querySelectorAll('a[data-premium]').forEach(enlace => {
    enlace.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mostrarToast('Esta función es solo para miembros premium 👑', {
        icon: '💎',
        duracion: 4000
      });
    });
  });

  // No disponible en móvil
  document.querySelectorAll('a[data-desktop-only]').forEach(enlace => {
    enlace.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mostrarToast('Esta función solo está disponible en desktop 💻', {
        icon: '📱',
        duracion: 4000
      });
    });
  });

}, 500);

// ===============================================
// TIPS ALEATORIOS
// ===============================================

const TIPS_ALEATORIOS = [
  { icon: '⚽', texto: 'El Mundial 2026 es el primero con 48 selecciones.' },
  { icon: '🌍', texto: 'Por primera vez el Mundial se juega en 3 países: EE.UU., México y Canadá.' },
  { icon: '💡', texto: 'Predice el resultado exacto y ganas puntos extra.' },
  { icon: '🏆', texto: 'El campeón que eliges al inicio vale puntos dobles.' },
  { icon: '📊', texto: 'Hay 104 partidos en total en el torneo.' },
  { icon: '🌟', texto: 'La final se jugará el 19 de julio de 2026 en Nueva York.' },
  { icon: '🇻🇪', texto: 'Droguería Carrisan trae la Quiniela más emocionante del 2026.' },
  { icon: '⚡', texto: 'El torneo arranca el 11 de junio de 2026.' },
  { icon: '🥅', texto: 'Los grupos tienen 3 equipos cada uno — más partidos por equipo.' },
  { icon: '🎯', texto: 'Cuanto más aciertes, más alto subes en el ranking global.' },
];

// ── Listener para tips aleatorios ──
setTimeout(() => {
  document.querySelectorAll('a[data-tip], button[data-tip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Seleccionar tip random
      const tip = TIPS_ALEATORIOS[Math.floor(Math.random() * TIPS_ALEATORIOS.length)];
      
      mostrarToast(tip.texto, {
        icon: tip.icon,
        duracion: 5000
      });
    });
  });
}, 500);

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