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

// ═══════════════════════════════════════════════════════════════
// REEMPLAZA la función completa compartirRanking() en tu .js
// ═══════════════════════════════════════════════════════════════

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

    const total   = datos.length;
    const lider   = datos[0];
    const ultimo  = datos[total - 1];
    const promedio = Math.round(datos.reduce((a, b) => a + (Number(b.puntos_totales) || 0), 0) / total);
    const top3    = datos.slice(0, 3);

    // ── Filas de la tabla ──────────────────────────────────────
    function renderFilas() {
        return datos.map((user, index) => {
            const posicion = index + 1;
            const medalla  = obtenerMedallaPosicion(posicion, total);
            const nombre   = user.nombre_publico || user.nombre || 'Usuario';
            const puntos   = user.puntos_totales || 0;
            const esTop1   = posicion === 1;
            const esTop3   = posicion <= 3;

            const bgFila     = index % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent';
            const borderLeft = esTop1        ? '3px solid #C9A84C'
                             : posicion === 2 ? '3px solid #9e9e9e'
                             : posicion === 3 ? '3px solid #8B5E3C'
                             :                  '3px solid transparent';
            const colorPts   = esTop1 ? '#C9A84C'
                             : esTop3 ? 'rgba(201,168,76,0.75)'
                             :          'rgba(255,255,255,0.55)';
            const sizePts    = esTop1 ? '18px' : esTop3 ? '16px' : '14px';
            const fontPts    = esTop3 ? '900' : '500';

            return `
    <div style="
        display:flex; align-items:center;
        padding:5px 10px;
        background:${esTop1
            ? 'linear-gradient(90deg, rgba(201,168,76,0.10) 0%, transparent 60%)'
            : bgFila};
        border-bottom:1px solid rgba(255,255,255,0.03);
        border-left:${borderLeft};
        gap:6px;
    ">
        <div style="
            font-size:${esTop3 ? '14px' : '11px'};
            width:26px; text-align:center; flex-shrink:0;
            color:rgba(255,255,255,0.45);
            font-family:Arial Black,Arial,sans-serif;
        ">${medalla}</div>
        <div style="
            flex:1; min-width:0;
            font-size:12px;
            font-weight:${esTop3 ? '700' : '400'};
            color:${esTop1 ? '#fff' : 'rgba(255,255,255,0.82)'};
            font-family:Arial,sans-serif;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        ">${nombre}</div>
        <div style="
            font-size:${sizePts};
            font-weight:${fontPts};
            color:${colorPts};
            font-family:Arial Black,Arial,sans-serif;
            flex-shrink:0;
            letter-spacing:-0.5px;
        ">${puntos}</div>
    </div>`;
        }).join('');
    }

    // ── Mini podio derecha ─────────────────────────────────────
        function renderPodium() {
    const podiumImages = [
        '/img/messi.png',
        '/img/baggio.jpg',
        '/img/turquia.jpg'
    ];

    const ordenVisual = [
        { idx: 2, corona: '🥉', color: '#8B5E3C', glow: 'rgba(139,94,60,0.4)',  baseH: 50,  avatarS: 62 },
        { idx: 0, corona: '👑',  color: '#C9A84C', glow: 'rgba(201,168,76,0.45)', baseH: 76, avatarS: 76 },
        { idx: 1, corona: '🥈', color: '#9e9e9e', glow: 'rgba(158,158,158,0.35)', baseH: 62, avatarS: 68 }
    ];

    return `
        <div style="display:flex; align-items:flex-end; justify-content:center; gap:4px;">
            ${ordenVisual.map(({ idx, corona, color, glow, baseH, avatarS }) => {
                const user   = top3[idx];
                if (!user) return '';
                const nombre = user.nombre_publico || user.nombre || 'Usuario';
                const pts    = Number(user.puntos_totales) || 0;
                const pos    = idx + 1;

                return `
                <div style="display:flex; flex-direction:column; align-items:center; flex:1; min-width:0;">

                    <!-- Corona -->
                    <div style="font-size:${idx===0?'18px':'14px'}; line-height:1; margin-bottom:4px;">${corona}</div>

                    <!-- Avatar -->
                    <div style="
                        width:${avatarS}px; height:${avatarS}px;
                        border-radius:50%;
                        border:2px solid ${color};
                        box-shadow:0 0 14px ${glow}, 0 0 0 4px rgba(0,0,0,0.4);
                        overflow:hidden;
                        background:#111;
                        margin-bottom:6px;
                        flex-shrink:0;
                    ">
                        <img src="${podiumImages[idx]}"
                            crossorigin="anonymous"
                            style="width:100%; height:100%; object-fit:cover; display:block;">
                    </div>

                    <!-- Nombre -->
                    <div style="
                        font-size:10px; font-weight:700; color:#fff;
                        text-align:center; line-height:1.3;
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                        max-width:120px;
                        margin-bottom:6px;
                    ">${nombre}</div>

                    <!-- Base / pedestal -->
                    <div style="
                        width:100%;
                        height:${baseH}px;
                        background:linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.2) 100%);
                        border:1px solid ${color};
                        border-bottom:none;
                        border-radius:6px 6px 0 0;
                        display:flex; flex-direction:column;
                        align-items:center; justify-content:center; gap:1px;
                        box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);
                    ">
                        <span style="
                            font-size:${idx===0?'22px':'18px'};
                            font-weight:900; color:${color};
                            font-family:Arial Black,Arial,sans-serif; line-height:1;
                        ">${pts}</span>
                        <span style="font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:1px;">pts</span>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}

    // ── Contenedor offscreen ───────────────────────────────────
    const el = document.createElement('div');
    el.id = 'rankingShareTarget';
    el.style.cssText = `
        position: fixed;
        left: -9999px; top: 0;
        width: 1440px;
        background: #0a0a0a;
        font-family: 'Segoe UI', Arial, sans-serif;
        overflow: hidden;
    `;

    el.innerHTML = `
        <div style="background:#0a0a0a; position:relative; overflow:hidden; font-family:'Segoe UI',Arial,sans-serif;">

            <!-- Grid decorativo de fondo -->
            <div style="
                position:absolute; inset:0; pointer-events:none; z-index:0;
                background:
                    repeating-linear-gradient(90deg, rgba(255,255,255,0.013) 0, rgba(255,255,255,0.013) 1px, transparent 1px, transparent 72px),
                    repeating-linear-gradient(0deg,  rgba(255,255,255,0.013) 0, rgba(255,255,255,0.013) 1px, transparent 1px, transparent 72px);
            "></div>

            <!-- Glow dorado izquierda -->
            <div style="
                position:absolute; left:-80px; top:15%;
                width:440px; height:500px; pointer-events:none; z-index:0;
                background:radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%);
            "></div>

            <!-- Glow azul derecha -->
            <div style="
                position:absolute; right:-80px; top:15%;
                width:500px; height:500px; pointer-events:none; z-index:0;
                background:radial-gradient(circle, rgba(0,102,204,0.09) 0%, transparent 65%);
            "></div>

            <!-- Franja dorada top -->
            <div style="height:3px; background:linear-gradient(90deg, #C9A84C 0%, #FFD700 35%, transparent 100%); position:relative; z-index:2;"></div>

            <!-- ════════════════════════ BODY ════════════════════════ -->
            <div style="position:relative; z-index:2; display:flex; align-items:stretch;">

                <!-- ══ IZQUIERDA — TABLA (60%) ══ -->
                <div style="flex:0 0 25%; border-right:1px solid rgba(255,255,255,0.06);">

                    <!-- Header tabla -->
                    <div style="
                        padding:14px 18px 12px;
                        border-bottom:1px solid rgba(255,255,255,0.06);
                        display:flex; align-items:center; justify-content:space-between;
                    ">
                        <div style="font-size:9px; font-weight:900; letter-spacing:2.5px; color:rgba(255,255,255,0.22); text-transform:uppercase;">
                            🏆 TABLA DE POSICIONES
                        </div>
                        <div style="
                            font-size:9px; font-weight:900; letter-spacing:1px;
                            color:rgba(201,168,76,0.75); text-transform:uppercase;
                            background:rgba(201,168,76,0.08); border:1px solid rgba(201,168,76,0.2);
                            border-radius:10px; padding:2px 10px;
                        ">${ligaNombre}</div>
                    </div>

                    <!-- Filas -->
                    <div>${renderFilas()}</div>
                </div>

                <!-- ══ DERECHA — INFO + STATS (40%) ══ -->
                <div style="
                    flex:0 0 75%;
padding:20px 24px 0;
                    display:flex; flex-direction:column; gap:16px;
                    background:rgba(0,30,70,0.04);
                ">

                    <!-- Liga + Fecha -->
                    <div style="
                        background:rgba(255,255,255,0.025);
                        border:1px solid rgba(255,255,255,0.07);
                        border-radius:12px; overflow:hidden;
                    ">
                        <div style="
                            padding:8px 14px;
                            border-bottom:1px solid rgba(255,255,255,0.06);
                            background:rgba(255,255,255,0.02);
                            display:flex; align-items:center; gap:7px;
                        ">
                            <div style="width:6px; height:6px; border-radius:50%; background:#C9A84C; opacity:0.8; flex-shrink:0;"></div>
                            <span style="font-size:9px; font-weight:900; letter-spacing:1.5px; color:rgba(201,168,76,0.85); text-transform:uppercase;">${ligaNombre}</span>
                        </div>
                        <div style="padding:13px 16px; display:flex; flex-direction:column; gap:7px;">
                            <div style="font-size:12px; color:rgba(255,255,255,0.5); letter-spacing:0.3px;">📅 ${fechaFormateada}</div>
                            <div style="font-size:12px; color:rgba(255,255,255,0.5);">👥 ${total} participante${total !== 1 ? 's' : ''}</div>
                        </div>
                    </div>

                    <!-- Podio -->
                    <div>
                        <div style="font-size:8px; font-weight:900; letter-spacing:2px; color:rgba(255,255,255,0.22); text-transform:uppercase; margin-bottom:16px;">
                            🏆 PODIO ACTUAL
                        </div>
                        ${renderPodium()}
                    </div>

                    <!-- Stats grid 2×2 -->
                    <div style="
                        background:rgba(255,255,255,0.025);
                        border:1px solid rgba(255,255,255,0.07);
                        border-radius:12px; padding:14px 16px;
                        display:grid; grid-template-columns:1fr 1fr; gap:12px;
                    ">
                        <div style="text-align:center;">
                            <div style="font-size:22px; font-weight:900; color:#C9A84C; font-family:Arial Black,Arial,sans-serif; line-height:1;">${lider ? lider.puntos_totales || 0 : 0}</div>
                            <div style="font-size:8px; color:rgba(255,255,255,0.28); text-transform:uppercase; letter-spacing:1.5px; margin-top:3px;">Máx. pts</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:22px; font-weight:900; color:#5bb3ff; font-family:Arial Black,Arial,sans-serif; line-height:1;">${promedio}</div>
                            <div style="font-size:8px; color:rgba(255,255,255,0.28); text-transform:uppercase; letter-spacing:1.5px; margin-top:3px;">Promedio</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:22px; font-weight:900; color:rgba(255,255,255,0.38); font-family:Arial Black,Arial,sans-serif; line-height:1;">${ultimo ? ultimo.puntos_totales || 0 : 0}</div>
                            <div style="font-size:8px; color:rgba(255,255,255,0.28); text-transform:uppercase; letter-spacing:1.5px; margin-top:3px;">Mín. pts</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:22px; font-weight:900; color:rgba(255,255,255,0.5); font-family:Arial Black,Arial,sans-serif; line-height:1;">${total}</div>
                            <div style="font-size:8px; color:rgba(255,255,255,0.28); text-transform:uppercase; letter-spacing:1.5px; margin-top:3px;">Jugadores</div>
                        </div>
                    </div>

                    <!-- Spacer flexible -->
                    <div style="flex:1; min-height:8px;"></div>

                    <!-- Branding -->
<div style="
    background:rgba(201,168,76,0.06);
    border:1px solid rgba(201,168,76,0.15);
    border-left:3px solid #C9A84C;
    border-radius:10px;
    overflow:hidden;
    position:relative;
">
    <!-- Glow fondo -->
    <div style="
        position:absolute; inset:0; pointer-events:none;
        background:radial-gradient(ellipse at 50% 60%, rgba(201,168,76,0.10) 0%, transparent 70%);
        z-index:0;
    "></div>

    <!-- Jugadores GRANDES, saliendo desde abajo del bloque -->
    <div style="
        position:relative; z-index:1;
        display:flex; justify-content:center; align-items:flex-end;
        height:200px; overflow:hidden;
        margin-bottom:-2px;
    ">
        <img src="/img/olise.png" crossorigin="anonymous"
            style="height:185px; margin-right:-18px; opacity:0.88; filter:drop-shadow(0 0 12px rgba(201,168,76,0.25));">
        <img src="/img/trofeo.png" crossorigin="anonymous"
            style="height:200px; position:relative; z-index:2; opacity:1; filter:drop-shadow(0 0 16px rgba(201,168,76,0.35));">
        <img src="/img/diaz.png" crossorigin="anonymous"
            style="height:185px; margin-left:-18px; opacity:0.88; filter:drop-shadow(0 0 12px rgba(201,168,76,0.25));">
    </div>

    <!-- Logo + URL abajo -->
    <div style="
        position:relative; z-index:2;
        padding:10px 16px 12px;
        border-top:1px solid rgba(201,168,76,0.15);
        background:rgba(0,0,0,0.35);
        text-align:center;
    ">
        <img src="/img/logoblancomenu.png" crossorigin="anonymous"
            style="height:32px; display:block; margin:0 auto 4px;">
        <div style="font-size:9px; color:rgba(255,255,255,0.22); letter-spacing:1.5px;">quinielacarrisan.com.ve</div>
    </div>
</div>
</div>

                </div>
            </div>

            <!-- FOOTER -->
            <div style="
                position:relative; z-index:2;
                padding:10px 30px;
                border-top:1px solid rgba(255,255,255,0.06);
                display:flex; align-items:center; justify-content:space-between;
                background:rgba(0,0,0,0.25);
            ">
                <div style="font-size:9px; color:rgba(255,255,255,0.2); letter-spacing:1.5px; font-weight:600;">quinielacarrisan.com.ve</div>
                <div style="font-size:8px; font-weight:900; letter-spacing:2px; color:rgba(201,168,76,0.25); text-transform:uppercase;">
                    COPA MUNDIAL FIFA 2026™
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(el);

    try {
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0a0a0a',
            logging: false
        });

        document.body.removeChild(el);

        canvas.toBlob(async (blob) => {
            const archivo = new File([blob], 'ranking-quiniela.png', { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
                try {
                    await navigator.share({
                        files: [archivo],
                        title: 'Ranking Quiniela',
                        text: '¡Mira cómo va la tabla! 😱'
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
        alert('No se pudo generar la imagen. Intenta de nuevo.');
    }
}

function mostrarErrorCarga() {
    const podiumSection = document.getElementById('podiumSection');
    const tbody = document.getElementById('rankingTableBody');
    
    if (podiumSection) {
        podiumSection.innerHTML = `
            <div style="text-align: center; color: var(--error); padding: 2rem;">
                <p>❌ Error al cargar el ranking</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: var(--fifa-blue); border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: 600;">
                    Reintentar
                </button>
            </div>
        `;
    }
    
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 3rem; color: var(--text-gray);">
                    ❌ Error al cargar el ranking
                </td>
            </tr>
        `;
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