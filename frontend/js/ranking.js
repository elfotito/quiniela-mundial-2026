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

    // ── Filas tabla ─────────────────────────────────────────────
    function renderFilas() {
        return datos.map((user, index) => {
            const pos    = index + 1;
            const nombre = (user.nombre_publico || user.nombre || 'Usuario').substring(0, 15);
            const puntos = user.puntos_totales || 0;
            const esTop1 = pos === 1;
            const esTop2 = pos === 2;
            const esTop3 = pos === 3;
            const esTop  = pos <= 3;

            const icono = esTop1 ? '🥇' : esTop2 ? '🥈' : esTop3 ? '🥉' : `${pos}`;
            const bgFila = index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
            const bLeft  = esTop1 ? '3px solid #C9A84C'
                         : esTop2 ? '3px solid #8fa8c8'
                         : esTop3 ? '3px solid #8B5E3C'
                         : '3px solid transparent';

            return `
<div style="
    display:flex;align-items:center;gap:6px;
    padding:5px 10px 5px 7px;
    background:${esTop1 ? 'linear-gradient(90deg,rgba(201,168,76,0.10) 0%,transparent 80%)' : bgFila};
    border-bottom:1px solid rgba(255,255,255,0.025);
    border-left:${bLeft};
">
    <div style="width:22px;text-align:center;flex-shrink:0;font-size:${esTop ? '12px' : '9px'};color:rgba(255,255,255,0.28);font-family:Arial,sans-serif;">${icono}</div>
    <div style="flex:1;min-width:0;font-size:11px;font-weight:${esTop ? '700' : '400'};color:${esTop1 ? '#fff' : esTop ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)'};font-family:Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nombre}</div>
    <div style="font-size:${esTop1 ? '13px' : esTop ? '12px' : '10px'};font-weight:${esTop ? '900' : '400'};color:${esTop1 ? '#C9A84C' : esTop ? 'rgba(201,168,76,0.6)' : 'rgba(255,255,255,0.28)'};font-family:Arial Black,Arial,sans-serif;flex-shrink:0;">${puntos}</div>
</div>`;
        }).join('');
    }

    // ── Podio estilo "League Table card" ─────────────────────────
    function renderPodium() {
        const podiumImages = ['/img/messi.png', '/img/baggio.jpg', '/img/turquia.jpg'];

        const slots = [
            { idx: 1, pos: 2, color: '#8fa8c8', glow: 'rgba(143,168,200,0.35)', ringGlow: '0 0 20px rgba(143,168,200,0.4)', label: '2º', numSize: '42px', avatarS: 90,  cardH: 148, badgeBg: 'rgba(143,168,200,0.12)', badgeBorder: 'rgba(143,168,200,0.3)' },
            { idx: 0, pos: 1, color: '#C9A84C', glow: 'rgba(201,168,76,0.5)',   ringGlow: '0 0 30px rgba(201,168,76,0.55)', label: '1º', numSize: '58px', avatarS: 118, cardH: 200, badgeBg: 'rgba(201,168,76,0.14)', badgeBorder: 'rgba(201,168,76,0.4)' },
            { idx: 2, pos: 3, color: '#C0824A', glow: 'rgba(192,130,74,0.35)', ringGlow: '0 0 20px rgba(192,130,74,0.4)', label: '3º', numSize: '42px', avatarS: 90,  cardH: 148, badgeBg: 'rgba(192,130,74,0.10)', badgeBorder: 'rgba(192,130,74,0.28)' }
        ];

        return `<div style="display:flex;align-items:flex-end;justify-content:center;gap:12px;width:100%;">
${slots.map(({ idx, pos, color, glow, ringGlow, label, numSize, avatarS, cardH, badgeBg, badgeBorder }) => {
    const user   = top3[idx];
    if (!user) return '<div style="flex:1;"></div>';
    const nombre = (user.nombre_publico || user.nombre || 'Usuario').substring(0, 13);
    const pts    = Number(user.puntos_totales) || 0;
    const esLider = pos === 1;

    return `
<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;">

    <!-- Avatar flotante encima de la card -->
    <div style="position:relative;margin-bottom:-${avatarS/2}px;z-index:2;">
        <!-- Anillo de color -->
        <div style="
            width:${avatarS}px;height:${avatarS}px;border-radius:50%;
            background:linear-gradient(135deg,${color} 0%,rgba(0,0,0,0) 60%);
            padding:3px;
            box-shadow:${ringGlow};
        ">
            <div style="width:100%;height:100%;border-radius:50%;overflow:hidden;background:#0d1b35;">
                <img src="${podiumImages[idx]}" crossorigin="anonymous"
                    style="width:100%;height:100%;object-fit:cover;display:block;">
            </div>
        </div>
        <!-- Badge posición -->
        <div style="
            position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
            background:${color};border-radius:20px;padding:2px 10px;
            font-size:${esLider ? '11px' : '10px'};font-weight:900;color:#000;
            font-family:Arial Black,Arial,sans-serif;white-space:nowrap;
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
        ">${label}</div>
    </div>

    <!-- Card contenedor -->
    <div style="
        width:100%;
        height:${cardH}px;
        background:linear-gradient(160deg, rgba(15,30,65,0.95) 0%, rgba(8,16,40,0.98) 100%);
        border:1px solid rgba(255,255,255,0.08);
        border-top:2px solid ${color};
        border-radius:16px;
        box-shadow:0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
        display:flex;flex-direction:column;align-items:center;
        justify-content:flex-end;padding-bottom:14px;
        position:relative;overflow:hidden;
    ">
        <!-- Glow de color de fondo -->
        <div style="
            position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;
            background:radial-gradient(ellipse at 50% 0%, ${glow.replace('0.5','0.08').replace('0.35','0.05')} 0%, transparent 65%);
        "></div>

        <!-- Nombre -->
        <div style="
            font-size:${esLider ? '13px' : '11px'};font-weight:700;
            color:rgba(255,255,255,0.9);text-align:center;
            font-family:Arial,sans-serif;line-height:1.2;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            max-width:90%;margin-bottom:8px;
            position:relative;z-index:1;
        ">${nombre}</div>

        <!-- Número de puntos -->
        <div style="
            font-size:${numSize};font-weight:900;
            font-style:italic;
            color:${color};
            font-family:Arial Black,Arial,sans-serif;line-height:1;
            text-shadow:0 0 20px ${glow};
            position:relative;z-index:1;
            letter-spacing:-2px;
        ">${pts}</div>
        <div style="
            font-size:9px;color:rgba(255,255,255,0.25);
            text-transform:uppercase;letter-spacing:2px;margin-top:3px;
            position:relative;z-index:1;
        ">puntos</div>
    </div>

</div>`;
}).join('')}
</div>`;
    }

    // ── DOM 1080×1350 ────────────────────────────────────────────
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-9999px;top:0;width:1080px;height:1350px;overflow:hidden;`;

    el.innerHTML = `
