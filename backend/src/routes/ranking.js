// src/routes/ranking.js - Versión para PostgreSQL real
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/ranking - Tabla de posiciones
router.get("/", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const query = `
      SELECT 
        u.id,
        u.nombre_publico,
        u.codigo_acceso,
        COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales,
        COUNT(p.id) as predicciones_totales,
        COUNT(CASE WHEN p.puntos_obtenidos = 9 THEN 1 END) as exactas_9,
        COUNT(CASE WHEN p.puntos_obtenidos = 7 THEN 1 END) as exactas_7,
        COUNT(CASE WHEN p.puntos_obtenidos = 5 THEN 1 END) as ganador_5,
        COUNT(CASE WHEN p.puntos_obtenidos = 2 THEN 1 END) as parcial_2,
        COUNT(CASE WHEN p.puntos_obtenidos = 0 THEN 1 END) as incorrectas_0,
        MAX(p.fecha_prediccion) as ultima_prediccion
      FROM usuarios u
      LEFT JOIN predicciones p ON u.id = p.usuario_id
      WHERE u.esta_activo = true
      GROUP BY u.id, u.nombre_publico, u.codigo_acceso
      ORDER BY puntos_totales DESC, exactas_9 DESC, exactas_7 DESC
    `;
    
    const result = await client.query(query);
    
    const rankingConPosiciones = result.rows.map((usuario, index) => ({
      posicion: index + 1,
      ...usuario
    }));
    
    console.log(`🏆 Ranking generado: ${rankingConPosiciones.length} usuarios`);
    
    res.json({
      mensaje: "Ranking generado desde base de datos",
      actualizado: new Date().toISOString(),
      total_usuarios: rankingConPosiciones.length,
      ranking: rankingConPosiciones
    });
  } catch (error) {
    console.error("❌ Error generando ranking:", error);
    res.status(500).json({ 
      error: "Error al generar ranking",
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});

// GET /api/ranking/top - Solo top 5
router.get("/top", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const query = `
      SELECT 
        u.id,
        u.nombre_publico,
        u.codigo_acceso,
        COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales
      FROM usuarios u
      LEFT JOIN predicciones p ON u.id = p.usuario_id
      WHERE u.esta_activo = true
      GROUP BY u.id, u.nombre_publico, u.codigo_acceso
      ORDER BY puntos_totales DESC
      LIMIT 5
    `;
    
    const result = await client.query(query);
    
    const top5 = result.rows.map((usuario, index) => ({
      posicion: index + 1,
      nombre: usuario.nombre_publico,
      codigo: usuario.codigo_acceso,
      puntos: usuario.puntos_totales
    }));
    
    res.json({
      mensaje: "Top 5 jugadores",
      actualizado: new Date().toISOString(),
      top: top5
    });
  } catch (error) {
    console.error("❌ Error obteniendo top 5:", error);
    res.status(500).json({ error: "Error al obtener top 5" });
  } finally {
    if (client) client.release();
  }
});
router.get('/filtrado', async (req, res) => {
  const { categoria, fase, desde, hasta } = req.query;
  
  let whereClause = "WHERE u.esta_activo = true";
  let params = [];
  let paramIndex = 1;
  
  // Filtro por categoría de puntos
  if (categoria) {
    whereClause += ` AND p.puntos_obtenidos = $${paramIndex}`;
    params.push(parseInt(categoria));
    paramIndex++;
  }
  
  // Filtro por fase del partido
  if (fase) {
    whereClause += ` AND part.fase = $${paramIndex}`;
    params.push(fase);
    paramIndex++;
  }
  
  // Filtro por fecha
  if (desde && hasta) {
    whereClause += ` AND p.fecha_prediccion BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    params.push(desde, hasta);
    paramIndex += 2;
  }
  
  const query = `
    SELECT 
      u.id,
      u.nombre_publico,
      u.codigo_acceso,
      COUNT(p.id) as predicciones_filtradas,
      COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_filtrados,
      ROUND(AVG(p.puntos_obtenidos), 2) as promedio_filtrado
    FROM usuarios u
    LEFT JOIN predicciones p ON u.id = p.usuario_id
    LEFT JOIN partidos part ON p.partido_id = part.id
    ${whereClause}
    GROUP BY u.id, u.nombre_publico, u.codigo_acceso
    ORDER BY puntos_filtrados DESC
  `;
  
  const result = await pool.query(query, params);
  res.json({ ranking_filtrado: result.rows });
});

module.exports = router;