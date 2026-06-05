// ===============================================
// CHAT GENERAL - QUINIELA CARRISAN
// ===============================================
// Dependencias en ranking.html:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

(function () {

    const SUPABASE_URL  = 'https://aohnbafexgwkugtfryrk.supabase.co';
    const SUPABASE_KEY  = 'sb_publishable_LG2mW2C2kgi_dZrB4C9jgw_cMywfRB8';
    const API_BASE      = 'https://quinielamundial2026.onrender.com';
    const MAX_CHARS     = 500;
    const MAX_IMG_SIZE  = 2 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    let supabaseClient  = null;
    let usuario         = null;
    let imagenPendiente = null;

    function init() {
        usuario = window.auth?.getUser();
        if (!usuario?.id) return;
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        inyectarEstilos();
        inyectarHTML();
        cachearDOM();
        bindEventos();
        cargarMensajes();
        suscribirRealtime();
    }

    function inyectarHTML() {
        const wrapper = document.getElementById('chat-general-container');
        if (!wrapper) return;
        wrapper.innerHTML = `
        <div class="cg-card">
            <div class="cg-header">
                <div class="cg-header-left">
                    <span class="cg-icon">💬</span>
                    <span class="cg-title">Chat General</span>
                    <span class="cg-badge" id="cg-badge">0</span>
                </div>
                <button class="cg-toggle" id="cg-toggle">▾</button>
            </div>
            <div class="cg-body" id="cg-body">
                <div class="cg-mensajes" id="cg-mensajes">
                    <div class="cg-loading" id="cg-loading">
                        <span class="cg-spinner"></span> Cargando mensajes...
                    </div>
                </div>
                <div class="cg-img-preview-bar" id="cg-img-preview-bar" style="display:none">
                    <img id="cg-img-preview-thumb" src="" alt="preview"/>
                    <span id="cg-img-preview-name" class="cg-img-preview-name"></span>
                    <button class="cg-img-preview-cancel" id="cg-img-cancel">✕</button>
                </div>
                <div class="cg-input-area">
                    <button class="cg-emoji-btn" id="cg-emoji-btn">😊</button>
                    <div class="cg-emoji-picker" id="cg-emoji-picker">
                        ${EMOJIS.map(e => `<button class="cg-ep-btn" data-emoji="${e}">${e}</button>`).join('')}
                    </div>
                    <button class="cg-img-btn" id="cg-img-btn" title="Adjuntar imagen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </button>
                    <input type="file" id="cg-file-input" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none"/>
                    <input type="text" class="cg-input" id="cg-input" placeholder="Escribe algo..." maxlength="${MAX_CHARS}" autocomplete="off"/>
                    <button class="cg-send-btn" id="cg-send-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            </div>
        </div>
        <div class="cg-lightbox" id="cg-lightbox" style="display:none">
            <div class="cg-lightbox-bg" id="cg-lightbox-bg"></div>
            <img class="cg-lightbox-img" id="cg-lightbox-img" src="" alt="imagen"/>
            <button class="cg-lightbox-close" id="cg-lightbox-close">✕</button>
        </div>`;
    }

    let els = {};
    function cachearDOM() {
        els.body          = document.getElementById('cg-body');
        els.mensajes      = document.getElementById('cg-mensajes');
        els.loading       = document.getElementById('cg-loading');
        els.input         = document.getElementById('cg-input');
        els.sendBtn       = document.getElementById('cg-send-btn');
        els.emojiBtn      = document.getElementById('cg-emoji-btn');
        els.emojiPicker   = document.getElementById('cg-emoji-picker');
        els.toggle        = document.getElementById('cg-toggle');
        els.badge         = document.getElementById('cg-badge');
        els.imgBtn        = document.getElementById('cg-img-btn');
        els.fileInput     = document.getElementById('cg-file-input');
        els.previewBar    = document.getElementById('cg-img-preview-bar');
        els.previewThumb  = document.getElementById('cg-img-preview-thumb');
        els.previewName   = document.getElementById('cg-img-preview-name');
        els.imgCancel     = document.getElementById('cg-img-cancel');
        els.lightbox      = document.getElementById('cg-lightbox');
        els.lightboxImg   = document.getElementById('cg-lightbox-img');
        els.lightboxBg    = document.getElementById('cg-lightbox-bg');
        els.lightboxClose = document.getElementById('cg-lightbox-close');
    }

    function bindEventos() {
        els.input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
        });
        els.sendBtn.addEventListener('click', enviarMensaje);
        els.toggle.addEventListener('click', () => {
            const min = els.body.classList.toggle('cg-hidden');
            els.toggle.textContent = min ? '▸' : '▾';
        });
        els.emojiBtn.addEventListener('click', e => {
            e.stopPropagation();
            els.emojiPicker.classList.toggle('cg-ep-visible');
        });
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
        document.addEventListener('click', () => els.emojiPicker?.classList.remove('cg-ep-visible'));
        els.imgBtn.addEventListener('click', () => els.fileInput.click());
        els.fileInput.addEventListener('change', manejarArchivo);
        els.imgCancel.addEventListener('click', cancelarImagen);
        els.lightboxBg.addEventListener('click', cerrarLightbox);
        els.lightboxClose.addEventListener('click', cerrarLightbox);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarLightbox(); });
    }

    function manejarArchivo(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!ALLOWED_TYPES.includes(file.type)) { mostrarError('Solo JPG, PNG, GIF o WebP'); els.fileInput.value = ''; return; }
        if (file.size > MAX_IMG_SIZE) { mostrarError('Máximo 2MB'); els.fileInput.value = ''; return; }
        const url = URL.createObjectURL(file);
        imagenPendiente = { file, previewUrl: url };
        els.previewThumb.src = url;
        els.previewName.textContent = file.name;
        els.previewBar.style.display = 'flex';
        els.input.placeholder = 'Agrega un comentario (opcional)...';
        els.input.focus();
    }

    function cancelarImagen() {
        if (imagenPendiente) URL.revokeObjectURL(imagenPendiente.previewUrl);
        imagenPendiente = null;
        els.fileInput.value = '';
        els.previewBar.style.display = 'none';
        els.previewThumb.src = '';
        els.input.placeholder = 'Escribe algo...';
    }

    async function subirImagen(file) {
        const formData = new FormData();
        formData.append('imagen', file);
        const headers = { 'x-usuario-id': localStorage.getItem('quiniela_id') };
        const res = await fetch(`${API_BASE}/api/chat/imagen`, { method: 'POST', headers, body: formData });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error subiendo imagen'); }
        const data = await res.json();
        return data.url;
    }

    async function enviarMensaje() {
        const texto = els.input.value.trim();
        if (!texto && !imagenPendiente) return;
        setEnviando(true);
        try {
            let imagen_url = null;
            if (imagenPendiente) { imagen_url = await subirImagen(imagenPendiente.file); cancelarImagen(); }
            const res = await fetch(`${API_BASE}/api/chat/mensajes`, {
                method: 'POST',
                headers: window.auth.getAuthHeaders(),
                body: JSON.stringify({ mensaje: texto || '', imagen_url })
            });
            if (!res.ok) { const err = await res.json(); mostrarError(err.error || 'Error enviando'); return; }
            els.input.value = '';
            els.input.placeholder = 'Escribe algo...';
        } catch (err) {
            console.error('Error enviando:', err);
            mostrarError(err.message || 'Sin conexión');
        } finally {
            setEnviando(false);
            els.input.focus();
        }
    }

    function setEnviando(v) {
        els.sendBtn.disabled = v;
        els.input.disabled   = v;
        els.imgBtn.disabled  = v;
    }

    async function eliminarMensaje(id) {
        if (!confirm('¿Eliminar este mensaje?')) return;
        try {
            const res = await fetch(`${API_BASE}/api/chat/mensajes/${id}`, { method: 'DELETE', headers: window.auth.getAuthHeaders() });
            if (res.ok) { document.getElementById(`cg-msg-${id}`)?.remove(); actualizarBadge(); }
        } catch (err) { console.error('Error eliminando:', err); }
    }

    async function cargarMensajes() {
        try {
            const res = await fetch(`${API_BASE}/api/chat/mensajes`);
            const data = await res.json();
            els.loading?.remove();
            if (!data.mensajes?.length) { mostrarVacio(); return; }
            data.mensajes.forEach(m => renderMensaje(m, false));
            actualizarBadge();
            scrollAbajo(true);
        } catch (err) {
            console.error('Error cargando:', err);
            if (els.loading) els.loading.textContent = 'Error cargando mensajes.';
        }
    }

    function suscribirRealtime() {
        supabaseClient.channel('chat_mensajes_cambios')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes' }, payload => {
                if (document.getElementById(`cg-msg-${payload.new.id}`)) return;
                quitarVacio();
                renderMensaje(payload.new, true);
                actualizarBadge();
                scrollAbajo(false);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensajes' }, payload => {
                document.getElementById(`cg-msg-${payload.old.id}`)?.remove();
                actualizarBadge();
            })
            .subscribe();
    }

    function renderMensaje(m, animado) {
        console.log('mensaje recibido:', m);
        const esMio   = m.usuario_id?.toString() === usuario.id?.toString();
        const esAdmin = usuario.isAdmin;
        const hora    = formatHora(m.created_at);

        const div = document.createElement('div');
        div.id        = `cg-msg-${m.id}`;
        div.className = `cg-mensaje ${esMio ? 'cg-mio' : 'cg-otro'} ${animado ? 'cg-animado' : ''}`;

        let inner = '';
        if (!esMio) inner += `<span class="cg-nombre">${escapeHTML(m.usuario_nombre)}</span>`;
        if (m.imagen_url) {
            const esGif = m.imagen_url.toLowerCase().includes('.gif');
            inner += `<div class="cg-img-wrap"><img class="cg-img-burbuja${esGif ? ' cg-gif' : ''}" src="${escapeHTML(m.imagen_url)}" alt="imagen" loading="lazy" data-src="${escapeHTML(m.imagen_url)}"/></div>`;
        }
        if (m.mensaje) inner += `<span class="cg-texto">${escapeHTML(m.mensaje)}</span>`;
        inner += `<div class="cg-meta"><span class="cg-hora">${hora}</span>${esAdmin ? `<button class="cg-del-btn">🗑</button>` : ''}</div>`;

        div.innerHTML = `<div class="cg-burbuja">${inner}</div>`;

        const img = div.querySelector('.cg-img-burbuja');
        if (img) img.addEventListener('click', () => abrirLightbox(img.dataset.src));
        if (esAdmin) div.querySelector('.cg-del-btn').addEventListener('click', () => eliminarMensaje(m.id));

        els.mensajes.appendChild(div);
    }

    function abrirLightbox(src) {
        els.lightboxImg.src = src;
        els.lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function cerrarLightbox() {
        els.lightbox.style.display = 'none';
        els.lightboxImg.src = '';
        document.body.style.overflow = '';
    }

    function mostrarVacio() {
        if (document.getElementById('cg-vacio')) return;
        const p = document.createElement('p');
        p.id = 'cg-vacio'; p.className = 'cg-vacio';
        p.textContent = '¡Sé el primero en escribir algo! 👇';
        els.mensajes.appendChild(p);
    }

    function quitarVacio() { document.getElementById('cg-vacio')?.remove(); }

    function scrollAbajo(forzar) {
        const el = els.mensajes;
        const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (forzar || cerca) setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 50);
    }

    function actualizarBadge() {
        els.badge.textContent = els.mensajes.querySelectorAll('.cg-mensaje').length;
    }

    function formatHora(ts) {
        const d = new Date(ts);
        const fecha = d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
        const hora  = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
        return `${fecha} ${hora}`;
    }

    function escapeHTML(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function mostrarError(msg) {
        const t = document.createElement('div');
        t.className = 'cg-toast'; t.textContent = '⚠️ ' + msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    const EMOJIS = ['😂','🤣','😭','😅','😬','🫠','😎','🤔','😱','🥶',
                '😤','🤦‍♂️','🥲','👑','🏆','🎉','🔥','⚽','💪','👏','🙏',
                '👋','🫡','👻','👀','💀','🫪','💩','🫩'];

    function inyectarEstilos() {
        if (document.getElementById('cg-styles')) return;
        const style = document.createElement('style');
        style.id = 'cg-styles';
        style.textContent = `
        .cg-card { background:var(--dark-card,#1a1a1a); border:1px solid rgba(255,215,0,0.15); overflow:hidden; margin-top:24px; font-family:inherit; }
        .cg-header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:rgba(255,215,0,0.05); border-bottom:1px solid rgba(255,215,0,0.1); }
        .cg-header-left { display:flex; align-items:center; gap:8px; }
        .cg-icon { font-size:16px; }
        .cg-title { font-size:14px; font-weight:600; color:var(--fifa-gold,#FFD700); letter-spacing:0.03em; text-transform:uppercase; }
        .cg-badge { background:rgba(255,215,0,0.15); color:var(--fifa-gold,#FFD700); font-size:11px; font-weight:600; padding:1px 7px; border-radius:20px; min-width:20px; text-align:center; }
        .cg-toggle { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; font-size:16px; padding:2px 6px; border-radius:4px; transition:color 0.2s; }
        .cg-toggle:hover { color:rgba(255,255,255,0.8); }
        .cg-body { display:flex; flex-direction:column; }
        .cg-body.cg-hidden { display:none; }
        .cg-mensajes { height:340px; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px; scroll-behavior:smooth; }
        .cg-mensajes::-webkit-scrollbar { width:4px; }
        .cg-mensajes::-webkit-scrollbar-thumb { background:rgba(255,215,0,0.2); border-radius:2px; }
        .cg-loading { display:flex; align-items:center; gap:8px; color:rgba(255,255,255,0.4); font-size:13px; margin:auto; }
        .cg-spinner { width:14px; height:14px; border:2px solid rgba(255,215,0,0.2); border-top-color:var(--fifa-gold,#FFD700); border-radius:50%; display:inline-block; animation:cg-spin 0.8s linear infinite; }
        @keyframes cg-spin { to { transform:rotate(360deg); } }
        .cg-vacio { color:rgba(255,255,255,0.3); font-size:13px; text-align:center; margin:auto; }
        .cg-mensaje { display:flex; max-width:75%; }
        .cg-mensaje.cg-mio  { align-self:flex-end; }
        .cg-mensaje.cg-otro { align-self:flex-start; }
        @keyframes cg-entrada { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .cg-animado { animation:cg-entrada 0.2s ease; }
        .cg-burbuja { padding:8px 12px; border-radius:14px; font-size:13.5px; line-height:1.45; word-break:break-word; }
        .cg-mio  .cg-burbuja { background:var(--fifa-blue,#0066CC); color:#fff; border-bottom-right-radius:4px; }
        .cg-otro .cg-burbuja { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.9); border-bottom-left-radius:4px; }
        .cg-nombre { display:block; font-size:11px; font-weight:600; color:var(--fifa-gold,#FFD700); margin-bottom:3px; }
        .cg-texto { display:block; }
        .cg-meta { display:flex; align-items:center; gap:6px; margin-top:4px; justify-content:flex-end; }
        .cg-hora { font-size:10px; opacity:0.45; }
        .cg-del-btn { background:none; border:none; cursor:pointer; font-size:11px; opacity:0; padding:0; transition:opacity 0.15s; line-height:1; }
        .cg-burbuja:hover .cg-del-btn { opacity:0.6; }
        .cg-del-btn:hover { opacity:1 !important; }
        .cg-img-wrap { margin:4px 0 6px; border-radius:8px; overflow:hidden; max-width:220px; }
        .cg-img-burbuja { display:block; width:100%; max-width:220px; max-height:200px; object-fit:cover; border-radius:8px; cursor:zoom-in; transition:opacity 0.15s; }
        .cg-img-burbuja:hover { opacity:0.88; }
        .cg-gif { object-fit:contain; background:rgba(0,0,0,0.2); }
        .cg-img-preview-bar { display:flex; align-items:center; gap:10px; padding:8px 16px; border-top:1px solid rgba(255,255,255,0.06); background:rgba(255,215,0,0.04); }
        .cg-img-preview-bar img { width:40px; height:40px; object-fit:cover; border-radius:6px; border:1px solid rgba(255,215,0,0.2); }
        .cg-img-preview-name { flex:1; font-size:12px; color:rgba(255,255,255,0.5); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cg-img-preview-cancel { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; font-size:14px; padding:4px; border-radius:4px; transition:color 0.15s; }
        .cg-img-preview-cancel:hover { color:#ff7070; }
        .cg-input-area { display:flex; align-items:center; gap:8px; padding:12px 16px; border-top:1px solid rgba(255,255,255,0.06); position:relative; }
        .cg-emoji-btn { background:none; border:none; font-size:18px; cursor:pointer; padding:4px; border-radius:6px; transition:transform 0.15s; flex-shrink:0; }
        .cg-emoji-btn:hover { transform:scale(1.15); }
        .cg-img-btn { background:none; border:none; color:rgba(255,255,255,0.45); cursor:pointer; padding:4px; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:color 0.15s,transform 0.15s; }
        .cg-img-btn:hover { color:var(--fifa-gold,#FFD700); transform:scale(1.1); }
        .cg-img-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .cg-emoji-picker { display:none; position:absolute; bottom:calc(100% + 6px); left:12px; background:var(--dark-card,#1a1a1a); border:1px solid rgba(255,215,0,0.2); border-radius:10px; padding:10px; flex-wrap:wrap; width:228px; gap:4px; z-index:100; box-shadow:0 8px 24px rgba(0,0,0,0.5); opacity:0; pointer-events:none; transform:translateY(4px); transition:opacity 0.15s,transform 0.15s; }
        .cg-emoji-picker.cg-ep-visible { opacity:1; pointer-events:all; transform:translateY(0); display:flex; }
        .cg-ep-btn { background:none; border:none; font-size:20px; cursor:pointer; width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center; transition:background 0.1s; }
        .cg-ep-btn:hover { background:rgba(255,255,255,0.1); }
        .cg-input { flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:20px; color:#fff; font-size:13.5px; padding:8px 14px; outline:none; transition:border-color 0.2s; font-family:inherit; }
        .cg-input:focus { border-color:rgba(255,215,0,0.4); }
        .cg-input::placeholder { color:rgba(255,255,255,0.25); }
        .cg-send-btn { background:var(--fifa-gold,#FFD700); border:none; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#000; flex-shrink:0; transition:transform 0.15s; }
        .cg-send-btn:hover { transform:scale(1.08); }
        .cg-send-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
        .cg-lightbox { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; }
        .cg-lightbox-bg { position:absolute; inset:0; background:rgba(0,0,0,0.88); cursor:zoom-out; }
        .cg-lightbox-img { position:relative; max-width:90vw; max-height:88vh; border-radius:10px; object-fit:contain; animation:cg-entrada 0.2s ease; }
        .cg-lightbox-close { position:absolute; top:16px; right:20px; background:rgba(255,255,255,0.1); border:none; color:#fff; font-size:18px; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
        .cg-lightbox-close:hover { background:rgba(255,255,255,0.2); }
        .cg-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#2a1a1a; border:1px solid rgba(255,80,80,0.3); color:#ff9090; padding:10px 18px; border-radius:8px; font-size:13px; z-index:9999; animation:cg-entrada 0.2s ease; }
        @media (max-width:600px) { .cg-mensajes{height:550px} .cg-mensaje{max-width:88%} .cg-img-burbuja{max-width:180px;max-height:160px} }
        `;
        document.head.appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();