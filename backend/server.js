// ===============================================
// 🎯 SERVER.JS - QUINIELA MUNDIAL 2026
// ===============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit')
const bcrypt = require('bcrypt');
const { enviarNotificacion } = require('./pushNotifications');
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,
    message: { error: '¡A los vestidores! Analiza tu táctica (y tu contraseña), nos vemos en 15 minutos para seguir jugando' },
    standardHeaders: true,
    legacyHeaders: false
});
const registroLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,
    message: { error: '¡Hay fila en el ingreso al estadio! Tómate una hora para buscar estacionamiento y las primeras cervezas' },
    standardHeaders: true,
    legacyHeaders: false
});
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;


const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        family: 4 
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'postgres',
        password: process.env.DB_PASSWORD || '141092',
        port: process.env.DB_PORT || 5432,
      };

console.log('DATABASE_URL existe:', !!process.env.DATABASE_URL);

const pool = new Pool({
    ...poolConfig,
    max: 20,                          
    idleTimeoutMillis: 30000,         
    connectionTimeoutMillis: 10000,   
    allowExitOnIdle: true
    });            

const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Tipo de archivo no permitido'));
    }
});
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
        'https://quiniela-mundial-2026-omega.vercel.app',
        'https://quinielacarrisan.com.ve'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-codigo-acceso', 'x-usuario-id']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================================
