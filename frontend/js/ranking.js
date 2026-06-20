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
            const nombre = (user.nombre_publico || user.nombre || 'Usuario').substring(0, 16);
            const puntos = user.puntos_totales || 0;
            const esTop1 = pos === 1;
            const esTop2 = pos === 2;
            const esTop3 = pos === 3;
            const esTop  = pos <= 3;

            const icono  = esTop1 ? '🥇' : esTop2 ? '🥈' : esTop3 ? '🥉' : pos;
            const bgFila = esTop1
                ? 'linear-gradient(90deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.04) 100%)'
                : index % 2 === 0
                    ? 'rgba(255,255,255,0.02)'
                    : 'transparent';
            const bLeft  = esTop1
                ? '3px solid #D4AF37'
                : esTop2
                    ? '3px solid #B0B0B0'
                    : esTop3
                        ? '3px solid #CD7F32'
                        : '3px solid transparent';
            const nameColor = esTop1 ? '#fff' : esTop ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)';
            const ptsColor  = esTop1 ? '#D4AF37' : esTop ? 'rgba(212,175,55,0.7)' : 'rgba(255,255,255,0.3)';

            return `
<div style="display:flex;align-items:center;gap:8px;padding:7px 12px 7px 9px;background:${bgFila};border-left:${bLeft};border-bottom:1px solid rgba(255,255,255,0.025);">
    <div style="width:26px;text-align:center;flex-shrink:0;font-size:${esTop?'13px':'10px'};color:rgba(255,255,255,0.4);font-weight:${esTop?'800':'500'};font-family:'Arial Black',Arial,sans-serif;">${icono}</div>
    <div style="flex:1;min-width:0;font-size:11px;font-weight:${esTop?'700':'400'};color:${nameColor};font-family:Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.2px;">${nombre}</div>
    <div style="font-size:${esTop1?'13px':esTop?'11.5px':'10px'};font-weight:${esTop?'800':'500'};color:${ptsColor};font-family:'Arial Black',Arial,sans-serif;flex-shrink:0;min-width:32px;text-align:right;">${puntos}</div>
</div>`;
        }).join('');
    }

    // ── Podio ────────────────────────────────────────────────────
    function renderPodium() {
        const podiumImages = ['/img/messi.png', '/img/baggio.jpg', '/img/turquia.jpg'];
        // orden visual: 3ro izq, 1ro centro, 2do der
        const slots = [
            { idx: 2, color: '#CD7F32', glow: 'rgba(205,127,50,0.5)', baseH: 70, avatarS: 72, crown: '🥉', label: '3RO' },
            { idx: 0, color: '#D4AF37', glow: 'rgba(212,175,55,0.7)', baseH: 105, avatarS: 92, crown: '👑', label: '1RO' },
            { idx: 1, color: '#B0B0B0', glow: 'rgba(176,176,176,0.5)', baseH: 84, avatarS: 80, crown: '🥈', label: '2DO' }
        ];

        return `<div style="display:flex;align-items:flex-end;justify-content:center;gap:14px;width:100%;">
${slots.map(({ idx, color, glow, baseH, avatarS, crown, label }) => {
    const user = top3[idx];
    if (!user) return '<div style="flex:1;min-width:0;"></div>';
    const nombre = (user.nombre_publico || user.nombre || 'Usuario').substring(0, 12);
    const pts    = Number(user.puntos_totales) || 0;
    const isFirst = idx === 0;
    return `
<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;max-width:180px;">
    <div style="font-size:${isFirst?'20px':'16px'};line-height:1;margin-bottom:5px;filter:drop-shadow(0 0 8px ${glow});">${crown}</div>
    <div style="width:${avatarS}px;height:${avatarS}px;border-radius:50%;border:2.5px solid ${color};box-shadow:0 0 22px ${glow}, inset 0 0 10px rgba(0,0,0,0.4);overflow:hidden;background:#0d0d0d;flex-shrink:0;margin-bottom:7px;position:relative;">
        <img src="${podiumImages[idx]}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;display:block;">
        <div style="position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 -8px 16px rgba(0,0,0,0.5);pointer-events:none;"></div>
    </div>
    <div style="font-size:${isFirst?'11px':'9.5px'};font-weight:700;color:#fff;text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;margin-bottom:8px;font-family:Arial,sans-serif;letter-spacing:0.3px;">${nombre}</div>
    <div style="width:100%;height:${baseH}px;background:linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.35) 100%);border:1.5px solid ${color};border-bottom:none;border-radius:10px 10px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;position:relative;overflow:hidden;box-shadow:0 -4px 16px ${glow};">
        <div style="position:absolute;top:0;left:4px;right:4px;height:1.5px;background:${color};opacity:0.6;border-radius:1px;"></div>
        <div style="position:absolute;top:6px;left:6px;width:12px;height:40%;background:linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 100%);border-radius:2px;pointer-events:none;"></div>
        <div style="font-size:${isFirst?'32px':'26px'};font-weight:900;color:${color};font-family:'Arial Black',Arial,sans-serif;line-height:1;">${pts}</div>
        <div style="font-size:7.5px;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:2px;font-weight:600;">${label}</div>
    </div>
</div>`;
}).join('')}
</div>`;
    }

    // ── Contenedor 1080×1350 ─────────────────────────────────────
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-9999px;top:0;width:1080px;height:1350px;overflow:hidden;font-family:'Segoe UI','Arial Black',Arial,sans-serif;`;

    el.innerHTML = `
