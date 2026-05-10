// widget-ads.js
// ─── 1:1 (260x260) ───────────────────────────────────────
const ADS_11 = [
  { url: 'https://i.ibb.co/zVb3CqPk/Save-Clip-App-643561767-17977242236830415-4476175652748288014-n.webp', link: 'https://www.instagram.com/unicardio.ha/' },
  { url: 'https://i.ibb.co/zVb3CqPk/Save-Clip-App-643561767-17977242236830415-4476175652748288014-n.webp', link: 'https://tu-sitio.com/pagina' },
];

// ─── 4:3 (260x346) ───────────────────────────────────────
const ADS_43 = [
  { url: 'https://i.ibb.co/YT1bj33K/Gemini-Generated-Image-8hk19e8hk19e8hk1.png', link: 'https://tu-sitio.com/pagina' },
  { url: 'https://i.ibb.co/YT1bj33K/Gemini-Generated-Image-8hk19e8hk19e8hk1.png', link: 'https://www.instagram.com/dcarrisan' },
];

const AD_INTERVAL = 5000; // ms

function initAdWidget(widgetId, imgId, ads, interval) {
  const widget = document.getElementById(widgetId);
  const img    = document.getElementById(imgId);
  if (!widget || !ads.length) return;

  // Empieza en uno aleatorio cada carga
  let current = Math.floor(Math.random() * ads.length);

  function show(idx, fade) {
    const ad = ads[idx];
    widget.href = ad.link;
    const next = new Image();
    next.onload = () => {
      if (fade) img.style.opacity = '0';
      setTimeout(() => {
        img.src = next.src;
        img.style.opacity = '1';
      }, fade ? 400 : 0);
    };
    next.src = ad.url;
  }

  // Transición CSS en el img
  img.style.transition = 'opacity 0.5s ease';
  img.style.width  = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.style.display = 'block';

  show(current, false);
  setInterval(() => {
    current = (current + 1) % ads.length;
    show(current, true);
  }, interval);
}

document.addEventListener('DOMContentLoaded', () => {
  initAdWidget('ad-widget-11', 'ad-img-11', ADS_11, AD_INTERVAL);
  initAdWidget('ad-widget-43', 'ad-img-43', ADS_43, AD_INTERVAL);
});