// mrchip.js - Análisis de predicciones por partido
console.log('campeon guardado:', localStorage.getItem('quiniela_campeon'));
// Verificar autenticación
if (!auth.isAuthenticated()) {
    window.location.href = 'login.html';
}

const usuario = auth.getUser();
let todosPartidos = [];
let partidoActualId = null;

// ===================================
// FUNCIÓN PARA OBTENER BANDERAS EMOJI
// ===================================
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

// ===================================
// INICIALIZACIÓN
// ===================================

document.addEventListener('DOMContentLoaded', async () => {
    // Actualizar nombre de usuario
    const userCampeon = document.getElementById('userCampeon');
    if (userCampeon) userCampeon.textContent = obtenerCampeon(usuario.campeon_elegido);
    const userNameElement = document.getElementById('userName');
    if (userNameElement && usuario) {
        userNameElement.textContent = usuario.nombre;
    }

    // Mostrar botón admin si corresponde
    if (auth.isAdmin()) {
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.style.display = 'flex';
            adminBtn.onclick = () => window.location.href = 'admin.html';
        }
    }

    // Cargar datos iniciales
    await cargarPartidos();
    await cargarProximoPartido();

    // Configurar selector de partidos
    configurarSelectorPartidos();
});

// ===================================
// CARGAR PARTIDOS
// ===================================

async function cargarPartidos() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos`);
        const data = await response.json();
        console.log('Respuesta /partidos:', data[0]); // <-- agrega esto
        todosPartidos = data;
        llenarSelectorPartidos();
    } catch (error) {
        console.error('Error cargando partidos:', error);
    }
}

function llenarSelectorPartidos() {
    const select = document.getElementById('partidoSelect');
    
    select.innerHTML = '<option value="">-- Selecciona un partido --</option>';
    
    todosPartidos.filter(p => p.fase.startsWith('Grupo ')).forEach(partido => {
        const fechaStr = formatearFecha(partido.fecha);
        const horaStr = formatearHora(partido.fecha_hora);
        
        const option = document.createElement('option');
        option.value = partido.id;
        option.textContent = ` ${fechaStr}  | ${partido.equipo_local} vs ${partido.equipo_visitante}`;
        
        if (partido.estado === 'finalizado') {
            option.textContent += ` (${partido.goles_local_real}-${partido.goles_visitante_real})`;
        }
        
        select.appendChild(option);
    });
}

// ===================================
// CARGAR PRÓXIMO PARTIDO
// ===================================

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
        console.error('Error cargando próximo partido:', error);
    }
}

// ===================================
// CONFIGURAR SELECTOR
// ===================================

function configurarSelectorPartidos() {
    const select = document.getElementById('partidoSelect');
    
    select.addEventListener('change', async function() {
        const partidoId = this.value;
        
        if (partidoId) {
            partidoActualId = partidoId;
            await cargarDatosPartido(partidoId);
        }
    });
}

// ===================================
// CARGAR DATOS DEL PARTIDO
// ===================================

async function cargarDatosPartido(partidoId) {
    mostrarLoading(true);
    ocultarSecciones();

    try {
        // Cargar predicciones del partido
        const response = await fetch(`${CONFIG.API_URL}/mrchip/partido/${partidoId}`);
        const data = await response.json();
        console.log('prediccion local[0]:', data.predicciones.local[0]);
        // Cargar usuarios sin predicción
        const sinPredResponse = await fetch(`${CONFIG.API_URL}/mrchip/usuarios-sin-prediccion/${partidoId}`);
        const usuariosSinPred = await sinPredResponse.json();

        mostrarLoading(false);

        // Mostrar datos
        mostrarPartido(data.partido);
        mostrarPredicciones(data.predicciones, data.partido);
        mostrarUsuariosSinPrediccion(usuariosSinPred);
        mostrarEstadisticas(data.predicciones, data.total_predicciones);

    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarLoading(false);
        mostrarError('Error al cargar los datos del partido');
    }
}

// ===================================
// MOSTRAR PARTIDO
// ===================================

function mostrarPartido(partido) {
    const vsCard = document.getElementById('vsCard');
    vsCard.style.display = 'block';

    // Fecha y fase
    document.getElementById('matchDate').textContent = 
        `${formatearFecha(partido.fecha_hora)} - ${formatearHora(partido.fecha_hora)}`;
    document.getElementById('matchPhase').textContent = partido.fase;

    // Estado
    const statusBadge = document.getElementById('matchStatus');
    let statusClass = 'pending';
    let statusText = 'Pendiente';

    if (partido.estado === 'en_juego') {
        statusClass = 'live';
        statusText = '🔴 EN VIVO';
    } else if (partido.estado === 'finalizado') {
        statusClass = 'finished';
        statusText = 'Finalizado';
    }

    statusBadge.innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;

    // Equipo local
    const teamHome = document.getElementById('teamHome');
    teamHome.querySelector('.team-flag').textContent = obtenerBandera(partido.equipo_local);
    teamHome.querySelector('.team-name').textContent = partido.equipo_local;
    
    const scoreHome = document.getElementById('scoreHome');
    scoreHome.textContent = partido.goles_local_real !== null ? partido.goles_local_real : '-';

    // Equipo visitante
    const teamAway = document.getElementById('teamAway');
    teamAway.querySelector('.team-flag').textContent = obtenerBandera(partido.equipo_visitante);
    teamAway.querySelector('.team-name').textContent = partido.equipo_visitante;
    
    const scoreAway = document.getElementById('scoreAway');
    scoreAway.textContent = partido.goles_visitante_real !== null ? partido.goles_visitante_real : '-';
}

// ===================================
// MOSTRAR PREDICCIONES
// ===================================

function mostrarPredicciones(predicciones, partido) {
    const grid = document.getElementById('predictionsGrid');
    
    document.getElementById('teamLocalIcon').textContent = obtenerBandera(partido.equipo_local)
    document.getElementById('teamVisitanteIcon').textContent = obtenerBandera(partido.equipo_visitante)
    // Actualizar nombres de equipos en columnas
    document.getElementById('teamLocalName').textContent = partido.equipo_local.toUpperCase();
    document.getElementById('teamVisitanteName').textContent = partido.equipo_visitante.toUpperCase();

    // Contadores
    document.getElementById('countLocal').textContent = predicciones.local.length;
    document.getElementById('countEmpate').textContent = predicciones.empate.length;
    document.getElementById('countVisitante').textContent = predicciones.visitante.length;

    // Mostrar usuarios en cada columna
    mostrarUsuariosColumna('usersLocal', predicciones.local);
    mostrarUsuariosColumna('usersEmpate', predicciones.empate);
    mostrarUsuariosColumna('usersVisitante', predicciones.visitante);

    // Mostrar grid si hay predicciones
    const hayPredicciones = predicciones.local.length + predicciones.empate.length + predicciones.visitante.length > 0;
    
    if (hayPredicciones) {
        grid.style.display = 'grid';
        document.getElementById('emptyState').style.display = 'none';
    } else {
        grid.style.display = 'none';
        document.getElementById('emptyState').style.display = 'flex';
    }
}

function mostrarUsuariosColumna(containerId, usuarios) {
    const container = document.getElementById(containerId);
    
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
            ${user.puntos !== null ? `
                <div class="user-points ${getPuntosClass(user.puntos)}">
                    ${user.puntos} pts
                </div>
            ` : ''}
        </div>
    `).join('');
    
}

