// MR. CHIP v2.0 - Análisis de Predicciones Mejorado
// ===================================

console.log('Mr. CHIP iniciando...');

// Verificar autenticación
if (!auth.isAuthenticated()) {
    window.location.href = 'login.html';
}

const usuario = auth.getUser();
let todosPartidos = [];
let partidoActualId = null;
let datosEnCache = {};

// BANDERAS Y MAPEOS
// ===================================

const obtenerCampeon = (codigo) => {
    const campeones = {
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
    return campeones[codigo] || '🏴';
};

const obtenerBandera = (nombre) => {
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
        'Nueva Zelanda': '🇳🇿', 'Nueva Caledonia': '🇳🇨', 'Surinam': '🇸🇷'
    };
    return banderas[nombre] || '🏴';
};

// UTILIDADES
// ===================================

const parsearFecha = (fechaStr) => {
    if (!fechaStr) return null;
    const normalizada = fechaStr
        .replace(' ', 'T')
        .replace(/(\.\d+)?([+-]\d{2})$/, '$2:00');
    const fecha = new Date(normalizada);
    return isNaN(fecha.getTime()) ? null : fecha;
};

const formatearFecha = (fechaStr) => {
    const fecha = parsearFecha(fechaStr);
    if (!fecha) return 'N/A';
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const formatearHora = (fechaStr) => {
    const fecha = parsearFecha(fechaStr);
    if (!fecha) return '--:--';
    return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getPuntosClass = (puntos) => {
    if (puntos === 9) return 'points-perfect';
    if (puntos === 7) return 'points-good';
    if (puntos === 5 || puntos === 2) return 'points-partial';
    return 'points-none';
};

// UI HELPERS
// ===================================

const mostrarLoading = (mostrar) => {
    document.getElementById('loadingState').style.display = mostrar ? 'flex' : 'none';
};

const ocultarSecciones = () => {
    ['vsCard', 'predictionsGrid', 'sinPrediccionSection', 'emptyState'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.style.display = 'none';
    });
};

const mostrarError = (mensaje) => {
    console.error('❌ Error:', mensaje);
    // TODO: Sistema de notificaciones elegante
};

// CARGAR DATOS
// ===================================

async function cargarPartidos() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos`);
        const data = await response.json();
        todosPartidos = data;
        llenarSelectorPartidos();
    } catch (error) {
        mostrarError('Error cargando partidos: ' + error.message);
    }
}

function llenarSelectorPartidos() {
    const select = document.getElementById('partidoSelect');
    select.innerHTML = '<option value="">-- Selecciona un partido --</option>';
    
    todosPartidos
        .filter(p => p.fase.startsWith('Grupo '))
        .forEach(partido => {
            const option = document.createElement('option');
            option.value = partido.id;
            option.textContent = `${formatearFecha(partido.fecha)} | ${partido.equipo_local} vs ${partido.equipo_visitante}`;
            
            if (partido.estado === 'finalizado') {
                option.textContent += ` (${partido.goles_local_real}-${partido.goles_visitante_real})`;
            }
            
            select.appendChild(option);
        });
}

async function cargarProximoPartido() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/mrchip/proximo-partido`);
        const data = await response.json();
        
        if (data.id) {
            partidoActualId = data.id;
            document.getElementById('partidoSelect').value = data.id;
            await cargarDatosPartido(data.id);
        }
    } catch (error) {
        mostrarError('Error cargando próximo partido: ' + error.message);
    }
}

async function cargarDatosPartido(partidoId) {
    if (!partidoId) return;
    
    // Verificar caché
    if (datosEnCache[partidoId]) {
        mostrarDatos(datosEnCache[partidoId]);
        return;
    }
    
    mostrarLoading(true);
    ocultarSecciones();

    try {
        const [resPartido, resSinPred] = await Promise.all([
            fetch(`${CONFIG.API_URL}/mrchip/partido/${partidoId}`),
            fetch(`${CONFIG.API_URL}/mrchip/usuarios-sin-prediccion/${partidoId}`)
        ]);

        const dataPartido = await resPartido.json();
        const usuariosSinPred = await resSinPred.json();

        // Guardar en caché
        datosEnCache[partidoId] = {
            partido: dataPartido.partido,
            predicciones: dataPartido.predicciones,
            usuariosSinPred: usuariosSinPred,
            totalPredicciones: dataPartido.total_predicciones
        };

        mostrarLoading(false);
        mostrarDatos(datosEnCache[partidoId]);

    } catch (error) {
        mostrarLoading(false);
        mostrarError('Error cargando datos: ' + error.message);
    }
}

function mostrarDatos(datos) {
    mostrarPartido(datos.partido);
    mostrarPredicciones(datos.predicciones, datos.partido);
    mostrarUsuariosSinPrediccion(datos.usuariosSinPred);
    mostrarEstadisticas(datos.predicciones, datos.totalPredicciones);
}

// MOSTRAR INFORMACIÓN
// ===================================

