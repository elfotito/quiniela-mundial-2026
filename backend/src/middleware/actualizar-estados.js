const pool = require('../src/db');
const cron = require('node-cron');

async function actualizarEstadosPartidos() {
  try {
    const ahora = new Date();
    
    // 1. Partidos que están por empezar (1 hora antes)
    await pool.query(`
      UPDATE partidos 
      SET estado = 'por comenzar' 
      WHERE estado = 'pendiente' 
      AND fecha_hora <= $1 
      AND fecha_hora >= $2
    `, [
      new Date(ahora.getTime() + 1 * 60 * 1000), // 1 hora en el futuro
      ahora
    ]);

    // 2. Partidos que jugando (1 hora antes)
    await pool.query(`
        UPDATE partidos 
        SET estado = 'jugando' 
        WHERE estado IN ('pendiente', 'por comenzar') 
        AND fecha_hora <= $1  -- Ya pasó la hora de inicio
        AND fecha_hora >= $2  -- Pero no hace más de 2 horas
`, [
  ahora,  // Ya comenzó (fecha_hora <= ahora)
  new Date(ahora.getTime() - 2 * 60 * 60 * 1000)  // No hace más de 2 horas
]);
    
    // 2. Partidos que ya finalizaron (2 horas después de empezar)
    await pool.query(`
      UPDATE partidos 
      SET estado = 'finalizado' 
      WHERE estado = 'jugando' 
      AND fecha_hora <= $1
    `, [new Date(ahora.getTime() - 2 * 60 * 60 * 1000)]);
    
    console.log('🔄 Estados de partidos actualizados');
  } catch (error) {
    console.error('❌ Error actualizando estados:', error);
  }
}

// Ejecutar cada 5 minutos
cron.schedule('*/5 * * * *', actualizarEstadosPartidos);

// Ejecutar inmediatamente
actualizarEstadosPartidos();