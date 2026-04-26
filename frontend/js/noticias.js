
document.addEventListener('DOMContentLoaded', () => {
    inicializarCompartir();
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