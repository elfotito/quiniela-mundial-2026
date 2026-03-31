// src/app.js - VERSIÓN COMPLETA
const express = require('express');
const cors = require('cors');

require('dotenv').config();

// Importar rutas (las crearemos a continuación)
const partidosRoutes = require('./routes/partidos');
const usuariosRoutes = require('./routes/usuarios');
const prediccionesRoutes = require('./routes/predicciones');
const rankingRoutes = require('./routes/ranking');
const adminRoutes = require("./routes/admin");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.json({
    proyecto: '⚽ Sistema de Predicciones Mundial 2026',
    estado: 'API funcionando',
    version: '1.0.0',
    endpoints: {
      partidos: 'GET /api/partidos',
      usuario: 'GET /api/usuarios/:codigo',
      predicciones: 'GET /api/predicciones/:usuario_id',
      ranking: 'GET /api/ranking',
      nueva_prediccion: 'POST /api/predicciones',
      actualizar_resultado: 'PUT /api/partidos/:id (admin)'
    }
  });
});

// Rutas de la API
app.use('/api/partidos', partidosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/predicciones', prediccionesRoutes);
app.use('/api/ranking', rankingRoutes);
app.use("/api/admin", adminRoutes);

// Ruta para verificar salud del sistema
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'PostgreSQL (pendiente de conexión)',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path
  });
});

// Puerto
const PORT = process.env.PORT || 3000;

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   ⚽ SISTEMA DE PREDICCIONES MUNDIAL 2026        ║
║   🚀 Backend API iniciado correctamente         ║
╠══════════════════════════════════════════════════╣
║   📡 URL: http://localhost:${PORT}                ${PORT < 1000 ? ' ' : ''}║
║   📅 ${new Date().toLocaleString()}              ║
╚══════════════════════════════════════════════════╝
  `);
});
