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

    // ── PALETA DE COLORES EDITORIAL DEPORTIVA ──────────────────────
    const K_COLOR = {
        bg: '#0A0B0E',        // Obsidian Dark
        card: '#13151B',      // Carbon Slate
        gold: '#F4C430',      // Trophy Gold
        silver: '#E5E8EB',    // Silver Metallic
        bronze: '#CD7F32',    // Bronze Core
        textMain: '#FFFFFF',  // Crisp White
        textMuted: '#6B7280'  // Slate Muted
    };

    // ── FILAS DE LA TABLA (IZQUIERDA) ─────────────────────────────
    function renderFilas() {
        return datos.map((user, index) => {
            const pos    = index + 1;
            const nombre = (user.nombre_publico || user.nombre || 'Usuario').substring(0, 16);
            const puntos = user.puntos_totales || 0;
            
            const esTop1 = pos === 1;
            const esTop2 = pos === 2;
            const esTop3 = pos === 3;
            const esTop  = pos <= 3;

            // Configuración visual por rango
            let badgeBg = 'rgba(255,255,255,0.05)';
            let badgeColor = K_COLOR.textMuted;
            let rowBg = index % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
            let nameColor = K_COLOR.textMain;
            let ptsColor = 'rgba(255,255,255,0.85)';
            let borderLeft = 'none';

            if (esTop1) {
                badgeBg = K_COLOR.gold;
                badgeColor = '#000';
                rowBg = 'linear-gradient(90deg, rgba(244,196,48,0.12) 0%, transparent 100%)';
                ptsColor = K_COLOR.gold;
                borderLeft = `3px solid ${K_COLOR.gold}`;
            } else if (esTop2) {
                badgeBg = K_COLOR.silver;
                badgeColor = '#000';
                rowBg = 'linear-gradient(90deg, rgba(229,232,235,0.06) 0%, transparent 100%)';
                borderLeft = `3px solid ${K_COLOR.silver}`;
            } else if (esTop3) {
                badgeBg = K_COLOR.bronze;
                badgeColor = '#fff';
                borderLeft = `3px solid ${K_COLOR.bronze}`;
            }

            return `
<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:${rowBg};border-left:${borderLeft};border-bottom:1px solid rgba(255,255,255,0.03);margin-bottom:2px;">
    <div style="display:flex;align-items:center;gap:12px;min-width:0;">
        <div style="width:24px;height:24px;border-radius:4px;background:${badgeBg};color:${badgeColor};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;font-family:'Impact','Arial Black',sans-serif;flex-shrink:0;">
            ${pos}
        </div>
        <div style="font-size:12px;font-weight:${esTop?'700':'500'};color:${nameColor};font-family:'Segoe UI',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.3px;text-transform:uppercase;">
            ${nombre}
        </div>
    </div>
    <div style="font-size:13px;font-weight:800;color:${ptsColor};font-family:'Impact',sans-serif;letter-spacing:0.5px;text-align:right;min-width:35px;">
        ${puntos} <span style="font-size:9px;color:${K_COLOR.textMuted};font-weight:400;font-family:sans-serif;">PTS</span>
    </div>
</div>`;
        }).join('');
    }

    // ── PODIO (DERECHA) ───────────────────────────────────────────
    function renderPodium() {
        const podiumImages = ['/img/messi.png', '/img/baggio.jpg', '/img/turquia.jpg'];
        // Orden deportivo moderno en paralelo: 3ro Izquierda, 1ro Centro, 2do Derecha
        const slots = [
            { idx: 2, color: K_COLOR.bronze, height: '150px', label: '03', textPos: '3RD PLACE', avatarSize: '80px' },
            { idx: 0, color: K_COLOR.gold, height: '200px', label: '01', textPos: 'LEADER', avatarSize: '105px' },
            { idx: 1, color: K_COLOR.silver, height: '170px', label: '02', textPos: '2ND PLACE', avatarSize: '90px' }
        ];

        return `
<div style="display:flex;align-items:flex-end;justify-content:center;gap:20px;width:100%;padding:10px 0;">
${slots.map(({ idx, color, height, label, textPos, avatarSize }) => {
    const user = top3[idx];
    if (!user) return '<div style="flex:1;min-width:0;visibility:hidden;"></div>';
    const nombre = (user.nombre_publico || user.nombre || 'Usuario').substring(0, 14);
    const pts    = Number(user.puntos_totales) || 0;
    const isFirst = idx === 0;

    return `
<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;position:relative;">
    
    <!-- Avatar con marco poligonal / circular tecnológico -->
    <div style="position:relative;margin-bottom:15px;z-index:2;">
        <div style="width:${avatarSize};height:${avatarSize};border-radius:50%;border:3px solid ${color};padding:4px;background:${K_COLOR.bg};box-shadow: 0 10px 25px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <div style="width:100%;height:100%;border-radius:50%;overflow:hidden;position:relative;background:'#111';">
                <img src="${podiumImages[idx]}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;">
            </div>
        </div>
        <!-- Indicador flotante superior -->
        <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:${color};color:#000;font-size:9px;font-weight:900;font-family:'Impact',sans-serif;padding:2px 8px;border-radius:10px;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,0.3);">
            ${textPos}
        </div>
    </div>

    <!-- Bloque de Podio Estilo Tarjeta EA Sports -->
    <div style="width:100%;height:${height};background:linear-gradient(180deg, ${K_COLOR.card} 0%, rgba(19,21,27,0.4) 100%);border-top:4px solid ${color};border-radius:6px 6px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:20px 10px;box-shadow:0 15px 35px rgba(0,0,0,0.4);position:relative;overflow:hidden;">
        
        <!-- Número gigante de fondo difuminado de posición -->
        <div style="position:absolute;bottom:-20px;right:-10px;font-size:110px;font-weight:900;font-family:'Impact',sans-serif;color:rgba(255,255,255,0.02);line-height:1;pointer-events:none;user-select:none;">
            ${label}
        </div>

        <div style="text-align:center;width:100%;z-index:1;">
            <div style="font-size:12px;font-weight:700;color:${K_COLOR.textMain};font-family:'Segoe UI',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
                ${nombre}
            </div>
        </div>

        <div style="text-align:center;z-index:1;">
            <div style="font-size:${isFirst?'38px':'30px'};font-weight:900;color:${color};font-family:'Impact',Arial,sans-serif;line-height:1;">
                ${pts}
            </div>
            <div style="font-size:9px;color:${K_COLOR.textMuted};font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">
                PUNTOS TOTALES
            </div>
        </div>
    </div>
</div>`;
}).join('')}
</div>`;
    }

    // ── CONTENEDOR MAESTRO 1080×1350 (FORMATO INSTAGRAM) ──────────
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-9999px;top:0;width:1080px;height:1350px;overflow:hidden;background:${K_COLOR.bg};`;

    el.innerHTML = `