<div style="width:1080px;height:1350px;background:#060606;position:relative;overflow:hidden;display:flex;">

    <!-- ═══════════ FONDO ═══════════ -->
    <div style="position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0.06;background:
        repeating-linear-gradient(-28deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 40.5px),
        repeating-linear-gradient(28deg, transparent, transparent 40px, rgba(255,255,255,0.2) 40px, rgba(255,255,255,0.2) 40.5px);
    "></div>

    <div style="position:absolute;top:-120px;right:-80px;width:700px;height:700px;z-index:0;pointer-events:none;background:radial-gradient(ellipse at center, rgba(212,175,55,0.12) 0%, transparent 70%);border-radius:50%;"></div>
    <div style="position:absolute;bottom:-100px;left:-60px;width:600px;height:600px;z-index:0;pointer-events:none;background:radial-gradient(ellipse at center, rgba(30,100,200,0.1) 0%, transparent 70%);border-radius:50%;"></div>
    <div style="position:absolute;top:35%;right:15%;width:400px;height:400px;z-index:0;pointer-events:none;background:radial-gradient(ellipse at center, rgba(180,60,120,0.06) 0%, transparent 70%);border-radius:50%;"></div>

    <!-- Partículas -->
    <div style="position:absolute;inset:0;z-index:0;pointer-events:none;">
        <div style="position:absolute;top:8%;left:18%;width:3px;height:3px;background:rgba(255,255,255,0.5);border-radius:50%;box-shadow:0 0 4px rgba(255,255,255,0.3);"></div>
        <div style="position:absolute;top:15%;left:80%;width:2px;height:2px;background:rgba(212,175,55,0.6);border-radius:50%;box-shadow:0 0 5px rgba(212,175,55,0.4);"></div>
        <div style="position:absolute;top:72%;left:10%;width:3px;height:3px;background:rgba(255,255,255,0.4);border-radius:50%;box-shadow:0 0 4px rgba(255,255,255,0.2);"></div>
        <div style="position:absolute;top:60%;left:88%;width:2px;height:2px;background:rgba(100,170,255,0.6);border-radius:50%;box-shadow:0 0 6px rgba(100,170,255,0.4);"></div>
        <div style="position:absolute;top:22%;left:6%;width:2px;height:2px;background:rgba(212,175,55,0.5);border-radius:50%;box-shadow:0 0 5px rgba(212,175,55,0.3);"></div>
        <div style="position:absolute;top:85%;left:75%;width:2px;height:2px;background:rgba(255,255,255,0.45);border-radius:50%;box-shadow:0 0 4px rgba(255,255,255,0.2);"></div>
    </div>

    <!-- Línea divisoria -->
    <div style="position:absolute;left:270px;top:0;bottom:0;width:1px;z-index:1;pointer-events:none;background:linear-gradient(180deg, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0.08) 40%, rgba(100,170,255,0.08) 70%, rgba(100,170,255,0.2) 100%);"></div>
    <div style="position:absolute;left:269px;top:0;bottom:0;width:3px;z-index:1;pointer-events:none;background:linear-gradient(180deg, transparent 0%, rgba(212,175,55,0.25) 15%, transparent 50%, rgba(100,170,255,0.15) 85%, transparent 100%);filter:blur(3px);"></div>

    <!-- ═══════════ TABLA IZQUIERDA ═══════════ -->
    <div style="position:relative;z-index:2;flex:0 0 270px;width:270px;display:flex;flex-direction:column;background:rgba(6,6,6,0.7);backdrop-filter:blur(2px);">
        <div style="padding:18px 14px 14px;border-bottom:1px solid rgba(212,175,55,0.2);background:linear-gradient(180deg, rgba(212,175,55,0.08) 0%, rgba(0,0,0,0.3) 100%);position:relative;">
            <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.5) 20%, rgba(212,175,55,0.5) 80%, transparent 100%);"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:3.5px;color:rgba(212,175,55,0.6);text-transform:uppercase;margin-bottom:7px;">🏆 CLASIFICACIÓN</div>
            <div style="display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:3px 12px;background:rgba(255,255,255,0.02);">${ligaNombre}</div>
            <div style="font-size:8px;color:rgba(255,255,255,0.25);margin-top:5px;letter-spacing:0.5px;">${total} jugadores</div>
        </div>
        <div style="flex:1;overflow:hidden;padding-top:4px;">${renderFilas()}</div>
        <div style="padding:10px 14px;border-top:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.3);">
            <div style="font-size:7px;color:rgba(255,255,255,0.15);letter-spacing:2px;text-align:center;">QUINIELACARRISAN</div>
        </div>
    </div>

    <!-- ═══════════ PANEL DERECHO ═══════════ -->
    <div style="position:relative;z-index:2;flex:1;min-width:0;display:flex;flex-direction:column;">

        <!-- HEADER -->
        <div style="padding:20px 30px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:relative;">
            <div style="position:absolute;top:0;left:30px;right:30px;height:1px;background:linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.4) 50%, transparent 100%);"></div>
            <div style="display:flex;align-items:center;gap:14px;">
                <img src="/img/logoblancomenu.png" crossorigin="anonymous" style="height:36px;filter:drop-shadow(0 0 10px rgba(255,255,255,0.3));">
                <div style="width:1px;height:30px;background:rgba(255,255,255,0.12);"></div>
                <div>
                    <div style="font-size:20px;font-weight:900;color:#fff;font-family:'Arial Black',Arial,sans-serif;letter-spacing:-0.5px;line-height:1.05;">TABLA DE</div>
                    <div style="font-size:20px;font-weight:900;color:#D4AF37;font-family:'Arial Black',Arial,sans-serif;letter-spacing:-0.5px;line-height:1.05;">POSICIONES</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:9px;font-weight:900;color:rgba(212,175,55,0.85);letter-spacing:2px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.2);border-radius:20px;padding:5px 16px;text-transform:uppercase;display:inline-block;margin-bottom:7px;">${ligaNombre}</div>
                <div style="font-size:9.5px;color:rgba(255,255,255,0.35);letter-spacing:0.5px;">📅 ${fechaFormateada}</div>
            </div>
        </div>

        <!-- Franja dorada -->
        <div style="height:2px;background:linear-gradient(90deg, transparent 0%, #D4AF37 30%, #FFE082 50%, #D4AF37 70%, transparent 100%);flex-shrink:0;position:relative;">
            <div style="position:absolute;inset:0;background:linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);filter:blur(4px);"></div>
        </div>

        <!-- HÉROE -->
        <div style="position:relative;flex-shrink:0;height:300px;overflow:hidden;background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(5,15,30,0.5) 60%, rgba(6,6,6,1) 100%);">
            <div style="position:absolute;top:-40px;left:50%;transform:translateX(-50%);width:500px;height:200px;background:radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%);pointer-events:none;z-index:1;"></div>
            <div style="position:absolute;bottom:-30px;left:50%;transform:translateX(-50%);width:260px;height:260px;border-radius:50%;background:radial-gradient(circle, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.05) 45%, transparent 70%);pointer-events:none;z-index:1;"></div>
            <div style="position:absolute;bottom:-20px;left:50px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle, rgba(30,100,200,0.15) 0%, transparent 70%);pointer-events:none;z-index:1;"></div>
            <div style="position:absolute;bottom:-20px;right:50px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle, rgba(30,100,200,0.15) 0%, transparent 70%);pointer-events:none;z-index:1;"></div>

            <img src="/img/olise.png" crossorigin="anonymous" style="position:absolute;bottom:-8px;left:30px;height:290px;object-fit:contain;object-position:bottom;opacity:0.9;filter:drop-shadow(-6px 0 18px rgba(0,60,150,0.4)) drop-shadow(0 0 30px rgba(0,0,0,0.5));z-index:2;">
            <img src="/img/trofeo.png" crossorigin="anonymous" style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);height:285px;object-fit:contain;object-position:bottom;opacity:1;filter:drop-shadow(0 0 35px rgba(212,175,55,0.55)) drop-shadow(0 0 10px rgba(212,175,55,0.7)) drop-shadow(0 0 60px rgba(0,0,0,0.6));z-index:3;">
            <img src="/img/diaz.png" crossorigin="anonymous" style="position:absolute;bottom:-8px;right:30px;height:290px;object-fit:contain;object-position:bottom;opacity:0.9;filter:drop-shadow(6px 0 18px rgba(0,60,150,0.4)) drop-shadow(0 0 30px rgba(0,0,0,0.5));z-index:2;">

            <div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);border:1px solid rgba(212,175,55,0.35);border-radius:20px;padding:5px 20px;font-size:8.5px;font-weight:900;letter-spacing:3.5px;color:rgba(212,175,55,0.8);text-transform:uppercase;white-space:nowrap;z-index:4;backdrop-filter:blur(4px);">⚽ COPA MUNDIAL FIFA 2026™</div>
        </div>

        <!-- PODIO -->
        <div style="padding:14px 28px 10px;flex-shrink:0;position:relative;">
            <div style="font-size:8px;font-weight:900;letter-spacing:4px;color:rgba(255,255,255,0.14);text-transform:uppercase;margin-bottom:14px;text-align:center;">PODIO ACTUAL</div>
            ${renderPodium()}
        </div>

        <!-- STATS -->
        <div style="padding:6px 28px 10px;flex-shrink:0;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
            <div style="background:linear-gradient(180deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.02) 100%);border:1px solid rgba(212,175,55,0.2);border-radius:12px;padding:14px 10px;text-align:center;position:relative;overflow:hidden;">
                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:30px;height:3px;background:#D4AF37;border-radius:2px;opacity:0.5;"></div>
                <div style="font-size:30px;font-weight:900;color:#D4AF37;font-family:'Arial Black',Arial,sans-serif;line-height:1;">${lider ? lider.puntos_totales || 0 : 0}</div>
                <div style="font-size:7.5px;color:rgba(255,255,255,0.22);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px;font-weight:600;">Líder</div>
            </div>
            <div style="background:linear-gradient(180deg, rgba(70,150,255,0.08) 0%, rgba(70,150,255,0.02) 100%);border:1px solid rgba(70,150,255,0.2);border-radius:12px;padding:14px 10px;text-align:center;position:relative;overflow:hidden;">
                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:30px;height:3px;background:#4696ff;border-radius:2px;opacity:0.5;"></div>
                <div style="font-size:30px;font-weight:900;color:#5bb3ff;font-family:'Arial Black',Arial,sans-serif;line-height:1;">${promedio}</div>
                <div style="font-size:7.5px;color:rgba(255,255,255,0.22);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px;font-weight:600;">Promedio</div>
            </div>
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 10px;text-align:center;position:relative;overflow:hidden;">
                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:30px;height:3px;background:rgba(255,255,255,0.2);border-radius:2px;opacity:0.5;"></div>
                <div style="font-size:30px;font-weight:900;color:rgba(255,255,255,0.35);font-family:'Arial Black',Arial,sans-serif;line-height:1;">${ultimo ? ultimo.puntos_totales || 0 : 0}</div>
                <div style="font-size:7.5px;color:rgba(255,255,255,0.22);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px;font-weight:600;">Mínimo</div>
            </div>
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 10px;text-align:center;position:relative;overflow:hidden;">
                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:30px;height:3px;background:rgba(212,175,55,0.4);border-radius:2px;opacity:0.5;"></div>
                <div style="font-size:30px;font-weight:900;color:rgba(255,255,255,0.45);font-family:'Arial Black',Arial,sans-serif;line-height:1;">${total}</div>
                <div style="font-size:7.5px;color:rgba(255,255,255,0.22);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px;font-weight:600;">Jugadores</div>
            </div>
        </div>

        <!-- Spacer -->
        <div style="flex:1;min-height:6px;"></div>

        <!-- FOOTER -->
        <div style="padding:16px 30px;border-top:1px solid rgba(212,175,55,0.15);background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:relative;">
            <div style="position:absolute;top:0;left:30px;right:30px;height:1px;background:linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.3) 50%, transparent 100%);"></div>
            <img src="/img/logoblancomenu.png" crossorigin="anonymous" style="height:28px;opacity:0.65;filter:drop-shadow(0 0 8px rgba(255,255,255,0.2));">
            <div style="font-size:7.5px;color:rgba(255,255,255,0.18);letter-spacing:2px;font-weight:500;">QUINIELACARRISAN.COM.VE</div>
            <div style="font-size:8px;font-weight:900;letter-spacing:2.5px;color:rgba(212,175,55,0.3);text-transform:uppercase;">CARRISÁN · 2026</div>
        </div>

    </div><!-- /panel derecho -->
</div><!-- /root -->
    `;

    document.body.appendChild(el);

    // Pequeña pausa para carga de imágenes
    await new Promise(r => setTimeout(r, 300));

    try {
        const canvas = await html2canvas(el.firstElementChild, {
            scale: 1,
            useCORS: true,
            backgroundColor: '#060606',
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