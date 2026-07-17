// widget-ads.js
// ─── 1:1 (260x260) ───────────────────────────────────────
const AD_POOL = {
  // ─── 1:1 (260x260) ───────────────────────────────────────
'11' : [
  { url: 'https://i.ibb.co/5gwSz0wy/Screenshot-64.png' },
  { url: 'https://i.ibb.co/z3sjb32/Screenshot-65.png' },
  { url: 'https://i.ibb.co/JRvpWg3C/Screenshot-66.png' },
  { url: 'https://i.ibb.co/0ptjFGkZ/Screenshot-67.png' },
  { url: 'https://i.ibb.co/rRGmns53/Screenshot-68.png' },
  { url: 'https://i.ibb.co/FkgCzVHM/Screenshot-69.png' },
  { url: 'https://i.ibb.co/2XZM281/Screenshot-70.png' },
  { url: 'https://i.ibb.co/5WVSQ6Rg/Screenshot-71.png' },
  { url: 'https://i.ibb.co/7xshbryL/Screenshot-72.png' },
  { url: 'https://i.ibb.co/Y4W6VvZf/Screenshot-73.png' },
  { url: 'https://i.ibb.co/rfkbM5Vt/Screenshot-74.png' },
  { url: 'https://i.ibb.co/v4Xtq3Ks/Screenshot-75.png' },
  { url: 'https://i.ibb.co/d453Gc3Q/Screenshot-76.png' },
],

// ─── 4:3 (260x346) ───────────────────────────────────────
'43' : [
  { url: 'https://i.ibb.co/PZgb2G2f/Screenshot-52.png' },
  { url: 'https://i.ibb.co/8DFqNm21/Screenshot-53.png' },
  { url: 'https://i.ibb.co/Jwn41dV2/Screenshot-54.png' },
  { url: 'https://i.ibb.co/ds36cXQq/Screenshot-55.png' },
  { url: 'https://i.ibb.co/vxKPt3f0/Screenshot-56.png' },
  { url: 'https://i.ibb.co/ZzGHkNqc/Screenshot-57.png' },
  { url: 'https://i.ibb.co/0jXVGkXd/Screenshot-58.png' },
  { url: 'https://i.ibb.co/ZRs187TQ/Screenshot-59.png' },
  { url: 'https://i.ibb.co/v4tZhNyg/Screenshot-60.png' },
],
};

const AD_INTERVAL = 8000; // ms

function initAdWidgets() {
  const widgets = document.querySelectorAll('.ad-widget[data-ads]');
  const typeCounters = {};

  widgets.forEach(widget => {
    const type = widget.dataset.ads;
    const pool = AD_POOL[type];
    if (!pool || !pool.length) return;

    // Cada widget arranca en un anuncio distinto
    if (typeCounters[type] === undefined) {
      typeCounters[type] = Math.floor(Math.random() * pool.length);
    }
    let current = typeCounters[type];
    typeCounters[type] = (typeCounters[type] + 1) % pool.length;

    const img = widget.querySelector('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;transition:opacity 0.5s ease;opacity:0;';

    function show(idx, fade) {
      const ad = pool[idx];
      widget.href = ad.link;
      const next = new Image();
      next.onload = () => {
        if (fade) {
          img.style.opacity = '0';
          setTimeout(() => { img.src = next.src; img.style.opacity = '1'; }, 450);
        } else {
          img.src = next.src;
          img.style.opacity = '1';
        }
      };
      next.src = ad.url;
    }

    show(current, false);
    setInterval(() => {
      current = (current + 1) % pool.length;
      show(current, true);
    }, AD_INTERVAL);
  });
}

document.addEventListener('DOMContentLoaded', initAdWidgets);