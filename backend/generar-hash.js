const bcrypt = require('bcrypt');
bcrypt.hash('VIK101', 10).then(hash => {
    console.log('Tu hash es:');
    console.log(hash);
    console.log('\nEjecuta esto en Supabase SQL Editor:');
    console.log(`UPDATE usuarios SET codigo_acceso = '${hash}' WHERE id = 1;`);
});