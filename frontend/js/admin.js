// ===============================================
// ADMIN.JS - LIMPIO Y FUNCIONAL
// ===============================================

let partidos = [];
let usuarios = [];
let partidoActual = null;

// ===============================================
// INICIALIZAR
// ===============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar admin
    if (!auth.isAuthenticated() || !auth.isAdmin()) {
        alert('⛔ Solo administradores');
        window.location.href = 'index.html';
        return;
    }

    const user = auth.getUser();
    document.querySelector('.user-name-display').textContent = user.nombre;
    document.querySelector('.user-emoji-display').textContent = obtenerCampeon(user.campeon_elegido);

    await cargarDatos();
});

async function cargarDatos() {
    await Promise.all([
        cargarPartidos(),
        cargarUsuarios()
    ]);
}

// ===============================================
// TAB 1: RESULTADOS
// ===============================================

async function cargarPartidos() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/partidos`);
        partidos = await res.json();
        mostrarPartidos();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar partidos', 'error');
    }
}

function filtrarPartidos() {
    const filtro = document.getElementById('filterEstado').value;
    let partidosFiltrados = partidos;
    
    if (filtro !== 'all') {
        partidosFiltrados = partidos.filter(p => p.estado === filtro);
    }
    
    mostrarPartidos(partidosFiltrados);
}

function mostrarPartidos(lista = partidos) {
    const container = document.getElementById('partidosList');
    
    if (lista.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-gray);">No hay partidos</p>';
        return;
    }
    
    container.innerHTML = lista.map(p => {
        const fecha = new Date(p.fecha).toLocaleDateString('es', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const tieneMarcador = p.goles_local_real !== null;
        
        return `
            <div class="partido-item">
                <div class="partido-info">
                    <h4>${p.equipo_local} vs ${p.equipo_visitante}</h4>
                    <div class="partido-meta">
                        ${p.fase} • ${fecha} • ${p.estado}
                        ${tieneMarcador ? `<br><strong style="color:var(--fifa-gold)">Resultado: ${p.goles_local_real} - ${p.goles_visitante_real}</strong>` : ''}
                    </div>
                </div>
                <div class="partido-actions">
                    <button class="btn-table btn-primary" onclick="abrirModalResultado(${p.id})">
                        ${tieneMarcador ? '✏️ Modificar' : '📝 Ingresar'}
                    </button>
                    ${tieneMarcador ? `
                        <button class="btn-table btn-danger" onclick="anularResultado(${p.id})">
                            ❌ Anular
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function abrirModalResultado(partidoId) {
    partidoActual = partidos.find(p => p.id === partidoId);
    if (!partidoActual) return;
    
    const tieneMarcador = partidoActual.goles_local_real !== null;
    
    document.getElementById('modalTitle').textContent = 
        tieneMarcador ? 'Modificar Resultado' : 'Ingresar Resultado';
    
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label class="form-label">Partido</label>
            <div style="padding:1rem; background:rgba(255,255,255,0.05); border-radius:8px; text-align:center;">
                <strong>${partidoActual.equipo_local} vs ${partidoActual.equipo_visitante}</strong>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label">Resultado Final</label>
            <div class="score-row">
                <input type="number" 
                       class="score-input" 
                       id="golesLocal" 
                       min="0" 
                       max="20" 
                       value="${partidoActual.goles_local_real || ''}"
                       placeholder="0">
                <span style="font-size:2rem; color:var(--text-gray);">-</span>
                <input type="number" 
                       class="score-input" 
                       id="golesVisitante" 
                       min="0" 
                       max="20" 
                       value="${partidoActual.goles_visitante_real || ''}"
                       placeholder="0">
            </div>
        </div>
        
        <div style="display:flex; gap:1rem; margin-top:2rem;">
            <button class="btn-table btn-danger" onclick="cerrarModal()" style="flex:1; padding:1rem;">
                Cancelar
            </button>
            <button class="btn-table btn-primary" onclick="guardarResultado()" style="flex:1; padding:1rem;">
                💾 Guardar
            </button>
        </div>
    `;
    
    document.getElementById('modalResultado').classList.add('show');
}

