// ─── CARGAR NOTICIAS EN WIDGET SIDEBAR ─────────────────────
async function cargarNoticiasWidget() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/noticias?limit=5`);
        const noticias = await res.json();

        const container = document.getElementById('sidebarNoticias');
        if (!container) return;

        if (!noticias.length) {
            container.innerHTML = '<p style="padding:10px; color:#999; text-align:center;">Sin noticias aún</p>';
            return;
        }

        // Mapear noticias a HTML
        container.innerHTML = noticias.map(n => {
            const timeAgo = formatTimeAgo(n.created_at);
            const thumb = getNoticiaThumb(n);
            const categoria = getNoticiaCategoria(n);

            return `
                <div class="sidebar-news-item">
                    <div class="sidebar-news-thumb-placeholder">${thumb}</div>
                    <div>
                        <span class="sidebar-news-cat">${categoria}</span>
                        <a href="index.html#noticia-${n.id}" class="sidebar-news-title">${n.titulo}</a>
                        <span class="sidebar-news-time">${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error cargando noticias widget:', err);
        const container = document.getElementById('sidebarNoticias');
        if (container) {
            container.innerHTML = '<p style="padding:10px; color:#999; text-align:center;">Error al cargar</p>';
        }
    }
}

// ─── HELPER: Obtener emoji/thumb según tipo ────────────────
function getNoticiaThumb(noticia) {
    if (noticia.tipo === 'hero') return '📰';
    if (noticia.tipo === 'secundaria') return '📌';
    if (noticia.tipo === 'partido') return '⚽';
    if (noticia.tipo === 'video') return '🎥';
    return '📄';
}

// ─── HELPER: Obtener categoría según tipo ──────────────────
function getNoticiaCategoria(noticia) {
    if (noticia.tipo === 'partido' && noticia.equipo_local) {
        return `${noticia.equipo_local} vs ${noticia.equipo_visitante}`;
    }
    if (noticia.tipo === 'video') return 'Video';
    if (noticia.tipo === 'hero') return 'Destacado';
    return 'Noticias';
}

// ─── HELPER: Formatear "hace X tiempo" ─────────────────────
function formatTimeAgo(isoDate) {
    if (!isoDate) return '';
    const fecha = new Date(isoDate);
    const ahora = new Date();
    const segundos = Math.floor((ahora - fecha) / 1000);

    if (segundos < 60) return 'Hace unos segundos';
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    const dias = Math.floor(horas / 24);
    return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

// ─── EJECUTAR AL CARGAR LA PÁGINA ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cargarNoticiasWidget();
});