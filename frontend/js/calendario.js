// ===============================================
// CALENDARIO FIFA STYLE - MUNDIAL 2026
// ===============================================

let todosPartidos = [];
let fechasDisponibles = [];
let fechaSeleccionada = null;
let showLiveOnly = false;

document.addEventListener('DOMContentLoaded', async () => {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    const usuario = auth.getUser();
    document.querySelectorAll('.user-name-display').forEach(el => el.textContent = usuario.nombre);
    const emoji = obtenerCampeon(usuario.campeon_elegido);
    document.querySelectorAll('.user-emoji-display').forEach(el => el.textContent = emoji);
    // Botón admin
    const adminBtn = document.querySelector('.btn-admin-display');
    if (adminBtn && auth.isAdmin()) {
        adminBtn.style.display = 'flex';
        adminBtn.onclick = () => window.location.href = 'admin.html';
    }

    await cargarPartidos();
    cargarProximosPartidos(),
    cargarUltimosResultados(),
    configurarEventos();
});

// ===============================================
// CARGAR PARTIDOS
// ===============================================

async function cargarPartidos() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/partidos`);
        if (!response.ok) throw new Error('Error cargando partidos');

        todosPartidos = await response.json();
        console.log('📅 Partidos cargados:', todosPartidos.length);

        // Ordenar por fecha
        todosPartidos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        generarFechas();
        renderizarDateScroller();
        
        // Seleccionar fecha de hoy por defecto
        const hoy = new Date().toISOString().split('T')[0];
        const fechaHoy = fechasDisponibles.find(f => f.dateString === hoy);
        
        if (fechaHoy) {
            seleccionarFecha(fechaHoy.dateString);
        } else {
            // Si no hay partidos hoy, seleccionar la primera fecha disponible
            if (fechasDisponibles.length > 0) {
                seleccionarFecha(fechasDisponibles[0].dateString);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        document.getElementById('matchesContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error al cargar partidos</h3>
                <p style="color: var(--text-gray);">${error.message}</p>
            </div>
        `;
    }
}

// ===============================================
// GENERAR FECHAS DISPONIBLES
// ===============================================

function generarFechas() {
    const fechasMap = new Map();

    todosPartidos.forEach(partido => {
        const fecha = new Date(partido.fecha);
        const dateString = fecha.toISOString().split('T')[0];

        if (!fechasMap.has(dateString)) {
            fechasMap.set(dateString, {
                date: fecha,
                dateString: dateString,
                partidos: []
            });
        }

        fechasMap.get(dateString).partidos.push(partido);
    });

    fechasDisponibles = Array.from(fechasMap.values()).sort((a, b) => a.date - b.date);
    console.log('📆 Fechas disponibles:', fechasDisponibles.length);
}

// ===============================================
// RENDERIZAR DATE SCROLLER
// ===============================================

function renderizarDateScroller() {
    const track = document.getElementById('datesTrack');
    const hoy = new Date().toISOString().split('T')[0];

    track.innerHTML = fechasDisponibles.map(fecha => {
        const date = fecha.date;
        const dayName = date.toLocaleDateString('es', { weekday: 'short' });
        const dayNumber = date.getDate();
        const month = date.toLocaleDateString('es', { month: 'short' });
        const isToday = fecha.dateString === hoy;
        const matchCount = fecha.partidos.length;

        return `
            <div class="date-item ${isToday ? 'today' : ''}" 
                 data-date="${fecha.dateString}"
                 onclick="seleccionarFecha('${fecha.dateString}')">
                <div class="date-day-name">${dayName.toUpperCase()}</div>
                <div class="date-day-number">${dayNumber}</div>
                <div class="date-month">${month.toUpperCase()}</div>
                <div class="date-match-count">${matchCount} partido${matchCount !== 1 ? 's' : ''}</div>
            </div>
        `;
    }).join('');

    actualizarContadorLive();
}

// ===============================================
// SELECCIONAR FECHA
// ===============================================