<div style="width:1080px;height:1350px;background:${K_COLOR.bg};position:relative;overflow:hidden;display:flex;font-family:'Segoe UI',sans-serif;color:${K_COLOR.textMain};">

    <!-- ═══════════ TEXTURAS Y GEOMETRÍAS DE FONDO DEPORTIVAS ═══════════ -->
    <!-- Líneas dinámicas cinéticas oblicuas -->
    <div style="position:absolute;inset:0;opacity:0.04;background:repeating-linear-gradient(-45deg, transparent, transparent 60px, #fff 60px, #fff 62px);z-index:0;"></div>
    
    <!-- Bloques geométricos abstractos de iluminación -->
    <div style="position:absolute;top:-300px;left:400px;width:800px;height:800px;background:radial-gradient(circle, rgba(244,196,48,0.08) 0%, transparent 70%);border-radius:50%;z-index:0;"></div>
    <div style="position:absolute;bottom:-200px;right:-100px;width:600px;height:600px;background:radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%);border-radius:50%;z-index:0;"></div>
    
    <!-- Marca de Agua Monumental Trasera -->
    <div style="position:absolute;right:-150px;top:40%;transform:translateY(-50%) rotate(-90deg);font-size:160px;font-weight:900;font-family:'Impact',sans-serif;color:rgba(255,255,255,0.015);letter-spacing:10px;pointer-events:none;white-space:nowrap;z-index:0;">
        LEADERBOARD 2026
    </div>

    <!-- ═══════════ SECCIÓN IZQUIERDA: TABLA COMPLETA ═══════════ -->
    <div style="position:relative;z-index:2;width:310px;background:linear-gradient(180deg, #111319 0%, #0A0B0E 100%);display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,0.05);box-shadow:10px 0 30px rgba(0,0,0,0.5);">
        
        <!-- Encabezado Tabla -->
        <div style="padding:35px 20px 20px;border-bottom:2px solid ${K_COLOR.gold};background:rgba(0,0,0,0.25);">
            <div style="font-size:10px;font-weight:900;letter-spacing:3px;color:${K_COLOR.gold};text-transform:uppercase;margin-bottom:6px;font-family:'Impact',sans-serif;">
                LIVE STANDINGS
            </div>
            <div style="font-size:24px;font-weight:900;font-family:'Impact',sans-serif;letter-spacing:0.5px;text-transform:uppercase;line-height:1.1;color:#fff;">
                CLASIFICACIÓN
            </div>
            <div style="margin-top:12px;display:inline-block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:4px 10px;background:rgba(255,255,255,0.03);text-transform:uppercase;letter-spacing:0.5px;">
                ${ligaNombre}
            </div>
        </div>

        <!-- Contenedor Scrollable simulado para filas -->
        <div style="flex:1;overflow:hidden;padding:15px 8px 0;">
            ${renderFilas()}
        </div>

        <!-- Footer Izquierdo -->
        <div style="padding:15px 20px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
            <div style="font-size:9px;font-weight:700;color:${K_COLOR.textMuted};letter-spacing:2px;text-transform:uppercase;">
                TOTAL: ${total} PARTICIPANTES
            </div>
        </div>
    </div>

    <!-- ═══════════ SECCIÓN DERECHA: PANEL PRINCIPAL SHOWCASE ═══════════ -->
    <div style="position:relative;z-index:2;flex:1;display:flex;flex-direction:column;">

        <!-- HEADER PRINCIPAL -->
        <div style="padding:40px 45px 25px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:18px;">
                <img src="/img/logoblancomenu.png" crossorigin="anonymous" style="height:45px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.3));">
                <div style="width:2px;height:35px;background:rgba(255,255,255,0.15);"></div>
                <div>
                    <h1 style="margin:0;font-size:26px;font-weight:900;font-family:'Impact',sans-serif;letter-spacing:0.5px;line-height:0.95;color:#fff;text-transform:uppercase;">
                        TABLA DE <span style="color:${K_COLOR.gold};">POSICIONES</span>
                    </h1>
                </div>
            </div>
            
            <div style="text-align:right;">
                <div style="font-size:11px;font-weight:900;color:#000;background:${K_COLOR.gold};letter-spacing:1px;border-radius:4px;padding:5px 14px;text-transform:uppercase;display:inline-block;margin-bottom:6px;font-family:'Impact',sans-serif;">
                    ${ligaNombre}
                </div>
                <div style="font-size:11px;color:${K_COLOR.textMuted};font-weight:600;letter-spacing:0.5px;">
                    📅 ${fechaFormateada}
                </div>
            </div>
        </div>

        <!-- HERO COMPOSICIÓN GRÁFICA (ESTILO FIFA WORLD CUP COPA MUNDIAL) -->
        <div style="position:relative;height:340px;margin:0 45px;border-radius:12px;background:linear-gradient(135deg, #161922 0%, #0D0F14 100%);border:1px solid rgba(255,255,255,0.05);box-shadow:0 20px 40px rgba(0,0,0,0.6);overflow:hidden;flex-shrink:0;">
            
            <!-- Iluminaciones de fondo en la tarjeta Hero -->
            <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 120%, rgba(244,196,48,0.15) 0%, transparent 60%);z-index:1;"></div>
            <div style="position:absolute;top:-50px;right:-50px;width:200px;height:200px;background:rgba(255,255,255,0.02);transform:rotate(45deg);z-index:1;"></div>

            <!-- Insignia Central Superior de Torneo -->
            <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);border:1px solid ${K_COLOR.gold};border-radius:4px;padding:6px 18px;font-size:10px;font-weight:900;letter-spacing:2.5px;color:${K_COLOR.gold};text-transform:uppercase;white-space:nowrap;z-index:4;font-family:'Impact',sans-serif;box-shadow:0 4px 15px rgba(0,0,0,0.5);">
                ⚽ COPA MUNDIAL FIFA 2026™
            </div>

            <!-- Recortes de Jugadores con Estilo de Sombra Profunda Dinámica -->
            <img src="/img/olise.png" crossorigin="anonymous" style="position:absolute;bottom:0;left:40px;height:310px;object-fit:contain;z-index:2;filter:drop-shadow(-10px 10px 20px rgba(0,0,0,0.8));">
            <img src="/img/trofeo.png" crossorigin="anonymous" style="position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);height:315px;object-fit:contain;z-index:3;filter:drop-shadow(0 15px 30px rgba(0,0,0,0.7)) drop-shadow(0 0 40px rgba(244,196,48,0.3));">
            <img src="/img/diaz.png" crossorigin="anonymous" style="position:absolute;bottom:0;right:40px;height:310px;object-fit:contain;z-index:2;filter:drop-shadow(10px 10px 20px rgba(0,0,0,0.8));">
        </div>

        <!-- PODIO CORONA DE LÍDERES -->
        <div style="margin:30px 45px 10px;flex-shrink:0;">
            <div style="font-size:10px;font-weight:900;letter-spacing:4px;color:${K_COLOR.textMuted};text-transform:uppercase;margin-bottom:15px;text-align:center;font-family:'Impact',sans-serif;">
                CURRENT TOP THREE / PODIO ACTUAL
            </div>
            ${renderPodium()}
        </div>

        <!-- MÉTRICAS Y ESTADÍSTICAS DEL TORNEO -->
        <div style="margin:25px 45px 15px;display:grid;grid-template-columns:repeat(4, 1fr);gap:15px;flex-shrink:0;">
            
            <!-- Bloque Líder -->
            <div style="background:${K_COLOR.card};border:1px solid rgba(255,255,255,0.04);border-top:3px solid ${K_COLOR.gold};border-radius:6px;padding:16px 10px;text-align:center;box-shadow:0 10px 20px rgba(0,0,0,0.25);">
                <div style="font-size:10px;color:${K_COLOR.textMuted};text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">MAX SCORE</div>
                <div style="font-size:32px;font-weight:900;color:${K_COLOR.gold};font-family:'Impact',sans-serif;line-height:1;">
                    ${lider ? lider.puntos_totales || 0 : 0}
                </div>
                <div style="font-size:9px;color:${K_COLOR.textMain};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;opacity:0.8;">LÍDER</div>
            </div>

            <!-- Bloque Promedio -->
            <div style="background:${K_COLOR.card};border:1px solid rgba(255,255,255,0.04);border-top:3px solid #2563EB;border-radius:6px;padding:16px 10px;text-align:center;box-shadow:0 10px 20px rgba(0,0,0,0.25);">
                <div style="font-size:10px;color:${K_COLOR.textMuted};text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">AVERAGE</div>
                <div style="font-size:32px;font-weight:900;color:#3B82F6;font-family:'Impact',sans-serif;line-height:1;">
                    ${promedio}
                </div>
                <div style="font-size:9px;color:${K_COLOR.textMain};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;opacity:0.8;">PROMEDIO</div>
            </div>

            <!-- Bloque Mínimo -->
            <div style="background:${K_COLOR.card};border:1px solid rgba(255,255,255,0.04);border-top:3px solid #EF4444;border-radius:6px;padding:16px 10px;text-align:center;box-shadow:0 10px 20px rgba(0,0,0,0.25);">
                <div style="font-size:10px;color:${K_COLOR.textMuted};text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">MIN SCORE</div>
                <div style="font-size:32px;font-weight:900;color:#EF4444;font-family:'Impact',sans-serif;line-height:1;">
                    ${ultimo ? ultimo.puntos_totales || 0 : 0}
                </div>
                <div style="font-size:9px;color:${K_COLOR.textMain};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;opacity:0.8;">MÍNIMO</div>
            </div>

            <!-- Bloque Jugadores -->
            <div style="background:${K_COLOR.card};border:1px solid rgba(255,255,255,0.04);border-top:3px solid ${K_COLOR.textMuted};border-radius:6px;padding:16px 10px;text-align:center;box-shadow:0 10px 20px rgba(0,0,0,0.25);">
                <div style="font-size:10px;color:${K_COLOR.textMuted};text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">PLAYERS</div>
                <div style="font-size:32px;font-weight:900;color:${K_COLOR.textMain};font-family:'Impact',sans-serif;line-height:1;">
                    ${total}
                </div>
                <div style="font-size:9px;color:${K_COLOR.textMain};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;opacity:0.8;">JUGADORES</div>
            </div>
        </div>

        <!-- Flex spacer para empujar el footer perfectamente al borde inferior -->
        <div style="flex:1;"></div>

        <!-- FOOTER CORPORATIVO -->
        <div style="padding:25px 45px;background:#0A0B0E;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
            <img src="/img/logoblancomenu.png" crossorigin="anonymous" style="height:32px;opacity:0.8;">
            <div style="font-size:10px;color:${K_COLOR.textMuted};letter-spacing:2.5px;font-weight:700;font-family:sans-serif;text-transform:uppercase;">
                QUINIELACARRISAN.COM.VE
            </div>
            <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:${K_COLOR.gold};text-transform:uppercase;font-family:'Impact',sans-serif;">
                CARRISÁN · 2026
            </div>
        </div>

    </div><!-- /panel derecho -->
</div><!-- /root -->
    `;

    document.body.appendChild(el);

    // Pausa para la correcta renderización interna y carga de imágenes
    await new Promise(r => setTimeout(r, 400));

    try {
        const canvas = await html2canvas(el.firstElementChild, {
            scale: 1.2, // Ligero aumento de escala para nitidez en pantallas de alta densidad (Retina)
            useCORS: true,
            backgroundColor: K_COLOR.bg,
            logging: false,
            width: 1080,
            height: 1350
        });

        document.body.removeChild(el);

        canvas.toBlob(async (blob) => {
            const archivo = new File([blob], 'ranking-quiniela.png', { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
                try {
                    await navigator.share({
                        files: [archivo],
                        title: 'Ranking Quiniela Carrisán',
                        text: '¡Mira cómo va la tabla de posiciones! 😱⚽'
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
        alert('No se pudo generar la imagen para compartir. Inténtalo de nuevo.');
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