// src/routes/usuarios.js - Versión para PostgreSQL real
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/usuarios/:codigo - Login simple
router.get("/:codigo", async (req, res) => {
  let client;
  try {
    console.log(`🔑 Intentando login con código: ${req.params.codigo}`);
    
    client = await pool.connect();
    
    const query = `
      SELECT id, codigo_acceso, nombre_publico, email, esta_activo
      FROM usuarios 
      WHERE codigo_acceso = $1 AND esta_activo = true
    `;
    
    const result = await client.query(query, [req.params.codigo]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: "Usuario no encontrado o inactivo",
        codigo: req.params.codigo
      });
    }
    
    console.log(`✅ Login exitoso para: ${result.rows[0].nombre_publico}`);
    res.json({
      mensaje: "Login exitoso",
      usuario: result.rows[0]
    });
  } catch (error) {
    console.error("❌ Error en login PostgreSQL:", error);
    res.status(500).json({ 
      error: "Error al verificar usuario",
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});

// GET /api/usuarios - Listar usuarios (solo admin en producción)
router.get("/", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT id, codigo_acceso, nombre_publico, email, esta_activo, telefono
      FROM usuarios
      ORDER BY id
    `);
    
    res.json({
      total: result.rows.length,
      usuarios: result.rows
    });
  } catch (error) {
    console.error("❌ Error listando usuarios:", error);
    res.status(500).json({ error: "Error al listar usuarios" });
  } finally {
    if (client) client.release();
  }
});

// GET: Obtener logros del usuario
router.get('/api/usuarios/:id/logros', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            'SELECT logros_desbloqueados FROM usuarios WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ logros: result.rows[0].logros_desbloqueados || [] });
    } catch (error) {
        console.error('Error al obtener logros:', error);
        res.status(500).json({ error: 'Error al obtener logros' });
    }
});

// POST: Desbloquear un logro
router.post('/api/usuarios/:id/logros', async (req, res) => {
    try {
        const { id } = req.params;
        const { logro_id } = req.body;
        
        // Obtener logros actuales
        const result = await db.query(
            'SELECT logros_desbloqueados FROM usuarios WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        let logros = result.rows[0].logros_desbloqueados || [];
        
        // Verificar si ya está desbloqueado
        if (!logros.includes(logro_id)) {
            logros.push(logro_id);
            
            // Actualizar en BD
            await db.query(
                'UPDATE usuarios SET logros_desbloqueados = $1 WHERE id = $2',
                [JSON.stringify(logros), id]
            );
        }
        
        res.json({ success: true, logros });
    } catch (error) {
        console.error('Error al desbloquear logro:', error);
        res.status(500).json({ error: 'Error al desbloquear logro' });
    }
});

module.exports = router;