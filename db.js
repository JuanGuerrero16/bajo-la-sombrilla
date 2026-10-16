// ==========================================
// BASE DE DATOS (MySQL / MariaDB)
// ==========================================
// Tablas (ver schema.sql):
//   usuarias            -> cuentas (rol: usuaria | admin)
//   areas               -> catálogo de áreas de interés
//   testimonios         -> testimonios (pertenecen, opcionalmente, a una usuaria)
//   testimonio_areas    -> relación muchos a muchos testimonios <-> areas
//   motivos             -> catálogo de motivos de orientación
//   solicitudes         -> solicitudes de orientación
//   solicitud_motivos   -> relación muchos a muchos solicitudes <-> motivos

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bajo_la_sombrilla',
    charset: 'utf8mb4',
    timezone: 'Z',                 // las fechas se leen y se escriben en UTC
    flags: ['+FOUND_ROWS'],        // "changes" cuenta las filas encontradas, no solo las modificadas
    waitForConnections: true,
    connectionLimit: 10
});

// Catálogos iniciales (los mismos que muestra la página)
const AREAS = ['Trabajo', 'Educación', 'Emprendimiento', 'Familia', 'Salud', 'Comunidad', 'Recreación', 'Otro'];
const MOTIVOS = ['Empleo', 'Educación', 'Salud', 'Orientación jurídica', 'Vivienda', 'Emprendimiento', 'Redes de apoyo', 'Otro'];

// ------------------------------------------
// UTILIDADES
// ------------------------------------------
const consultar = async (sql, params = []) => (await pool.execute(sql, params))[0];

// Ejecuta varias consultas como una sola operación: o se guardan todas o ninguna
async function enTransaccion(fn) {
    const conexion = await pool.getConnection();

    try {
        await conexion.beginTransaction();
        const resultado = await fn(conexion);
        await conexion.commit();
        return resultado;
    } catch (e) {
        await conexion.rollback();
        throw e;
    } finally {
        conexion.release();
    }
}

// Las fechas salen como texto ISO (2026-01-31T10:00:00.000Z)
const conFecha = (fila) => (fila && fila.creado_en instanceof Date)
    ? { ...fila, creado_en: fila.creado_en.toISOString() }
    : fila;

// ------------------------------------------
// ARRANQUE: crea las tablas y los catálogos
// ------------------------------------------
async function iniciar() {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    const sentencias = sql
        .split('\n')
        .filter((linea) => !linea.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);

    for (const sentencia of sentencias) await pool.query(sentencia);

    for (const nombre of AREAS) await consultar('INSERT IGNORE INTO areas (nombre) VALUES (?)', [nombre]);
    for (const nombre of MOTIVOS) await consultar('INSERT IGNORE INTO motivos (nombre) VALUES (?)', [nombre]);
}

// ------------------------------------------
// USUARIAS
// ------------------------------------------
const crearUsuaria = async (nombre, email, hash, rol = 'usuaria') =>
    (await pool.execute(
        'INSERT INTO usuarias (nombre, email, password_hash, rol, creado_en) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
        [nombre, email, hash, rol]
    ))[0].insertId;

const usuariaPorEmail = async (email) =>
    (await consultar('SELECT * FROM usuarias WHERE email = ? LIMIT 1', [email]))[0];

const usuariaPorId = async (id) =>
    (await consultar('SELECT id, nombre, email, rol FROM usuarias WHERE id = ? LIMIT 1', [id]))[0];

const usuariaConHash = async (id) =>
    (await consultar('SELECT * FROM usuarias WHERE id = ? LIMIT 1', [id]))[0];

const cambiarHash = (id, hash) =>
    consultar('UPDATE usuarias SET password_hash = ? WHERE id = ?', [hash, id]);

const existeAdmin = async () =>
    (await consultar("SELECT 1 AS ok FROM usuarias WHERE rol = 'admin' LIMIT 1")).length > 0;

// ------------------------------------------
// TESTIMONIOS
// ------------------------------------------
const SQL_TESTIMONIOS = `
    SELECT t.id, t.nombre_publico, t.texto, t.estado, t.creado_en,
           (SELECT GROUP_CONCAT(a.nombre ORDER BY a.id SEPARATOR ', ')
              FROM testimonio_areas ta JOIN areas a ON a.id = ta.area_id
             WHERE ta.testimonio_id = t.id) AS areas
      FROM testimonios t`;

