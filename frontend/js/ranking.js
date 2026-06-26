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
    const maxPts   = Number(datos[0]?.puntos_totales) || 0;
    const minPts   = Number(datos[total - 1]?.puntos_totales) || 0;
    const top3     = datos.slice(0, 3);

    const C = {
        bg:          '#0A0A0A',        // negro casi puro
        surface:     '#111111',        // negro suave
        surfaceAlt:  '#181818',        // negro elevado
        border:      '#2C2C2C',        // borde sutil
        gold:        '#C9A84C',        // dorado Carrisán (igual que --fifa-gold)
        goldBright:  '#F0C866',        // dorado brillante para highlights
        goldDim:     'rgba(201,168,76,0.15)',
        silver:      '#C0C0C0',        // plata limpia
        silverDim:   'rgba(192,192,192,0.10)',
        bronze:      '#CD7F32',        // bronce
        bronzeDim:   'rgba(205,127,50,0.12)',
        white:       '#FFFFFF',
        textMain:    '#FFFFFF',        // blanco puro
        textMuted:   '#707070',        // gris medio
        green:       '#2ECC71',        // verde clasificación
        red:         '#E74C3C',        // rojo descenso
        greenDim:    'rgba(46,204,113,0.12)',
        redDim:      'rgba(231,76,60,0.12)',
    };

    // ── FILAS TABLA ──
    function renderFilas() {
        return datos.map((user, index) => {
            const pos     = index + 1;
            const nombre  = (user.nombre_publico || user.nombre || 'Usuario').substring(0, 18);
            const puntos  = user.puntos_totales || 0;
            const bandera = obtenerCampeon(user.campeon_elegido);

            const esTop1        = pos === 1;
            const esTop2        = pos === 2;
            const esTop3        = pos === 3;
            const esAntePenultimo   = index === total - 3;
            const esPenultimo   = index === total - 2;
            const esUltimo      = index === total - 1;
            const esZonaRoja    = esPenultimo || esUltimo || esAntePenultimo;
            const displayPos    = esPenultimo ? '🚑' : String(pos);

            let badgeBg    = C.surfaceAlt;
            let badgeColor = C.textMuted;
            let ptsColor   = C.textMain;
            let rowBg      = index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
            let leftBorder = '3px solid transparent';

            if (esTop1) {
                badgeBg = C.gold; badgeColor = '#000'; ptsColor = C.gold;
                leftBorder = `3px solid ${C.green}`; rowBg = C.goldDim;
            } else if (esTop2) {
                badgeBg = C.silver; badgeColor = '#000'; ptsColor = C.silver;
                leftBorder = `3px solid ${C.green}`; rowBg = C.silverDim;
            } else if (esTop3) {
                badgeBg = C.bronze; badgeColor = '#FFF'; ptsColor = C.bronze;
                leftBorder = `3px solid ${C.green}`; rowBg = C.bronzeDim;
            } else if (esZonaRoja) {
                leftBorder = `3px solid ${C.red}`; rowBg = C.redDim; ptsColor = C.red;
            }

            return `
<div style="display:flex;align-items:center;justify-content:space-between;height:39px;padding:0 14px 0 0;background:${rowBg};border-left:${leftBorder};margin-bottom:2px;border-radius:0 6px 6px 0;">
    <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
        <div style="width:30px;height:30px;border-radius:5px;background:${badgeBg};color:${badgeColor};display:flex;align-items:center;justify-content:center;font-size:${esPenultimo ? '16px' : '12px'};font-weight:700;flex-shrink:0;font-family:'Yolk',Arial,sans-serif;letter-spacing:-0.5px;margin-left:10px;">${displayPos}</div>
        <div style="font-size:18px;line-height:1;flex-shrink:0;width:21px;text-align:center;">${bandera}</div>
        <div style="font-size:15px;font-weight:600;color:${C.textMain};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Yolk',Arial,sans-serif;letter-spacing:0.5px;">${nombre}</div>
    </div>
    <div style="font-size:18px;font-weight:700;color:${ptsColor};font-family:'Yolk',Arial,sans-serif;flex-shrink:0;min-width:42px;text-align:right;letter-spacing:-0.5px;">${puntos}</div>
</div>`;
        }).join('');
    }

    // ── PODIO VERTICAL ──
    function renderPodioItem(user, pos, imgSrc) {
        const nombre  = (user?.nombre_publico || user?.nombre || '—').substring(0, 16).toUpperCase();
        const puntos  = user?.puntos_totales || 0;
        const bandera = obtenerCampeon(user?.campeon_elegido);
        const medals  = { 1: '🥇', 2: '🥈', 3: '🥉' };
        const sizes   = { 1: { h: '88px', font: '18px', pts: '23px' },
                          2: { h: '74px',  font: '16px', pts: '19px' },
                          3: { h: '68px',  font: '14px', pts: '18px' } };
        const bgs     = { 1: C.goldDim,   2: C.silverDim,   3: C.bronzeDim  };
        const border  = { 1: C.gold,      2: C.silver,      3: C.bronze     };
        const ptsClr  = { 1: C.goldBright, 2: C.silver,      3: C.bronze     };
        const sz      = sizes[pos];
        const posLabel = pos === 1 ? '1ER LUGAR' : pos === 2 ? '2DO LUGAR' : '3ER LUGAR';

        return `
<div style="display:flex;align-items:center;gap:12px;background:${bgs[pos]};border:1px solid ${border[pos]}33;border-radius:10px;padding:10px 14px;margin-bottom:10px;height:${sz.h};box-sizing:border-box;">
    <div style="width:80px;height:80px;border-radius:50%;border:2px solid ${border[pos]};overflow:hidden;flex-shrink:0;background:${C.surfaceAlt};display:flex;align-items:center;justify-content:center;">
        ${imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:28px;">${medals[pos]}</span>`}
    </div>
    <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;color:${border[pos]};font-family:'Yolk',Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">${medals[pos]} ${posLabel}</div>
        <div style="font-size:${sz.font};font-weight:700;color:${C.white};font-family:'Yolk',Arial,sans-serif;letter-spacing:0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nombre}</div>
        <div style="font-size:13px;color:${C.textMuted};font-family:'Yolk',Arial,sans-serif;margin-top:1px;">${bandera} ${puntos} pts</div>
    </div>
    <div style="font-size:${sz.pts};font-weight:800;color:${ptsClr[pos]};font-family:'Yolk',Arial,sans-serif;letter-spacing:-1px;flex-shrink:0;">${puntos}</div>
