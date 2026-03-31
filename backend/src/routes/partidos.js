// src/routes/partidos.js - Versión para PostgreSQL real
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/partidos - Todos los partidos
router.get("/", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const query = `
      SELECT id, equipo_local, equipo_visitante, fase, 
             fecha_hora, estado,
             goles_local_real, goles_visitante_real
      FROM partidos 
      ORDER BY fecha_hora ASC
    `;
    
    const result = await client.query(query);
    
    console.log(`✅ Partidos obtenidos: ${result.rows.length}`);
    res.json({
      mensaje: "Partidos obtenidos correctamente",
      total: result.rows.length,
      partidos: result.rows
    });
  } catch (error) {
    console.error("❌ Error obteniendo partidos:", error);
    res.status(500).json({ 
      error: "Error al obtener partidos",
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});

// GET /api/partidos/:id - Partido específico
router.get("/:id", async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    client = await pool.connect();
    
    const query = `
      SELECT id, equipo_local, equipo_visitante, fase, 
             fecha_hora, estado,
             goles_local_real, goles_visitante_real
      FROM partidos 
      WHERE id = $1
    `;
    
    const result = await client.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: "Partido no encontrado",
        id: id
      });
    }
    
    res.json({
      mensaje: "Partido encontrado",
      partido: result.rows[0]
    });
  } catch (error) {
    console.error("❌ Error obteniendo partido:", error);
    res.status(500).json({ error: "Error al obtener partido" });
  } finally {
    if (client) client.release();
  }
});

// PUT /api/partidos/:id - Actualizar resultados (ADMIN)
router.put("/:id", async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { goles_local_real, goles_visitante_real } = req.body;
    
    // Validaciones
    if (goles_local_real === undefined || goles_visitante_real === undefined) {
      return res.status(400).json({ 
        error: "Se requieren goles_local_real y goles_visitante_real" 
      });
    }
    
    client = await pool.connect();
    
    // Primero verificamos que el partido existe
    const checkQuery = 'SELECT estado FROM partidos WHERE id = $1';
    const checkResult = await client.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Partido no encontrado" });
    }
    
    // Actualizamos los resultados
    const updateQuery = `
      UPDATE partidos 
      SET goles_local_real = $1, 
          goles_visitante_real = $2,
          estado = 'finalizado'
      WHERE id = $3
      RETURNING *
    `;
    
    const updateResult = await client.query(
      updateQuery, 
      [goles_local_real, goles_visitante_real, id]
    );
    
    console.log(`✅ Resultados actualizados para partido ID: ${id}`);
    
    res.json({
      mensaje: "✅ Resultados actualizados correctamente",
      partido: updateResult.rows[0],
      nota: "Los puntos se calcularán automáticamente para todas las predicciones"
    });
  } catch (error) {
    console.error("❌ Error actualizando resultados:", error);
    res.status(500).json({ 
      error: "Error al actualizar resultados",
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});
  // GET /api/partidos/estados/count - Conteo por estado
router.get('/estados/count', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        estado,
        COUNT(*) as cantidad,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as porcentaje
      FROM partidos
      GROUP BY estado
      ORDER BY estado
    `);
    
    res.json({
      total: result.rows.reduce((sum, row) => sum + parseInt(row.cantidad), 0),
      estados: result.rows
    });
  } catch (error) {
    console.error('❌ Error contando estados:', error);
    res.status(500).json({ error: 'Error al contar estados' });
  }
});
module.exports = router;