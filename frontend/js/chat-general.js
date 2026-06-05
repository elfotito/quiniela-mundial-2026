// ===============================================
// 💬 CHAT GENERAL - QUINIELA CARRISAN
// ===============================================
// Dependencia: Supabase JS CDN (agregar en ranking.html)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

(function () {

    // ── CONFIGURACIÓN ──────────────────────────────
    const SUPABASE_URL  = 'https://aohnbafexgwkugtfryrk.supabase.co';
    const SUPABASE_KEY  = 'sb_publishable_LG2mW2C2kgi_dZrB4C9jgw_cMywfRB8'; // sb_publishable_...
    const API_BASE      = 'https://quinielamundial2026.onrender.com';
    const MAX_CHARS     = 500;

    // ── ESTADO ─────────────────────────────────────
    let supabaseClient  = null;
    let realtimeChannel = null;
    let usuario         = null;

    // ── INIT ───────────────────────────────────────
    function init() {
        usuario = window.auth?.getUser();
        if (!usuario?.id) return; // no autenticado

        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        inyectarEstilos();
        inyectarHTML();
        cachearDOM();
        bindEventos();
        cargarMensajes();
        suscribirRealtime();
    }

    // ── HTML ───────────────────────────────────────
    function inyectarHTML() {
        const wrapper = document.getElementById('chat-general-container');
        if (!wrapper) return;

        wrapper.innerHTML = `
        <div class="cg-card">
            <div class="cg-header">
                <div class="cg-header-left">
                    <span class="cg-icon">💬</span>
                    <span class="cg-title">Chat Mundial</span>
                    <span class="cg-badge" id="cg-badge">0</span>
                </div>
                <button class="cg-toggle" id="cg-toggle" title="Minimizar">▾</button>
            </div>

            <div class="cg-body" id="cg-body">
                <div class="cg-mensajes" id="cg-mensajes">
                    <div class="cg-loading" id="cg-loading">
                        <span class="cg-spinner"></span> Cargando mensajes...
                    </div>
                </div>

                <div class="cg-input-area">
                    <button class="cg-emoji-btn" id="cg-emoji-btn" title="Emojis">😊</button>
                    <div class="cg-emoji-picker" id="cg-emoji-picker">
                        ${EMOJIS.map(e => `<button class="cg-ep-btn" data-emoji="${e}">${e}</button>`).join('')}
                    </div>
                    <input
                        type="text"
                        class="cg-input"
                        id="cg-input"
                        placeholder="Escribe algo..."
                        maxlength="${MAX_CHARS}"
                        autocomplete="off"
                    />
                    <button class="cg-send-btn" id="cg-send-btn" title="Enviar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            </div>
        </div>`;
    }

    // ── DOM REFS ───────────────────────────────────
    let els = {};
    function cachearDOM() {
        els.body        = document.getElementById('cg-body');
        els.mensajes    = document.getElementById('cg-mensajes');
        els.loading     = document.getElementById('cg-loading');
        els.input       = document.getElementById('cg-input');
        els.sendBtn     = document.getElementById('cg-send-btn');
        els.emojiBtn    = document.getElementById('cg-emoji-btn');
        els.emojiPicker = document.getElementById('cg-emoji-picker');
        els.toggle      = document.getElementById('cg-toggle');
        els.badge       = document.getElementById('cg-badge');
    }

    // ── EVENTOS ────────────────────────────────────
    function bindEventos() {
        // Enviar con Enter
        els.input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarMensaje();
            }
        });

        // Botón enviar
        els.sendBtn.addEventListener('click', enviarMensaje);

        // Toggle minimizar
        els.toggle.addEventListener('click', () => {
            const minimizado = els.body.classList.toggle('cg-hidden');
            els.toggle.textContent = minimizado ? '▸' : '▾';
        });

        // Emoji picker toggle
        els.emojiBtn.addEventListener('click', e => {
            e.stopPropagation();
            els.emojiPicker.classList.toggle('cg-ep-visible');
        });

        // Click en emoji
        els.emojiPicker.addEventListener('click', e => {
            const btn = e.target.closest('.cg-ep-btn');
            if (!btn) return;
            const emoji = btn.dataset.emoji;
            const pos = els.input.selectionStart;
            const val = els.input.value;
            els.input.value = val.slice(0, pos) + emoji + val.slice(pos);
            els.input.focus();
            els.input.selectionStart = els.input.selectionEnd = pos + emoji.length;
            els.emojiPicker.classList.remove('cg-ep-visible');
        });

        // Cerrar picker al hacer click afuera
        document.addEventListener('click', () => {
            els.emojiPicker?.classList.remove('cg-ep-visible');
        });
    }

    // ── CARGAR HISTORIAL ───────────────────────────
    async function cargarMensajes() {
        try {
            const res = await fetch(`${API_BASE}/api/chat/mensajes`);
            const data = await res.json();

            els.loading?.remove();

            if (!data.mensajes?.length) {
                mostrarVacio();
                return;
            }

            data.mensajes.forEach(m => renderMensaje(m, false));
            actualizarBadge(data.mensajes.length);
            scrollAbajo(true);

        } catch (err) {
            console.error('❌ Error cargando chat:', err);
            if (els.loading) els.loading.textContent = 'Error cargando mensajes.';
        }
    }

    // ── ENVIAR MENSAJE ─────────────────────────────
    async function enviarMensaje() {
        const texto = els.input.value.trim();
        if (!texto) return;

        els.sendBtn.disabled = true;
        els.input.disabled   = true;

        try {
            const res = await fetch(`${API_BASE}/api/chat/mensajes`, {
                method: 'POST',
                headers: window.auth.getAuthHeaders(),
                body: JSON.stringify({ mensaje: texto })
            });

            if (!res.ok) {
                const err = await res.json();
                mostrarError(err.error || 'Error enviando mensaje');
                return;
            }

            els.input.value = '';

        } catch (err) {
            console.error('❌ Error enviando mensaje:', err);
            mostrarError('Sin conexión al servidor');
        } finally {
            els.sendBtn.disabled = false;
            els.input.disabled   = false;
            els.input.focus();
        }
    }

    // ── ELIMINAR MENSAJE (ADMIN) ───────────────────
    async function eliminarMensaje(id) {
        if (!confirm('¿Eliminar este mensaje?')) return;

        try {
            const res = await fetch(`${API_BASE}/api/chat/mensajes/${id}`, {
                method: 'DELETE',
                headers: window.auth.getAuthHeaders()
            });

            if (res.ok) {
                document.getElementById(`cg-msg-${id}`)?.remove();
                actualizarBadge();
            }
        } catch (err) {
            console.error('❌ Error eliminando:', err);
        }
    }

    // ── REALTIME ───────────────────────────────────
    function suscribirRealtime() {
        realtimeChannel = supabaseClient
            .channel('chat_mensajes_cambios')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_mensajes' },
                payload => {
                    // Evitar duplicado si el mensaje ya fue renderizado por optimistic UI
                    if (document.getElementById(`cg-msg-${payload.new.id}`)) return;
                    quitarVacio();
                    renderMensaje(payload.new, true);
                    actualizarBadge();
                    scrollAbajo(false);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'chat_mensajes' },
                payload => {
                    document.getElementById(`cg-msg-${payload.old.id}`)?.remove();
                    actualizarBadge();
                }
            )
            .subscribe();
    }

    // ── RENDER MENSAJE ─────────────────────────────
    function renderMensaje(m, animado) {
        const esMio    = m.usuario_id?.toString() === usuario.id?.toString();
        const esAdmin  = usuario.isAdmin;
        const hora     = formatHora(m.created_at);

        const div = document.createElement('div');
        div.id        = `cg-msg-${m.id}`;
        div.className = `cg-mensaje ${esMio ? 'cg-mio' : 'cg-otro'} ${animado ? 'cg-animado' : ''}`;

        div.innerHTML = `
            <div class="cg-burbuja">
                ${!esMio ? `<span class="cg-nombre">${escapeHTML(m.usuario_nombre)}</span>` : ''}
                <span class="cg-texto">${escapeHTML(m.mensaje)}</span>
                <div class="cg-meta">
                    <span class="cg-hora">${hora}</span>
                    ${esAdmin ? `<button class="cg-del-btn" title="Eliminar">🗑</button>` : ''}
                </div>
            </div>`;

        if (esAdmin) {
            div.querySelector('.cg-del-btn').addEventListener('click', () => eliminarMensaje(m.id));
        }

        els.mensajes.appendChild(div);
    }

    // ── HELPERS ────────────────────────────────────
    function mostrarVacio() {
        if (!document.getElementById('cg-vacio')) {
            const p = document.createElement('p');
            p.id        = 'cg-vacio';
            p.className = 'cg-vacio';
            p.textContent = '¡Sé el primero en escribir algo! 👇';
            els.mensajes.appendChild(p);
        }
    }

    function quitarVacio() {
        document.getElementById('cg-vacio')?.remove();
    }

    function scrollAbajo(forzar) {
        const el = els.mensajes;
        const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (forzar || cerca) {
            setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 50);
        }
    }

    function actualizarBadge() {
        const total = els.mensajes.querySelectorAll('.cg-mensaje').length;
        els.badge.textContent = total;
    }

  function formatHora(ts) {
    const d = new Date(ts);
    const dia = d.toLocaleDateString('es-VE', { day: '2-digit' });
    const mes = d.toLocaleDateString('es-VE', { month: 'short' });
    const fecha = `${dia}-${mes}`;
    const hora  = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    return `${fecha} ${hora}`;
}

    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function mostrarError(msg) {
        const toast = document.createElement('div');
        toast.className = 'cg-toast';
        toast.textContent = '⚠️ ' + msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ── EMOJIS ─────────────────────────────────────
const EMOJIS = ['😂','🤣','😭','😅','😬','🫠','😎','🤔','😱','🥶',
                '😤','🤦‍♂️','🥲','👑','🏆','🎉','🔥','⚽','💪','👏','🙏',
                '👋','🫡','👻','👀','💀','🫪','💩','🫩'];

    // ── ESTILOS ────────────────────────────────────
    function inyectarEstilos() {
        if (document.getElementById('cg-styles')) return;
        const style = document.createElement('style');
        style.id = 'cg-styles';
        style.textContent = `
        /* ── CARD ── */
        .cg-card {
            background: var(--dark-card, #1a1a1a);
            border: 1px solid rgba(255,215,0,0.15);
            border-radius: 12px;
            overflow: hidden;
            margin-top: 24px;
            font-family: inherit;
        }

        /* ── HEADER ── */
        .cg-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 18px;
            background: rgba(255,215,0,0.05);
            border-bottom: 1px solid rgba(255,215,0,0.1);
        }
        .cg-header-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .cg-icon { font-size: 16px; }
        .cg-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--fifa-gold, #FFD700);
            letter-spacing: 0.03em;
            text-transform: uppercase;
        }
        .cg-badge {
            background: rgba(255,215,0,0.15);
            color: var(--fifa-gold, #FFD700);
            font-size: 11px;
            font-weight: 600;
            padding: 1px 7px;
            border-radius: 20px;
            min-width: 20px;
            text-align: center;
        }
        .cg-toggle {
            background: none;
            border: none;
            color: rgba(255,255,255,0.4);
            cursor: pointer;
            font-size: 16px;
            padding: 2px 6px;
            border-radius: 4px;
            transition: color 0.2s;
        }
        .cg-toggle:hover { color: rgba(255,255,255,0.8); }

        /* ── BODY ── */
        .cg-body { display: flex; flex-direction: column; }
        .cg-body.cg-hidden { display: none; }

        /* ── MENSAJES ── */
        .cg-mensajes {
            height: 440px;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            scroll-behavior: smooth;
        }
        .cg-mensajes::-webkit-scrollbar { width: 4px; }
        .cg-mensajes::-webkit-scrollbar-track { background: transparent; }
        .cg-mensajes::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.2); border-radius: 2px; }

        .cg-loading {
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(255,255,255,0.4);
            font-size: 13px;
            margin: auto;
        }
        .cg-spinner {
            width: 14px; height: 14px;
            border: 2px solid rgba(255,215,0,0.2);
            border-top-color: var(--fifa-gold, #FFD700);
            border-radius: 50%;
            display: inline-block;
            animation: cg-spin 0.8s linear infinite;
        }
        @keyframes cg-spin { to { transform: rotate(360deg); } }

        .cg-vacio {
            color: rgba(255,255,255,0.3);
            font-size: 13px;
            text-align: center;
            margin: auto;
        }

        /* ── BURBUJAS ── */
        .cg-mensaje {
            display: flex;
            max-width: 75%;
        }
        .cg-mensaje.cg-mio  { align-self: flex-end; }
        .cg-mensaje.cg-otro { align-self: flex-start; }

        @keyframes cg-entrada {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .cg-animado { animation: cg-entrada 0.2s ease; }

        .cg-burbuja {
            padding: 8px 12px;
            border-radius: 14px;
            font-size: 13.5px;
            line-height: 1.45;
            word-break: break-word;
        }
        .cg-mio .cg-burbuja {
            background: var(--fifa-blue, #0066CC);
            color: #fff;
            border-bottom-right-radius: 4px;
        }
        .cg-otro .cg-burbuja {
            background: rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.9);
            border-bottom-left-radius: 4px;
        }

        .cg-nombre {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: var(--fifa-gold, #FFD700);
            margin-bottom: 3px;
        }
        .cg-texto { display: block; }

        .cg-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 4px;
            justify-content: flex-end;
        }
        .cg-hora {
            font-size: 10px;
            opacity: 0.45;
        }
        .cg-del-btn {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 11px;
            opacity: 0;
            padding: 0;
            transition: opacity 0.15s;
            line-height: 1;
        }
        .cg-burbuja:hover .cg-del-btn { opacity: 0.6; }
        .cg-del-btn:hover { opacity: 1 !important; }

        /* ── INPUT AREA ── */
        .cg-input-area {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            border-top: 1px solid rgba(255,255,255,0.06);
            position: relative;
        }

        .cg-emoji-btn {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 4px;
            border-radius: 6px;
            transition: transform 0.15s;
            flex-shrink: 0;
        }
        .cg-emoji-btn:hover { transform: scale(1.15); }

        .cg-emoji-picker {
            display: none;
            position: absolute;
            bottom: calc(100% + 6px);
            left: 12px;
            background: var(--dark-card, #1a1a1a);
            border: 1px solid rgba(255,215,0,0.2);
            border-radius: 10px;
            padding: 10px;
            display: flex;
            flex-wrap: wrap;
            width: 228px;
            gap: 4px;
            z-index: 100;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            opacity: 0;
            pointer-events: none;
            transform: translateY(4px);
            transition: opacity 0.15s, transform 0.15s;
        }
        .cg-emoji-picker.cg-ep-visible {
            opacity: 1;
            pointer-events: all;
            transform: translateY(0);
        }
        .cg-ep-btn {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            width: 32px; height: 32px;
            border-radius: 6px;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.1s;
        }
        .cg-ep-btn:hover { background: rgba(255,255,255,0.1); }

        .cg-input {
            flex: 1;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            color: #fff;
            font-size: 13.5px;
            padding: 8px 14px;
            outline: none;
            transition: border-color 0.2s;
            font-family: inherit;
        }
        .cg-input:focus {
            border-color: rgba(255,215,0,0.4);
        }
        .cg-input::placeholder { color: rgba(255,255,255,0.25); }

        .cg-send-btn {
            background: var(--fifa-gold, #FFD700);
            border: none;
            border-radius: 50%;
            width: 34px; height: 34px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            color: #000;
            flex-shrink: 0;
            transition: transform 0.15s, background 0.15s;
        }
        .cg-send-btn:hover { transform: scale(1.08); }
        .cg-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

        /* ── TOAST ── */
        .cg-toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: #2a1a1a;
            border: 1px solid rgba(255,80,80,0.3);
            color: #ff9090;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 9999;
            animation: cg-entrada 0.2s ease;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 600px) {
            .cg-mensajes { height: 490px; }
            .cg-mensaje  { max-width: 88%; }
        }
        `;
        document.head.appendChild(style);
    }

    // ── ARRANCAR ───────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();