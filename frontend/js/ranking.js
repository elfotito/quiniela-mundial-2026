// ===============================================
// RANKING.JS - CON PODIO DINÁMICO Y COMPARTIR
// ===============================================

let usuario = null;
let rankingCompleto = [];
let rankingFiltrado = [];
let ligasDisponibles = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    usuario = auth.getUser();
    console.log('👑 Ranking cargando...');
    
    configurarUI();
    
    await Promise.all([
        cargarLigas(),
        cargarRankingCompleto()
    ]);
    
    configurarEventos();
});

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
    const promesas = rankingCompleto.map(async (user) => {
        try {
            const response = await fetch(`${CONFIG.API_URL}/usuarios/${user.usuario_id}/ligas`);
            if (response.ok) {
                const ligasUsuario = await response.json();
                user.ligas = ligasUsuario.map(l => l.liga_id || l.id);
            } else {
                user.ligas = [];
            }
        } catch (error) {
            console.error(`Error cargando ligas para usuario ${user.usuario_id}:`, error);
            user.ligas = [];
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
        podiumSection.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 2rem;">No hay participantes</p>';
        return;
    }
    
    if (ranking.length < 3) {
        podiumSection.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 2rem;">Aún no hay suficientes participantes</p>';
        return;
    }
    
    const top3 = ranking.slice(0, 3);
    const medallas = ['🥈', '🥇', '🥉'];
    const images = [
    'img/baggio.jpg',   // 2do lugar (posición visual izquierda)
    'img/messi.png',   // 1er lugar (posición visual centro)
    'img/turquia.jpg'    // 3er lugar (posición visual derecha)
    ];
    const posiciones = [1, 0, 2]; // Orden visual: 2do, 1ro, 3ro
    const clases = ['second', 'first', 'third'];
    
    const podiumHTML = `
        <div class="podium-container">
            ${posiciones.map((index, displayIndex) => {
                const user = top3[index];
                if (!user) return '';
                
                return `
                    <div class="podium-place ${clases[displayIndex]}">
                        <div class="podium-image">
                            <img src="${images[displayIndex]}" alt="podio" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
                        </div>
                        <div class="podium-medal">${medallas[displayIndex]}</div>
                        <div class="podium-name">${user.nombre_publico || user.nombre || 'Usuario'}</div>
                        <div class="podium-liga">
                            ${obtenerIconoLigaPrincipal(user.ligas)}
                            ${obtenerLigaPrincipal(user.ligas)}
                        </div>
                        <div class="podium-points">${user.puntos_totales || 0}</div>
                        <div class="podium-label">Puntos</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    podiumSection.innerHTML = podiumHTML;
}

// ===============================================
// MOSTRAR TABLA DE RANKING
// ===============================================

function mostrarTablaRanking(ranking) {
    const tbody = document.getElementById('rankingTableBody');
    if (!tbody) return;
    
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
        
        const fases = ['grupos', '16avos', '8vos', '4tos', 'semis', 'tercer_puesto', 'final'];
        
        return `
            <tr class="${claseFila}">
                <td class="td-pos">${obtenerMedallaPosicion(posicion)}</td>
                <td>
                    <div class="user-cell">
                        <!-- PUEDE SERVIR PARA METER LAS BANDERAS DEL EQUIPO CAMPEON <span class="user-flag">${obtenerBandera(user.campeon_elegido)}</span> -->
                        <span class="user-nametable">${user.nombre_publico || user.nombre || 'Usuario'}</span>
                    </div>
                </td>
                <td>
                    <span class="liga-badge">
                        ${obtenerIconoLigaPrincipal(user.ligas)}
                        ${obtenerLigaPrincipal(user.ligas)}
                    </span>
                </td>
                ${fases.map(fase => {
                    const puntos = user[`puntos_${fase}`] || 0;
                    return `<td class="td-fase ${puntos > 0 ? 'has-points' : ''}">${puntos}</td>`;
                }).join('')}
                <td class="td-total">${user.puntos_totales || 0}</td>
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

function obtenerMedallaPosicion(posicion) {
    switch(posicion) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return posicion;
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
    
    const ligaId = Array.isArray(ligas) ? ligas[0] : ligas;
    const liga = ligasDisponibles.find(l => l.id === ligaId);
    
    return liga ? (liga.icono || '🏅') : '🏅';
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

function mostrarToast(mensaje, tipo) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: var(--dark-card);
        border: 2px solid ${tipo === 'success' ? 'var(--success)' : 'var(--error)'};
        color: ${tipo === 'success' ? 'var(--success)' : 'var(--error)'};
        padding: 1rem 1.5rem;
        border-radius: 10px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

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

// Hacer funciones globales
window.logout = logout;
window.compartirRanking = compartirRanking;
window.compartirComoImagen = compartirComoImagen;