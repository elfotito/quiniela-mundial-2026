// Crea src/routes/admin.js si no existe
// src/routes/admin.js - Rutas protegidas para administradores
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { verificarUsuario, esAdministrador } = require("../middleware/auth");
const { validarResultadoPartido } = require("../middleware/validaciones");

// Aplicar middleware de autenticación a TODAS las rutas admin
router.use(verificarUsuario);
router.use(esAdministrador);

// GET /api/admin/estadisticas - Estadísticas del sistema
router.get("/estadisticas", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    // Obtener estadísticas reales de la BD
    const [
      totalUsuarios,
      usuariosActivos,
      totalPredicciones,
      partidosJugados,
      partidosPendientes
    ] = await Promise.all([
      client.query('SELECT COUNT(*) FROM usuarios'),
      client.query('SELECT COUNT(*) FROM usuarios WHERE esta_activo = true'),
      client.query('SELECT COUNT(*) FROM predicciones'),
      client.query('SELECT COUNT(*) FROM partidos WHERE estado = \'finalizado\''),
      client.query('SELECT COUNT(*) FROM partidos WHERE estado = \'pendiente\'')
    ]);
    
    // Estadísticas de puntos
    const puntosStats = await client.query(`
      SELECT 
        AVG(puntos_obtenidos) as promedio_puntos,
        MAX(puntos_obtenidos) as maximo_puntos,
        COUNT(CASE WHEN puntos_obtenidos = 9 THEN 1 END) as exactas_9,
        COUNT(CASE WHEN puntos_obtenidos = 7 THEN 1 END) as exactas_7,
        COUNT(CASE WHEN puntos_obtenidos = 5 THEN 1 END) as ganador_5
      FROM predicciones
      WHERE puntos_obtenidos IS NOT NULL
    `);
    
    const estadisticas = {
      sistema: {
        total_usuarios: parseInt(totalUsuarios.rows[0].count),
        usuarios_activos: parseInt(usuariosActivos.rows[0].count),
        total_predicciones: parseInt(totalPredicciones.rows[0].count),
        partidos_jugados: parseInt(partidosJugados.rows[0].count),
        partidos_pendientes: parseInt(partidosPendientes.rows[0].count)
      },
      puntos: {
        promedio_por_prediccion: parseFloat(puntosStats.rows[0].promedio_puntos || 0).toFixed(2),
        maximo_puntos: parseInt(puntosStats.rows[0].maximo_puntos || 0),
        predicciones_exactas_9: parseInt(puntosStats.rows[0].exactas_9 || 0),
        predicciones_exactas_7: parseInt(puntosStats.rows[0].exactas_7 || 0),
        predicciones_ganador: parseInt(puntosStats.rows[0].ganador_5 || 0)
      }
    };
    
    console.log(`📊 Estadísticas generadas por admin: ${req.usuario.nombre_publico}`);
    
    res.json({
      mensaje: "Estadísticas del sistema",
      generado: new Date().toISOString(),
      administrador: req.usuario.nombre_publico,
      ...estadisticas
    });
  } catch (error) {
    console.error("❌ Error en estadísticas admin:", error);
    res.status(500).json({ 
      error: "Error al obtener estadísticas",
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});

// PUT /api/admin/partidos/:id/resultado - Ingresar resultados reales
router.put("/partidos/:id/resultado", validarResultadoPartido, async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { goles_local_real, goles_visitante_real } = req.body;

    client = await pool.connect();
    
    // Iniciar transacción
    await client.query('BEGIN');
    
    // 1. Verificar que el partido existe
    const partidoCheck = await client.query(
      'SELECT id, estado FROM partidos WHERE id = $1 FOR UPDATE',
      [id]
    );
    
    if (partidoCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: "Partido no encontrado",
        id: id
      });
    }
    
    // 2. Actualizar resultados del partido
    const updatePartido = await client.query(`
      UPDATE partidos 
      SET goles_local_real = $1, 
          goles_visitante_real = $2,
          estado = 'finalizado'
      WHERE id = $3
      RETURNING *
    `, [goles_local_real, goles_visitante_real, id]);
    
    // 3. Actualizar puntos para todas las predicciones de este partido
    const updatePuntos = await client.query(`
      UPDATE predicciones p
      SET puntos_obtenidos = calcular_puntos($1, $2, p.goles_local_pred, p.goles_visitante_pred)
      WHERE p.partido_id = $3
      RETURNING id
    `, [goles_local_real, goles_visitante_real, id]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Resultados actualizados por admin ${req.usuario.nombre_publico} para partido ${id}`);
    console.log(`   Predicciones actualizadas: ${updatePuntos.rows[0].predicciones_actualizadas}`);
    
    res.json({
      mensaje: "✅ Resultados actualizados correctamente",
      partido: updatePartido.rows[0],
      predicciones_actualizadas: parseInt(updatePuntos.rows[0].predicciones_actualizadas),
      nota: "Los puntos se calcularon automáticamente para todas las predicciones"
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    
    console.error("❌ Error actualizando resultados:", error);
    res.status(500).json({ 
      error: "Error al actualizar resultados",
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});

// GET /api/admin/usuarios - Lista de todos los usuarios
router.get("/usuarios", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        id, 
        codigo_acceso, 
        nombre_publico, 
        email, 
        esta_activo,
        (SELECT COUNT(*) FROM predicciones WHERE usuario_id = usuarios.id) as total_predicciones,
        (SELECT COALESCE(SUM(puntos_obtenidos), 0) FROM predicciones WHERE usuario_id = usuarios.id) as puntos_totales
      FROM usuarios
      ORDER BY id
    `);
    
    res.json({
      total: result.rows.length,
      activos: result.rows.filter(u => u.esta_activo).length,
      usuarios: result.rows
    });
  } catch (error) {
    console.error("❌ Error listando usuarios:", error);
    res.status(500).json({ error: "Error al listar usuarios" });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;