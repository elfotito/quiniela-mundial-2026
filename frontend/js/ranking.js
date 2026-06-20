// ===============================================
// RANKING.JS - CON PODIO DINÁMICO Y COMPARTIR
// ===============================================
const API_URL = CONFIG.API_URL;
let usuario = null;
let rankingCompleto = [];
let rankingFiltrado = [];
let ligasDisponibles = [];
const TOTAL_PARTICIPANTES_ESPERADOS = 50;

document.addEventListener('DOMContentLoaded', async () => {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    usuario = auth.getUser();
    await verificarLogin();
    configurarUI();
    
    // cargarLigas() debe completarse ANTES de cargarRankingCompleto(),
    // ya que este último usa ligasDisponibles para resolver nombre/icono de cada usuario.
    // Si no, hay un race condition que deja "🏅 Sin liga" según qué request responda primero.
    await cargarLigas();

    await Promise.all([
        cargarRankingCompleto(),
        cargarEstadisticas(),
        cargarLigasRegistradas(),
    ]);
    
    configurarEventos();
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

    // ✅ PRIMERO: Ocultar botones admin para todos
    document.querySelectorAll('.btn-admin-display, .btn-noticias-display').forEach(btn => {
        btn.style.display = 'none';
    });

    if (usuario.isAdmin) {
        // Esperar a que el DOM esté listo para estos elementos
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // LUEGO: Mostrar solo si es admin
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
// CONFIGURACIÓN UI
// ===============================================

function configurarUI() {
    
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = usuario.nombre || usuario.codigo;
    }
    const userCampeon = document.getElementById('userCampeon');
    if (userCampeon) userCampeon.textContent = obtenerCampeon(usuario.campeon_elegido);

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
        setVal('statPuntosResumen', stats.puntos_totales || 0);
        setVal('statPosicion', stats.posicion_ranking || '-');
        setVal('statPosicionResumen', stats.posicion_ranking || '-');
        setVal('statEfectividad', (stats.efectividad || 0) + '%');
        setVal('statEfectividadResumen', (stats.efectividad || 0) + '%');
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// ===============================================
// CARGAR LIGAS
// ===============================================

async function cargarLigas() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/ligas`);
        if (!response.ok) throw new Error('Error cargando ligas');
        
        ligasDisponibles = await response.json();
        console.log('🏅 Ligas cargadas:', ligasDisponibles);
        
        const ligaSelect = document.getElementById('ligaFilter');
        if (ligaSelect && ligasDisponibles.length > 0) {
            ligaSelect.innerHTML = '<option value="">Todas las ligas</option>';
            ligasDisponibles.forEach(liga => {
                const option = document.createElement('option');
                option.value = liga.id;
                option.textContent = `${liga.icono || '🏅'} ${liga.nombre}`;
                ligaSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('❌ Error cargando ligas:', error);
    }
}

// ===============================================
// CARGAR RANKING
// ===============================================

async function cargarRankingCompleto() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/ranking`);
        if (!response.ok) throw new Error('Error cargando ranking');
        
        rankingCompleto = await response.json();
        console.log('🏆 Ranking cargado:', rankingCompleto);
        
        // Normalizar datos
        rankingCompleto = rankingCompleto.map(user => ({
            ...user,
            usuario_id: user.id,
            nombre_publico: user.nombre,
            campeon_elegido: user.campeon_elegido || null,
            ligas: []
        }));
        
        // Cargar ligas de cada usuario
        await cargarLigasUsuarios();
        
        // Inicializar ranking filtrado
        rankingFiltrado = [...rankingCompleto];
        
        // Mostrar todo
        mostrarPodio(rankingFiltrado);
        mostrarTablaRanking(rankingFiltrado);
        actualizarContador(rankingFiltrado.length);
        
    } catch (error) {
        console.error('❌ Error cargando ranking:', error);
        mostrarErrorCarga();
    }
}

