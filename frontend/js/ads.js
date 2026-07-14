// widget-ads.js
// ─── 1:1 (260x260) ───────────────────────────────────────
const AD_POOL = {
  // ─── 1:1 (260x260) ───────────────────────────────────────
'11' : [
  { url: 'https://i.ibb.co/G15Jwm7/1.png' },
  { url: 'https://i.ibb.co/1f63gz4K/743541408-1045158827878946-4676420644925089113-n.jpg' },
  { url: 'https://i.ibb.co/wFggHLtc/745699562-1104784218896155-5488577579258038421-n.jpg' },
  { url: 'https://i.ibb.co/sdxKHj2D/746042172-1018054201109773-6142336588778628120-n.jpg' },
  { url: 'https://i.ibb.co/XrzPn6Y4/744441082-915886181534749-8286135704173631644-n.jpg' },
  { url: 'https://i.ibb.co/dsSxCZ9K/747931520-1025582283504927-8468768908392883282-n.jpg' },
],

// ─── 4:3 (260x346) ───────────────────────────────────────
'43' : [
  { url: 'https://i.ibb.co/G15Jwm7/1.png' },
  { url: 'https://i.ibb.co/1f63gz4K/743541408-1045158827878946-4676420644925089113-n.jpg' },
  { url: 'https://i.ibb.co/wFggHLtc/745699562-1104784218896155-5488577579258038421-n.jpg' },
  { url: 'https://i.ibb.co/sdxKHj2D/746042172-1018054201109773-6142336588778628120-n.jpg' },
  { url: 'https://i.ibb.co/XrzPn6Y4/744441082-915886181534749-8286135704173631644-n.jpg' },
  { url: 'https://i.ibb.co/dsSxCZ9K/747931520-1025582283504927-8468768908392883282-n.jpg' },
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