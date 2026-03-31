// backend/scraper.js
const puppeteer = require('puppeteer');

async function scrapeResultados() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Navegar a página de resultados (ej: ESPN, FIFA)
    await page.goto('https://www.fifa.com/fifaplus/es/tournaments/mens/worldcup/canadamexicousa2026');
    
    // Extraer resultados
    const resultados = await page.evaluate(() => {
        const partidos = [];
        // Selectores específicos de la página
        document.querySelectorAll('.match-item').forEach(item => {
            partidos.push({
                equipo1: item.querySelector('.team1').innerText,
                equipo2: item.querySelector('.team2').innerText,
                resultado: item.querySelector('.score').innerText
            });
        });
        return partidos;
    });
    
    await browser.close();
    return resultados;
}