const crearTestimonio = ({ usuariaId, nombrePublico, texto, areas }) =>
    enTransaccion(async (c) => {
        const [r] = await c.execute(
            'INSERT INTO testimonios (usuaria_id, nombre_publico, texto, creado_en) VALUES (?, ?, ?, UTC_TIMESTAMP())',
            [usuariaId || null, nombrePublico || null, texto]
        );

        for (const nombre of areas) {
            const [encontradas] = await c.execute('SELECT id FROM areas WHERE nombre = ? LIMIT 1', [nombre]);

            if (encontradas.length) {
                await c.execute(
                    'INSERT IGNORE INTO testimonio_areas (testimonio_id, area_id) VALUES (?, ?)',
                    [r.insertId, encontradas[0].id]
                );
            }
        }
        return r.insertId;
    });

const testimoniosPublicos = async () =>
    (await consultar(SQL_TESTIMONIOS + " WHERE t.estado = 'aprobado' ORDER BY t.creado_en DESC, t.id DESC")).map(conFecha);

const listarTestimonios = async (estado) => (estado
    ? await consultar(SQL_TESTIMONIOS + ' WHERE t.estado = ? ORDER BY t.creado_en DESC, t.id DESC', [estado])
    : await consultar(SQL_TESTIMONIOS + ' ORDER BY t.creado_en DESC, t.id DESC')
).map(conFecha);

const estadoTestimonio = async (id, estado) =>
    (await pool.execute('UPDATE testimonios SET estado = ? WHERE id = ?', [estado, id]))[0].affectedRows;

const borrarTestimonio = async (id) =>
    (await pool.execute('DELETE FROM testimonios WHERE id = ?', [id]))[0].affectedRows;

// ------------------------------------------
// SOLICITUDES DE ORIENTACIÓN
// ------------------------------------------
const SQL_SOLICITUDES = `
    SELECT s.id, s.nombre, s.contacto, s.mensaje, s.estado, s.creado_en,
           (SELECT GROUP_CONCAT(m.nombre ORDER BY m.id SEPARATOR ', ')
              FROM solicitud_motivos sm JOIN motivos m ON m.id = sm.motivo_id
             WHERE sm.solicitud_id = s.id) AS motivos
      FROM solicitudes s`;

const crearSolicitud = ({ nombre, contacto, mensaje, motivos }) =>
    enTransaccion(async (c) => {
        const [r] = await c.execute(
            'INSERT INTO solicitudes (nombre, contacto, mensaje, creado_en) VALUES (?, ?, ?, UTC_TIMESTAMP())',
            [nombre || null, contacto || null, mensaje || null]
        );

        for (const nombreMotivo of motivos) {
            const [encontrados] = await c.execute('SELECT id FROM motivos WHERE nombre = ? LIMIT 1', [nombreMotivo]);

            if (encontrados.length) {
                await c.execute(
                    'INSERT IGNORE INTO solicitud_motivos (solicitud_id, motivo_id) VALUES (?, ?)',
                    [r.insertId, encontrados[0].id]
                );
            }
        }
        return r.insertId;
    });

const listarSolicitudes = async (estado) => (estado
    ? await consultar(SQL_SOLICITUDES + ' WHERE s.estado = ? ORDER BY s.creado_en DESC, s.id DESC', [estado])
    : await consultar(SQL_SOLICITUDES + ' ORDER BY s.creado_en DESC, s.id DESC')
).map(conFecha);

const estadoSolicitud = async (id, estado) =>
    (await pool.execute('UPDATE solicitudes SET estado = ? WHERE id = ?', [estado, id]))[0].affectedRows;

const borrarSolicitud = async (id) =>
    (await pool.execute('DELETE FROM solicitudes WHERE id = ?', [id]))[0].affectedRows;

// ------------------------------------------
// RESUMEN PARA EL PANEL
// ------------------------------------------
const contar = async (sql) => Number((await consultar(sql))[0].n);

const resumen = async () => ({
    testimoniosPendientes: await contar("SELECT COUNT(*) AS n FROM testimonios WHERE estado = 'pendiente'"),
    testimoniosPublicados: await contar("SELECT COUNT(*) AS n FROM testimonios WHERE estado = 'aprobado'"),
    solicitudesNuevas: await contar("SELECT COUNT(*) AS n FROM solicitudes WHERE estado = 'nueva'")
});

module.exports = {
    AREAS, MOTIVOS, iniciar,
    crearUsuaria, usuariaPorEmail, usuariaPorId, usuariaConHash, cambiarHash, existeAdmin,
    crearTestimonio, testimoniosPublicos, listarTestimonios, estadoTestimonio, borrarTestimonio,
    crearSolicitud, listarSolicitudes, estadoSolicitud, borrarSolicitud,
    resumen
};