async function cargarLigasUsuarios() {
    const fetchLigasUsuario = async (usuarioId) => {
        const response = await fetch(`${CONFIG.API_URL}/usuarios/${usuarioId}/ligas`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    };

    const promesas = rankingCompleto.map(async (user) => {
        try {
            const ligasUsuario = await fetchLigasUsuario(user.usuario_id);
            user.ligas = ligasUsuario.map(l => l.liga_id || l.id);
        } catch (error) {
            // Reintento único: bajo Render free tier, fetches paralelos a veces fallan/timeout
            try {
                const ligasUsuario = await fetchLigasUsuario(user.usuario_id);
                user.ligas = ligasUsuario.map(l => l.liga_id || l.id);
            } catch (error2) {
                console.error(`Error cargando ligas para usuario ${user.usuario_id}:`, error2);
                // No forzar [] aquí: deja user.ligas como venía (undefined si nunca se cargó),
                // así el render puede distinguir "sin liga real" de "fallo de carga".
            }
        }
    });
    
    await Promise.all(promesas);
}

// ===============================================
// MOSTRAR PODIO TOP 3 - DINÁMICO
// ===============================================

function mostrarPodio(ranking) {
    const podiumSection = document.getElementById('podiumSection');
    if (!podiumSection) return;
 
    if (ranking.length === 0) {
        podiumSection.innerHTML = '<p style="text-align:center;color:#aaa;padding:2rem;">No hay participantes</p>';
        return;
    }
    if (ranking.length < 3) {
        podiumSection.innerHTML = '<p style="text-align:center;color:#aaa;padding:2rem;">Aún no hay suficientes participantes</p>';
        return;
    }
 
    const top3 = ranking.slice(0, 3);
 
    // Imágenes por posición real (ajusta si quieres otras)
    const images = [
        'img/messi.png',  // 1er lugar
        'img/baggio.jpg',   // 2do lugar
        'img/turquia.jpg'  // 3er lugar
    ];
 
    // Coronas / medallas
    const coronas = ['👑', '🥈', '🥉'];
 
    // Orden visual: 2do izquierda | 1ro centro | 3ro derecha
    const ordenVisual = [
        { real: 2, clase: 'third',  corona: '🥉', img: images[2] },
        { real: 0, clase: 'first',  corona: '👑',  img: images[0] },
        { real: 1, clase: 'second', corona: '🥈', img: images[1] }
    ];
 
    const posNumeros = { first: '1', second: '2', third: '3' };
 
    podiumSection.innerHTML = `
        <div class="podium-arena">
            <div class="podium-players">
                ${ordenVisual.map(({ real, clase, corona, img }) => {
                    const user = top3[real];
                    if (!user) return '';
                    const nombre = user.nombre_publico || user.nombre || 'Usuario';
                    const liga   = `${obtenerIconoLigaPrincipal(user.ligas)} ${obtenerLigaPrincipal(user.ligas)}`;
                    const pts    = user.puntos_totales || 0;
 
                    return `
                    <div class="podium-player ${clase}">
                        <div class="podium-avatar-wrap">
                            <span class="podium-crown">${corona}</span>
                            <img class="podium-avatar" src="${img}" alt="${nombre}"
                                onerror="this.src='img/logomenu.png'">
                        </div>
                        <div class="podium-info">
                            <span class="podium-player-name">${nombre}</span>
                            <span class="podium-player-liga">${liga}</span>
                        </div>
                        <div class="podium-base">
                            <span class="podium-pos-num">${posNumeros[clase]}</span>
                            <span class="podium-pts-val">${pts}</span>
                            <span class="podium-pts-label">puntos</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
}


// ===============================================
// MOSTRAR TABLA DE RANKING
// ===============================================

function mostrarTablaRanking(ranking) {
    const tbody = document.getElementById('rankingTableBody');
    if (!tbody) return;
    if (ranking.length > 0) {
        console.log('Primer usuario del ranking:', ranking[0]);
        console.log('Campos disponibles:', Object.keys(ranking[0]));
    }
    if (ranking.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 3rem; color: var(--text-gray);">
                    No hay participantes
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = ranking.map((user, index) => {
        const posicion = index + 1;
        const esUsuarioActual = user.usuario_id === parseInt(usuario.id);
        const claseFila = esUsuarioActual ? 'current-user' : '';
        
        const fases = ['F.G.', '16vos', '8vos', '4tos', 'semis', 'tercer_puesto', 'final'];
        
        return `
    <tr class="${claseFila}">
        <td class="td-pos">${obtenerMedallaPosicion(posicion, ranking.length)}</td>
        <td>
            <div class="user-cell">
                ${obtenerCampeon(user.campeon_elegido)} <span class="user-nametable">${user.nombre_publico || user.nombre || 'Usuario'}</span>
            </div>
        </td>
        <td>
            <span class="liga-badge">
                ${obtenerIconoLigaPrincipal(user.ligas)}
            </span>
        </td>
        <td class="td-total">${user.puntos_totales || 0}</td>
        ${fases.map(fase => {
            const puntos = user[`puntos_${fase}`] || 0;
            return `<td class="td-fase fase-col ${puntos > 0 ? 'has-points' : ''}">${puntos}</td>`;
        }).join('')}
    </tr>
`;
    }).join('');
}

// ===============================================
// FILTRAR RANKING - ACTUALIZA POSICIONES
// ===============================================

function filtrarRanking() {
    const ligaId = document.getElementById('ligaFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    rankingFiltrado = [...rankingCompleto];
    
    // Filtrar por liga
    if (ligaId) {
        rankingFiltrado = rankingFiltrado.filter(user => {
            return user.ligas && user.ligas.includes(parseInt(ligaId));
        });
    }
    
    // Filtrar por búsqueda
    if (searchTerm) {
        rankingFiltrado = rankingFiltrado.filter(user => {
            const nombre = user.nombre_publico || user.nombre || '';
            return nombre.toLowerCase().includes(searchTerm);
        });
    }
    
    // Reordenar por puntos (importante para que las posiciones sean correctas)
    rankingFiltrado.sort((a, b) => b.puntos_totales - a.puntos_totales);
    
    // Mostrar resultados
    const emptyState = document.getElementById('emptyState');
    if (rankingFiltrado.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        const tbody = document.getElementById('rankingTableBody');
        if (tbody) tbody.innerHTML = '';
        document.getElementById('podiumSection').innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 2rem;">No hay resultados</p>';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        mostrarPodio(rankingFiltrado); // ✅ Actualiza podio con ranking filtrado
        mostrarTablaRanking(rankingFiltrado);
    }
    
    actualizarContador(rankingFiltrado.length);
}

// ===============================================
// COMPARTIR RANKING
// ===============================================

async function compartirRanking() {
    try {
        // Opción 1: Compartir URL con filtros
        const ligaId = document.getElementById('ligaFilter').value;
        const ligaName = ligaId ? 
            ligasDisponibles.find(l => l.id === parseInt(ligaId))?.nombre || 'General' : 
            'General';
        
        const shareData = {
            title: 'Ranking Quiniela Mundial 2026',
            text: `🏆 Ranking ${ligaName}\n${rankingFiltrado.length} participantes\n\nTop 3:\n${rankingFiltrado.slice(0, 3).map((u, i) => `${i + 1}. ${u.nombre_publico || u.nombre} - ${u.puntos_totales} pts`).join('\n')}`,
            url: window.location.href
        };
        
        // Si el navegador soporta Web Share API
        if (navigator.share) {
            await navigator.share(shareData);
            console.log('✅ Compartido exitosamente');
        } else {
            // Fallback: Copiar al portapapeles
            await navigator.clipboard.writeText(shareData.text + '\n\n' + shareData.url);
            mostrarToast('📋 Texto copiado al portapapeles', 'success');
        }
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error al compartir:', error);
            mostrarToast('❌ Error al compartir', 'error');
        }
    }
}

// Alternativa: Generar imagen del ranking (más avanzado)
async function compartirComoImagen() {
    // Esta función requeriría una librería como html2canvas
    // La implementaremos cuando agregues la librería
    alert('📸 Función de captura de imagen en desarrollo.\n\nPor ahora puedes usar:\n- Captura de pantalla manual\n- Botón compartir para copiar texto');
}

// ===============================================
// CONFIGURAR EVENTOS
// ===============================================

function configurarEventos() {
    const ligaFilter = document.getElementById('ligaFilter');
    if (ligaFilter) {
        ligaFilter.addEventListener('change', filtrarRanking);
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filtrarRanking, 300));
    }
}

