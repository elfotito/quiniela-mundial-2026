// widget-ads.js
// ─── 1:1 (260x260) ───────────────────────────────────────
const AD_POOL = {
  // ─── 1:1 (260x260) ───────────────────────────────────────
'11' : [
  { url: 'https://i.ibb.co/G15Jwm7/1.png' },
  { url: 'https://i.ibb.co/nMsxjCQ3/2.png' },
  { url: 'https://i.ibb.co/9H8MSkj0/3.png' },
  { url: 'https://i.ibb.co/ccz3z5xW/4.jpg' },
  { url: 'https://i.ibb.co/vWvw8V1/5.jpg' },
  { url: 'https://i.ibb.co/PZdyqM9x/6.jpg' },
  { url: 'https://i.ibb.co/WpsLqygs/7.jpg' },
  { url: 'https://i.ibb.co/tpkgJZKG/8.jpg' },
  { url: 'https://i.ibb.co/67syDtFZ/9.jpg' },
  { url: 'https://i.ibb.co/mFg5y8LJ/10.jpg' },
  { url: 'https://i.ibb.co/Hpq0svx8/11.jpg' },
  { url: 'https://i.ibb.co/s9CnPSxb/12.jpg' },
  { url: 'https://i.ibb.co/9HmT0YTm/13.jpg' },
  { url: 'https://i.ibb.co/Fkpz07NV/14.jpg' },
  { url: 'https://i.ibb.co/9mBRWzHj/15.jpg' },
],

// ─── 4:3 (260x346) ───────────────────────────────────────
'43' : [
  { url: 'https://i.ibb.co/G15Jwm7/1.png' },
  { url: 'https://i.ibb.co/nMsxjCQ3/2.png' },
  { url: 'https://i.ibb.co/9H8MSkj0/3.png' },
  { url: 'https://i.ibb.co/ccz3z5xW/4.jpg' },
  { url: 'https://i.ibb.co/vWvw8V1/5.jpg' },
  { url: 'https://i.ibb.co/PZdyqM9x/6.jpg' },
  { url: 'https://i.ibb.co/WpsLqygs/7.jpg' },
  { url: 'https://i.ibb.co/tpkgJZKG/8.jpg' },
  { url: 'https://i.ibb.co/67syDtFZ/9.jpg' },
  { url: 'https://i.ibb.co/mFg5y8LJ/10.jpg' },
  { url: 'https://i.ibb.co/Hpq0svx8/11.jpg' },
  { url: 'https://i.ibb.co/s9CnPSxb/12.jpg' },
  { url: 'https://i.ibb.co/9HmT0YTm/13.jpg' },
  { url: 'https://i.ibb.co/Fkpz07NV/14.jpg' },
  { url: 'https://i.ibb.co/9mBRWzHj/15.jpg' },
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