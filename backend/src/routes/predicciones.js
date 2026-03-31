// ===============================================
// PREDICCIONES.JS - SIN LÍMITE DE TIEMPO (TESTING)
// ===============================================

let usuario = null;
let partidosPendientes = [];
let prediccionesRealizadas = [];
let filtroFase = 'all';
let ordenamiento = 'fecha';

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

function configurarUI() {
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

    let partidosFiltrados = filtroFase === 'all' 
        ? partidosPendientes 
        : partidosPendientes.filter(p => p.fase === filtroFase);

    if (ordenamiento === 'fecha') {
        partidosFiltrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    } else if (ordenamiento === 'fase') {
        partidosFiltrados.sort((a, b) => a.fase.localeCompare(b.fase));
    }

    if (partidosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚽</div>
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

    return `
        <div class="match-card" id="card-${partido.id}">
            <div class="match-header">
                <span class="match-phase">${partido.fase}</span>
                <span class="match-date">${fecha.toLocaleDateString('es', { 
                    day: '2-digit', 
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</span>
            </div>
            
            <div class="match-teams">
                <div class="team">
                    <span class="team-flag">${obtenerBandera(partido.equipo_local)}</span>
                    <span class="team-name">${partido.equipo_local}</span>
                </div>
                
                <span class="vs">VS</span>
                
                <div class="team">
                    <span class="team-flag">${obtenerBandera(partido.equipo_visitante)}</span>
                    <span class="team-name">${partido.equipo_visitante}</span>
                </div>
            </div>
            
            <div class="prediction-inputs">
                <input type="number" 
                       class="goal-input" 
                       id="local_${partido.id}" 
                       min="0" 
                       max="9" 
                       placeholder="0"
                       onkeypress="if(event.key==='Enter') enviarPrediccion(${partido.id})">
                <span class="separator">-</span>
                <input type="number" 
                       class="goal-input" 
                       id="visitante_${partido.id}" 
                       min="0" 
                       max="9" 
                       placeholder="0"
                       onkeypress="if(event.key==='Enter') enviarPrediccion(${partido.id})">
            </div>
            
            <button class="btn-predict" onclick="enviarPrediccion(${partido.id})">
                <span>💾</span>
                <span>Guardar Predicción</span>
            </button>
            
            <div class="time-limit">
                <span>📅</span>
                <span>${fecha.toLocaleDateString('es', { 
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                })}</span>
            </div>
        </div>
    `;
}

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

    const prediccionesOrdenadas = [...prediccionesRealizadas].sort((a, b) => 
        new Date(b.fecha) - new Date(a.fecha)
    );

    container.innerHTML = prediccionesOrdenadas.map(pred => crearCardPrediccion(pred)).join('');
}

function crearCardPrediccion(prediccion) {
    const fecha = new Date(prediccion.fecha);
    const esPendiente = prediccion.puntos_obtenidos === null;

    return `
        <div class="prediction-card">
            <div class="prediction-info">
                <div class="prediction-match-name">
                    ${obtenerBandera(prediccion.equipo_local)} ${prediccion.equipo_local} vs 
                    ${prediccion.equipo_visitante} ${obtenerBandera(prediccion.equipo_visitante)}
                </div>
                <div class="prediction-details">
                    <span>${prediccion.fase}</span>
                    <span>•</span>
                    <span>${fecha.toLocaleDateString('es', { day: '2-digit', month: 'short' })}</span>
                </div>
            </div>
            
            <div class="prediction-score">
                ${prediccion.goles_local_pred} - ${prediccion.goles_visitante_pred}
            </div>
            
            <div class="prediction-result">
                <span class="status-badge ${esPendiente ? 'pendiente' : 'finalizado'}">
                    ${esPendiente ? '⏳ Pendiente' : '✅ Finalizado'}
                </span>
                ${!esPendiente ? `<span class="points-display">+${prediccion.puntos_obtenidos}</span>` : ''}
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
        const btnPredict = card.querySelector('.btn-predict');
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

            setTimeout(() => {
                cambiarTab('completed');
            }, 1500);
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

function obtenerBandera(codigoEquipo) {
    const banderas = {
        'ARG': '🇦🇷', 'BRA': '🇧🇷', 'URU': '🇺🇾', 'COL': '🇨🇴', 'CHI': '🇨🇱',
        'MEX': '🇲🇽', 'USA': '🇺🇸', 'CAN': '🇨🇦', 'CRC': '🇨🇷', 'JAM': '🇯🇲',
        'ESP': '🇪🇸', 'GER': '🇩🇪', 'FRA': '🇫🇷', 'ITA': '🇮🇹', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'POR': '🇵🇹', 'NED': '🇳🇱', 'BEL': '🇧🇪', 'CRO': '🇭🇷', 'SUI': '🇨🇭',
        'JPN': '🇯🇵', 'KOR': '🇰🇷', 'AUS': '🇦🇺', 'IRN': '🇮🇷', 'SAU': '🇸🇦',
        'MAR': '🇲🇦', 'SEN': '🇸🇳', 'TUN': '🇹🇳', 'CMR': '🇨🇲', 'NGA': '🇳🇬',
        'GHA': '🇬🇭', 'ECU': '🇪🇨'
    };
    return banderas[codigoEquipo] || '🏴';
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