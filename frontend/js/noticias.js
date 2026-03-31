// ============================================
// NOTICIAS.JS - Script para páginas de noticias
// Funciones: 1) Compartir  2) Próximos Partidos
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Página de noticia cargada');
    
    inicializarCompartir();
    cargarProximosPartidos();
});

// ============================================
// 1️⃣ FUNCIÓN COMPARTIR (Copiar enlace)
// ============================================
function inicializarCompartir() {
    const btnCompartir = document.querySelector('.share-btn');
    
    if (!btnCompartir) {
        console.warn('No se encontró botón compartir');
        return;
    }
    
    btnCompartir.addEventListener('click', async () => {
        const url = window.location.href;
        
        try {
            // Copiar al portapapeles
            await navigator.clipboard.writeText(url);
            mostrarExito(btnCompartir);
        } catch (error) {
            // Fallback para navegadores viejos
            copiarFallback(url);
            mostrarExito(btnCompartir);
        }
    });
}

function mostrarExito(boton) {
    const htmlOriginal = boton.innerHTML;
    
    // Cambiar a check verde
    boton.innerHTML = '<span>✅</span><span>¡Copiado!</span>';
    boton.style.background = 'rgba(0, 208, 132, 0.2)';
    boton.style.borderColor = '#00D084';
    
    // Volver a la normalidad después de 2 segundos
    setTimeout(() => {
        boton.innerHTML = htmlOriginal;
        boton.style.background = '';
        boton.style.borderColor = '';
    }, 2000);
}

function copiarFallback(texto) {
    const input = document.createElement('input');
    input.value = texto;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
}

// ============================================
// 2️⃣ PRÓXIMOS PARTIDOS
// ============================================
async function cargarProximosPartidos() {
    console.log('⚽ Cargando próximos partidos...');
    
    // Buscar el widget de "Últimas Noticias"
    const widgets = document.querySelectorAll('.widget');
    let widgetPartidos = null;
    
    widgets.forEach(widget => {
        const titulo = widget.querySelector('.widget-title');
        if (titulo && titulo.textContent.includes('Últimas Noticias')) {
            widgetPartidos = widget;
        }
    });
    
    if (!widgetPartidos) {
        console.warn('No se encontró widget de últimas noticias');
        return;
    }
    
    // Cambiar título
    const titulo = widgetPartidos.querySelector('.widget-title');
    titulo.innerHTML = '⚽ Próximos Partidos';
    
    const contenedor = widgetPartidos.querySelector('.widget-content');
    
    // Mostrar loading
    contenedor.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #666;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚽</div>
            <div>Cargando partidos...</div>
        </div>
    `;
    
    try {
        // Llamar al API (IGUAL QUE INDEX.JS)
        const response = await fetch(`${CONFIG.API_URL}/partidos?estado=pendiente&limit=3`);
        
        if (!response.ok) {
            throw new Error('Error cargando partidos');
        }
        
        const partidos = await response.json();
        
        if (partidos.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #666;">
                    No hay partidos pendientes
                </div>
            `;
            return;
        }
        
        // Renderizar partidos (MISMO ESTILO QUE INDEX.JS)
        contenedor.innerHTML = partidos.map(partido => {
            const fecha = new Date(partido.fecha_hora);
            const tiempoRestante = calcularTiempo(fecha);
            
            return `
                <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.85rem; color: #a0a0a0;">${partido.fase}</span>
                        <span style="font-size: 0.85rem; color: #a0a0a0;">${fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <strong style="color: white; font-size: 0.95rem;">${partido.equipo_local}</strong>
                        <span style="color: #FFD700; font-weight: 700;">VS</span>
                        <strong style="color: white; font-size: 0.95rem;">${partido.equipo_visitante}</strong>
                    </div>
                    <div style="text-align: center; padding: 0.5rem; background: rgba(0, 102, 204, 0.1); border-radius: 6px; font-size: 0.85rem; color: #0066CC; font-weight: 600;">
                        ⏰ ${tiempoRestante}
                    </div>
                </div>
            `;
        }).join('');
        
        console.log(`✅ ${partidos.length} partidos cargados`);
        
    } catch (error) {
        console.error('Error cargando partidos:', error);
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ff4444;">
                Error al cargar partidos
            </div>
        `;
    }
}

// ============================================
// UTILIDADES
// ============================================

function calcularTiempo(fecha) {
    const ahora = new Date();
    const diferencia = fecha - ahora;
    
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (dias > 1) {
        return `En ${dias} días`;
    } else if (dias === 1) {
        return 'Mañana';
    } else if (horas > 1) {
        return `En ${horas} horas`;
    } else if (horas === 1) {
        return 'En 1 hora';
    } else {
        return 'Muy pronto';
    }
}

// ============================================
// UTILIDADES
// ============================================

function obtenerBandera(codigo) {
    const banderas = {
        // CONCACAF
        'México': '🇲🇽', 'USA': '🇺🇸', 'Canadá': '🇨🇦', 'Costa Rica': '🇨🇷', 
        'Jamaica': '🇯🇲', 'Panamá': '🇵🇦', 'Honduras': '🇭🇳',
        
        // CONMEBOL
        'Argentina': '🇦🇷', 'Brasil': '🇧🇷', 'Uruguay': '🇺🇾', 'Colombia': '🇨🇴', 
        'Chile': '🇨🇱', 'Ecuador': '🇪🇨', 'Perú': '🇵🇪', 'Paraguay': '🇵🇾', 
        'Venezuela': '🇻🇪', 'Bolivia': '🇧🇴',
        
        // UEFA
        'España': '🇪🇸', 'Alemania': '🇩🇪', 'Francia': '🇫🇷', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 
        'Italia': '🇮🇹', 'Holanda': '🇳🇱', 'Portugal': '🇵🇹', 'Bélgica': '🇧🇪', 
        'Croacia': '🇭🇷', 'Dinamarca': '🇩🇰', 'Suiza': '🇨🇭', 'Polonia': '🇵🇱',
        
        // AFC
        'Japón': '🇯🇵', 'Corea del Sur': '🇰🇷', 'Australia': '🇦🇺', 
        'Irán': '🇮🇷', 'Arabia Saudita': '🇸🇦', 'Qatar': '🇶🇦',
        
        // CAF
        'Senegal': '🇸🇳', 'Marruecos': '🇲🇦', 'Túnez': '🇹🇳', 
        'Nigeria': '🇳🇬', 'Camerún': '🇨🇲', 'Ghana': '🇬🇭'
    };
    
    return banderas[codigo] || '⚽';
}

function formatearFecha(fecha) {
    const opciones = {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    };
    return fecha.toLocaleDateString('es', opciones);
}

console.log('✅ noticias.js listo');