// ===============================================
// UTILIDADES
// ===============================================

function obtenerMedallaPosicion(posicion, totalActual) {
    switch(posicion) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default:
            // Penúltimo lugar según los usuarios que hay AHORA en la vista
            if (totalActual && posicion === totalActual - 1) return '🚑';
            return posicion;
    }
}
function obtenerLigaPrincipal(ligas) {
    if (!ligas || ligas.length === 0) return 'Sin liga';
    
    const ligaId = Array.isArray(ligas) ? ligas[0] : ligas;
    const liga = ligasDisponibles.find(l => l.id === ligaId);
    
    return liga ? liga.nombre : 'Sin liga';
}

function obtenerIconoLigaPrincipal(ligas) {
    if (!ligas || ligas.length === 0) return '🏅';
    
    // Asegurar que sea array
    const idsLigas = Array.isArray(ligas) ? ligas : [ligas];
    
    // Obtener todas las ligas y sus iconos
    const iconos = idsLigas
        .map(id => {
            const liga = ligasDisponibles.find(l => l.id === id);
            return liga ? (liga.icono || '🏅') : '🏅';
        })
        .join(' ');
    
    return iconos;
}

async function cargarLigasRegistradas() {
    try {
        // Obtener ligas del endpoint
        const response = await fetch(`${CONFIG.API_URL}/ligas`);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const ligas = await response.json();
        
        // Si no hay ligas, mostrar mensaje
        if (!ligas || ligas.length === 0) {
            renderizarLigasVacio();
            return;
        }
        
        // Renderizar tarjetas de ligas
        renderizarLigas(ligas);
        
    } catch (error) {
        console.error('❌ Error cargando ligas:', error);
        renderizarErrorLigas();
    }
}
 
function renderizarLigas(ligas) {
    const widgetLigas = document.querySelector('.widget-ligas');
    
    if (!widgetLigas) {
        console.warn('⚠️ No se encontró .widget-ligas para ligas');
        return;
    }
    
    // Limpiar contenido anterior
    widgetLigas.innerHTML = '';
    
    // Crear contenedor de ligas
    const ligasContainer = document.createElement('div');
    ligasContainer.className = 'ligas-container';
    
    // Renderizar cada liga como tarjeta
    ligas.forEach((liga, index) => {
        const tarjeta = crearTarjetaLiga(liga);
        ligasContainer.appendChild(tarjeta);
        
        // Pequeña animación de entrada escalonada
        tarjeta.style.animation = `slideInLiga 0.4s ease-out ${index * 0.1}s both`;
    });
    
    widgetLigas.appendChild(ligasContainer);
}
 
