// Crea el archivo src/middleware/validaciones.js
// src/middleware/validaciones.js - Middleware para validar datos
const validarPrediccion = (req, res, next) => {
  const { usuario_id, partido_id, goles_local_pred, goles_visitante_pred } = req.body;

  // Validar campos requeridos
  const camposRequeridos = [];
  if (!usuario_id) camposRequeridos.push("usuario_id");
  if (!partido_id) camposRequeridos.push("partido_id");
  if (goles_local_pred === undefined) camposRequeridos.push("goles_local_pred");
  if (goles_visitante_pred === undefined) camposRequeridos.push("goles_visitante_pred");

  if (camposRequeridos.length > 0) {
    return res.status(400).json({
      error: "Campos requeridos faltantes",
      campos_faltantes: camposRequeridos,
      ejemplo: {
        usuario_id: 1,
        partido_id: 1,
        goles_local_pred: 2,
        goles_visitante_pred: 1
      }
    });
  }

  // Validar tipos de datos
  if (!Number.isInteger(Number(usuario_id)) || Number(usuario_id) <= 0) {
    return res.status(400).json({ 
      error: "usuario_id debe ser un número entero positivo",
      valor_recibido: usuario_id,
      tipo_recibido: typeof usuario_id
    });
  }

  if (!Number.isInteger(Number(partido_id)) || Number(partido_id) <= 0) {
    return res.status(400).json({ 
      error: "partido_id debe ser un número entero positivo",
      valor_recibido: partido_id,
      tipo_recibido: typeof partido_id
    });
  }

  if (!Number.isInteger(Number(goles_local_pred)) || Number(goles_local_pred) < 0) {
    return res.status(400).json({ 
      error: "goles_local_pred debe ser un número entero no negativo",
      valor_recibido: goles_local_pred,
      tipo_recibido: typeof goles_local_pred
    });
  }

  if (!Number.isInteger(Number(goles_visitante_pred)) || Number(goles_visitante_pred) < 0) {
    return res.status(400).json({ 
      error: "goles_visitante_pred debe ser un número entero no negativo",
      valor_recibido: goles_visitante_pred,
      tipo_recibido: typeof goles_visitante_pred
    });
  }

  // Validar límites razonables (máximo 10 goles por equipo)
  if (Number(goles_local_pred) > 9 || Number(goles_visitante_pred) > 9) {
    return res.status(400).json({ 
      error: "AH NO VALE, se te fue el dedo o enserio crees que van a meter mas de 9 goles",
      goles_local_pred: goles_local_pred,
      goles_visitante_pred: goles_visitante_pred
    });
  }

  // Convertir a números para que las rutas no tengan que hacerlo
  req.body.usuario_id = Number(usuario_id);
  req.body.partido_id = Number(partido_id);
  req.body.goles_local_pred = Number(goles_local_pred);
  req.body.goles_visitante_pred = Number(goles_visitante_pred);

  next();
};

const validarResultadoPartido = (req, res, next) => {
  const { goles_local_real, goles_visitante_real } = req.body;

  if (goles_local_real === undefined || goles_visitante_real === undefined) {
    return res.status(400).json({ 
      error: "Se requieren goles_local_real y goles_visitante_real",
      ejemplo: {
        goles_local_real: 2,
        goles_visitante_real: 1
      }
    });
  }

  if (!Number.isInteger(Number(goles_local_real)) || Number(goles_local_real) < 0) {
    return res.status(400).json({ 
      error: "goles_local_real debe ser un número entero no negativo",
      valor_recibido: goles_local_real,
      tipo_recibido: typeof goles_local_real
    });
  }

  if (!Number.isInteger(Number(goles_visitante_real)) || Number(goles_visitante_real) < 0) {
    return res.status(400).json({ 
      error: "goles_visitante_real debe ser un número entero no negativo",
      valor_recibido: goles_visitante_real,
      tipo_recibido: typeof goles_visitante_real
    });
  }

  // Convertir a números
  req.body.goles_local_real = Number(goles_local_real);
  req.body.goles_visitante_real = Number(goles_visitante_real);

  next();
};

const validarCodigoAcceso = (req, res, next) => {
  const codigoAcceso = req.headers['x-codigo-acceso'] || 
                      req.query.codigo || 
                      req.body.codigo_acceso;

  if (!codigoAcceso) {
    return res.status(401).json({ 
      error: "Se requiere código de acceso",
      instruccion: "Enviar 'x-codigo-acceso' en headers o 'codigo' en query params",
      ejemplo_headers: {
        "x-codigo-acceso": "TU_CODIGO_AQUI"
      },
      ejemplo_query: "?codigo=TU_CODIGO_AQUI"
    });
  }

  // Validar formato básico (puedes ajustar según tus necesidades)
  if (typeof codigoAcceso !== 'string' || codigoAcceso.trim().length === 0) {
    return res.status(400).json({ 
      error: "Código de acceso inválido",
      valor_recibido: codigoAcceso
    });
  }

  next();
};

module.exports = {
  validarPrediccion,
  validarResultadoPartido,
  validarCodigoAcceso
};