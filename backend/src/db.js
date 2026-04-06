// src/db.js
const { Pool } = require('pg');
require('dotenv').config();

let poolConfig;

// Si existe DATABASE_URL (Render + Supabase), la usa
// Si no, usa las variables separadas (desarrollo local)
if (process.env.DATABASE_URL) {
  console.log('🌐 Usando DATABASE_URL (producción)');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Requerido por Supabase
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
} else {
  console.log('💻 Usando variables locales (desarrollo)');
  poolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool:', err.message);
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL conectado:', res.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
  }
}

testConnection();

module.exports = pool;