<div style="width:1080px;height:1350px;position:relative;overflow:hidden;display:flex;font-family:'Segoe UI',Arial,sans-serif;
    background:linear-gradient(135deg, #060f24 0%, #0a1628 40%, #0d1f3c 70%, #091428 100%);">

    <!-- Noise/grain sutil -->
    <div style="position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0.03;
        background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22/></filter><rect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22 opacity=%221%22/></svg>');
        background-size:200px 200px;
    "></div>

    <!-- Orbe dorado top-right -->
    <div style="position:absolute;top:-120px;right:100px;width:600px;height:600px;z-index:0;pointer-events:none;
        background:radial-gradient(circle, rgba(201,168,76,0.10) 0%, rgba(201,168,76,0.02) 40%, transparent 65%);
        border-radius:50%;
    "></div>

    <!-- Orbe azul brillante centro-derecha -->
    <div style="position:absolute;top:35%;right:50px;width:500px;height:500px;z-index:0;pointer-events:none;
        background:radial-gradient(circle, rgba(0,100,255,0.10) 0%, transparent 60%);
        border-radius:50%;
    "></div>

    <!-- Línea diagonal decorativa -->
    <div style="position:absolute;top:0;bottom:0;left:268px;width:1px;z-index:0;pointer-events:none;
        background:linear-gradient(180deg, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.08) 40%, transparent 80%);
    "></div>

    <!-- ═══ TABLA IZQUIERDA ═══ -->
    <div style="
        position:relative;z-index:2;
        flex:0 0 270px;width:270px;
        border-right:1px solid rgba(255,255,255,0.05);
        display:flex;flex-direction:column;
        background:rgba(0,0,0,0.25);
    ">
        <!-- Header tabla -->
        <div style="padding:20px 14px 14px;border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:7px;font-weight:900;letter-spacing:3.5px;color:rgba(201,168,76,0.45);text-transform:uppercase;margin-bottom:8px;">POSICIONES</div>
            <div style="font-size:15px;font-weight:900;color:#fff;font-family:Arial Black,Arial,sans-serif;line-height:1;margin-bottom:6px;">TABLA</div>
            <div style="
                display:inline-flex;align-items:center;gap:5px;
                background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
                border-radius:20px;padding:3px 10px;
            ">
                <div style="width:5px;height:5px;border-radius:50%;background:#C9A84C;"></div>
                <span style="font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:0.5px;">${ligaNombre} · ${total} jugadores</span>
            </div>
        </div>

        <!-- Filas -->
        <div style="flex:1;overflow:hidden;">${renderFilas()}</div>

        <!-- Footer tabla -->
        <div style="padding:10px 14px;border-top:1px solid rgba(255,255,255,0.04);background:rgba(0,0,0,0.2);">
            <div style="font-size:8px;color:rgba(255,255,255,0.1);letter-spacing:1.5px;">quinielacarrisan.com.ve</div>
        </div>
    </div>

    <!-- ═══ PANEL DERECHO ═══ -->
    <div style="position:relative;z-index:2;flex:1;min-width:0;display:flex;flex-direction:column;">

        <!-- HEADER -->
        <div style="
            padding:22px 32px 18px;
            border-bottom:1px solid rgba(255,255,255,0.05);
            display:flex;align-items:center;justify-content:space-between;
            flex-shrink:0;
        ">
            <div style="display:flex;align-items:center;gap:14px;">
                <img src="/img/logoblancomenu.png" crossorigin="anonymous" style="height:32px;opacity:0.9;">
                <div style="width:1px;height:32px;background:rgba(255,255,255,0.07);"></div>
                <div>
                    <div style="font-size:20px;font-weight:900;font-style:italic;color:#fff;font-family:Arial Black,Arial,sans-serif;letter-spacing:-0.5px;line-height:1;">TABLA DE POSICIONES</div>
                    <div style="font-size:9px;color:rgba(255,255,255,0.28);letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Copa Mundial FIFA 2026™</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="
                    font-size:9px;font-weight:900;color:rgba(201,168,76,0.9);letter-spacing:1.5px;
                    background:rgba(201,168,76,0.10);border:1px solid rgba(201,168,76,0.2);
                    border-radius:20px;padding:4px 14px;text-transform:uppercase;
                    display:inline-block;margin-bottom:6px;
                ">${ligaNombre}</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.25);">📅 ${fechaFormateada}</div>
            </div>
        </div>

        <!-- Acento línea dorada -->
        <div style="height:2px;background:linear-gradient(90deg,transparent 0%,rgba(201,168,76,0.6) 20%,rgba(255,215,0,0.8) 50%,rgba(201,168,76,0.6) 80%,transparent 100%);flex-shrink:0;"></div>

        <!-- ── HERO JUGADORES ── -->
        <div style="
            position:relative;flex-shrink:0;height:280px;overflow:visible;
        ">
            <!-- Backdrop glow dorado detrás del trofeo -->
            <div style="
                position:absolute;bottom:0;left:50%;transform:translateX(-50%);
                width:340px;height:200px;border-radius:50%;pointer-events:none;
                background:radial-gradient(ellipse at center bottom, rgba(201,168,76,0.22) 0%, rgba(201,168,76,0.06) 45%, transparent 70%);
            "></div>

            <!-- Olise - izquierda con clip hacia adentro -->
            <img src="/img/olise.png" crossorigin="anonymous" style="
                position:absolute;bottom:0;left:10px;
                height:265px;object-fit:contain;object-position:bottom;
                opacity:0.82;
                filter:drop-shadow(0 -4px 16px rgba(0,60,180,0.3));
            ">

            <!-- Trofeo - centro elevado, más grande -->
            <img src="/img/trofeo.png" crossorigin="anonymous" style="
                position:absolute;bottom:0;left:50%;transform:translateX(-50%);
                height:275px;object-fit:contain;object-position:bottom;
                filter:drop-shadow(0 0 40px rgba(201,168,76,0.55)) drop-shadow(0 0 12px rgba(255,200,0,0.7));
                z-index:2;
            ">

            <!-- Diaz - derecha -->
            <img src="/img/diaz.png" crossorigin="anonymous" style="
                position:absolute;bottom:0;right:10px;
                height:265px;object-fit:contain;object-position:bottom;
                opacity:0.82;
                filter:drop-shadow(0 -4px 16px rgba(0,60,180,0.3));
            ">

            <!-- Fade inferior para unir con el podio -->
            <div style="
                position:absolute;bottom:0;left:0;right:0;height:100px;pointer-events:none;
                background:linear-gradient(0deg, rgba(9,20,40,1) 0%, transparent 100%);
            "></div>

            <!-- Badge Copa -->
            <div style="
                position:absolute;top:14px;left:50%;transform:translateX(-50%);
                background:rgba(6,15,36,0.75);border:1px solid rgba(201,168,76,0.25);
                backdrop-filter:blur(4px);
                border-radius:20px;padding:5px 20px;white-space:nowrap;
                font-size:8px;font-weight:900;letter-spacing:3px;color:rgba(201,168,76,0.7);text-transform:uppercase;
            ">⚽ COPA MUNDIAL FIFA 2026™</div>
        </div>

        <!-- ── PODIO ── -->
        <div style="padding:8px 28px 20px;flex-shrink:0;">
            <div style="font-size:7px;font-weight:900;letter-spacing:3px;color:rgba(255,255,255,0.14);text-transform:uppercase;margin-bottom:20px;">🏆 PODIO ACTUAL</div>
            ${renderPodium()}
        </div>

        <!-- ── STATS 4 pill cards ── -->
        <div style="padding:0 28px 20px;flex-shrink:0;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">

            <div style="
                background:linear-gradient(135deg,rgba(201,168,76,0.10) 0%,rgba(201,168,76,0.04) 100%);
                border:1px solid rgba(201,168,76,0.22);
                border-radius:14px;padding:14px 10px;text-align:center;
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);
            ">
                <div style="font-size:30px;font-weight:900;font-style:italic;color:#C9A84C;font-family:Arial Black,Arial,sans-serif;line-height:1;letter-spacing:-1px;">${lider ? lider.puntos_totales || 0 : 0}</div>
                <div style="font-size:7px;color:rgba(201,168,76,0.4);text-transform:uppercase;letter-spacing:2px;margin-top:4px;">Líder</div>
            </div>

            <div style="
                background:linear-gradient(135deg,rgba(0,100,255,0.10) 0%,rgba(0,60,180,0.04) 100%);
                border:1px solid rgba(80,140,255,0.20);
                border-radius:14px;padding:14px 10px;text-align:center;
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);
            ">
                <div style="font-size:30px;font-weight:900;font-style:italic;color:#6aacff;font-family:Arial Black,Arial,sans-serif;line-height:1;letter-spacing:-1px;">${promedio}</div>
                <div style="font-size:7px;color:rgba(100,160,255,0.45);text-transform:uppercase;letter-spacing:2px;margin-top:4px;">Promedio</div>
            </div>

            <div style="
                background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                border-radius:14px;padding:14px 10px;text-align:center;
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);
            ">
                <div style="font-size:30px;font-weight:900;font-style:italic;color:rgba(255,255,255,0.28);font-family:Arial Black,Arial,sans-serif;line-height:1;letter-spacing:-1px;">${ultimo ? ultimo.puntos_totales || 0 : 0}</div>
                <div style="font-size:7px;color:rgba(255,255,255,0.18);text-transform:uppercase;letter-spacing:2px;margin-top:4px;">Mínimo</div>
            </div>

            <div style="
                background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                border-radius:14px;padding:14px 10px;text-align:center;
                box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);
            ">
                <div style="font-size:30px;font-weight:900;font-style:italic;color:rgba(255,255,255,0.4);font-family:Arial Black,Arial,sans-serif;line-height:1;letter-spacing:-1px;">${total}</div>
                <div style="font-size:7px;color:rgba(255,255,255,0.18);text-transform:uppercase;letter-spacing:2px;margin-top:4px;">Jugadores</div>
            </div>

        </div>

        <!-- Spacer -->
        <div style="flex:1;min-height:0;"></div>

        <!-- ── FOOTER ── -->
        <div style="
            padding:14px 28px;
            border-top:1px solid rgba(255,255,255,0.04);
            background:rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:space-between;
            flex-shrink:0;
        ">
            <img src="/img/logoblancomenu.png" crossorigin="anonymous" style="height:24px;opacity:0.55;">
            <div style="height:1px;flex:1;margin:0 20px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.12),transparent);"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:2px;color:rgba(201,168,76,0.22);text-transform:uppercase;">CARRISÁN · 2026</div>
        </div>

    </div><!-- /panel derecho -->

</div>
    `;

    document.body.appendChild(el);

    try {
        const canvas = await html2canvas(el.firstElementChild, {
            scale: 1,
            useCORS: true,
            backgroundColor: '#060f24',
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