function seleccionarFecha(dateString) {
    fechaSeleccionada = dateString;

    // Actualizar UI de fechas
    document.querySelectorAll('.date-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.date === dateString) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    });

    mostrarPartidosDelDia();
}

// ===============================================
// MOSTRAR PARTIDOS DEL DÍA
// ===============================================

function mostrarPartidosDelDia() {
    const container = document.getElementById('matchesContainer');
    const fechaData = fechasDisponibles.find(f => f.dateString === fechaSeleccionada);

    if (!fechaData) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <h3>No hay partidos</h3>
                <p style="color: var(--text-gray);">No hay partidos programados para esta fecha</p>
            </div>
        `;
        return;
    }

    let partidos = fechaData.partidos;

    // Filtrar solo partidos en vivo si el toggle está activo
    if (showLiveOnly) {
        partidos = partidos.filter(p => p.estado === 'en_juego');
        
        if (partidos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📺</div>
                    <h3>No hay partidos en vivo</h3>
                    <p style="color: var(--text-gray);">No hay partidos en vivo en este momento</p>
                </div>
            `;
            return;
        }
    }

    // Renderizar partidos
    const fecha = fechaData.date;
    const fechaFormateada = fecha.toLocaleDateString('es', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    container.innerHTML = `
        <div class="day-section">
            <div class="day-header">
                <div class="day-title">${fechaFormateada}</div>
                <div class="day-match-count">${partidos.length} partido${partidos.length !== 1 ? 's' : ''}</div>
            </div>
            
            <div class="matches-list">
                ${partidos.map(partido => crearMatchCard(partido)).join('')}
            </div>
        </div>
    `;
}

// ===============================================
// CREAR MATCH CARD
// ===============================================

function crearMatchCard(partido) {
    const fecha = new Date(partido.fecha);
    const hora = fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    
    const tieneMarcador = partido.goles_local_real !== null && partido.goles_local_real !== undefined;
    
    let statusBadge = '';
    let statusClass = '';
    
    switch (partido.estado) {
        case 'en_juego':
            statusBadge = '🔴 EN VIVO';
            statusClass = 'live';
            break;
        case 'finalizado':
            statusBadge = 'FINALIZADO';
            statusClass = 'finished';
            break;
        default:
            statusBadge = 'PRÓXIMO';
            statusClass = 'pending';
    }

    return `
        <div class="match-card-fifa">
            <!-- Hora -->
            <div class="match-time">
                <div class="match-hour">${hora}</div>
                <div class="match-phase">${partido.fase}</div>
            </div>
            
            <!-- Equipo Local -->
            <div class="match-team">
                <span class="team-flag-fifa">${obtenerBandera(partido.equipo_local)}</span>
                <span class="team-name-fifa">${partido.equipo_local}</span>
            </div>
            
            <!-- Marcador -->
            <div class="match-score">
                ${tieneMarcador ? `
                    <div class="score-display-fifa">
                        ${partido.goles_local_real} - ${partido.goles_visitante_real}
                    </div>
                ` : `
                    <div class="score-vs">VS</div>
                `}
            </div>
            
            <!-- Equipo Visitante -->
            <div class="match-team away">
                <span class="team-flag-fifa">${obtenerBandera(partido.equipo_visitante)}</span>
                <span class="team-name-fifa">${partido.equipo_visitante}</span>
            </div>
            
            <!-- Estado -->
            <div class="match-status">
                <div class="status-badge-fifa ${statusClass}">${statusBadge}</div>
            </div>
        </div>
    `;
}

// ===============================================
// CONFIGURAR EVENTOS
// ===============================================

function configurarEventos() {
    // Scroll navigation
    document.getElementById('scrollLeft').addEventListener('click', () => {
        document.getElementById('datesTrack').scrollBy({ left: -300, behavior: 'smooth' });
    });

    document.getElementById('scrollRight').addEventListener('click', () => {
        document.getElementById('datesTrack').scrollBy({ left: 300, behavior: 'smooth' });
    });

    // Live toggle
    document.getElementById('liveToggle').addEventListener('click', () => {
        showLiveOnly = !showLiveOnly;
        document.getElementById('liveToggle').classList.toggle('active');
        mostrarPartidosDelDia();
    });
}

// ===============================================
// ACTUALIZAR CONTADOR LIVE
// ===============================================

function actualizarContadorLive() {
    const partidosEnVivo = todosPartidos.filter(p => p.estado === 'en_juego').length;
    const liveCount = document.getElementById('liveCount');
    
    if (partidosEnVivo > 0) {
        liveCount.textContent = partidosEnVivo;
        liveCount.style.display = 'inline-block';
    } else {
        liveCount.style.display = 'none';
    }
}

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
// ===============================================
// UTILIDADES
// ===============================================

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

function logout() {
    if (confirm('¿Estás seguro de que quieres salir?')) {
        auth.logout();
    }
}

window.logout = logout;
window.seleccionarFecha = seleccionarFecha;