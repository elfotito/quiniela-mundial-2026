// widget-ads.js
// ─── 1:1 (260x260) ───────────────────────────────────────
const AD_POOL = {
  // ─── 1:1 (260x260) ───────────────────────────────────────
'11' : [
  { url: 'https://i.ibb.co/pBcBXc8w/unicardio.png', link: 'https://www.instagram.com/unicardio.ha/' },
  { url: 'https://i.ibb.co/jP97FC5M/Save-Clip-App-651932567-18102108917497080-5880069149386066025-n.webp', link: 'https://www.instagram.com/unicardio.ha/' },
  { url: 'https://i.ibb.co/SXF8b6PN/Save-Clip-App-652773881-18087064778269663-1733593774225891798-n.webp', link: 'https://www.instagram.com/unicardio.ha/' },
  { url: 'https://i.ibb.co/LKyHTd7/Save-Clip-App-655086237-18078404945574082-8845079464837833066-n-1.webp', link: 'https://www.instagram.com/deliverysorpresa/' },
  { url: 'https://i.ibb.co/Pv6fMMLv/Save-Clip-App-658474710-18370531537202009-7154433570683986532-n.webp', link: 'https://www.instagram.com/deliverysorpresa/' },
  { url: 'https://i.ibb.co/rRKfbtpH/Save-Clip-App-656057688-18117165637712782-2735713681201846829-n.webp', link: 'https://www.instagram.com/deliverysorpresa/' },
],

// ─── 4:3 (260x346) ───────────────────────────────────────
'43' : [
  { url: 'https://i.ibb.co/YT1bj33K/Gemini-Generated-Image-8hk19e8hk19e8hk1.png', link: 'https://www.instagram.com/dcarrisan/' },
  { url: 'https://i.ibb.co/qYQ1jYmZ/Gemini-Generated-Image-fgsxjlfgsxjlfgsx.png', link: 'https://www.instagram.com/dcarrisan/' },
  { url: 'https://i.ibb.co/PvpKL0gS/Gemini-Generated-Image-81pq5l81pq5l81pq.png', link: 'https://www.instagram.com/dcarrisan/' },
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