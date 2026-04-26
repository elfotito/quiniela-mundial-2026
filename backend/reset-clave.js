require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    family: 4
});

async function resetClave(usuarioId, nuevaClave) {
    const hash = await bcrypt.hash(nuevaClave.toUpperCase(), 10);
    
    const result = await pool.query(
        `UPDATE usuarios 
         SET codigo_acceso = $1 
         WHERE id = $2 
         RETURNING nombre_publico, telefono`,
        [hash, usuarioId]
    );

    if (result.rows.length === 0) {
        console.log('❌ Usuario no encontrado');
    } else {
        console.log(`✅ Clave reseteada para: ${result.rows[0].nombre_publico}`);
        console.log(`   Teléfono: ${result.rows[0].telefono}`);
        console.log(`   Nueva clave: ${nuevaClave.toUpperCase()}`);
    }

    await pool.end();
}

const [,, id, clave] = process.argv;

if (!id || !clave) {
    console.log('Uso: node reset-clave.js <id> <nueva_clave>');
    console.log('Ejemplo: node reset-clave.js 1 VIK101');
    process.exit(1);
}

resetClave(id, clave);