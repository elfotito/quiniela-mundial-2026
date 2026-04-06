// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar rutas
const partidosRoutes = require('./routes/partidos');
const usuariosRoutes = require('./routes/usuarios');
const prediccionesRoutes = require('./routes/predicciones');
const rankingRoutes = require('./routes/ranking');
const adminRoutes = require('./routes/admin');

const app = express();

// --------------------------------------------------------------
// CORS - Permite peticiones desde tu frontend en Vercel
// --------------------------------------------------------------
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:5500',       // Live Server local
    process.env.FRONTEND_URL       // Tu URL de Vercel (la pones en variables de Render)
  ],
  credentials: true
}));

app.use(express.json());

// --------------------------------------------------------------
// RUTAS DE LA API
// --------------------------------------------------------------
app.use('/api/partidos', partidosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/predicciones', prediccionesRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/admin', adminRoutes);

// --------------------------------------------------------------
// HEALTH CHECK (Render lo usa para saber si el servidor vive)
// --------------------------------------------------------------
app.get('/health', async (req, res) => {
  try {
    const pool = require('./db');
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'conectada', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', database: err.message });
  }
});

// --------------------------------------------------------------
// 404 para rutas API no encontradas
// --------------------------------------------------------------
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Ruta no encontrada', path: req.path });
  }
  res.status(404).json({ error: '404 - Not found' });
});

// --------------------------------------------------------------
// INICIAR SERVIDOR
// --------------------------------------------------------------
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    const pool = require('./db');
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL conectado');
  } catch (err) {
    console.error('⚠️ Error conectando a la BD:', err.message);
    // No matamos el servidor, Render reintentará
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║   ⚽ QUINIELA MUNDIAL 2026 - Backend API         ║
╠══════════════════════════════════════════════════╣
║   📡 Puerto: ${PORT}                                 ║
║   🌐 Frontend: ${process.env.FRONTEND_URL || 'localhost'} 
╚══════════════════════════════════════════════════╝
    `);
  });
};

startServer();