function crearTarjetaLiga(liga) {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'liga-card';
    
    // Color dinámico (usa el color de la liga si existe, sino fallback a FIFA gold)
    const colorAcento = liga.color || 'var(--fifa-gold)';
    
    tarjeta.style.setProperty('--liga-accent', colorAcento);
    
    tarjeta.innerHTML = `
        <div class="liga-card-header">
            <div class="liga-icon">${liga.icono || '⚽'}</div>
        </div>
        <div class="liga-card-content">
            <h3 class="liga-nombre">${escapeHtml(liga.nombre)}</h3>
            <p class="liga-descripcion">${escapeHtml(liga.descripcion || '')}</p>
        </div>
        <div class="liga-card-accent"></div>
    `;
    
    tarjeta.addEventListener('click', () => {
        mostrarToast('Esperando a los presidentes para agregar un comentario aqui', {
        icon: '⚽',
        duracion: 4000
      });
        // Aquí puedes agregar navegación o modal si lo necesitas
    });
    
    return tarjeta;
}
 
function renderizarLigasVacio() {
    const widgetLigas = document.querySelector('.widget-ligas');
    
    if (!widgetLigas) return;
    
    widgetLigas.innerHTML = `
        <div class="ligas-vacio">
            <div class="ligas-vacio-icon">⚽</div>
            <p class="ligas-vacio-text">No hay ligas disponibles</p>
        </div>
    `;
}
 
