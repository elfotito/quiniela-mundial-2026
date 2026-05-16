/**
 * WIDGET CARRUSEL DE NOTICIAS - MUNDIAL 2026
 * ===========================================
 * Uso en index.html:
 *   1. Incluir ANTES del cierre </body>:
 *        <script src="js/noticias-mundial.js"></script>
 *        <script src="js/noticias-widget.js"></script>
 *   2. Colocar el contenedor donde quieras el widget:
 *        <div id="noticias-widget"></div>
 *
 * El widget se inicializa solo al cargar la página.
 */

(function () {
  /* ── Imagen placeholder en base64 (gris neutro con ícono) ── */
  const PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'%3E%3Crect width='400' height='220' fill='%231a1a2e'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%230066CC' opacity='.4'%3E⚽%3C/text%3E%3C/svg%3E";

  /* ── Colores del design system del proyecto ── */
  const CSS = `
    #noticias-widget {
      --nw-blue:      #0066CC;
      --nw-dark-blue: #003d7a;
      --nw-gold:      #ffd830;
      --nw-dark:      #000000;
      --nw-card:      #000000;
      --nw-border:    rgba(0,102,204,.25);
      --nw-radius:    10px;
      --nw-gap:       14px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      position: relative;
      padding: 0;
      user-select: none;
    }

    /* ── Cabecera ── */
    .nw-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .nw-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 8px;
    }
    .nw-icon {
      width: 28px;
      height: 28px;
      background: var(--nw-blue);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
    }
    .nw-title {
      font-size: 15px;
      font-weight: 700;
      color: #000000;
      letter-spacing: 1.5px;
    }
    .nw-subtitle {
      font-size: 11px;
      color: #0052a3;
      margin-top: -4px;
    }
    .nw-nav-btns {
      display: flex;
      gap: 6px;
    }
    .nw-nav-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1px solid var(--nw-border);
      background: var(--nw-card);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: background .2s, border-color .2s;
    }
    .nw-nav-btn:hover {
      background: var(--nw-blue);
      border-color: var(--nw-blue);
    }
    .nw-nav-btn:disabled {
      opacity: .3;
      cursor: default;
    }

    /* ── Track ── */
    .nw-viewport {
      overflow: hidden;
      border-radius: var(--nw-radius);
    }
    .nw-track {
      display: flex;
      gap: var(--nw-gap);
      transition: transform .38s cubic-bezier(.4,0,.2,1);
      will-change: transform;
    }

    /* ── Tarjeta ── */
    .nw-card {
      flex: 0 0 var(--nw-card-w, 200px);
      background: var(--nw-card);
      border-radius: var(--nw-radius);
      border: 1px solid var(--nw-border);
      overflow: hidden;
      cursor: pointer;
      transition: transform .22s, box-shadow .22s, border-color .22s;
    }
    .nw-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0,102,204,.22);
      border-color: rgba(0,102,204,.6);
    }
    .nw-card-img-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16/9;
      overflow: hidden;
      background: #0a0a1a;
    }
    .nw-card-img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform .35s;
    }
    .nw-card:hover .nw-card-img-wrap img {
      transform: scale(1.05);
    }
    /* Badge de categoría sobre la imagen */
    .nw-badge {
      position: absolute;
      bottom: 8px;
      left: 8px;
      background: var(--nw-blue);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .6px;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
    }
    /* Área de texto */
    .nw-card-body {
      padding: 10px 12px 12px;
    }
    .nw-card-titulo {
      font-size: 12.5px;
      font-weight: 600;
      color: #fff;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .nw-card-meta {
      font-size: 10.5px;
      color: rgba(255,255,255,.38);
    }
    .nw-card-fecha {
      color: var(--nw-gold);
      font-size: 10px;
      font-weight: 500;
    }

    /* ── Dots ── */
    .nw-dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
    }
    .nw-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255,255,255,.2);
      border: none;
      cursor: pointer;
      padding: 0;
      transition: background .2s, transform .2s;
    }
    .nw-dot.active {
      background: var(--nw-blue);
      transform: scale(1.35);
    }
  `;

  /* ── Helpers ── */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /* ── Inyectar estilos una sola vez ── */
  function injectStyles() {
    if (document.getElementById("noticias-widget-css")) return;
    const tag = document.createElement("style");
    tag.id = "noticias-widget-css";
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  /* ── Render ── */
  function buildWidget(container, noticias) {
    injectStyles();

    /* Calcular cuántas tarjetas caben según ancho */
    function getVisible() {
      const w = container.offsetWidth;
      if (w < 400) return 1;
      if (w < 600) return 2;
      if (w < 860) return 3;
      return 4;
    }

    let visible  = getVisible();
    let cardW    = 0;
    let current  = 0; // índice del primer visible
    const total  = noticias.length;

    /* ── HTML ── */
    container.innerHTML = `
      <div class="nw-header">
        <div class="nw-header-left">
          <div class="nw-icon">📰</div>
          <div>
            <div class="nw-title">NOTICIAS</div>
            <div class="nw-subtitle">Copa Mundial FIFA 2026™</div>
          </div>
        </div>
        <div class="nw-nav-btns">
          <button class="nw-nav-btn" id="nw-prev" title="Anterior">&#8592;</button>
          <button class="nw-nav-btn" id="nw-next" title="Siguiente">&#8594;</button>
        </div>
      </div>
      <div class="nw-viewport">
        <div class="nw-track" id="nw-track">
          ${noticias.map((n, i) => `
            <div class="nw-card" data-url="${n.url || '#'}" tabindex="0" role="button" aria-label="${n.titulo}">
              <div class="nw-card-img-wrap">
                <img
                  src="${n.imagen}"
                  alt="${n.titulo}"
                  loading="${i < 4 ? 'eager' : 'lazy'}"
                  onerror="this.src='${PLACEHOLDER}'"
                >
                <span class="nw-badge">${n.categoria}</span>
              </div>
              <div class="nw-card-body">
                <div class="nw-card-titulo">${n.titulo}</div>
                <div class="nw-card-fecha">${n.fecha}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="nw-dots" id="nw-dots"></div>
    `;

    const track  = container.querySelector("#nw-track");
    const btnPrev = container.querySelector("#nw-prev");
    const btnNext = container.querySelector("#nw-next");
    const dotsEl  = container.querySelector("#nw-dots");

    /* ── Calcular tamaño de tarjeta ── */
    function calcCardW() {
      visible = getVisible();
      const vw = container.querySelector(".nw-viewport").offsetWidth;
      const gap = 14;
      cardW = (vw - gap * (visible - 1)) / visible;
      container.style.setProperty("--nw-card-w", cardW + "px");
    }

    /* ── Mover track ── */
    function goTo(idx) {
      const maxIdx = Math.max(0, total - visible);
      current = clamp(idx, 0, maxIdx);
      const offset = current * (cardW + 14);
      track.style.transform = `translateX(-${offset}px)`;
      updateUI();
    }

    /* ── Actualizar estado de botones y dots ── */
    function updateUI() {
      const maxIdx = Math.max(0, total - visible);
      btnPrev.disabled = current === 0;
      btnNext.disabled = current >= maxIdx;
      const activePage = Math.floor(current / visible);
      dotsEl.querySelectorAll(".nw-dot").forEach((d, i) =>
        d.classList.toggle("active", i === activePage)
      );
    }

    /* ── Botones ── */
    btnPrev.addEventListener("click", () => goTo(current - visible));
    btnNext.addEventListener("click", () => goTo(current + visible));

    /* ── Click en tarjeta ── */
    container.querySelectorAll(".nw-card").forEach(card => {
      card.addEventListener("click", () => {
        const url = card.dataset.url;
        if (url && url !== "#") window.open(url, "_blank");
      });
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") card.click();
      });
    });

    /* ── Touch / swipe ── */
    let touchStartX = 0;
    const viewport = container.querySelector(".nw-viewport");
    viewport.addEventListener("touchstart", e => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    viewport.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        dx < 0 ? goTo(current + visible) : goTo(current - visible);
      }
    }, { passive: true });

    /* ── Init y resize ── */
    function init() {
      calcCardW();
      buildDots();
      goTo(0);
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        init();
      }, 120);
    });

    init();
  }

  /* ── Auto-init al cargar ── */
  function autoInit() {
    const container = document.getElementById("noticias-widget");
    if (!container) return;

    if (typeof NOTICIAS_MUNDIAL === "undefined" || !NOTICIAS_MUNDIAL.length) {
      container.innerHTML =
        '<p style="color:rgba(255,255,255,.4);font-size:13px;text-align:center;padding:20px">No hay noticias cargadas aún.</p>';
      return;
    }

    buildWidget(container, NOTICIAS_MUNDIAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();