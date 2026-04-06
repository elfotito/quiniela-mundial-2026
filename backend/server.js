// ===============================================
// 🎯 SERVER.JS - QUINIELA MUNDIAL 2026
// ===============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================================
// CONEXIÓN A POSTGRESQL
// ===============================================
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'postgres',
        password: process.env.DB_PASSWORD || '141092',
        port: process.env.DB_PORT || 5432,
      };

console.log('DATABASE_URL existe:', !!process.env.DATABASE_URL);

const pool = new Pool(poolConfig);

// Probar conexión
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
        // NO hacer process.exit(1) — Render reintentará
    } else {
        console.log('✅ Conexión a PostgreSQL exitosa');
        release();
    }
});

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'https://quiniela-mundial-2026-omega.vercel.app'  // ← tu URL exacta de Vercel
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-codigo-acceso']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ===============================================
// RUTAS DE AUTENTICACIÓN
// ===============================================

// POST /api/login
app.post('/api/login', async (req, res) => {
    try {
        const { codigo } = req.body;

        if (!codigo) {
            return res.status(400).json({ error: 'Código requerido' });
        }

        const query = `
            SELECT 
                id,
                nombre_publico AS nombre,
                codigo_acceso AS codigo,
                email,
                isadmin AS "isAdmin",
                esta_activo,
                campeon_elegido
            FROM usuarios 
            WHERE UPPER(codigo_acceso) = UPPER($1)
            AND esta_activo = true
        `;

        const result = await pool.query(query, [codigo]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Código incorrecto o usuario inactivo' });
        }

        const usuario = result.rows[0];
        console.log(`✅ Login: ${usuario.nombre} | Admin: ${usuario.isAdmin}`);

        res.json({
            success: true,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                codigo: usuario.codigo,
                email: usuario.email,
                campeon_elegido: usuario.campeon_elegido,
                isAdmin: usuario.isAdmin
            }
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// GET /api/usuarios/:codigo
app.get('/api/usuarios/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        
        const query = `
            SELECT 
                id, 
                nombre_publico as nombre,
                codigo_acceso, 
                total_predicciones,
                esta_activo, 
                email,
                fecha_registro, 
                ultima_prediccion
            FROM usuarios 
            WHERE codigo_acceso = $1
        `;
        
        const result = await pool.query(query, [codigo.toUpperCase()]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// RUTAS DE PARTIDOS
// ===============================================

// GET /api/partidos
app.get('/api/partidos', async (req, res) => {
    try {
        const { fase, estado, limit } = req.query;
        
        let query = `
            SELECT 
                id, 
                fecha_hora as fecha,
                equipo_local, 
                equipo_visitante,
                goles_local_real as goles_local,
                goles_visitante_real as goles_visitante,
                fase, 
                estado,
                created_at
            FROM partidos
            WHERE 1=1
        `;
        
        const params = [];
        
        if (fase) {
            params.push(fase);
            query += ` AND fase = $${params.length}`;
        }
        
        if (estado) {
            params.push(estado);
            query += ` AND estado = $${params.length}`;
        }
        
        query += ' ORDER BY fecha_hora ASC';
        
        if (limit) {
            params.push(parseInt(limit));
            query += ` LIMIT $${params.length}`;
        }
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo partidos:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// GET /api/partidos/:id
app.get('/api/partidos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                id, 
                fecha_hora as fecha,
                equipo_local, 
                equipo_visitante,
                goles_local_real as goles_local,
                goles_visitante_real as goles_visitante,
                fase, 
                estado
            FROM partidos
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error obteniendo partido:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// RUTAS ADMIN
// ===============================================

// PUT /api/admin/partidos/:id/resultado
app.put('/api/admin/partidos/:id/resultado', async (req, res) => {
    try {
        const { id } = req.params;
        const { goles_local, goles_visitante, anular } = req.body;
        
        let query, params, mensaje;
        
        if (anular === true) {
            console.log(`❌ Admin anulando resultado - Partido ${id}`);
            
            query = `
                UPDATE partidos 
                SET 
                    goles_local_real = NULL,
                    goles_visitante_real = NULL,
                    estado = 'pendiente'
                WHERE id = $1
                RETURNING *
            `;
            
            params = [id];
            mensaje = 'Resultado anulado correctamente';
            
        } else {
            if (goles_local === undefined || goles_visitante === undefined) {
                return res.status(400).json({ 
                    error: 'Se requieren goles_local y goles_visitante' 
                });
            }
            
            if (goles_local < 0 || goles_visitante < 0) {
                return res.status(400).json({ 
                    error: 'Los goles no pueden ser negativos' 
                });
            }
            
            console.log(`📝 Admin ingresando resultado - Partido ${id}: ${goles_local}-${goles_visitante}`);
            
            query = `
                UPDATE partidos 
                SET 
                    goles_local_real = $1,
                    goles_visitante_real = $2,
                    estado = 'finalizado'
                WHERE id = $3
                RETURNING *
            `;
            
            params = [goles_local, goles_visitante, id];
            mensaje = 'Resultado ingresado correctamente';
        }
        
        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        const countQuery = `SELECT COUNT(*) as total FROM predicciones WHERE partido_id = $1`;
        const countResult = await pool.query(countQuery, [id]);
        
        console.log(`✅ ${mensaje}. ${countResult.rows[0].total} predicciones actualizadas automáticamente`);
        
        res.json({
            success: true,
            mensaje,
            partido: result.rows[0],
            predicciones_actualizadas: parseInt(countResult.rows[0].total)
        });
        
    } catch (error) {
        console.error('❌ Error actualizando resultado:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// GET /api/admin/usuarios
app.get('/api/admin/usuarios', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id,
                u.codigo_acceso,
                u.nombre_publico as nombre,
                u.email,
                u.telefono,
                u.campeon_elegido,
                u.esta_activo,
                u.isadmin,
                u.fecha_registro,
                COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales,
                COUNT(p.id) as total_predicciones
            FROM usuarios u
            LEFT JOIN predicciones p ON u.id = p.usuario_id
            GROUP BY u.id, u.codigo_acceso, u.nombre_publico, u.email, u.telefono, u.campeon_elegido, u.esta_activo, u.isadmin, u.fecha_registro
            ORDER BY puntos_totales DESC
        `;

        const result = await pool.query(query);

        res.json({
            total: result.rows.length,
            usuarios: result.rows
        });

    } catch (error) {
        console.error('❌ Error listando usuarios:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// RUTAS DE PREDICCIONES
// ===============================================

// POST /api/predicciones
app.post('/api/predicciones', async (req, res) => {
    try {
        const { usuario_id, partido_id, goles_local, goles_visitante } = req.body;

        if (!usuario_id || !partido_id || goles_local === undefined || goles_visitante === undefined) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        if (goles_local < 0 || goles_local > 9 || goles_visitante < 0 || goles_visitante > 9) {
            return res.status(400).json({ error: 'Goles deben estar entre 0 y 9' });
        }

        const partidoQuery = `SELECT fecha_hora, estado FROM partidos WHERE id = $1`;
        const partidoResult = await pool.query(partidoQuery, [partido_id]);

        if (partidoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }

        const partido = partidoResult.rows[0];
        const ahora = new Date();
        const fechaPartido = new Date(partido.fecha_hora);
        const limitePrediccion = new Date(fechaPartido.getTime() - (10 * 60 * 1000));

        if (ahora > limitePrediccion) {
            return res.status(400).json({ 
                error: 'Ya no puedes predecir este partido (límite: 10 min antes del inicio)'
            });
        }

        if (partido.estado !== 'pendiente') {
            return res.status(400).json({ 
                error: 'Este partido ya no acepta predicciones'
            });
        }

        const insertQuery = `
            INSERT INTO predicciones 
            (usuario_id, partido_id, goles_local_pred, goles_visitante_pred)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [usuario_id, partido_id, goles_local, goles_visitante]);

        console.log(`✅ Predicción creada - Usuario ${usuario_id} → Partido ${partido_id}: ${goles_local}-${goles_visitante}`);

        res.status(201).json({
            success: true,
            mensaje: 'Predicción guardada correctamente',
            prediccion: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error creando predicción:', error);

        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Ya tienes una predicción para este partido' 
            });
        }

        res.status(500).json({ error: 'Error del servidor' });
    }
});

// GET /api/predicciones/:usuario_id
app.get('/api/predicciones/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;

        const query = `
            SELECT 
                p.id,
                p.partido_id,
                p.goles_local_pred,
                p.goles_visitante_pred,
                p.puntos_obtenidos,
                p.fecha_prediccion,
                m.equipo_local,
                m.equipo_visitante,
                m.fase,
                m.fecha_hora as fecha_partido,
                m.estado,
                m.goles_local_real as goles_local,
                m.goles_visitante_real as goles_visitante
            FROM predicciones p
            JOIN partidos m ON p.partido_id = m.id
            WHERE p.usuario_id = $1
            ORDER BY m.fecha_hora ASC
        `;

        const result = await pool.query(query, [usuario_id]);

        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error obteniendo predicciones:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// RUTAS DE RANKING
// ===============================================

// GET /api/ranking
app.get('/api/ranking', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id,
                u.nombre_publico as nombre,
                u.codigo_acceso,
                COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) as total_predicciones,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos > 0) as aciertos,
                ROUND(
                    CASE 
                        WHEN COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) > 0 
                        THEN (COUNT(p.id) FILTER (WHERE p.puntos_obtenidos > 0)::numeric / 
                              COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL)::numeric * 100)
                        ELSE 0 
                    END, 
                1) as efectividad
            FROM usuarios u
            LEFT JOIN predicciones p ON u.id = p.usuario_id
            WHERE u.esta_activo = true
            GROUP BY u.id, u.nombre_publico, u.codigo_acceso
            ORDER BY puntos_totales DESC, aciertos DESC
        `;

        const result = await pool.query(query);

        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error generando ranking:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// GET /api/ranking/top
app.get('/api/ranking/top', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id,
                u.nombre_publico as nombre,
                COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales
            FROM usuarios u
            LEFT JOIN predicciones p ON u.id = p.usuario_id
            WHERE u.esta_activo = true
            GROUP BY u.id, u.nombre_publico
            ORDER BY puntos_totales DESC
            LIMIT 5
        `;

        const result = await pool.query(query);

        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error obteniendo top 5:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.get('/api/ranking/detallado', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id,
                u.nombre_publico,
                u.codigo_acceso,
                u.campeon_elegido,
                em.bandera_emoji as bandera_campeon,
                COALESCE(
                    json_agg(DISTINCT ul.liga_id) FILTER (WHERE ul.liga_id IS NOT NULL),
                    '[]'
                ) as ligas,
                
                -- Puntos por fase (necesitas la columna 'fase' en tabla partidos)
                COALESCE(
                    SUM(CASE WHEN p.fase IN (
                        'Grupo A', 'Grupo B', 'Grupo C', 'Grupo D', 'Grupo E', 'Grupo F',
                        'Grupo G', 'Grupo H', 'Grupo I', 'Grupo J', 'Grupo K', 'Grupo L'
                    ) THEN pr.puntos_obtenidos ELSE 0 END), 
                    0
                ) as puntos_grupos,
                COALESCE(
                    SUM(CASE WHEN p.fase = '16vos' THEN pr.puntos_obtenidos ELSE 0 END), 
                    0
                ) as puntos_16avos,
                COALESCE(
                    SUM(CASE WHEN p.fase = '8vos' THEN pr.puntos_obtenidos ELSE 0 END), 
                    0
                ) as puntos_8vos,
                COALESCE(
                    SUM(CASE WHEN p.fase = '4tos' THEN pr.puntos_obtenidos ELSE 0 END), 
                    0
                ) as puntos_4tos,
                COALESCE(
                    SUM(CASE WHEN p.fase = 'Semifinal' THEN pr.puntos_obtenidos ELSE 0 END), 
                    0
                ) as puntos_semis,
                COALESCE(
                    SUM(CASE WHEN p.fase = '3er puesto' THEN pr.puntos_obtenidos ELSE 0 END), 
                    0
                ) as puntos_tercer_puesto,
                COALESCE(
                    SUM(CASE WHEN p.fase = 'Final' THEN pr.puntos_obtenidos ELSE 0 END), 
                    0
                ) as puntos_final,
                COALESCE(SUM(pr.puntos_obtenidos), 0) as puntos_totales,
                COUNT(pr.id) as total_predicciones
                
            FROM usuarios u
            LEFT JOIN predicciones pr ON u.id = pr.usuario_id
            LEFT JOIN partidos p ON pr.partido_id = p.id
            LEFT JOIN usuario_ligas ul ON u.id = ul.usuario_id
            LEFT JOIN equipos_mundial em ON u.campeon_elegido = em.codigo_fifa
            WHERE u.esta_activo = true
            GROUP BY u.id, u.nombre_publico, u.codigo_acceso, u.campeon_elegido, em.bandera_emoji
            ORDER BY puntos_totales DESC, total_predicciones DESC
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            data: result.rows
        });
        
    } catch (error) {
        console.error('Error en /api/ranking/detallado:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener ranking detallado'
        });
    }
});

// ===============================================
// RUTAS DE ESTADÍSTICAS
// ===============================================

// GET /api/estadisticas/usuario/:id
app.get('/api/estadisticas/usuario/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            WITH user_stats AS (
                SELECT 
                    COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales,
                    COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) as total_predicciones,
                    COUNT(p.id) FILTER (WHERE p.puntos_obtenidos > 0) as aciertos
                FROM predicciones p
                WHERE p.usuario_id = $1
            ),
            user_rank AS (
                SELECT 
                    u.id,
                    ROW_NUMBER() OVER (
                        ORDER BY COALESCE(SUM(p.puntos_obtenidos), 0) DESC
                    ) as posicion
                FROM usuarios u
                LEFT JOIN predicciones p ON u.id = p.usuario_id
                WHERE u.esta_activo = true
                GROUP BY u.id
            )
            SELECT 
                us.*,
                COALESCE(ur.posicion, 0) as posicion_ranking,
                ROUND(
                    CASE 
                        WHEN us.total_predicciones > 0 
                        THEN (us.aciertos::numeric / us.total_predicciones::numeric * 100)
                        ELSE 0 
                    END, 
                1) as efectividad
            FROM user_stats us
            LEFT JOIN user_rank ur ON ur.id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.json({
                puntos_totales: 0,
                total_predicciones: 0,
                aciertos: 0,
                posicion_ranking: 0,
                efectividad: 0
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// RUTAS DE LIGAS Y EQUIPOS
// ===============================================

// GET /api/ligas
app.get('/api/ligas', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                nombre,
                descripcion,
                icono,
                color
            FROM ligas
            WHERE esta_activa = true
            ORDER BY nombre ASC
        `;

        const result = await pool.query(query);
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error obteniendo ligas:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// GET /api/equipos
app.get('/api/equipos', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                nombre,
                codigo_fifa,
                bandera_emoji
            FROM equipos_mundial
            ORDER BY nombre ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error obteniendo equipos:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// RUTAS DE REGISTRO
// ===============================================

// POST /api/registro
app.post('/api/registro', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { nombre_publico, codigo_acceso, telefono, campeon_elegido, ligas } = req.body;

        if (!nombre_publico || !codigo_acceso || !telefono) {
            return res.status(400).json({ 
                error: 'Faltan campos obligatorios: nombre_publico, codigo_acceso, telefono' 
            });
        }

        if (!campeon_elegido) {
            return res.status(400).json({ 
                error: 'Debes seleccionar un equipo campeón' 
            });
        }

        if (!ligas || ligas.length === 0) {
            return res.status(400).json({ 
                error: 'Debes seleccionar al menos una liga' 
            });
        }

                // Validar que tenga al menos letras Y números
        const tieneLetras = /[a-zA-Z]/.test(codigo_acceso);
        const tieneNumeros = /[0-9]/.test(codigo_acceso);

        if (!tieneLetras || !tieneNumeros) {
            return res.status(400).json({ 
                error: 'El código debe contener al menos una letra y un número' 
            });
        }

        // Validar que solo tenga caracteres permitidos
        if (!/^[A-Za-z0-9_-]+$/.test(codigo_acceso)) {
            return res.status(400).json({ 
                error: 'El código solo puede contener letras, números, guiones(-) y guiones bajos(_)' 
            });
        }

        // Validar longitud mínima
        if (codigo_acceso.length < 6) {
            return res.status(400).json({ 
                error: 'El código debe tener al menos 6 caracteres' 
            });
        }

        await client.query('BEGIN');

        const checkQuery = `SELECT id FROM usuarios WHERE UPPER(codigo_acceso) = UPPER($1)`;
        const checkResult = await client.query(checkQuery, [codigo_acceso]);

        if (checkResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Ese código no esta autorizado. Por favor elige otro.' 
            });
        }

        const checkEquipoQuery = `SELECT codigo_fifa FROM equipos_mundial WHERE codigo_fifa = $1`;
        const checkEquipoResult = await client.query(checkEquipoQuery, [campeon_elegido]);

        if (checkEquipoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'El equipo seleccionado no es válido' 
            });
        }

        const insertUserQuery = `
            INSERT INTO usuarios (
                codigo_acceso,
                nombre_publico,
                telefono,
                campeon_elegido,
                esta_activo,
                isadmin,
                fecha_registro
            ) VALUES ($1, $2, $3, $4, true, false, CURRENT_TIMESTAMP)
            RETURNING id, codigo_acceso, nombre_publico, telefono, campeon_elegido
        `;

        const userResult = await client.query(insertUserQuery, [
            codigo_acceso.toUpperCase(),
            nombre_publico,
            telefono,
            campeon_elegido
        ]);

        const nuevoUsuario = userResult.rows[0];

        const insertLigasQuery = `INSERT INTO usuario_ligas (usuario_id, liga_id) VALUES ($1, $2)`;

        for (const ligaId of ligas) {
            await client.query(insertLigasQuery, [nuevoUsuario.id, ligaId]);
        }

        await client.query('COMMIT');

        console.log(`✅ Usuario registrado: ${nuevoUsuario.nombre_publico} (${nuevoUsuario.codigo_acceso}) - Campeón: ${nuevoUsuario.campeon_elegido}`);

        res.status(201).json({
            success: true,
            mensaje: 'Usuario registrado exitosamente',
            usuario: {
                id: nuevoUsuario.id,
                nombre: nuevoUsuario.nombre_publico,
                codigo: nuevoUsuario.codigo_acceso,
                telefono: nuevoUsuario.telefono,
                campeon: nuevoUsuario.campeon_elegido
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en registro:', error);
        res.status(500).json({ error: 'Error del servidor' });
    } finally {
        client.release();
    }
});

// GET /api/usuarios/:id/ligas
app.get('/api/usuarios/:id/ligas', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                l.id,
                l.nombre,
                l.icono,
                l.color
            FROM ligas l
            JOIN usuario_ligas ul ON l.id = ul.liga_id
            WHERE ul.usuario_id = $1
            ORDER BY l.nombre ASC
        `;

        const result = await pool.query(query, [id]);
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error obteniendo ligas del usuario:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// GET /api/ranking/liga/:ligaId
app.get('/api/ranking/liga/:ligaId', async (req, res) => {
    try {
        const { ligaId } = req.params;

        const query = `
            SELECT 
                u.id,
                u.nombre_publico as nombre,
                u.codigo_acceso,
                COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) as total_predicciones,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos > 0) as aciertos,
                ROUND(
                    CASE 
                        WHEN COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) > 0 
                        THEN (COUNT(p.id) FILTER (WHERE p.puntos_obtenidos > 0)::numeric / 
                              COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL)::numeric * 100)
                        ELSE 0 
                    END, 
                1) as efectividad
            FROM usuarios u
            JOIN usuario_ligas ul ON u.id = ul.usuario_id
            LEFT JOIN predicciones p ON u.id = p.usuario_id
            WHERE ul.liga_id = $1 AND u.esta_activo = true
            GROUP BY u.id, u.nombre_publico, u.codigo_acceso
            ORDER BY puntos_totales DESC, aciertos DESC
        `;

        const result = await pool.query(query, [ligaId]);
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error generando ranking de liga:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});
// ===============================================
// RUTAS DE GESTIÓN DE PREDICCIONES (ADMIN)
// ===============================================

// DELETE /api/admin/predicciones/:id
app.delete('/api/admin/predicciones/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            DELETE FROM predicciones 
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Predicción no encontrada' });
        }

        console.log(`✅ Predicción ${id} eliminada`);

        res.json({
            success: true,
            mensaje: 'Predicción eliminada correctamente',
            prediccion: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error eliminando predicción:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// GET /api/admin/predicciones/partido/:partidoId
app.get('/api/admin/predicciones/partido/:partidoId', async (req, res) => {
    try {
        const { partidoId } = req.params;

        const query = `
            SELECT 
                p.id,
                p.usuario_id,
                p.goles_local_pred,
                p.goles_visitante_pred,
                p.puntos_obtenidos,
                p.fecha_prediccion,
                u.nombre_publico,
                u.codigo_acceso
            FROM predicciones p
            JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.partido_id = $1
            ORDER BY p.fecha_prediccion DESC
        `;

        const result = await pool.query(query, [partidoId]);

        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error obteniendo predicciones del partido:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// RUTA MR. CHIP - ANÁLISIS DE PREDICCIONES
// ===============================================

// GET /api/mrchip/partido/:partido_id
// Obtiene todas las predicciones de un partido agrupadas por tipo
app.get('/api/mrchip/partido/:partido_id', async (req, res) => {
    try {
        const { partido_id } = req.params;

        // Query principal: obtener datos del partido y predicciones
        const query = `
            SELECT 
                m.id as partido_id,
                m.equipo_local,
                m.equipo_visitante,
                m.fecha_hora,
                m.fase,
                m.estado,
                m.goles_local_real,
                m.goles_visitante_real,
                
                -- Predicciones
                p.id as prediccion_id,
                p.usuario_id,
                p.goles_local_pred,
                p.goles_visitante_pred,
                p.puntos_obtenidos,
                
                -- Usuario
                u.nombre_publico as nombre_usuario,
                u.campeon_elegido,
                
                -- Clasificación de la predicción
                CASE 
                    WHEN p.goles_local_pred > p.goles_visitante_pred THEN 'local'
                    WHEN p.goles_local_pred < p.goles_visitante_pred THEN 'visitante'
                    ELSE 'empate'
                END as prediccion_tipo
                
            FROM partidos m
            LEFT JOIN predicciones p ON m.id = p.partido_id
            LEFT JOIN usuarios u ON p.usuario_id = u.id AND u.esta_activo = true
            WHERE m.id = $1
            ORDER BY 
                CASE 
                    WHEN p.goles_local_pred > p.goles_visitante_pred THEN 1
                    WHEN p.goles_local_pred = p.goles_visitante_pred THEN 2
                    ELSE 3
                END,
                u.nombre_publico
        `;

        const result = await pool.query(query, [partido_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Partido no encontrado' 
            });
        }

        // Separar datos del partido y predicciones
        const partido = {
            id: result.rows[0].partido_id,
            equipo_local: result.rows[0].equipo_local,
            equipo_visitante: result.rows[0].equipo_visitante,
            fecha_hora: result.rows[0].fecha_hora,
            fase: result.rows[0].fase,
            estado: result.rows[0].estado,
            goles_local_real: result.rows[0].goles_local_real,
            goles_visitante_real: result.rows[0].goles_visitante_real
        };

        // Agrupar predicciones por tipo
        const predicciones = {
            local: [],
            empate: [],
            visitante: []
        };

        result.rows.forEach(row => {
            if (row.prediccion_id) {
                const pred = {
                        id: row.prediccion_id,
                        usuario_id: row.usuario_id,
                        nombre: row.nombre_usuario,
                        campeon_elegido: row.campeon_elegido,
                        goles_local: row.goles_local_pred,
                        goles_visitante: row.goles_visitante_pred,
                        puntos: row.puntos_obtenidos
                    };
                predicciones[row.prediccion_tipo].push(pred);
            }
        });

        res.json({
            partido,
            predicciones,
            total_predicciones: result.rows.filter(r => r.prediccion_id).length
        });

    } catch (error) {
        console.error('Error en /api/mrchip/partido:', error);
        res.status(500).json({ 
            error: 'Error del servidor' 
        });
    }
});

// GET /api/mrchip/usuarios-sin-prediccion/:partido_id
// Obtiene usuarios que NO han predicho un partido específico
app.get('/api/mrchip/usuarios-sin-prediccion/:partido_id', async (req, res) => {
    try {
        const { partido_id } = req.params;

        const query = `
            SELECT 
                u.id,
                u.nombre_publico as nombre,
                u.campeon_elegido
            FROM usuarios u
            WHERE u.esta_activo = true
            AND u.id NOT IN (
                SELECT usuario_id 
                FROM predicciones 
                WHERE partido_id = $1
            )
            ORDER BY u.nombre_publico
        `;

        const result = await pool.query(query, [partido_id]);

        res.json(result.rows);

    } catch (error) {
        console.error('Error obteniendo usuarios sin predicción:', error);
        res.status(500).json({ 
            error: 'Error del servidor' 
        });
    }
});

// GET /api/mrchip/proximo-partido
// Obtiene el próximo partido pendiente con fecha más cercana
app.get('/api/mrchip/proximo-partido', async (req, res) => {
    try {
        const query = `
            SELECT id
            FROM partidos
            WHERE estado = 'pendiente' 
            AND fecha_hora > NOW()
            ORDER BY fecha_hora ASC
            LIMIT 1
        `;

        const result = await pool.query(query);

        if (result.rows.length === 0) {
            // Si no hay pendientes, devolver el último partido
            const ultimoQuery = `
                SELECT id
                FROM partidos
                ORDER BY fecha_hora DESC
                LIMIT 1
            `;
            const ultimoResult = await pool.query(ultimoQuery);
            return res.json(ultimoResult.rows[0] || { id: 1 });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error obteniendo próximo partido:', error);
        res.status(500).json({ 
            error: 'Error del servidor' 
        });
    }
});

// ===============================================
// AGREGAR AL FINAL DE TU SERVER.JS (antes del app.listen)
// ===============================================

// PATCH /api/usuarios/:id/estado - Activar/Desactivar usuario
app.patch('/api/usuarios/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        
        const query = `
            UPDATE usuarios 
            SET esta_activo = $1
            WHERE id = $2
            RETURNING id, nombre_publico, esta_activo
        `;
        
        const result = await pool.query(query, [activo, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`✅ Usuario ${id} ${activo ? 'activado' : 'desactivado'}`);
        
        res.json({
            success: true,
            usuario: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Error actualizando estado:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// FIN - Agregar antes de app.listen()
// ===============================================
// ===============================================
// INICIAR SERVIDOR
// ===============================================

app.listen(PORT, () => {
    console.log(`\n🚀 ===================================`);
    console.log(`   SERVIDOR QUINIELA MUNDIAL 2026`);
    console.log(`   Puerto: ${PORT}`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`===================================\n`);
});