// 🛡️ MIDDLEWARE DE SEGURIDAD - CABECERAS HTTP
// ===============================================
app.use((req, res, next) => {
    res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
    );
    
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
    res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https://quinielamundial2026.onrender.com; " +
    "frame-src 'self' https://www.youtube.com https://youtu.be; " +
    "img-src 'self' https: data:; " +
    "script-src 'self' https: 'unsafe-inline'; " +
    "style-src 'self' https: 'unsafe-inline'; " +
    "connect-src 'self' https: wss://aohnbafexgwkugtfryrk.supabase.co"
);
    
    res.removeHeader('X-Powered-By');
    
    next();
});
// ===============================================
// 🛡️ MIDDLEWARE - VERIFICAR ADMIN
// ===============================================
const verificarAdmin = async (req, res, next) => {
    try {
        const usuarioId = req.headers['x-usuario-id'];

        if (!usuarioId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const result = await pool.query(
            `SELECT id FROM usuarios 
             WHERE id = $1 
             AND isadmin = true 
             AND esta_activo = true`,
            [usuarioId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        next();
    } catch (error) {
        console.error('❌ Error verificando admin:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
// ===============================================
// RUTAS DE AUTENTICACIÓN
// ===============================================

// POST /api/login
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { codigo } = req.body;

        if (!codigo) {
            return res.status(400).json({ error: 'Código requerido' });
        }

        // Traer todos los usuarios activos
        const result = await pool.query(`
            SELECT 
                id,
                nombre_publico AS nombre,
                codigo_acceso,
                isadmin AS "isAdmin",
                esta_activo,
                campeon_elegido
            FROM usuarios 
            WHERE esta_activo = true
        `);

        // Buscar cuál usuario tiene el hash que coincide
        let usuarioEncontrado = null;
        for (const usuario of result.rows) {
            const coincide = await bcrypt.compare(
                codigo.toUpperCase(), 
                usuario.codigo_acceso
            );
            if (coincide) {
                usuarioEncontrado = usuario;
                break;
            }
        }

        if (!usuarioEncontrado) {
            // Registrar intento fallido
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            await pool.query(
                `INSERT INTO login_intentos (ip, exitoso) VALUES ($1, false)`,
                [ip]
            );
            return res.status(401).json({ error: 'Código incorrecto o usuario inactivo' });
        }

        console.log(`✅ Login: ${usuarioEncontrado.nombre}`);

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await pool.query(
            `INSERT INTO login_intentos (ip, exitoso) VALUES ($1, true)`,
            [ip]
        );
        res.json({
            success: true,
            usuario: {
                id: usuarioEncontrado.id,
                nombre: usuarioEncontrado.nombre,
                codigo: codigo.toUpperCase(),
                campeon_elegido: usuarioEncontrado.campeon_elegido,
                isAdmin: usuarioEncontrado.isAdmin
            }
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
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
app.put('/api/admin/partidos/:id/resultado', verificarAdmin, async (req, res) => {
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
app.get('/api/admin/usuarios', verificarAdmin, async (req, res) => {
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
                u.campeon_elegido,
                COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) as total_predicciones,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos > 0) as aciertos,
                ROUND(
                    CASE 
                        WHEN COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) > 0 
                        THEN (
                            SUM(
                                CASE 
                                    WHEN p.puntos_obtenidos = 0 THEN 0
                                    WHEN p.puntos_obtenidos = 2 THEN 22.22
                                    WHEN p.puntos_obtenidos = 5 THEN 55.55
                                    WHEN p.puntos_obtenidos = 7 THEN 77.77
                                    WHEN p.puntos_obtenidos = 9 THEN 100
                                    ELSE 0
                                END
                            ) / COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL)
                        )
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
                u.campeon_elegido,
                COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos = 9) as aciertos_9,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos = 7) as aciertos_7,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos = 5) as aciertos_5,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos = 2) as aciertos_2
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
// GET /api/estadisticas/usuario/:id
app.get('/api/estadisticas/usuario/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            WITH user_stats AS (
                SELECT 
                    COALESCE(SUM(p.puntos_obtenidos), 0) as puntos_totales,
                    COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) as total_predicciones,
                    COUNT(p.id) FILTER (WHERE p.puntos_obtenidos > 0) as aciertos,
                    ROUND(
                        CASE 
                            WHEN COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) > 0 
                            THEN (
                                SUM(
                                    CASE 
                                        WHEN p.puntos_obtenidos = 0 THEN 0
                                        WHEN p.puntos_obtenidos = 2 THEN 22.22
                                        WHEN p.puntos_obtenidos = 5 THEN 55.55
                                        WHEN p.puntos_obtenidos = 7 THEN 77.77
                                        WHEN p.puntos_obtenidos = 9 THEN 100
                                        ELSE 0
                                    END
                                )::numeric / COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL)
                            )
                            ELSE 0 
                        END, 
                    1) as efectividad
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
                us.puntos_totales,
                us.total_predicciones,
                us.aciertos,
                us.efectividad,
                COALESCE(ur.posicion, 0) as posicion_ranking
            FROM user_stats us
            CROSS JOIN user_rank ur
            WHERE ur.id = $1
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
app.post('/api/registro', registroLimiter, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { nombre_publico, codigo_acceso, telefono, campeon_elegido, ligas } = req.body;
        if (req.body.website) {
            // Bot detectado — respuesta falsa de éxito
            return res.status(201).json({
                success: true,
                mensaje: 'Usuario registrado exitosamente'
            });
        }
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
        const codigoHash = await bcrypt.hash(codigo_acceso.toUpperCase(), 10);
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
            codigoHash,
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
                
                -- Contadores individuales (lo que necesitas)
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos = 9) as aciertos_9,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos = 7) as aciertos_7,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos = 5) as aciertos_5,
                COUNT(p.id) FILTER (WHERE p.puntos_obtenidos = 2) as aciertos_2,
                
                ROUND(
                    CASE 
                        WHEN COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL) > 0 
                        THEN (
                            SUM(
                                CASE 
                                    WHEN p.puntos_obtenidos = 0 THEN 0
                                    WHEN p.puntos_obtenidos = 2 THEN 22.22
                                    WHEN p.puntos_obtenidos = 5 THEN 55.55
                                    WHEN p.puntos_obtenidos = 7 THEN 77.77
                                    WHEN p.puntos_obtenidos = 9 THEN 100
                                    ELSE 0
                                END
                            ) / COUNT(p.id) FILTER (WHERE p.puntos_obtenidos IS NOT NULL)
                        )
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

// GET /api/mrchip/duelo/:idA/:idB
// Comparación cabeza a cabeza entre dos participantes, partido por partido
app.get('/api/mrchip/duelo/:idA/:idB', async (req, res) => {
    try {
        const { idA, idB } = req.params;

        if (idA === idB) {
            return res.status(400).json({ error: 'Selecciona dos participantes distintos' });
        }

        const usuariosRes = await pool.query(`
            SELECT id, nombre_publico AS nombre, campeon_elegido
            FROM usuarios
            WHERE id IN ($1, $2) AND esta_activo = true
        `, [idA, idB]);

        if (usuariosRes.rows.length < 2) {
            return res.status(404).json({ error: 'Uno o ambos participantes no existen' });
        }

        const usuarioA = usuariosRes.rows.find(u => String(u.id) === String(idA));
        const usuarioB = usuariosRes.rows.find(u => String(u.id) === String(idB));

        const partidosRes = await pool.query(`
            SELECT
                pa.id AS partido_id,
                pa.equipo_local,
                pa.equipo_visitante,
                pa.fecha_hora,
                pa.fase,
                pa.goles_local_real,
                pa.goles_visitante_real,
                pA.goles_local_pred     AS a_goles_local,
                pA.goles_visitante_pred AS a_goles_visitante,
                pA.puntos_obtenidos     AS a_puntos,
                pB.goles_local_pred     AS b_goles_local,
                pB.goles_visitante_pred AS b_goles_visitante,
                pB.puntos_obtenidos     AS b_puntos
            FROM partidos pa
            LEFT JOIN predicciones pA ON pA.partido_id = pa.id AND pA.usuario_id = $1
            LEFT JOIN predicciones pB ON pB.partido_id = pa.id AND pB.usuario_id = $2
            WHERE pa.estado = 'finalizado'
              AND (pA.id IS NOT NULL OR pB.id IS NOT NULL)
            ORDER BY pa.fecha_hora ASC
        `, [idA, idB]);

        let puntosA = 0, puntosB = 0, ganadosA = 0, ganadosB = 0, empatesDuelo = 0;

        const partidos = partidosRes.rows.map(row => {
            const aPts = row.a_puntos ?? 0;
            const bPts = row.b_puntos ?? 0;
            puntosA += aPts;
            puntosB += bPts;
            if (aPts > bPts) ganadosA++;
            else if (bPts > aPts) ganadosB++;
            else empatesDuelo++;

            return {
                partido_id: row.partido_id,
                equipo_local: row.equipo_local,
                equipo_visitante: row.equipo_visitante,
                fecha_hora: row.fecha_hora,
                fase: row.fase,
                goles_local_real: row.goles_local_real,
                goles_visitante_real: row.goles_visitante_real,
                a: row.a_puntos === null ? null : {
                    goles_local: row.a_goles_local,
                    goles_visitante: row.a_goles_visitante,
                    puntos: row.a_puntos
                },
                b: row.b_puntos === null ? null : {
                    goles_local: row.b_goles_local,
                    goles_visitante: row.b_goles_visitante,
                    puntos: row.b_puntos
                }
            };
        });

        res.json({
            usuario_a: usuarioA,
            usuario_b: usuarioB,
            partidos,
            resumen: {
                puntos_a: puntosA,
                puntos_b: puntosB,
                partidos_ganados_a: ganadosA,
                partidos_ganados_b: ganadosB,
                empates: empatesDuelo,
                total_partidos: partidos.length
            }
        });

    } catch (error) {
        console.error('❌ Error /api/mrchip/duelo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ===============================================
// AGREGAR AL FINAL DE TU SERVER.JS (antes del app.listen)
// ===============================================

// PATCH /api/usuarios/:id/estado - Activar/Desactivar usuario
app.patch('/api/usuarios/:id/estado', verificarAdmin, async (req, res) => {
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

// ─── GET /api/noticias ───────────────────────────────────
// Retorna noticias activas ordenadas por fecha desc
// Público — no requiere auth
app.get('/api/noticias', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const result = await pool.query(
            `SELECT 
                id, tipo, titulo, resena, imagen_url, youtube_url,
                equipo_local, equipo_visitante,
                marcador_local, marcador_visitante,
                created_at
             FROM noticias
             WHERE activa = TRUE
             ORDER BY created_at DESC
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error GET /api/noticias:', err);
        res.status(500).json({ error: 'Error al obtener noticias' });
    }
});

// ─── POST /api/noticias ──────────────────────────────────
// Crea una noticia nueva
// Solo admin — verifica isAdmin en la sesión/token
app.post('/api/noticias', verificarAdmin, async (req, res) => {
    try {
        const {
            tipo,
            titulo,
            resena,
            imagen_url,
            youtube_url,
            equipo_local,
            equipo_visitante,
            marcador_local,
            marcador_visitante
        } = req.body;

        // Validaciones básicas
        if (!tipo || !['hero', 'secundaria', 'partido', 'video'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de noticia inválido' });
        }
        if (!titulo || titulo.trim().length === 0) {
            return res.status(400).json({ error: 'El título es obligatorio' });
        }
        if (!resena || resena.trim().length === 0) {
            return res.status(400).json({ error: 'La reseña es obligatoria' });
        }

        // Validaciones por tipo
        if ((tipo === 'hero' || tipo === 'secundaria') && !imagen_url) {
            return res.status(400).json({ error: 'La imagen es obligatoria para este tipo' });
        }
        if (tipo === 'partido' && (!equipo_local || !equipo_visitante)) {
            return res.status(400).json({ error: 'Los equipos son obligatorios para tipo partido' });
        }
        if (tipo === 'video' && !youtube_url) {
            return res.status(400).json({ error: 'El enlace de YouTube es obligatorio para tipo video' });
        }

        // Validar URL de YouTube
        if (tipo === 'video' && youtube_url) {
            const isValidYouTube = youtube_url.includes('youtube.com') || youtube_url.includes('youtu.be');
            if (!isValidYouTube) {
                return res.status(400).json({ error: 'El enlace debe ser de YouTube' });
            }
        }

        const result = await pool.query(
            `INSERT INTO noticias 
                (tipo, titulo, resena, imagen_url, youtube_url, equipo_local, equipo_visitante, marcador_local, marcador_visitante)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                tipo,
                titulo.trim(),
                resena?.trim() || null,
                imagen_url?.trim() || null,
                youtube_url?.trim() || null,
                equipo_local || null,
                equipo_visitante || null,
                marcador_local ?? null,
                marcador_visitante ?? null
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error POST /api/noticias:', err);
        res.status(500).json({ error: 'Error al crear noticia' });
    }
});

// ─── DELETE /api/noticias/:id ────────────────────────────
// Elimina (desactiva) una noticia por ID
// Solo admin
app.delete('/api/noticias/:id', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const result = await pool.query(
            `UPDATE noticias SET activa = FALSE WHERE id = $1 RETURNING id`,
            [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Noticia no encontrada' });
        }
        res.json({ ok: true, id: parseInt(id) });
    } catch (err) {
        console.error('Error DELETE /api/noticias/:id:', err);
        res.status(500).json({ error: 'Error al eliminar noticia' });
    }
});

// POST /api/recuperar-clave
app.post('/api/recuperar-clave', async (req, res) => {
    try {
        const { telefono, nueva_clave } = req.body;

        if (!telefono || !nueva_clave) {
            return res.status(400).json({ error: 'Teléfono y nueva clave son requeridos' });
        }

        
        const tieneLetras = /[a-zA-Z]/.test(nueva_clave);
        const tieneNumeros = /[0-9]/.test(nueva_clave);

        if (!tieneLetras || !tieneNumeros || nueva_clave.length < 6) {
            return res.status(400).json({ 
                error: 'La clave debe tener mínimo 6 caracteres, al menos una letra y un número' 
            });
        }

        const result = await pool.query(`
            SELECT id, nombre_publico, puede_resetear
            FROM usuarios
            WHERE telefono = $1
            AND esta_activo = true
        `, [telefono]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Teléfono no encontrado' });
        }

        const usuario = result.rows[0];

        if (!usuario.puede_resetear) {
            return res.status(403).json({ 
                error: 'No tienes permiso para cambiar tu clave. Contacta al administrador.' 
            });
        }

        const hash = await bcrypt.hash(nueva_clave.toUpperCase(), 10);

        await pool.query(`
            UPDATE usuarios 
            SET codigo_acceso = $1,
                puede_resetear = FALSE
            WHERE id = $2
        `, [hash, usuario.id]);

        console.log(`✅ Clave reseteada para: ${usuario.nombre_publico}`);

        res.json({ 
            success: true, 
            mensaje: 'Clave actualizada correctamente. Ya puedes iniciar sesión.' 
        });

    } catch (error) {
        console.error('❌ Error en recuperar-clave:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});
    // GET /api/admin/logs/login
    app.get('/api/admin/logs/login', verificarAdmin, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    ip,
                    COUNT(*) FILTER (WHERE exitoso = false) as intentos_fallidos,
                    COUNT(*) FILTER (WHERE exitoso = true) as logins_exitosos,
                    MAX(fecha) as ultimo_intento
                FROM login_intentos
                WHERE fecha > NOW() - INTERVAL '24 hours'
                GROUP BY ip
                ORDER BY intentos_fallidos DESC
                LIMIT 50
            `);

            res.json({
                periodo: 'Últimas 24 horas',
                registros: result.rows
            });

        } catch (error) {
            console.error('❌ Error obteniendo logs:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });
    // PATCH /api/admin/usuarios/:id/permitir-reset
    app.patch('/api/admin/usuarios/:id/permitir-reset', verificarAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE usuarios
                SET puede_resetear = TRUE
                WHERE id = $1
                RETURNING nombre_publico, telefono
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            console.log(`✅ Reset permitido para: ${result.rows[0].nombre_publico}`);

            res.json({ 
                success: true,
                mensaje: `Reset activado para ${result.rows[0].nombre_publico}`
            });

        } catch (error) {
            console.error('❌ Error activando reset:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });


// Ruta para guardar subscription del navegador
app.post('/api/push/subscribe', async (req, res) => {
  const { subscription } = req.body;
  const usuarioId = req.body.usuario_id; // o desde tu middleware de auth

  try {
    await pool.query(
      `INSERT INTO push_subscriptions (usuario_id, subscription)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, subscription) DO NOTHING`,
      [usuarioId, JSON.stringify(subscription)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando subscription' });
  }
});

// Ruta para obtener la VAPID public key (el frontend la necesita)
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/notificar-partido
app.post('/api/push/notificar-partido', verificarAdmin, async (req, res) => {
    const { partido_id, equipo_local, equipo_visitante, goles_local, goles_visitante } = req.body;

    try {
        // Buscar usuarios que predijeron este partido
        const { rows: subs } = await pool.query(`
            SELECT ps.id, ps.subscription, ps.usuario_id
            FROM push_subscriptions ps
            INNER JOIN predicciones pr ON pr.usuario_id = ps.usuario_id
            WHERE pr.partido_id = $1
        `, [partido_id]);

        if (subs.length === 0) {
            return res.json({ ok: true, enviadas: 0 });
        }

        const payload = {
            title: '⚽ ¡Partido finalizado!',
            body: `${equipo_local} ${goles_local} - ${goles_visitante} ${equipo_visitante}`,
            icon: '/img/icon/android-chrome-192x192.png',
            url: '/index.html'
        };

        let enviadas = 0;
        const expiradas = [];

        for (const sub of subs) {
            const resultado = await enviarNotificacion(sub.subscription, payload);
            if (resultado === true) enviadas++;
            if (resultado === 'expired') expiradas.push(sub.id);
        }

        // Limpiar subscriptions expiradas
        if (expiradas.length > 0) {
            await pool.query(
                `DELETE FROM push_subscriptions WHERE id = ANY($1)`,
                [expiradas]
            );
            console.log(`🧹 ${expiradas.length} subscriptions expiradas eliminadas`);
        }

        console.log(`🔔 Push enviados: ${enviadas}/${subs.length} para partido ${partido_id}`);
        res.json({ ok: true, enviadas, total: subs.length });

    } catch (err) {
        console.error('❌ Error enviando push:', err);
        res.status(500).json({ error: 'Error enviando notificaciones' });
    }
});
// POST /api/push/broadcast
app.post('/api/push/broadcast', verificarAdmin, async (req, res) => {
    const { title, body, url } = req.body;

    if (!title || !body) {
        return res.status(400).json({ error: 'title y body son requeridos' });
    }

    try {
        // Traer TODAS las subscriptions activas
        const { rows: subs } = await pool.query(
            `SELECT id, subscription FROM push_subscriptions`
        );

        if (subs.length === 0) {
            return res.json({ ok: true, enviadas: 0, mensaje: 'No hay suscriptores' });
        }

        const payload = {
            title,
            body,
            icon: '/img/icon/android-chrome-192x192.png',
            url: url || '/index.html'
        };

        let enviadas = 0;
        const expiradas = [];

        for (const sub of subs) {
            const resultado = await enviarNotificacion(sub.subscription, payload);
            if (resultado === true) enviadas++;
            if (resultado === 'expired') expiradas.push(sub.id);
        }

        if (expiradas.length > 0) {
            await pool.query(
                `DELETE FROM push_subscriptions WHERE id = ANY($1)`,
                [expiradas]
            );
            console.log(`🧹 ${expiradas.length} subscriptions expiradas eliminadas`);
        }

        console.log(`📢 Broadcast enviado: ${enviadas}/${subs.length}`);
        res.json({ ok: true, enviadas, total: subs.length, expiradas: expiradas.length });

    } catch (err) {
        console.error('❌ Error en broadcast:', err);
        res.status(500).json({ error: 'Error enviando broadcast' });
    }
});

app.get('/api/proximo-partido-countdown', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                equipo_local,
                equipo_visitante,
                fecha_hora,
                fase,
                estado
            FROM partidos
            WHERE fecha_hora > NOW()
            AND estado = 'pendiente'
            ORDER BY fecha_hora ASC
            LIMIT 1
        `;

        const result = await pool.query(query);

        if (result.rows.length === 0) {
            return res.json({ 
                hayPartido: false,
                mensaje: 'No hay partidos programados'
            });
        }

        const partido = result.rows[0];
        
        res.json({
            hayPartido: true,
            partido: {
                id: partido.id,
                equipo_local: partido.equipo_local,
                equipo_visitante: partido.equipo_visitante,
                fecha: partido.fecha_hora, // Convertimos fecha_hora a fecha para el frontend
                fase: partido.fase,
                estado: partido.estado
            }
        });

    } catch (error) {
        console.error('Error en proximo-partido-countdown:', error);
        res.status(500).json({ 
            hayPartido: false,
            error: error.message,
            mensaje: 'Error al cargar el partido'
        });
    }
});

// ===============================================
// 💬 RUTAS DE CHAT GENERAL
// ===============================================

// GET /api/chat/mensajes — últimos 100 mensajes
app.get('/api/chat/mensajes', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const result = await pool.query(`
            SELECT id, usuario_id, usuario_nombre, mensaje, imagen_url, created_at
            FROM chat_mensajes
            ORDER BY created_at ASC
            LIMIT 100
        `);
        res.json({ success: true, mensajes: result.rows });
    } catch (error) {
        console.error('❌ Error obteniendo mensajes:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// POST /api/chat/mensajes — enviar mensaje
app.post('/api/chat/mensajes', async (req, res) => {
    try {
        const usuarioId = req.headers['x-usuario-id'];
        const { mensaje, imagen_url } = req.body;

        if (!usuarioId) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        if (!mensaje && !req.body.imagen_url) {
        return res.status(400).json({ error: 'Mensaje vacío' });
        }
        if (mensaje.trim().length > 500) {
            return res.status(400).json({ error: 'Mensaje demasiado largo (máx 500 caracteres)' });
        }
        

        // Obtener nombre del usuario
        const usuarioResult = await pool.query(
            `SELECT nombre_publico FROM usuarios WHERE id = $1 AND esta_activo = true`,
            [usuarioId]
        );
        if (usuarioResult.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

const result = await pool.query(`
    INSERT INTO chat_mensajes (usuario_id, usuario_nombre, mensaje, imagen_url)
    VALUES ($1, $2, $3, $4)
    RETURNING id, usuario_id, usuario_nombre, mensaje, imagen_url, created_at
`, [usuarioId, usuarioResult.rows[0].nombre_publico, mensaje.trim(), imagen_url || null]);

        res.status(201).json({ success: true, mensaje: result.rows[0] });
    } catch (error) {
    console.error('❌ Error POST chat:', error.message, error.stack);
    res.status(500).json({ error: error.message });
}
});

// DELETE /api/chat/mensajes/:id — solo admin
app.delete('/api/chat/mensajes/:id', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM chat_mensajes WHERE id = $1 RETURNING id`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mensaje no encontrado' });
        }

        res.json({ success: true, mensaje: 'Mensaje eliminado' });
    } catch (error) {
        console.error('❌ Error eliminando mensaje:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});
app.post('/api/chat/imagen', upload.single('imagen'), async (req, res) => {
    try {
        const usuarioId = req.headers['x-usuario-id'];
        if (!usuarioId) return res.status(401).json({ error: 'No autorizado' });
        if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

        const ext = req.file.mimetype.split('/')[1];
        const filename = `${Date.now()}-${usuarioId}.${ext}`;

        const { error } = await supabase.storage
            .from('chat-imagenes')
            .upload(filename, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (error) throw error;

        const { data } = supabase.storage
            .from('chat-imagenes')
            .getPublicUrl(filename);

        res.json({ success: true, url: data.publicUrl });

    } catch (error) {
        console.error('❌ Error subiendo imagen:', error);
        res.status(500).json({ error: error.message || 'Error subiendo imagen' });
    }
});
// ===============================================
// MR. CHIP — NUEVOS ENDPOINTS
// Pegar en server.js ANTES del bloque app.listen
// ===============================================


// ─────────────────────────────────────────────────────────────────
// GET /api/rankings/oraculo?limit=5
// Top N usuarios por mayor cantidad de predicciones exactas (9 pts)
// ─────────────────────────────────────────────────────────────────
app.get('/api/rankings/oraculo', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);

        const result = await pool.query(`
            SELECT
                u.id,
                u.nombre_publico   AS nombre,
                u.campeon_elegido  AS emoji,
                COUNT(*)::int      AS exactos
            FROM predicciones p
            JOIN usuarios     u ON u.id = p.usuario_id
            JOIN partidos     pa ON pa.id = p.partido_id
            WHERE pa.estado       = 'finalizado'
              AND p.puntos_obtenidos = 9
              AND u.esta_activo    = true
            GROUP BY u.id, u.nombre_publico, u.campeon_elegido
            ORDER BY exactos DESC
            LIMIT $1
        `, [limit]);

        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error /api/rankings/oraculo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});


// ─────────────────────────────────────────────────────────────────
// GET /api/rankings/mufas?limit=5
// Top N usuarios por mayor cantidad de predicciones con 0 puntos
// ─────────────────────────────────────────────────────────────────
app.get('/api/rankings/mufas', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);

        const result = await pool.query(`
            SELECT
                u.id,
                u.nombre_publico   AS nombre,
                u.campeon_elegido  AS emoji,
                COUNT(*)::int      AS ceros
            FROM predicciones p
            JOIN usuarios     u ON u.id = p.usuario_id
            JOIN partidos     pa ON pa.id = p.partido_id
            WHERE pa.estado       = 'finalizado'
              AND p.puntos_obtenidos = 0
              AND u.esta_activo    = true
            GROUP BY u.id, u.nombre_publico, u.campeon_elegido
            ORDER BY ceros DESC
            LIMIT $1
        `, [limit]);

        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error /api/rankings/mufas:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});


// ─────────────────────────────────────────────────────────────────
// GET /api/rankings/estadisticas-torneo
// Estadísticas globales del torneo para Mr. Chip
// ─────────────────────────────────────────────────────────────────
app.get('/api/rankings/estadisticas-torneo', async (req, res) => {
    try {

        // 1. Total de predicciones registradas
        const totalPredRes = await pool.query(`
            SELECT COUNT(*)::int AS total FROM predicciones
        `);

        // 2. Total de predicciones perfectas (9 pts)
        const perfectasRes = await pool.query(`
            SELECT COUNT(*)::int AS total
            FROM predicciones p
            JOIN partidos pa ON pa.id = p.partido_id
            WHERE pa.estado = 'finalizado'
              AND p.puntos_obtenidos = 9
        `);

        // 3. Marcador más predicho en todo el torneo
        const marcadorTopRes = await pool.query(`
            SELECT
                goles_local || '-' || goles_visitante AS marcador,
                COUNT(*)::int AS veces
            FROM predicciones
            GROUP BY goles_local, goles_visitante
            ORDER BY veces DESC
            LIMIT 1
        `);

        // 4. Partido con más consenso (mayor % de votos al mismo resultado)
        // Se calcula como: partido donde el grupo mayoritario tiene mayor % del total
        const consensoRes = await pool.query(`
            WITH votos AS (
                SELECT
                    p.partido_id,
                    pa.equipo_local,
                    pa.equipo_visitante,
                    COUNT(*) FILTER (WHERE p.goles_local > p.goles_visitante)  AS votos_local,
                    COUNT(*) FILTER (WHERE p.goles_local = p.goles_visitante)  AS votos_empate,
                    COUNT(*) FILTER (WHERE p.goles_local < p.goles_visitante)  AS votos_visitante,
                    COUNT(*) AS total_votos
                FROM predicciones p
                JOIN partidos pa ON pa.id = p.partido_id
                WHERE pa.estado = 'finalizado'
                GROUP BY p.partido_id, pa.equipo_local, pa.equipo_visitante
                HAVING COUNT(*) > 0
            )
            SELECT
                equipo_local || ' vs ' || equipo_visitante AS partido,
                GREATEST(votos_local, votos_empate, votos_visitante) * 100 / total_votos AS pct_consenso
            FROM votos
            ORDER BY pct_consenso DESC
            LIMIT 1
        `);

        // 5. Partido más polarizado (menor % del grupo mayoritario = más dividido)
        const polarizadoRes = await pool.query(`
            WITH votos AS (
                SELECT
                    p.partido_id,
                    pa.equipo_local,
                    pa.equipo_visitante,
                    COUNT(*) FILTER (WHERE p.goles_local > p.goles_visitante)  AS votos_local,
                    COUNT(*) FILTER (WHERE p.goles_local = p.goles_visitante)  AS votos_empate,
                    COUNT(*) FILTER (WHERE p.goles_local < p.goles_visitante)  AS votos_visitante,
                    COUNT(*) AS total_votos
                FROM predicciones p
                JOIN partidos pa ON pa.id = p.partido_id
                WHERE pa.estado = 'finalizado'
                GROUP BY p.partido_id, pa.equipo_local, pa.equipo_visitante
                HAVING COUNT(*) >= 3
            )
            SELECT
                equipo_local || ' vs ' || equipo_visitante AS partido,
                GREATEST(votos_local, votos_empate, votos_visitante) * 100 / total_votos AS pct_max
            FROM votos
            ORDER BY pct_max ASC
            LIMIT 1
        `);

        // 6. Mejor racha activa (usuario con más partidos consecutivos acertando,
        //    contando desde el último partido finalizado hacia atrás)
        const rachaRes = await pool.query(`
            WITH partidos_ordenados AS (
                SELECT
                    p.usuario_id,
                    u.nombre_publico,
                    u.campeon_elegido,
                    pa.fecha_hora,
                    p.puntos_obtenidos,
                    ROW_NUMBER() OVER (PARTITION BY p.usuario_id ORDER BY pa.fecha_hora DESC) AS rn
                FROM predicciones p
                JOIN partidos pa ON pa.id = p.partido_id
                JOIN usuarios  u ON u.id  = p.usuario_id
                WHERE pa.estado = 'finalizado'
                  AND u.esta_activo = true
            ),
            racha AS (
                SELECT
                    usuario_id,
                    nombre_publico,
                    campeon_elegido,
                    SUM(CASE WHEN puntos_obtenidos >= 5 THEN 1 ELSE 0 END)
                        FILTER (WHERE rn <= (
                            -- Cantidad de partidos consecutivos acertando desde el último
                            SELECT MIN(rn) - 1
                            FROM partidos_ordenados p2
                            WHERE p2.usuario_id = partidos_ordenados.usuario_id
                              AND p2.puntos_obtenidos = 0
                        ) + 1
                    ) AS racha_actual
                FROM partidos_ordenados
                GROUP BY usuario_id, nombre_publico, campeon_elegido
            )
            SELECT nombre_publico AS usuario, campeon_elegido AS emoji, COALESCE(racha_actual, 0) AS racha
            FROM racha
            ORDER BY racha DESC
            LIMIT 1
        `);

        // ── Armar respuesta ────────────────────────────────────────
        const marcadorTop  = marcadorTopRes.rows[0];
        const consenso     = consensoRes.rows[0];
        const polarizado   = polarizadoRes.rows[0];
        const racha        = rachaRes.rows[0];

        res.json({
            total_predicciones       : totalPredRes.rows[0]?.total              || 0,
            total_perfectas          : perfectasRes.rows[0]?.total              || 0,
            marcador_top             : marcadorTop?.marcador                    || '—',
            marcador_top_veces       : marcadorTop?.veces                       || 0,
            partido_mas_consenso     : consenso?.partido                        || '—',
            partido_mas_consenso_pct : consenso?.pct_consenso                  || 0,
            partido_mas_polarizado   : polarizado?.partido                      || '—',
            partido_mas_polarizado_detalle: polarizado
                ? `Solo ${polarizado.pct_max}% de consenso`
                : '—',
            mejor_racha              : racha?.racha                             || 0,
            mejor_racha_usuario      : racha
                ? `${racha.emoji || '👤'} ${racha.usuario}`
                : '—',
        });

    } catch (error) {
        console.error('❌ Error /api/rankings/estadisticas-torneo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});


// ─────────────────────────────────────────────────────────────────
// GET /api/partidos/sala-guerra?filtro=hoy|todos|pendientes|jugados
// Todos los partidos con estadísticas de predicciones para Sala de Guerra
// ─────────────────────────────────────────────────────────────────
app.get('/api/partidos/sala-guerra', async (req, res) => {
    try {
        const filtro = req.query.filtro || 'hoy';

        // Condición de filtro
        let condicion = '';
        if (filtro === 'hoy') {
            condicion = `AND DATE(pa.fecha_hora AT TIME ZONE 'America/Caracas') = CURRENT_DATE`;
        } else if (filtro === 'pendientes') {
            condicion = `AND pa.estado = 'pendiente'`;
        } else if (filtro === 'jugados') {
            condicion = `AND pa.estado = 'finalizado'`;
        }
        // 'todos' → sin condición extra

        const result = await pool.query(`
            SELECT
                pa.id,
                pa.equipo_local,
                pa.equipo_visitante,
                pa.fecha_hora,
                pa.fase,
                pa.estado,
                pa.goles_local_real    AS goles_local,
                pa.goles_visitante_real AS goles_visitante,

                -- Total predicciones
                COUNT(p.id)::int AS total_pred,

                -- Votos por resultado
                COUNT(p.id) FILTER (WHERE p.goles_local > p.goles_visitante)::int  AS votos_local,
                COUNT(p.id) FILTER (WHERE p.goles_local = p.goles_visitante)::int  AS votos_empate,
                COUNT(p.id) FILTER (WHERE p.goles_local < p.goles_visitante)::int  AS votos_visitante,

                -- Porcentajes (0 si no hay predicciones)
                CASE WHEN COUNT(p.id) > 0
                    THEN ROUND(COUNT(p.id) FILTER (WHERE p.goles_local > p.goles_visitante) * 100.0 / COUNT(p.id))
                    ELSE 0 END::int AS pct_local,
                CASE WHEN COUNT(p.id) > 0
                    THEN ROUND(COUNT(p.id) FILTER (WHERE p.goles_local = p.goles_visitante) * 100.0 / COUNT(p.id))
                    ELSE 0 END::int AS pct_empate,
                CASE WHEN COUNT(p.id) > 0
                    THEN ROUND(COUNT(p.id) FILTER (WHERE p.goles_local < p.goles_visitante) * 100.0 / COUNT(p.id))
                    ELSE 0 END::int AS pct_visitante

            FROM partidos pa
            LEFT JOIN predicciones p ON p.partido_id = pa.id
            WHERE 1=1
            ${condicion}
            GROUP BY pa.id
            ORDER BY pa.fecha_hora ASC
        `);

        // Formatear fechas y agregar banderas para el frontend
        const partidos = result.rows.map(p => ({
            ...p,
            fecha        : formatearFechaServer(p.fecha_hora),
            bandera_local    : obtenerBanderaServer(p.equipo_local),
            bandera_visitante: obtenerBanderaServer(p.equipo_visitante),
        }));

        res.json(partidos);

    } catch (error) {
        console.error('❌ Error /api/partidos/sala-guerra:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});


// ─── Helpers internos del servidor ───────────────────────────────

function formatearFechaServer(fechaISO) {
    if (!fechaISO) return '';
    const d = new Date(fechaISO);
    const dia  = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', timeZone: 'America/Caracas' });
    const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Caracas' });
    return `${dia} · ${hora}`;
}

function obtenerBanderaServer(equipo) {
    const banderas = {
        'Argentina'      : '🇦🇷', 'Brasil'          : '🇧🇷', 'Francia'         : '🇫🇷',
        'Alemania'       : '🇩🇪', 'España'          : '🇪🇸', 'Inglaterra'      : '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'Portugal'       : '🇵🇹', 'Italia'          : '🇮🇹', 'Países Bajos'    : '🇳🇱',
        'Bélgica'        : '🇧🇪', 'Uruguay'         : '🇺🇾', 'Colombia'        : '🇨🇴',
        'México'         : '🇲🇽', 'Estados Unidos'  : '🇺🇸', 'Canadá'          : '🇨🇦',
        'Marruecos'      : '🇲🇦', 'Senegal'         : '🇸🇳', 'Japón'           : '🇯🇵',
        'Corea del Sur'  : '🇰🇷', 'Australia'       : '🇦🇺', 'Ecuador'         : '🇪🇨',
        'Venezuela'      : '🇻🇪', 'Chile'           : '🇨🇱', 'Perú'            : '🇵🇪',
        'Arabia Saudita' : '🇸🇦', 'Irán'            : '🇮🇷', 'Ghana'           : '🇬🇭',
        'Camerún'        : '🇨🇲', 'Nigeria'         : '🇳🇬', 'Túnez'           : '🇹🇳',
        'Polonia'        : '🇵🇱', 'Croacia'         : '🇭🇷', 'Dinamarca'       : '🇩🇰',
        'Suiza'          : '🇨🇭', 'Serbia'          : '🇷🇸', 'Ucrania'         : '🇺🇦',
        'Turquía'        : '🇹🇷', 'Austria'         : '🇦🇹', 'Escocia'         : '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        'Sudáfrica'      : '🇿🇦', 'Egipto'          : '🇪🇬', 'Argelia'         : '🇩🇿',
        'Costa Rica'     : '🇨🇷', 'Panamá'          : '🇵🇦', 'Jamaica'         : '🇯🇲',
        'Bolivia'        : '🇧🇴', 'Paraguay'        : '🇵🇾', 'Honduras'        : '🇭🇳',
        'Irak'           : '🇮🇶', 'Indonesia'       : '🇮🇩', 'Nueva Zelanda'   : '🇳🇿',
    };
    return banderas[equipo] || '🏳️';
}
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