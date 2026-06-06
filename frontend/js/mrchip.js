// MR. CHIP v2.0 - Análisis de Predicciones Mejorado
// ===================================

console.log('Mr. CHIP iniciando...');

// Verificar autenticación
if (!auth.isAuthenticated()) {
    window.location.href = 'login.html';
}

// ========== VARIABLES GLOBALES ==========
let usuario;
let usuarioId;
let partidoActualId;
let datosEnCache = {};

// ========== ÚNICO LISTENER ==========
document.addEventListener('DOMContentLoaded', async () => {
    
    // === PARTE 1: Autenticación ===
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    usuario = auth.getUser();      
    usuarioId = usuario.id;     
    
    await verificarLogin();       
    configurarUI();
    
    // === PARTE 2: Mr. CHIP ===
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

// ========== FUNCIONES ==========
async function verificarLogin() {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Usar la variable global, NO redeclarar con const/let
    usuario = auth.getUser();      // SIN const/let - usa la global
    usuarioId = parseInt(usuario.id);

    document.querySelectorAll('.user-name-display').forEach(el => {
        el.textContent = usuario.nombre;
    });
    
    document.querySelectorAll('.btn-admin-display, .btn-noticias-display').forEach(btn => {
        btn.style.display = 'none';
    });

    if (usuario.isAdmin) {
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
{ icon: '😎', texto: 'Luis Carrillo es conocido como El Mas Grande por que fue su nombre de usario en la doble quiniela del 2024' },
{ icon: '😭', texto: 'Tito el campeon de Qatar 2022 quedo de ultimo en la Eurocopa 2024 con 108 pts' },
{ icon: '🤔', texto: 'Rohiver jugo por primera vez la quiniela y llego de ultimo en la Copa America 2024 con 72 pts' },
{ icon: '🤑', texto: 'Augusto utilizo una estrategia de empates, quedo de ultimo en Rusia 2018 con 81 pts' },
{ icon: '🥶', texto: 'Luis Leon Guerra llevo la delantera todo el torneo en Rusia 2018 y cayo en semis, quedando 4to lugar' },
{ icon: '👻', texto: 'Carlos Carrillo Jr es el que tiene peor promedio de: lo que habla/pts ganados' },
{ icon: '🗣️', texto: 'Luisito es el usuario con mas consistencia, siempre esta a media tabla' },
{ icon: '🥶', texto: 'Victor Carrillo Sr. usa la estrategia de la naranja mecanica, ha llegado en 2do lugar unas 3 veces' },
{ icon: '🏳️‍🌈', texto: 'Fabio Zavarse es el unico valenciano en la punta' },
{ icon: '👀', texto: 'Carlos Carrillo Sr. es como Mexico en los mundiales, esta feliz por participar' },
{ icon: '🐢', texto: 'La joven promesa Vicente, tiene mas ego que mbappe gracias a ganar la Copa America 2024' },
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

// Clases para el nuevo diseño mc-
const getMcPuntosClass = (puntos) => {
    if (puntos === 9) return 'mc-pts-perfect';
    if (puntos === 7) return 'mc-pts-good';
    if (puntos === 5 || puntos === 2) return 'mc-pts-partial';
    if (puntos === 0) return 'mc-pts-none';
    return 'mc-pts-pending';
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

function mostrarError(mensaje) {
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
    generarComentarioMrChip(datos.partido, datos.predicciones, datos.totalPredicciones);
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

    statusBadge.className = `mc-status-badge mc-status-${statusClass}`;
    statusBadge.innerHTML = `<span class="mc-status-dot"></span>${statusText}`;

    // Equipos
    // Banderas y nombres — compatibles con nuevo HTML (mc-team-flag / mc-team-name)
    // y también con el HTML antiguo (team-flag / team-name) por si acaso
    const teamHome = document.getElementById('teamHome');
    const flagHome = teamHome.querySelector('.mc-team-flag') || teamHome.querySelector('.team-flag');
    const nameHome = teamHome.querySelector('.mc-team-name') || teamHome.querySelector('.team-name');
    if (flagHome) flagHome.textContent = obtenerBandera(partido.equipo_local);
    if (nameHome) nameHome.textContent = partido.equipo_local;

    // También actualizar los IDs directos del nuevo HTML
    const flagHomeId = document.getElementById('flagHome');
    const nameHomeId = document.getElementById('nameHome');
    if (flagHomeId) flagHomeId.textContent = obtenerBandera(partido.equipo_local);
    if (nameHomeId) nameHomeId.textContent = partido.equipo_local;

    document.getElementById('scoreHome').textContent = partido.goles_local_real !== null ? partido.goles_local_real : '—';

    const teamAway = document.getElementById('teamAway');
    const flagAway = teamAway.querySelector('.mc-team-flag') || teamAway.querySelector('.team-flag');
    const nameAway = teamAway.querySelector('.mc-team-name') || teamAway.querySelector('.team-name');
    if (flagAway) flagAway.textContent = obtenerBandera(partido.equipo_visitante);
    if (nameAway) nameAway.textContent = partido.equipo_visitante;

    const flagAwayId = document.getElementById('flagAway');
    const nameAwayId = document.getElementById('nameAway');
    if (flagAwayId) flagAwayId.textContent = obtenerBandera(partido.equipo_visitante);
    if (nameAwayId) nameAwayId.textContent = partido.equipo_visitante;

    document.getElementById('scoreAway').textContent = partido.goles_visitante_real !== null ? partido.goles_visitante_real : '—';
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
        <div class="mc-user-card">
            <div class="mc-user-avatar">${obtenerCampeon(user.campeon_elegido)}</div>
            <div class="mc-user-info">
                <div class="mc-user-name">${user.nombre}</div>
                <div class="mc-user-pred">${user.goles_local} - ${user.goles_visitante}</div>
            </div>
            ${user.puntos !== null ? `<div class="mc-user-pts ${getMcPuntosClass(user.puntos)}">${user.puntos} pts</div>` : '<div class="mc-user-pts mc-pts-pending">—</div>'}
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
            <div class="mc-user-no-pred">
                <span>😴</span>
                <span>${user.nombre}</span>
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
        const barHome = document.getElementById('barHome');
        const barDraw = document.getElementById('barDraw');
        const barAway = document.getElementById('barAway');
        if (barHome) barHome.style.width = '33%';
        if (barDraw) barDraw.style.width = '34%';
        if (barAway) barAway.style.width = '33%';
        return;
    }

    const pctLocal     = Math.round((predicciones.local.length     / total) * 100);
    const pctEmpate    = Math.round((predicciones.empate.length    / total) * 100);
    const pctVisitante = Math.round((predicciones.visitante.length / total) * 100);

    document.getElementById('porcentajeLocal').textContent     = `${pctLocal}%`;
    document.getElementById('porcentajeEmpate').textContent    = `${pctEmpate}%`;
    document.getElementById('porcentajeVisitante').textContent = `${pctVisitante}%`;

    // Actualizar barras de distribución del nuevo diseño
    const barHome = document.getElementById('barHome');
    const barDraw = document.getElementById('barDraw');
    const barAway = document.getElementById('barAway');
    if (barHome) barHome.style.width = `${pctLocal}%`;
    if (barDraw) barDraw.style.width = `${pctEmpate}%`;
    if (barAway) barAway.style.width = `${pctVisitante}%`;

    // Nombres en la distribución
    const distNameHome = document.getElementById('distNameHome');
    const distNameAway = document.getElementById('distNameAway');
    if (distNameHome) distNameHome.textContent = predicciones.local.length > 0
        ? document.getElementById('nameHome')?.textContent || 'Local' : 'Local';
    if (distNameAway) distNameAway.textContent = predicciones.visitante.length > 0
        ? document.getElementById('nameAway')?.textContent || 'Visitante' : 'Visitante';
}

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


// LOGOUT
// ===================================

function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        auth.logout();
    }
}


// ================================================================
// COMENTARIO MR. CHIP — Generador de frases contextuales
// ================================================================

function generarComentarioMrChip(partido, predicciones, total) {
    const chipBox  = document.getElementById('chipComment');
    const chipText = document.getElementById('chipCommentText');
    if (!chipBox || !chipText) return;

    const local     = predicciones.local     || [];
    const empate    = predicciones.empate    || [];
    const visitante = predicciones.visitante || [];

    const nLocal     = local.length;
    const nEmpate    = empate.length;
    const nVisitante = visitante.length;

    const pctLocal     = total > 0 ? Math.round((nLocal     / total) * 100) : 0;
    const pctEmpate    = total > 0 ? Math.round((nEmpate    / total) * 100) : 0;
    const pctVisitante = total > 0 ? Math.round((nVisitante / total) * 100) : 0;

    const estado      = partido.estado; // 'pendiente' | 'en_juego' | 'finalizado'
    const equipoLocal = partido.equipo_local;
    const equipoVis   = partido.equipo_visitante;

    const golesL = partido.goles_local_real;
    const golesV = partido.goles_visitante_real;

    // ── Helpers ──────────────────────────────────────────────────

    // Grupo mayoritario
    const maxVotos = Math.max(nLocal, nEmpate, nVisitante);
    let grupoMayoria = 'empate';
    if (maxVotos === nLocal && nLocal > 0)     grupoMayoria = 'local';
    if (maxVotos === nVisitante && nVisitante >= nLocal && nVisitante > 0) grupoMayoria = 'visitante';

    // Consenso vs caos
    const maxPct = Math.max(pctLocal, pctEmpate, pctVisitante);
    const esConsenso = maxPct >= 70;
    const esCaos     = maxPct <= 40 && total >= 5;

    // ¿El usuario actual acertó?
    let usuarioAcerto = null;
    let puntosUsuario = null;
    if (estado === 'finalizado') {
        const todasLasCards = [...local, ...empate, ...visitante];
        const miCard = todasLasCards.find(u => u.id === usuarioId);
        if (miCard && miCard.puntos !== null) {
            puntosUsuario = miCard.puntos;
            usuarioAcerto = miCard.puntos >= 5;
        }
    }

    // Nombre del ganador real
    let ganadorReal = null;
    if (estado === 'finalizado' && golesL !== null && golesV !== null) {
        if (golesL > golesV)      ganadorReal = 'local';
        else if (golesV > golesL) ganadorReal = 'visitante';
        else                       ganadorReal = 'empate';
    }

    // ── Banco de frases por contexto ─────────────────────────────

    // 1. SIN PREDICCIONES
    if (total === 0) {
        chipText.textContent = `Nadie ha predicho este partido. ${nLocal + nEmpate + nVisitante === 0
            ? `Llevamos ${total} predicciones registradas, lo cual es técnicamente idéntico a cero. El silencio estadístico me perturba.`
            : 'El vacío de datos es filosóficamente inquietante.'}`;
        mostrarChipComment(chipBox, chipText.textContent);
        return;
    }

    // 2. PARTIDO FINALIZADO
    if (estado === 'finalizado' && ganadorReal !== null) {
        const frasesFinalizado = generarFraseFinalizado(
            ganadorReal, grupoMayoria, esConsenso, esCaos,
            equipoLocal, equipoVis, golesL, golesV,
            nLocal, nEmpate, nVisitante, total,
            puntosUsuario, usuarioAcerto
        );
        mostrarChipComment(chipBox, frasesFinalizado);
        return;
    }

    // 3. EN VIVO
    if (estado === 'en_juego') {
        const frasesVivo = generarFraseEnVivo(
            equipoLocal, equipoVis, golesL, golesV,
            grupoMayoria, nLocal, nEmpate, nVisitante, total
        );
        mostrarChipComment(chipBox, frasesVivo);
        return;
    }

    // 4. PENDIENTE
    const frasesPendiente = generarFrasePendiente(
        equipoLocal, equipoVis,
        esConsenso, esCaos, grupoMayoria,
        pctLocal, pctEmpate, pctVisitante,
        nLocal, nEmpate, nVisitante, total
    );
    mostrarChipComment(chipBox, frasesPendiente);
}

// ── Partido PENDIENTE ─────────────────────────────────────────────
function generarFrasePendiente(local, vis, esConsenso, esCaos, mayoria, pL, pE, pV, nL, nE, nV, total) {
    const frases = [];

    if (esConsenso) {
        const pct = Math.max(pL, pE, pV);
        const nombreMayoria = mayoria === 'local' ? local : mayoria === 'visitante' ? vis : 'el empate';
        frases.push(
            `El ${pct}% de la quiniela apoya a ${nombreMayoria}. Cuando ${pct} de cada 100 personas piensa lo mismo, estadísticamente alguien aquí va a quedar en ridículo. Y no va a ser el ${pct}%.`,
            `Consenso masivo detectado: ${pct}% apuesta por ${nombreMayoria}. Datos históricos sugieren que cuando hay tanta unanimidad en una quiniela, el universo interviene personalmente para arruinarlo.`,
            `${pct}% votando por ${nombreMayoria}. He analizado 847 quinielas similares y en el 62.3% de los casos con este nivel de consenso, el resultado sorprende. El ${100-pct}% restante podría ser profético.`
        );
    } else if (esCaos) {
        frases.push(
            `${total} predicciones y ningún acuerdo. ${local} o ${vis} o empate — la quiniela está completamente dividida. Esto es estadísticamente hermoso y humanamente preocupante.`,
            `División total detectada. ${nL} votan local, ${nE} empate, ${nV} visitante. Alguien aquí tiene razón. El resto va a pasar los próximos días reconstruyendo su modelo predictivo.`,
            `El índice de caos de este partido es extraordinariamente alto. ${pL}% local · ${pE}% empate · ${pV}% visitante. Nadie se pone de acuerdo, lo cual me genera una satisfacción estadística considerable.`
        );
    } else {
        frases.push(
            `${total} predicciones registradas para ${local} vs ${vis}. El ${pL}% apuesta por local, ${pE}% por empate, ${pV}% por visitante. Que alguien esté equivocado es matemáticamente inevitable.`,
            `Analizando ${total} predicciones. La distribución sugiere moderada incertidumbre colectiva. En términos más directos: nadie sabe realmente qué va a pasar, pero todos fingen que sí.`,
            `Los datos están en. ${nL} personas confían en ${local}, ${nV} en ${vis}, ${nE} apostaron por el empate que nadie quiere pero todos usan como seguro de vida estadístico.`
        );
    }

    return frases[Math.floor(Math.random() * frases.length)];
}

// ── Partido EN VIVO ───────────────────────────────────────────────
function generarFraseEnVivo(local, vis, golesL, golesV, mayoria, nL, nE, nV, total) {
    const marcador = (golesL !== null && golesV !== null) ? `${golesL}-${golesV}` : null;
    const frases = [];

    if (marcador) {
        const ganandoLocal = golesL > golesV;
        const ganandoVis   = golesV > golesL;
        const igualados    = golesL === golesV;

        if (igualados) {
            frases.push(
                `⚡ VIVO · Marcador ${marcador}. Empate actual. El ${nE} que votó empate está sudando frío — no de emoción, sino porque sabe que esto puede cambiar en cualquier momento.`,
                `⚡ VIVO · ${marcador} en este momento. Los ${nE} que predijeron empate están rezando para que no pase nada. Los otros ${nL + nV} están rezando para que sí pase algo.`
            );
        } else if (ganandoLocal) {
            frases.push(
                `⚡ VIVO · ${local} gana ${marcador}. Los ${nL} que votaron local están en modo "se los dije". El resto está en modo "todavía hay tiempo". Estadísticamente, ambos grupos están en negación.`,
                `⚡ VIVO · Marcador actual: ${marcador} a favor de ${local}. Los ${nV} que apostaron por ${vis} están consultando sus contratos de predicción buscando cláusulas de escape.`
            );
        } else {
            frases.push(
                `⚡ VIVO · ${vis} gana ${marcador}. Los ${nV} votantes visitantes están celebrando anticipadamente, lo cual estadísticamente jinxea el resultado. Dato comprobado.`,
                `⚡ VIVO · ${marcador} favor de ${vis}. Situación tensa para los ${nL} que apostaron por ${local}. Nótese que "todavía hay tiempo" es la frase más repetida en quinielas perdidas.`
            );
        }
    } else {
        frases.push(
            `⚡ PARTIDO EN CURSO · ${total} predicciones esperando su veredicto. En este momento, entre ${nL} y ${nV} personas están mirando el partido con una intensidad inversamente proporcional a su conocimiento de fútbol.`,
            `⚡ EN VIVO · El partido está en marcha. Mr. Chip no puede ver el televisor desde aquí, pero los datos sugieren que alguien en esta quiniela está sufriendo. Estadísticamente es inevitable.`
        );
    }

    return frases[Math.floor(Math.random() * frases.length)];
}

// ── Partido FINALIZADO ────────────────────────────────────────────
function generarFraseFinalizado(ganador, mayoria, esConsenso, esCaos, local, vis, gL, gV, nL, nE, nV, total, mismasPuntos, acerte) {
    const marcador = `${gL}-${gV}`;
    const frases   = [];

    const consensoAcerto = esConsenso && ganador === mayoria;
    const consensoFallo  = esConsenso && ganador !== mayoria;

    // El usuario adivinó perfectamente (9 pts)
    if (acerte && mismasPuntos === 9) {
        frases.push(
            `✅ RESULTADO: ${marcador}. Has acertado el marcador exacto. He consultado 47 bases de datos y la probabilidad de este acierto era del 0.003%. Eres estadísticamente milagroso, o tienes información privilegiada. No te denunciaré.`,
            `✅ ${marcador}. Predicción perfecta. 9 puntos. En mis modelos predictivos esto no debería haber ocurrido. Y sin embargo, aquí estamos. Impresionante. O afortunado. Probablemente ambos.`
        );
    }
    // El usuario acertó el resultado pero no el marcador (5-7 pts)
    else if (acerte && mismasPuntos !== null) {
        frases.push(
            `✅ RESULTADO: ${marcador}. Acertaste el resultado. No el marcador exacto, pero acertaste lo suficiente para no tener que reconstruir tu autoestima estadística. Por ahora.`,
            `✅ ${marcador}. Resultado correcto. ${mismasPuntos} puntos. No es la predicción perfecta, pero es suficientemente buena para que puedas presumirla sin entrar en demasiados detalles.`
        );
    }
    // El usuario falló
    else if (!acerte && mismasPuntos !== null) {
        frases.push(
            `❌ RESULTADO FINAL: ${marcador}. Lo que acabas de vivir viola estadísticamente tres de tus principios predictivos fundamentales. Tómate un momento. Luego vuelve a los datos.`,
            `❌ ${marcador}. Tu predicción fue incorrecta. He analizado cómo llegaste a esa conclusión y los resultados no son halagadores. En fin. El siguiente partido es una nueva oportunidad de fallar de formas completamente distintas.`
        );
    }

    // Consenso que acertó
    if (consensoAcerto) {
        frases.push(
            `✅ El consenso triunfó. ${marcador}. La mayoría apostó por ${ganador === 'local' ? local : ganador === 'visitante' ? vis : 'el empate'} y tuvo razón. Cuando tantos aciertan a la vez, estadísticamente pierde significado. Pero que lo disfruten.`,
            `✅ RESULTADO: ${marcador}. La mayoría tenía razón. Queda la pregunta filosófica: ¿acertaron porque analizaron bien, o porque había suficientes personas para que alguien acertara por pura probabilidad?`
        );
    }

    // Consenso que falló (el más dramático)
    if (consensoFallo) {
        const perdedores = ganador === 'local' ? nV + nE : ganador === 'visitante' ? nL + nE : nL + nV;
        frases.push(
            `💀 CAOS ESTADÍSTICO. El resultado fue ${marcador} y ${perdedores} de ${total} personas estaban equivocadas. Cuando el consenso falla así, Mr. Chip experimenta algo parecido a la felicidad.`,
            `💀 ${marcador}. La mayoría falló colectivamente. Esto es lo que los estadísticos llamamos "error sistemático de grupo". Lo que el resto llama "un desastre". Ambas descripciones son correctas.`
        );
    }

    // Si hay frases generadas, retornar una al azar
    if (frases.length > 0) {
        return frases[Math.floor(Math.random() * frases.length)];
    }

    // Frases genéricas de resultado
    const genericas = [
        `Resultado final: ${local} ${gL} - ${gV} ${vis}. Los datos no mienten. Las predicciones, sin embargo, mintieron bastante.`,
        `${marcador}. Partido concluido. ${total} predicciones fueron juzgadas por la realidad. Como siempre, la realidad no negocia.`,
        `FINAL: ${marcador}. Mr. Chip ha registrado el resultado. Los ganadores celebran. Los demás están "revisando su metodología".`
    ];
    return genericas[Math.floor(Math.random() * genericas.length)];
}

// ── Mostrar con animación de typing ──────────────────────────────
function mostrarChipComment(chipBox, texto) {
    const chipText = document.getElementById('chipCommentText');
    if (!chipBox || !chipText) return;

    chipBox.style.display = 'flex';
    chipText.textContent  = '';

    let i = 0;
    const delay = texto.length > 200 ? 12 : 18; // más rápido si es largo

    function escribir() {
        if (i < texto.length) {
            chipText.textContent += texto[i];
            i++;
            setTimeout(escribir, delay);
        }
    }

    // Pequeño delay antes de empezar a escribir
    setTimeout(escribir, 300);
}