
const LV_ESTADIOS = [
  { img:"https://i.ibb.co/WN8rGNtr/Metlife-stadium-Aerial-view.jpg",
    badge:"🏆 Final · Nueva York",
    fact:"MetLife Stadium — 82,500 espectadores · Sede de la Gran Final" },
  { img:"https://i.ibb.co/BHr1PZPk/AZTECA.jpg",
    badge:"⚽ Inauguración · Ciudad de México",
    fact:"Estadio Azteca — El único con dos inauguraciones mundialistas" },
  { img:"https://i.ibb.co/HL8gzc8R/ATT-Stadium-AP.jpg",
    badge:"🌟 Dallas · AT&T Stadium",
    fact:"AT&T Stadium — La pantalla más grande del mundo en un estadio" },
  { img:"https://i.ibb.co/0jJtK9zq/una-vista-dallalto-del-rose-bowl-stadium-di-pasadena-77xtyf1lmfjf106jhptoygoxr.jpg",
    badge:"🌹 Los Ángeles · Rose Bowl",
    fact:"Rose Bowl — Sede de la final del Mundial 1994" },
];
const WE_INTERVAL = 5000;

function initWidgetEstadio(imgId, badgeId, factId) {
  const img   = document.getElementById(imgId);
  const badge = document.getElementById(badgeId);
  const fact  = document.getElementById(factId);
  if (!img) return;

  let current = Math.floor(Math.random() * LV_ESTADIOS.length);

  function mostrar(idx, fade) {
    const e = LV_ESTADIOS[idx % LV_ESTADIOS.length];
    if (fade) {
      img.style.opacity = '0';
      setTimeout(() => {
        img.src = e.img; badge.textContent = e.badge; fact.textContent = e.fact;
        img.onload = () => img.style.opacity = '1';
        if (img.complete) img.style.opacity = '1';
      }, 400);
    } else {
      img.src = e.img; badge.textContent = e.badge; fact.textContent = e.fact;
      img.onload = () => img.style.opacity = '1';
      if (img.complete) img.style.opacity = '1';
    }
  }

  mostrar(current, false);
  setInterval(() => {
    current = (current + 1) % LV_ESTADIOS.length;
    mostrar(current, true);
  }, WE_INTERVAL);
}

document.addEventListener('DOMContentLoaded', () => {
  // Un widget por página normalmente, o dos con IDs distintos
  initWidgetEstadio('weImg1', 'weBadge1', 'weFact1');
  // initWidgetEstadio('weImg2', 'weBadge2', 'weFact2'); // segundo opcional
});