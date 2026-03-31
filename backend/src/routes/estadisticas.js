router.get('/categorias', async (req, res) => {
  const categorias = [
    { puntos: 9, nombre: "Cierren el estadio", descripcion: "Genio total" },
    { puntos: 7, nombre: "Le sabes", descripcion: "Un Crack" },
    { puntos: 5, nombre: "Algo sabes", descripcion: "Estas ganando hijo" },
    { puntos: 2, nombre: "Prendiste la TV", descripcion: "Algo muerdes" },
    { puntos: 0, nombre: "Prende la TV", descripcion: "A seguir intentando" }
  ];

  // Contar predicciones por categoría
  const stats = await Promise.all(
    categorias.map(async cat => {
      const result = await pool.query(
        `SELECT COUNT(*) FROM predicciones WHERE puntos_obtenidos = $1`,
        [cat.puntos]
      );
      return { ...cat, cantidad: parseInt(result.rows[0].count) };
    })
  );

  res.json({ categorias: stats });
});
// GET /api/estadisticas/usuario/:id
router.get('/usuario/:id', async (req, res) => {
  const userId = req.params.id;
  
  const query = `
    SELECT 
      -- Totales
      COUNT(*) as total_predicciones,
      COALESCE(SUM(puntos_obtenidos), 0) as puntos_totales,
      
      -- Por categoría
      COUNT(CASE WHEN puntos_obtenidos = 9 THEN 1 END) as genios,
      COUNT(CASE WHEN puntos_obtenidos = 7 THEN 1 END) as le_sabes,
      COUNT(CASE WHEN puntos_obtenidos = 5 THEN 1 END) as algo_sabes,
      COUNT(CASE WHEN puntos_obtenidos = 2 THEN 1 END) as prendiste_tv,
      COUNT(CASE WHEN puntos_obtenidos = 0 THEN 1 END) as prende_tv,
      
      -- Eficiencia
      ROUND(AVG(puntos_obtenidos) FILTER (WHERE puntos_obtenidos IS NOT NULL), 2) as promedio_puntos,
      
      -- Tendencias
      COUNT(CASE WHEN goles_local_pred > goles_visitante_pred THEN 1 END) as predijo_local,
      COUNT(CASE WHEN goles_local_pred < goles_visitante_pred THEN 1 END) as predijo_visitante,
      COUNT(CASE WHEN goles_local_pred = goles_visitante_pred THEN 1 END) as predijo_empate,
      
      -- Actualidad
      MAX(fecha_prediccion) as ultima_prediccion
      
    FROM predicciones 
    WHERE usuario_id = $1
  `;

  const result = await pool.query(query, [userId]);
  res.json(result.rows[0]);
});
// GET /api/estadisticas/logros/:usuario_id
router.get('/logros/:usuario_id', async (req, res) => {
  const userId = req.params.id;
  
  const logros = [
    {
      id: 'primer_genio',
      nombre: '¡Genio en ciernes!',
      descripcion: 'Primera predicción de 9 puntos',
      condicion: async () => {
        const res = await pool.query(
          `SELECT COUNT(*) FROM predicciones WHERE usuario_id = $1 AND puntos_obtenidos = 9`,
          [userId]
        );
        return parseInt(res.rows[0].count) >= 1;
      }
    },
    {
      id: 'consistencia',
      nombre: 'Consistencia Total',
      descripcion: '10 predicciones seguidas con al menos 2 puntos',
      condicion: async () => {
        // Lógica para verificar racha
        return false; // Implementar
      }
    },
    {
      id: 'adivino_empates',
      nombre: 'Adivino de Empates',
      descripcion: 'Acertó 5 empates correctamente',
      condicion: async () => {
        const res = await pool.query(`
          SELECT COUNT(*) 
          FROM predicciones p
          JOIN partidos pa ON p.partido_id = pa.id
          WHERE p.usuario_id = $1 
          AND p.goles_local_pred = p.goles_visitante_pred
          AND pa.goles_local_real = pa.goles_visitante_real
          AND pa.goles_local_real IS NOT NULL
        `, [userId]);
        return parseInt(res.rows[0].count) >= 5;
      }
    }
  ];
  
  // Verificar logros desbloqueados
  const logrosDesbloqueados = [];
  for (const logro of logros) {
    if (await logro.condicion()) {
      logrosDesbloqueados.push({
        id: logro.id,
        nombre: logro.nombre,
        descripcion: logro.descripcion
      });
    }
  }
  
  res.json({ logros: logrosDesbloqueados });
});