function renderizarErrorLigas() {
    const widgetLigas = document.querySelector('.widget-ligas');
    
    if (!widgetLigas) return;
    
    widgetLigas.innerHTML = `
        <div class="ligas-error">
            <div class="ligas-error-icon">⚠️</div>
            <p class="ligas-error-text">Error cargando ligas</p>
        </div>
    `;
}
 
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function obtenerBandera(codigoEquipo) {
    if (!codigoEquipo) return '🏆';
    
    const banderas = {
        'ARG': '🇦🇷', 'BRA': '🇧🇷', 'URU': '🇺🇾', 'COL': '🇨🇴', 'CHI': '🇨🇱',
        'MEX': '🇲🇽', 'USA': '🇺🇸', 'CAN': '🇨🇦', 'CRC': '🇨🇷', 'JAM': '🇯🇲',
        'ESP': '🇪🇸', 'GER': '🇩🇪', 'FRA': '🇫🇷', 'ITA': '🇮🇹', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'POR': '🇵🇹', 'NED': '🇳🇱', 'BEL': '🇧🇪', 'CRO': '🇭🇷', 'SUI': '🇨🇭',
        'JPN': '🇯🇵', 'KOR': '🇰🇷', 'AUS': '🇦🇺', 'IRN': '🇮🇷', 'SAU': '🇸🇦',
        'MAR': '🇲🇦', 'SEN': '🇸🇳', 'TUN': '🇹🇳', 'CMR': '🇨🇲', 'NGA': '🇳🇬',
        'GHA': '🇬🇭', 'ECU': '🇪🇨'
    };
    
    return banderas[codigoEquipo] || '🏆';
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
function actualizarContador(cantidad) {
    const counter = document.getElementById('participantsCount');
    if (counter) {
        counter.textContent = cantidad;
    }
}

async function compartirRanking() {
    const datos = rankingFiltrado;
    if (!datos || datos.length === 0) {
        alert('No hay datos para compartir.');
        return;
    }

    const ligaSelect = document.getElementById('ligaFilter');
    const ligaNombre = ligaSelect && ligaSelect.selectedIndex > 0
        ? ligaSelect.options[ligaSelect.selectedIndex].text
        : 'Todas las Ligas';

    const fecha = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const fechaFormateada = fecha.charAt(0).toUpperCase() + fecha.slice(1);

    const total    = datos.length;
    const lider    = datos[0];
    const ultimo   = datos[total - 1];
    const promedio = Math.round(datos.reduce((a, b) => a + (Number(b.puntos_totales) || 0), 0) / total);
    const top3     = datos.slice(0, 3);

    // ── PALETA DE COLORES PREMIUM ──
    const K_COLOR = {
        bg: '#0B0F19',
        surface: '#151A28',
        surfaceLight: '#1E2538',
        primary: '#6366F1',
        primaryGlow: 'rgba(99, 102, 241, 0.15)',
        gold: '#FBBF24',
        silver: '#CBD5E1',
        bronze: '#D97706',
        text: '#F8FAFC',
        textMuted: '#94A3B8'
    };

    // ── COLUMNA IZQ: FILAS (Más amplias para aprovechar los 1920px) ──
    function renderFilas() {
        return datos.map((user, index) => {
            const pos = index + 1;
            const nombre = (user.nombre_publico || user.nombre || 'Usuario').substring(0, 20);
            const puntos = user.puntos_totales || 0;
            
            // Lógica de la Ambulancia en la POSICIÓN
            // Ojo: index === datos.length - 2 es el PENÚLTIMO. Si quieres el antepenúltimo usa -3.
            const esAntepenultimo = index === datos.length - 2; 
            const displayPos = esAntepenultimo ? '🚑' : pos;

            const esTop1 = pos === 1;
            const esTop2 = pos === 2;
            const esTop3 = pos === 3;

            let numBg = 'rgba(255,255,255,0.05)';
            let numColor = K_COLOR.textMuted;
            let rowBg = index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
            let nameColor = K_COLOR.text;
            let ptsColor = K_COLOR.text;

            // Arreglado el color del número (numColor) a blanco (#FFF)
            if (esTop1) {
                numBg = K_COLOR.gold; numColor = '#FFF'; ptsColor = K_COLOR.gold;
                rowBg = 'linear-gradient(90deg, rgba(251,191,36,0.1) 0%, transparent 100%)';
            } else if (esTop2) {
                numBg = K_COLOR.silver; numColor = '#FFF'; ptsColor = K_COLOR.silver;
            } else if (esTop3) {
                numBg = K_COLOR.bronze; numColor = '#FFF'; ptsColor = K_COLOR.bronze;
            }

            // Franjas de zonas de clasificación
            let borderLeft = '4px solid transparent';
            if (pos <= 3) borderLeft = '4px solid #10B981'; // Clasificación
            else if (pos >= datos.length - 2) borderLeft = '4px solid #EF4444'; // Descenso

            return `
<div style="display:flex;align-items:center;justify-content:space-between;padding:0 15px 0 10px;height:35px;background:${rowBg};border-left:${borderLeft};margin-bottom:3px;border-radius:0 8px 8px 0;">
    <div style="display:flex;align-items:center;gap:12px;min-width:0;">
        <div style="width:26px;height:26px;border-radius:6px;background:${numBg};color:${numColor};display:flex;align-items:center;justify-content:center;font-size:${esAntepenultimo ? '14px' : '13px'};font-weight:900;flex-shrink:0;">
            ${displayPos}
        </div>
        <div style="width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:10px;">
            🛡️
        </div>
        <div style="font-size:13px;font-weight:800;color:${nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:0.5px;">
            ${nombre}
        </div>
    </div>
    
    <div style="font-size:15px;font-weight:900;color:${ptsColor};width:40px;text-align:right;">
        ${puntos}
    </div>
</div>`;
        }).join('');
    }

    // ── COLUMNA DER: PODIO IMPACTANTE ESCALONADO ──
    function renderPodiumImpactante() {
        const u1 = top3[0] || {}; const u2 = top3[1] || {}; const u3 = top3[2] || {};
        
        const n1 = (u1.nombre_publico || u1.nombre || 'N/A').substring(0, 12);
        const n2 = (u2.nombre_publico || u2.nombre || 'N/A').substring(0, 12);
        const n3 = (u3.nombre_publico || u3.nombre || 'N/A').substring(0, 12);

        return `
<div style="display:flex;align-items:flex-end;justify-content:center;gap:15px;height:400px;margin-top:20px;padding-bottom:20px;">
    
    <div style="display:flex;flex-direction:column;align-items:center;width:28%;z-index:2;">
        <div style="width:85px;height:85px;border-radius:50%;padding:4px;background:linear-gradient(180deg, ${K_COLOR.silver}, transparent);margin-bottom:-42px;z-index:3;">
            <img src="/img/messi.png" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;border-radius:50%;border:4px solid #151A28;">
        </div>
        <div style="background:linear-gradient(180deg, #1E2538 0%, #151A28 100%);border-top:4px solid ${K_COLOR.silver};width:100%;height:200px;border-radius:16px 16px 8px 8px;display:flex;flex-direction:column;align-items:center;padding-top:55px;box-shadow:0 15px 30px rgba(0,0,0,0.4);">
            <div style="color:${K_COLOR.silver};font-size:32px;font-weight:900;">2</div>
            <div style="color:#FFF;font-size:13px;font-weight:900;text-transform:uppercase;margin:10px 0 5px 0;">${n2}</div>
            <div style="color:${K_COLOR.silver};font-size:24px;font-weight:900;">${u2.puntos_totales || 0}</div>
        </div>
    </div>

    <div style="display:flex;flex-direction:column;align-items:center;width:38%;z-index:3;">
        <div style="font-size:45px;margin-bottom:-15px;z-index:4;filter:drop-shadow(0 5px 15px rgba(251,191,36,0.6));">👑</div>
        <div style="width:120px;height:120px;border-radius:50%;padding:5px;background:linear-gradient(180deg, ${K_COLOR.gold}, transparent);margin-bottom:-60px;z-index:3;box-shadow:0 0 40px rgba(251,191,36,0.2);">
            <img src="/img/baggio.jpg" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;border-radius:50%;border:5px solid #151A28;">
        </div>
        <div style="background:linear-gradient(180deg, rgba(251,191,36,0.15) 0%, #151A28 100%);border-top:5px solid ${K_COLOR.gold};width:100%;height:270px;border-radius:20px 20px 8px 8px;display:flex;flex-direction:column;align-items:center;padding-top:75px;box-shadow:0 20px 50px rgba(0,0,0,0.6);">
            <div style="color:${K_COLOR.gold};font-size:42px;font-weight:900;">1</div>
            <div style="color:#FFF;font-size:16px;font-weight:900;text-transform:uppercase;margin:12px 0 5px 0;">${n1}</div>
            <div style="color:${K_COLOR.gold};font-size:36px;font-weight:900;display:flex;align-items:baseline;gap:4px;">
                ${u1.puntos_totales || 0} <span style="font-size:14px;color:${K_COLOR.textMuted};">PTS</span>
            </div>
        </div>
    </div>

    <div style="display:flex;flex-direction:column;align-items:center;width:28%;z-index:1;">
        <div style="width:75px;height:75px;border-radius:50%;padding:4px;background:linear-gradient(180deg, ${K_COLOR.bronze}, transparent);margin-bottom:-37px;z-index:3;">
            <img src="/img/turquia.jpg" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;border-radius:50%;border:4px solid #151A28;">
        </div>
        <div style="background:linear-gradient(180deg, #1E2538 0%, #151A28 100%);border-top:4px solid ${K_COLOR.bronze};width:100%;height:170px;border-radius:16px 16px 8px 8px;display:flex;flex-direction:column;align-items:center;padding-top:48px;box-shadow:0 15px 30px rgba(0,0,0,0.3);">
            <div style="color:${K_COLOR.bronze};font-size:26px;font-weight:900;">3</div>
            <div style="color:#FFF;font-size:12px;font-weight:900;text-transform:uppercase;margin:8px 0 5px 0;">${n3}</div>
            <div style="color:${K_COLOR.bronze};font-size:22px;font-weight:900;">${u3.puntos_totales || 0}</div>
        </div>
    </div>
</div>`;
    }

    // ── CONTENEDOR MAESTRO 9:16 (1080x1920) ──
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-9999px;top:0;width:1080px;height:1920px;overflow:hidden;background:${K_COLOR.bg};`;

    el.innerHTML = `
<div style="width:1080px;height:1920px;background:${K_COLOR.bg};position:relative;overflow:hidden;display:flex;font-family:'Segoe UI', Roboto, sans-serif;color:${K_COLOR.text};">

    <div style="position:absolute;top:-200px;left:400px;width:1000px;height:1000px;background:radial-gradient(circle, ${K_COLOR.primaryGlow} 0%, transparent 60%);border-radius:50%;z-index:0;pointer-events:none;"></div>
    <div style="position:absolute;bottom:-150px;right:-150px;width:800px;height:800px;background:radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 60%);border-radius:50%;z-index:0;pointer-events:none;"></div>
    <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);background-size:24px 24px;z-index:0;pointer-events:none;"></div>

    <div style="position:relative;z-index:2;width:50%;background:${K_COLOR.surface};display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,0.05);padding:40px 30px;">
        
        <div style="margin-bottom:30px;padding:0 5px;">
            <div style="display:inline-block;background:rgba(99,102,241,0.15);color:${K_COLOR.primary};font-size:12px;font-weight:800;padding:6px 14px;border-radius:10px;margin-bottom:12px;letter-spacing:1px;">
                🔴 EN VIVO
            </div>
            <div style="font-size:32px;font-weight:900;line-height:1.1;margin-bottom:6px;letter-spacing:-1px;">
                CLASIFICACIÓN
            </div>
            <div style="font-size:16px;color:${K_COLOR.textMuted};font-weight:600;">
                ${ligaNombre}
            </div>
        </div>

        <div style="flex:1;overflow:hidden;padding-right:10px;">
            ${renderFilas()}
        </div>

        <div style="padding-top:20px;margin-top:20px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
            <div style="font-size:14px;font-weight:600;color:${K_COLOR.textMuted};">
                TOTAL: <span style="color:#fff;font-weight:800;">${total} PARTICIPANTES</span>
            </div>
        </div>
    </div>

    <div style="position:relative;z-index:2;width:50%;display:flex;flex-direction:column;padding:40px 35px;">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:40px;">
            <img src="/img/logoblancomenu.png" crossorigin="anonymous" style="height:45px;">
            <div style="text-align:right;">
                <div style="font-size:14px;font-weight:800;color:${K_COLOR.text};margin-bottom:4px;letter-spacing:0.5px;">TORNEO 2026</div>
                <div style="font-size:12px;color:${K_COLOR.textMuted};font-weight:600;">${fechaFormateada}</div>
            </div>
        </div>

        <div style="position:relative;height:380px;border-radius:24px;background:linear-gradient(135deg, ${K_COLOR.surface} 0%, #080B12 100%);border:1px solid rgba(255,255,255,0.05);box-shadow:0 20px 40px rgba(0,0,0,0.4);overflow:hidden;margin-bottom:30px;display:flex;flex-direction:column;justify-content:center;padding:0 35px;">
            <div style="position:relative;z-index:4;width:60%;">
                <div style="background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);color:${K_COLOR.gold};font-size:11px;font-weight:800;padding:8px 16px;border-radius:20px;display:inline-block;margin-bottom:20px;letter-spacing:1px;">
                    ⚽ COPA MUNDIAL
                </div>
                <div style="font-size:42px;font-weight:900;line-height:1.1;letter-spacing:-1px;margin-bottom:15px;">
                    RESUMEN<br><span style="color:${K_COLOR.primary};">JORNADA</span>
                </div>
            </div>
            <div style="position:absolute;right:-20px;bottom:-10px;width:320px;height:100%;z-index:2;display:flex;justify-content:center;align-items:flex-end;">
                <img src="/img/olise.png" crossorigin="anonymous" style="position:absolute;left:-40px;height:280px;object-fit:contain;filter:drop-shadow(-5px 5px 15px rgba(0,0,0,0.6));z-index:1;opacity:0.9;">
                <img src="/img/diaz.png" crossorigin="anonymous" style="position:absolute;right:20px;height:280px;object-fit:contain;filter:drop-shadow(5px 5px 15px rgba(0,0,0,0.6));z-index:1;opacity:0.9;">
                <img src="/img/trofeo.png" crossorigin="anonymous" style="position:absolute;height:330px;object-fit:contain;z-index:3;filter:drop-shadow(0 10px 25px rgba(0,0,0,0.8));">
            </div>
        </div>

        <div>
            <div style="font-size:18px;font-weight:900;color:${K_COLOR.text};margin-bottom:10px;letter-spacing:1px;text-align:center;">
                LÍDERES ACTUALES
            </div>
            ${renderPodiumImpactante()}
        </div>

        <div style="flex:1;margin-top:20px;">
            <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:20px;">
                
                <div style="background:${K_COLOR.surface};border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:25px;position:relative;overflow:hidden;">
                    <div style="position:absolute;top:0;left:0;width:100%;height:4px;background:${K_COLOR.gold};"></div>
                    <div style="font-size:24px;margin-bottom:15px;">👑</div>
                    <div style="font-size:12px;color:${K_COLOR.textMuted};font-weight:700;margin-bottom:5px;letter-spacing:1px;">PUNTAJE MÁX</div>
                    <div style="font-size:38px;font-weight:900;">${lider ? lider.puntos_totales || 0 : 0}</div>
                </div>

                <div style="background:${K_COLOR.surface};border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:25px;position:relative;overflow:hidden;">
                    <div style="position:absolute;top:0;left:0;width:100%;height:4px;background:${K_COLOR.primary};"></div>
                    <div style="font-size:24px;margin-bottom:15px;">📊</div>
                    <div style="font-size:12px;color:${K_COLOR.textMuted};font-weight:700;margin-bottom:5px;letter-spacing:1px;">PROMEDIO</div>
                    <div style="font-size:38px;font-weight:900;">${promedio}</div>
                </div>

                <div style="background:${K_COLOR.surface};border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:25px;position:relative;overflow:hidden;">
                    <div style="position:absolute;top:0;left:0;width:100%;height:4px;background:#EF4444;"></div>
                    <div style="font-size:24px;margin-bottom:15px;">📉</div>
                    <div style="font-size:12px;color:${K_COLOR.textMuted};font-weight:700;margin-bottom:5px;letter-spacing:1px;">PUNTAJE MÍN</div>
                    <div style="font-size:38px;font-weight:900;">${ultimo ? ultimo.puntos_totales || 0 : 0}</div>
                </div>

                <div style="background:${K_COLOR.surface};border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:25px;position:relative;overflow:hidden;">
                    <div style="position:absolute;top:0;left:0;width:100%;height:4px;background:#10B981;"></div>
                    <div style="font-size:24px;margin-bottom:15px;">👥</div>
                    <div style="font-size:12px;color:${K_COLOR.textMuted};font-weight:700;margin-bottom:5px;letter-spacing:1px;">JUGADORES</div>
                    <div style="font-size:38px;font-weight:900;">${total}</div>
                </div>

            </div>
        </div>

        <div style="margin-top:auto;display:flex;align-items:center;justify-content:center;padding-top:30px;">
            <div style="font-size:13px;color:${K_COLOR.textMuted};letter-spacing:2px;font-weight:700;text-align:center;">
                QUINIELACARRISAN.COM.VE <br>
                <span style="color:${K_COLOR.primary};font-size:11px;">CARRISÁN · 2026</span>
            </div>
        </div>

    </div>
</div>
    `;

    document.body.appendChild(el);

    await new Promise(r => setTimeout(r, 400));

    try {
        const canvas = await html2canvas(el.firstElementChild, {
            scale: 1.5, // Buen balance de calidad para móvil
            useCORS: true,
            backgroundColor: K_COLOR.bg,
            logging: false,
            width: 1080,
            height: 1920 // ¡Nuevas dimensiones de Stories!
        });

        document.body.removeChild(el);

        canvas.toBlob(async (blob) => {
            const archivo = new File([blob], 'ranking-quiniela.png', { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
                try {
                    await navigator.share({
                        files: [archivo],
                        title: 'Ranking Quiniela',
                        text: '¡Mira la tabla de posiciones! ⚽📊'
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') console.error('Share error:', err);
                }
            } else {
                const link = document.createElement('a');
                link.download = 'ranking-quiniela.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        }, 'image/png');

    } catch (err) {
        if (document.body.contains(el)) document.body.removeChild(el);
        console.error('Error generando imagen:', err);
        alert('No se pudo generar la imagen. Inténtalo de nuevo.');
    }
}

function mostrarToast(mensaje, opciones = {}) {
  const {
    icon = '🔧',
    duracion = 4000
  } = opciones;
 
  const container = document.getElementById('toast-container');
  if (!container) {
    console.error('Toast container no encontrado');
    return;
  }
 
  const toast = document.createElement('div');
  toast.className = 'toast-construccion';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
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
{ icon: '🇧🇷', texto: 'Brasil es la selección que más goles ha marcado en la historia de los Mundiales: 237 goles.' },
{ icon: '🇩🇪', texto: 'Alemania es la segunda selección con más goles en la historia de los Mundiales: 232 goles.' },
{ icon: '🇧🇷', texto: 'Brasil es la selección con más partidos disputados en la historia de los Mundiales: 114 partidos.' },
{ icon: '🇩🇪', texto: 'Alemania es la segunda selección con más partidos disputados: 112 partidos.' },
{ icon: '🇧🇷', texto: 'Brasil es la selección con más puntos en la historia de los Mundiales: 247 puntos.' },
{ icon: '🇩🇪', texto: 'Alemania es la segunda selección con más puntos: 225 puntos.' },
{ icon: '🇧🇷', texto: 'Brasil es la selección con más victorias en la historia de los Mundiales: 76 partidos ganados.' },
{ icon: '🇩🇪', texto: 'Alemania es la segunda selección con más victorias: 68 partidos ganados.' },
{ icon: '🇧🇷', texto: 'Brasil es la única selección que ha participado en todas las ediciones de la Copa del Mundo (23 ediciones).' },
{ icon: '🇧🇷', texto: 'Brasil es la selección más ganadora de la historia con 5 títulos mundiales.' },
{ icon: '🇩🇪', texto: 'Alemania y Brasil son las únicas selecciones con más de 200 goles anotados en la historia del Mundial.' },
{ icon: '🇭🇺', texto: 'Hungría tiene el récord de más goles en un solo Mundial: 27 goles en Suiza 1954.' },
{ icon: '🇰🇷', texto: 'Corea del Sur tiene el récord de más goles recibidos en un solo Mundial: 16 goles en Suiza 1954.' },
{ icon: '🇫🇷', texto: 'Francia tiene el récord de más goles en una sola edición por parte de un jugador: 13 goles de Just Fontaine en 1958.' },
{ icon: '🇷🇺', texto: 'Oleg Salenko (Rusia) tiene el récord de más goles en un solo partido: 5 goles contra Camerún en 1994.' },
{ icon: '🇩🇪', texto: 'Alemania es la selección con más finales disputadas: 8 finales.' },
{ icon: '🇦🇷', texto: 'Argentina y Alemania son las selecciones con más partidos de fase final disputados en el siglo XXI.' },
{ icon: '🇮🇹', texto: 'Italia es la segunda selección con más títulos mundiales: 4 títulos.' },
{ icon: '🇺🇾', texto: 'Uruguay fue el primer campeón del mundo en 1930 y tiene 2 títulos en solo 13 partidos disputados.' },
{ icon: '🇫🇷', texto: 'Francia ha sido campeona del mundo 2 veces y subcampeona 2 veces (2018, 2022, 2026).' },
{ icon: '🇪🇸', texto: 'España es la selección con más partidos invictos consecutivos (14) entre 2010 y 2014, igualando a Brasil (1978-1982).' }
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
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function logout() {
    if (confirm('¿Estás seguro de que quieres salir?')) {
        auth.logout();
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

// Hacer funciones globales
window.logout = logout;
window.compartirRanking = compartirRanking;
window.compartirComoImagen = compartirComoImagen;