async function guardarResultado() {
    const golesLocal = parseInt(document.getElementById('golesLocal').value);
    const golesVisitante = parseInt(document.getElementById('golesVisitante').value);
    
    if (isNaN(golesLocal) || isNaN(golesVisitante)) {
        mostrarToast('⚠️ Ingresa ambos resultados', 'error');
        return;
    }
    
    try {
        const res = await fetch(`${CONFIG.API_URL}/admin/partidos/${partidoActual.id}/resultado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                goles_local: golesLocal,
                goles_visitante: golesVisitante
            })
        });
        
        if (!res.ok) throw new Error('Error al guardar');
        
        mostrarToast('✅ Resultado guardado', 'success');
        cerrarModal();
        await cargarPartidos();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('❌ Error al guardar', 'error');
    }
}

async function anularResultado(partidoId) {
    if (!confirm('¿Anular este resultado? Se recalcularán los puntos.')) return;
    
    try {
        const res = await fetch(`${CONFIG.API_URL}/admin/partidos/${partidoId}/resultado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                goles_local: null,
                goles_visitante: null,
                anular: true
            })
        });
        
        if (!res.ok) throw new Error('Error al anular');
        
        mostrarToast('✅ Resultado anulado', 'success');
        await cargarPartidos();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('❌ Error al anular', 'error');
    }
}

function cerrarModal() {
    document.getElementById('modalResultado').classList.remove('show');
    partidoActual = null;
}

// ===============================================
// TAB 2: USUARIOS
// ===============================================

async function cargarUsuarios() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/admin/usuarios`);
        const data = await res.json();
        usuarios = data.usuarios;
        
        mostrarUsuarios();
        llenarSelectUsuarios();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar usuarios', 'error');
    }
}

function mostrarUsuarios() {
    const tbody = document.getElementById('usuariosTable');
    
    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-gray);">No hay usuarios</td></tr>';
        return;
    }
    
    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.nombre}</td>
            <td><code>${u.codigo_acceso}</code></td>
            <td><strong>${u.puntos_totales}</strong></td>
            <td>
                <span style="color:${u.esta_activo ? 'var(--success)' : 'var(--error)'}">
                    ${u.esta_activo ? '✅ Activo' : '❌ Inactivo'}
                </span>
            </td>
            <td>
                <label class="toggle-switch">
                    <input type="checkbox" 
                           ${u.esta_activo ? 'checked' : ''} 
                           onchange="toggleUsuario(${u.id}, this.checked)">
                    <span class="toggle-slider"></span>
                </label>
            </td>
        </tr>
    `).join('');
}

async function toggleUsuario(userId, activo) {
    try {
        const res = await fetch(`${CONFIG.API_URL}/usuarios/${userId}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo })
        });
        
        if (!res.ok) throw new Error('Error');
        
        mostrarToast(`✅ Usuario ${activo ? 'activado' : 'desactivado'}`, 'success');
        await cargarUsuarios();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('❌ Error al actualizar', 'error');
        await cargarUsuarios();
    }
}

// ===============================================
// TAB 3: PREDICCIONES
// ===============================================

function llenarSelectUsuarios() {
    const select = document.getElementById('selectUsuarioPred');
    select.innerHTML = '<option value="">Selecciona un usuario</option>' +
        usuarios.map(u => `<option value="${u.id}">${u.nombre} (${u.codigo_acceso})</option>`).join('');
}

async function cargarPrediccionesUsuario() {
    const userId = document.getElementById('selectUsuarioPred').value;
    const tbody = document.getElementById('prediccionesTable');
    
    if (!userId) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-gray);">Selecciona un usuario</td></tr>';
        return;
    }
    
    try {
        const res = await fetch(`${CONFIG.API_URL}/predicciones/${userId}`);
        const predicciones = await res.json();
        
        if (predicciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-gray);">Sin predicciones</td></tr>';
            return;
        }
        
        tbody.innerHTML = predicciones.map(p => `
            <tr>
                <td>${p.equipo_local} vs ${p.equipo_visitante}</td>
                <td><strong style="color:var(--fifa-gold)">${p.goles_local_pred} - ${p.goles_visitante_pred}</strong></td>
                <td>${p.puntos_obtenidos !== null ? p.puntos_obtenidos : '-'}</td>
                <td>
                    <button class="btn-table btn-danger" onclick="eliminarPrediccion(${p.id})">
                        🗑️ Eliminar
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar predicciones', 'error');
    }
}

async function eliminarPrediccion(predId) {
    if (!confirm('¿Eliminar esta predicción?')) return;
    
    try {
        const res = await fetch(`${CONFIG.API_URL}/admin/predicciones/${predId}`, {
            method: 'DELETE'
        });
        
        if (!res.ok) throw new Error('Error');
        
        mostrarToast('✅ Predicción eliminada', 'success');
        await cargarPrediccionesUsuario();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('❌ Error al eliminar', 'error');
    }
}

// ===============================================
// TABS
// ===============================================

function cambiarTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ===============================================
// UTILIDADES
// ===============================================

function mostrarToast(mensaje, tipo) {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.className = `toast ${tipo}`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}