function mostrarPartido(partido) {
    const vsCard = document.getElementById('vsCard');
    if (!vsCard) return;
    
    vsCard.style.display = 'block';

    document.getElementById('matchDate').textContent = 
        `${formatearFecha(partido.fecha_hora)} - ${formatearHora(partido.fecha_hora)}`;
    document.getElementById('matchPhase').textContent = partido.fase;

    const statusBadge = document.getElementById('matchStatus');
    let statusClass = 'pending';
    let statusText = 'Pendiente';

    if (partido.estado === 'en_juego') {
        statusClass = 'live';
        statusText = '🔴 EN VIVO';
    } else if (partido.estado === 'finalizado') {
        statusClass = 'finished';
        statusText = 'Finalizado ✅';
    }

    statusBadge.innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;

    // Equipos
    const teamHome = document.getElementById('teamHome');
    teamHome.querySelector('.team-flag').textContent = obtenerBandera(partido.equipo_local);
    teamHome.querySelector('.team-name').textContent = partido.equipo_local;
    document.getElementById('scoreHome').textContent = partido.goles_local_real !== null ? partido.goles_local_real : '-';

    const teamAway = document.getElementById('teamAway');
    teamAway.querySelector('.team-flag').textContent = obtenerBandera(partido.equipo_visitante);
    teamAway.querySelector('.team-name').textContent = partido.equipo_visitante;
    document.getElementById('scoreAway').textContent = partido.goles_visitante_real !== null ? partido.goles_visitante_real : '-';
}

function mostrarPredicciones(predicciones, partido) {
    document.getElementById('teamLocalIcon').textContent = obtenerBandera(partido.equipo_local);
    document.getElementById('teamVisitanteIcon').textContent = obtenerBandera(partido.equipo_visitante);
    document.getElementById('teamLocalName').textContent = partido.equipo_local.toUpperCase();
    document.getElementById('teamVisitanteName').textContent = partido.equipo_visitante.toUpperCase();

    document.getElementById('countLocal').textContent = predicciones.local.length;
    document.getElementById('countEmpate').textContent = predicciones.empate.length;
    document.getElementById('countVisitante').textContent = predicciones.visitante.length;

    mostrarUsuariosColumna('usersLocal', predicciones.local);
    mostrarUsuariosColumna('usersEmpate', predicciones.empate);
    mostrarUsuariosColumna('usersVisitante', predicciones.visitante);

    const hayPredicciones = predicciones.local.length + predicciones.empate.length + predicciones.visitante.length > 0;
    
    document.getElementById('predictionsGrid').style.display = hayPredicciones ? 'grid' : 'none';
    document.getElementById('emptyState').style.display = hayPredicciones ? 'none' : 'flex';
}

function mostrarUsuariosColumna(containerId, usuarios) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (usuarios.length === 0) {
        container.innerHTML = '<div class="empty-column">Sin predicciones</div>';
        return;
    }

    container.innerHTML = usuarios.map(user => `
        <div class="user-card">
            <div class="user-avatar">${obtenerCampeon(user.campeon_elegido)}</div>
            <div class="user-info">
                <div class="user-name">${user.nombre}</div>
                <div class="user-prediction">${user.goles_local} - ${user.goles_visitante}</div>
            </div>
            ${user.puntos !== null ? `<div class="user-points ${getPuntosClass(user.puntos)}">${user.puntos} pts</div>` : ''}
        </div>
    `).join('');
}

function mostrarUsuariosSinPrediccion(usuarios) {
    const section = document.getElementById('sinPrediccionSection');
    const container = document.getElementById('usersSinPrediccion');
    
    if (!usuarios || usuarios.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'block';
    if (container) {
        container.innerHTML = usuarios.map(user => `
            <div class="user-sin-pred">
                <span class="user-avatar-small">😴</span>
                <span class="user-name-small">${user.nombre}</span>
            </div>
        `).join('');
    }
}

function mostrarEstadisticas(predicciones, total) {
    document.getElementById('totalPredicciones').textContent = total;

    if (total === 0) {
        ['porcentajeLocal', 'porcentajeEmpate', 'porcentajeVisitante'].forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.textContent = '0%';
        });
        return;
    }

    const pctLocal = Math.round((predicciones.local.length / total) * 100);
    const pctEmpate = Math.round((predicciones.empate.length / total) * 100);
    const pctVisitante = Math.round((predicciones.visitante.length / total) * 100);

    document.getElementById('porcentajeLocal').textContent = `${pctLocal}%`;
    document.getElementById('porcentajeEmpate').textContent = `${pctEmpate}%`;
    document.getElementById('porcentajeVisitante').textContent = `${pctVisitante}%`;
}

// INICIALIZACIÓN
// ===================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🤓 Mr. CHIP iniciando carga...');
    
    await cargarPartidos();
    await cargarProximoPartido();

    const select = document.getElementById('partidoSelect');
    if (select) {
        select.addEventListener('change', async function() {
            if (this.value) {
                partidoActualId = this.value;
                await cargarDatosPartido(this.value);
            }
        });
    }

    console.log('✅ Mr. CHIP listo');
});

// LOGOUT
// ===================================

function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        auth.logout();
    }
}
