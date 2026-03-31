// Crea el archivo src/middleware/auth.js
// src/middleware/auth.js - Middleware de autenticación
const pool = require("../db");

// Middleware para verificar código de acceso
const verificarUsuario = async (req, res, next) => {
  try {
    // Obtener código de acceso de header, query param o body
    const codigoAcceso = req.headers['x-codigo-acceso'] || 
                        req.query.codigo || 
                        req.body.codigo_acceso;

    if (!codigoAcceso) {
      return res.status(401).json({ 
        error: "Se requiere código de acceso",
        instruccion: "Enviar 'x-codigo-acceso' en headers o 'codigo' en query params"
      });
    }

    // Buscar usuario en la base de datos
    const query = `
      SELECT id, codigo_acceso, nombre_publico, esta_activo
      FROM usuarios 
      WHERE codigo_acceso = $1 AND esta_activo = true
    `;
    
    const result = await pool.query(query, [codigoAcceso]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: "Código de acceso inválido o usuario inactivo",
        codigo_proporcionado: codigoAcceso
      });
    }

    // Adjuntar usuario a la request para usar en rutas
    req.usuario = result.rows[0];
    next();
  } catch (error) {
    console.error("❌ Error en autenticación:", error);
    res.status(500).json({ 
      error: "Error en autenticación",
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware para verificar si es administrador (simple)
// En tu sistema, podrías tener un campo 'es_admin' en la tabla usuarios
const esAdministrador = (req, res, next) => {
  // Por ahora, asumimos que usuarios con código que empieza con ADMIN son admins
  // En producción, esto debería venir de la base de datos
  const esAdmin = req.usuario?.codigo_acceso?.startsWith('ADMIN');
  
  if (!esAdmin) {
    return res.status(403).json({ 
      error: "Acceso denegado. Se requieren permisos de administrador",
      usuario_actual: req.usuario?.nombre_publico,
      codigo_usuario: req.usuario?.codigo_acceso
    });
  }
  
  next();
};

module.exports = {
  verificarUsuario,
  esAdministrador
};