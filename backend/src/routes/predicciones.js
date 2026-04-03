const express = require('express');
const router = express.Router();
const db = require('../db'); // Ajusta según tu configuración de BD

// GET - Obtener predicciones de un usuario
router.get('/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        
        const result = await db.query(
            `SELECT p.*, 
                    partido.equipo_local, partido.equipo_visitante, 
                    partido.fase, partido.fecha
             FROM predicciones p
             JOIN partidos partido ON p.partido_id = partido.id
             WHERE p.usuario_id = $1
             ORDER BY partido.fecha DESC`,
            [usuario_id]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error GET predicciones:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Crear una predicción
router.post('/', async (req, res) => {
    try {
        const { usuario_id, partido_id, goles_local, goles_visitante } = req.body;
        
        // Verificar que el partido existe y no ha comenzado
        const partidoResult = await db.query(
            'SELECT fecha FROM partidos WHERE id = $1',
            [partido_id]
        );
        
        if (partidoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        const fechaPartido = new Date(partidoResult.rows[0].fecha);
        const ahora = new Date();
        
        if (fechaPartido < ahora) {
            return res.status(400).json({ error: 'El partido ya comenzó' });
        }
        
        // Verificar que no exista una predicción previa
        const existeResult = await db.query(
            'SELECT id FROM predicciones WHERE usuario_id = $1 AND partido_id = $2',
            [usuario_id, partido_id]
        );
        
        if (existeResult.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe una predicción para este partido' });
        }
        
        // Guardar predicción
        const result = await db.query(
            `INSERT INTO predicciones (usuario_id, partido_id, goles_local, goles_visitante)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [usuario_id, partido_id, goles_local, goles_visitante]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error POST predicciones:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT - Actualizar una predicción (opcional)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { goles_local, goles_visitante } = req.body;
        
        const result = await db.query(
            `UPDATE predicciones 
             SET goles_local = $1, goles_visitante = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [goles_local, goles_visitante, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Predicción no encontrada' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error PUT predicciones:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;