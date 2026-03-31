// REEMPLAZA TODO el contenido de src/db.js con:
// src/db.js - Conexión REAL a PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔌 Configurando conexión a PostgreSQL...');
console.log(`📊 Base de datos: ${process.env.DB_NAME}`);
console.log(`👤 Usuario: ${process.env.DB_USER}`);
console.log(`📍 Host: ${process.env.DB_HOST}`);

// Configuración del pool de conexiones
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  max: 20, // máximo de clientes en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Manejo de errores de conexión
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
  process.exit(-1);
});

// Probar conexión al iniciar
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL exitosamente');
    
    // Verificar tablas existentes
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('📋 Tablas en la base de datos:');
    tablesRes.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });
    
    // Verificar conteo de registros
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) FROM partidos'),
      client.query('SELECT COUNT(*) FROM usuarios'),
      client.query('SELECT COUNT(*) FROM predicciones')
    ]);
    
    console.log('📊 Conteo de registros:');
    console.log(`   - Partidos: ${counts[0].rows[0].count}`);
    console.log(`   - Usuarios: ${counts[1].rows[0].count}`);
    console.log(`   - Predicciones: ${counts[2].rows[0].count}`);
    
    client.release();
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    console.log('💡 Posibles soluciones:');
    console.log('   1. Verifica que PostgreSQL esté corriendo');
    console.log('   2. Revisa usuario/contraseña en .env');
    console.log('   3. Verifica que la BD "predicciones_mundial2026" exista');
    console.log('   4. Prueba: psql -U postgres -h localhost -d predicciones_mundial2026');
  }
}

// Ejecutar test de conexión
testConnection();

// Exportar el pool
module.exports = pool;