function getPuntosClass(puntos) {
    if (puntos === 9) return 'points-perfect';
    if (puntos === 7) return 'points-good';
    if (puntos === 5 || puntos === 2) return 'points-partial';
    return 'points-none';
}

// ===================================
// MOSTRAR USUARIOS SIN PREDICCIÓN
// ===================================

function mostrarUsuariosSinPrediccion(usuarios) {
    const section = document.getElementById('sinPrediccionSection');
    const container = document.getElementById('usersSinPrediccion');

    if (usuarios.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = usuarios.map(user => `
        <div class="user-sin-pred">
            <span class="user-avatar-small">😴</span>
            <span class="user-name-small">${user.nombre}</span>
        </div>
    `).join('');
}

// ===================================
// MOSTRAR ESTADÍSTICAS
// ===================================

function mostrarEstadisticas(predicciones, total) {
    document.getElementById('totalPredicciones').textContent = total;

    if (total === 0) {
        document.getElementById('porcentajeLocal').textContent = '0%';
        document.getElementById('porcentajeEmpate').textContent = '0%';
        document.getElementById('porcentajeVisitante').textContent = '0%';
        return;
    }

    const pctLocal = ((predicciones.local.length / total) * 100).toFixed(0);
    const pctEmpate = ((predicciones.empate.length / total) * 100).toFixed(0);
    const pctVisitante = ((predicciones.visitante.length / total) * 100).toFixed(0);

    document.getElementById('porcentajeLocal').textContent = `${pctLocal}%`;
    document.getElementById('porcentajeEmpate').textContent = `${pctEmpate}%`;
    document.getElementById('porcentajeVisitante').textContent = `${pctVisitante}%`;
}

// ===================================
// UI HELPERS
// ===================================

function mostrarLoading(mostrar) {
    document.getElementById('loadingState').style.display = mostrar ? 'flex' : 'none';
}

function ocultarSecciones() {
    document.getElementById('vsCard').style.display = 'none';
    document.getElementById('predictionsGrid').style.display = 'none';
    document.getElementById('sinPrediccionSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
}

function mostrarError(mensaje) {
    console.error(mensaje);
    // TODO: Implementar sistema de notificaciones
}

// ===================================
// UTILIDADES
// ===================================

function parsearFecha(fechaStr) {
    if (!fechaStr) return null;
    const normalizada = fechaStr
        .replace(' ', 'T')
        .replace(/(\.\d+)?([+-]\d{2})$/, '$2:00'); // maneja milisegundos antes del offset
    const fecha = new Date(normalizada);
    return isNaN(fecha.getTime()) ? null : fecha;
}

function formatearFecha(fechaStr) {
    const fecha = parsearFecha(fechaStr);
    if (!fecha) return 'Fecha no disponible';
    return fecha.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short',
    });
}

function formatearHora(fechaStr) {
    const fecha = parsearFecha(fechaStr);
    if (!fecha) return '--:--';
    return fecha.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    });
}

// ===================================
// LOGOUT
// ===================================

function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        auth.logout();
    }
}