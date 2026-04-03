// src/app.js - VERSIÓN COMPLETA CON FRONTEND ESTÁTICO
const express = require('express');
const cors = require('cors');
const path = require('path');   // ← Necesario para rutas de archivos
require('dotenv').config();

// Importar rutas
const partidosRoutes = require('./routes/partidos');
const usuariosRoutes = require('./routes/usuarios');
const prediccionesRoutes = require('./routes/predicciones');
const rankingRoutes = require('./routes/ranking');
const adminRoutes = require("./routes/admin");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --------------------------------------------------------------
// 1. SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND (HTML, CSS, JS)
// --------------------------------------------------------------
// La carpeta 'frontend' está al mismo nivel que 'backend'
app.use(express.static(path.join(__dirname, '../../frontend')));

// --------------------------------------------------------------
// 2. RUTAS DE LA API (tienen prioridad sobre el frontend)
// --------------------------------------------------------------
app.use('/api/partidos', partidosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/predicciones', prediccionesRoutes);   // ← estaba faltando
app.use('/api/ranking', rankingRoutes);
app.use("/api/admin", adminRoutes);

// Ruta de salud del sistema (útil para Railway)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'PostgreSQL conectado',
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------------------
// 3. RUTAS DEL FRONTEND (para que sirva las páginas HTML)
// --------------------------------------------------------------
// Raíz del sitio → sirve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Opcional: si quieres que otras rutas como /login, /predicciones también funcionen
// (express.static ya sirve login.html, predicciones.html, etc. si existen)
// Pero por si acaso, forzamos la respuesta para rutas comunes del frontend:
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/login.html'));
});
app.get('/predicciones.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/predicciones.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/admin.html'));
});

// --------------------------------------------------------------
// 4. MANEJO DE ERROR 404 (solo para rutas no encontradas)
// --------------------------------------------------------------
// Si llega hasta aquí, no era API ni archivo estático ni página conocida
app.use((req, res) => {
  // Si la petición empezaba con /api, devolvemos JSON de error
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      error: 'Ruta de API no encontrada',
      path: req.path
    });
  }
  // Para el resto, mostramos un mensaje amigable o redirigimos al inicio
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head><title>Página no encontrada</title></head>
    <body>
      <h1>404 - Página no encontrada</h1>
      <p>Lo sentimos, la página que buscas no existe.</p>
      <a href="/">Volver al inicio</a>
    </body>
    </html>
  `);
});

// --------------------------------------------------------------
// 5. INICIAR EL SERVIDOR
// --------------------------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   ⚽ SISTEMA DE PREDICCIONES MUNDIAL 2026        ║
║   🚀 Backend API + Frontend estático             ║
╠══════════════════════════════════════════════════╣
║   📡 Servidor corriendo en puerto: ${PORT}         ║
║   🌐 Frontend disponible en: /                   ║
║   📅 ${new Date().toLocaleString()}              ║
╚══════════════════════════════════════════════════╝
  `);
});