</div>`;
    }

    // ── STATS ──
    function renderStats() {
        const stats = [
            { label: 'PUNTAJE MÁX', value: maxPts,   icon: '👑', color: C.gold   },
            { label: 'PROMEDIO',    value: promedio,  icon: '➗', color: C.silver },
            { label: 'PUNTAJE MÍN', value: minPts,   icon: '📉', color: C.red    },
            { label: 'JUGADORES',   value: total,     icon: '👥', color: C.green  },
        ];
        return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${stats.map(s => `
            <div style="background:${C.surfaceAlt};border:1px solid ${C.border};border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:24px;margin-bottom:4px;">${s.icon}</div>
                <div style="font-size:26px;font-weight:800;color:${s.color};font-family:'Yolk',Arial,sans-serif;letter-spacing:-1px;">${s.value}</div>
                <div style="font-size:12px;color:${C.textMuted};font-family:'Yolk',Arial,sans-serif;letter-spacing:1.5px;margin-top:2px;">${s.label}</div>
            </div>`).join('')}
        </div>`;
    }

    // ── ÚLTIMOS RESULTADOS: fetch los más recientes ──
    let ultimosResultados = [];
    try {
        const resPartidos = await fetch(`${CONFIG.API_URL}/partidos?estado=finalizado&limit=50`);
        if (resPartidos.ok) {
            const todos = await resPartidos.json();
            // El endpoint devuelve ASC → invertimos y tomamos los 3 últimos
            ultimosResultados = todos.slice(-3).reverse();
        }
    } catch(e) {
        console.warn('No se pudieron cargar resultados:', e);
    }

    function renderResultados() {
        if (!ultimosResultados.length) {
            return `<div style="text-align:center;padding:14px 0;font-size:12px;color:${C.textMuted};font-family:'Yolk',Arial,sans-serif;">⏳ Sin resultados disponibles</div>`;
        }
        return ultimosResultados.map(p => {
            const fecha = new Date(p.fecha);
            const fechaCorta = fecha.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' });
            const gl = p.goles_local !== null && p.goles_local !== undefined ? p.goles_local : '—';
            const gv = p.goles_visitante !== null && p.goles_visitante !== undefined ? p.goles_visitante : '—';
            const local = (p.equipo_local || '').toUpperCase();
            const visita = (p.equipo_visitante || '').toUpperCase();
            const ganLocal  = Number(gl) > Number(gv);
            const ganVisita = Number(gv) > Number(gl);
            return `
<div style="background:${C.surfaceAlt};border:1px solid ${C.border};border-radius:8px;padding:8px 10px;margin-bottom:6px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:10px;color:${C.gold};letter-spacing:1.5px;font-family:'Yolk',Arial,sans-serif;font-weight:600;">⚽ FASE DE GRUPOS</span>
        <span style="font-size:10px;color:${C.textMuted};font-family:'Yolk',Arial,sans-serif;">${fechaCorta} · FINALIZADO</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="font-size:17px;line-height:1;"></span>
                <span style="font-size:13px;font-weight:${ganLocal?'800':'500'};color:${ganLocal?C.white:C.textMuted};font-family:'Yolk',Arial,sans-serif;letter-spacing:0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${local}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:17px;line-height:1;"></span>
                <span style="font-size:13px;font-weight:${ganVisita?'800':'500'};color:${ganVisita?C.white:C.textMuted};font-family:'Yolk',Arial,sans-serif;letter-spacing:0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${visita}</span>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;background:${C.bg};border:1px solid ${C.border};border-radius:6px;padding:4px 10px;flex-shrink:0;min-width:42px;">
            <span style="font-size:16px;font-weight:800;color:${ganLocal?C.gold:C.white};font-family:'Yolk',Arial,sans-serif;line-height:1.1;">${gl}</span>
            <div style="width:16px;height:1px;background:${C.border};margin:2px 0;"></div>
            <span style="font-size:16px;font-weight:800;color:${ganVisita?C.gold:C.white};font-family:'Yolk',Arial,sans-serif;line-height:1.1;">${gv}</span>
        </div>
    </div>
</div>`;
        }).join('');
    }

    // ── IMÁGENES DEL PODIO — cámbielas manualmente ──
    const PODIO_IMG = {
        1: '/img/messi.png',   // ruta foto 1er lugar histórico
        2: '/img/baggio.jpg',   // ruta foto 2do lugar histórico
        3: '/img/turquia.jpg',   // ruta foto 3er lugar histórico
    };

    // ── CONSTRUCCIÓN DEL DOM ──
    // ── FUENTE: inyectar en DOM para html2canvas ──
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:900px;height:1600px;background:${C.bg};display:flex;font-family:'Roboto Condensed','Arial Narrow',Arial,sans-serif;overflow:hidden;`;

    // COLUMNA IZQUIERDA (60% = 540px)
    const colLeft = document.createElement('div');
    colLeft.style.cssText = `width:540px;height:1600px;display:flex;flex-direction:column;padding:28px 20px 28px 28px;box-sizing:border-box;border-right:1px solid ${C.border};`;
    colLeft.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid ${C.border};">
            <div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                <img src="/img/logomenu.png" alt="" style="max-width:100%; max-height:100%; object-fit:contain;" />
            </div>
            <div style="flex:1;">
                <div style="font-size:13px;color:${C.gold};letter-spacing:3px;font-weight:600;text-transform:uppercase;margin-bottom:4px;">COPA MUNDIAL FIFA 2026</div>
                <div style="font-size:25px;font-weight:800;color:${C.white};letter-spacing:-0.5px;line-height:1;">TABLA DE POSICIONES</div>
                <div style="font-size:12px;color:${C.textMuted};margin-top:5px;">${ligaNombre} · ${fechaFormateada}</div>
            </div>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:8px;padding-left:10px;">
            <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:2px;background:${C.green};"></div><span style="font-size:10px;color:${C.textMuted};letter-spacing:1px;">ZONA DE REGODEO</span></div>
            <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:2px;background:${C.red};"></div><span style="font-size:10px;color:${C.textMuted};letter-spacing:1px;">ZONA DE BULLYING</span></div>
        </div>
        <div style="flex:1;overflow:hidden;">${renderFilas()}</div>
        <div style="padding-top:14px;border-top:1px solid ${C.border};display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:13px;color:${C.textMuted};">TOTAL: ${total} PARTICIPANTES</div>
            <div style="font-size:13px;color:${C.gold};letter-spacing:1px;">quinielacarrisan.com.ve</div>
        </div>`;

    // COLUMNA DERECHA (40% = 360px)
    const colRight = document.createElement('div');
    colRight.style.cssText = `width:360px;height:1600px;display:flex;flex-direction:column;padding:28px 28px 28px 20px;box-sizing:border-box;gap:16px;`;
    colRight.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;height:70px;background:${C.surfaceAlt};border:1px solid ${C.border};border-radius:12px;overflow:hidden;flex-shrink:0;">
            <img src="/img/logoblancomenu.png" alt="" style="max-height:60px;max-width:90%;object-fit:contain;" />
        </div>
        <div style="position:relative;border-radius:14px;height:220px;background:${C.surfaceAlt};border:1px solid ${C.border};flex-shrink:0;position:relative;">
            <img src="/img/diaz.png" alt="" style="position:absolute;bottom: 0px;right:-15px;height:240px;object-fit:contain;z-index:2;filter:drop-shadow(0 0 30px rgba(201,168,76,0.5)) drop-shadow(-3px -3px 0px rgba(0,0,0,0.9));" crossorigin="anonymous"/>
            <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,10,10,0.97) 0%,rgba(10,10,10,0.80) 40%,rgba(10,10,10,0.0) 100%);z-index:1;border-radius:14px;"></div>
            <div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:3;padding:16px 20px;display:flex;flex-direction:column;justify-content:flex-end;">
                <div style="display:inline-flex;align-items:center;gap:6px;background:${C.gold};color:#000;font-size:12px;font-weight:700;letter-spacing:2px;padding:4px 10px;border-radius:4px;margin-bottom:8px;width:fit-content;">🏆 RANKING</div>
                <div style="font-size:14px;color:${C.gold};font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">TABLA DE POSICIONES</div>
                <div style="font-size:40px;font-weight:900;color:${C.white};line-height:0.95;letter-spacing:2px;text-transform:uppercase;font-family:'Yolk',Arial,sans-serif;">RESUMEN</div>
                <div style="font-size:40px;font-weight:900;color:${C.gold};line-height:0.95;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;font-family:'Yolk',Arial,sans-serif;">JORNADA</div>
                <div style="font-size:14px;color:rgba(255,255,255,0.5);letter-spacing:1px;">${fechaFormateada}</div>
            </div>
        </div>
        <div style="flex-shrink:0;">
            <div style="font-size:13px;color:${C.gold};letter-spacing:3px;font-weight:600;margin-bottom:10px;">🏆 LÍDERES ACTUALES</div>
            ${renderPodioItem(top3[0], 1, PODIO_IMG[1])}
            ${renderPodioItem(top3[1], 2, PODIO_IMG[2])}
            ${renderPodioItem(top3[2], 3, PODIO_IMG[3])}
        </div>
        <div style="flex:1;">
            <div style="font-size:13px;color:${C.gold};letter-spacing:3px;font-weight:600;margin-bottom:10px;">📊 ESTADÍSTICAS</div>
            ${renderStats()}
        </div>
        <div style="flex-shrink:0;">
            <div style="font-size:13px;color:${C.gold};letter-spacing:3px;font-weight:600;margin-bottom:8px;font-family:'Yolk',Arial,sans-serif;">🏟️ ÚLTIMOS RESULTADOS</div>
            ${renderResultados()}
        </div>
        <div style="padding-top:10px;border-top:1px solid ${C.border};text-align:center;flex-shrink:0;">
            <div style="font-size:13px;color:${C.textMuted};font-family:'Yolk',Arial,sans-serif;">El mundial al alcance de tus manos</div>
        </div>`;

    wrapper.appendChild(colLeft);
    wrapper.appendChild(colRight);
    document.body.appendChild(wrapper);

    try {
        const canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: C.bg,
            width: 900,
            height: 1600,
            logging: false,
        });

        document.body.removeChild(wrapper);
        if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);

        canvas.toBlob(blob => {
            if (!blob) { alert('Error generando imagen.'); return; }
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = `ranking-carrisán-${new Date().toISOString().slice(0,10)}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 3000);
        }, 'image/png');

    } catch (err) {
        document.body.removeChild(wrapper);
        if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        console.error('Error generando ranking:', err);
        alert('Error generando la imagen. Revisa la consola.');
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