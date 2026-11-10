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

// Líneas de atención que aparecen en el botón de ayuda/emergencia
const LINEAS_AYUDA = [
    ['Línea 155', '155', 'Orientación y acompañamiento para mujeres víctimas de violencia.', '24 horas', 'Violencia de género', 1],
    ['Línea 106', '106', 'Línea de salud mental y apoyo emocional.', '24 horas', 'Salud mental', 2],
    ['Línea 123', '123', 'Emergencias médicas, policiales y de protección.', '24 horas', 'Emergencias', 3],
    ['Línea 195', '195', 'Orientación sobre servicios sociales y programas de la ciudad.', '24 horas', 'Servicios sociales', 4],
    ['Línea 141', '141', 'Protección de niñas, niños y adolescentes (ICBF).', '24 horas', 'Niñez y familia', 5],
    ['Línea 122', '122', 'Atención de denuncias y orientación de la Fiscalía.', '24 horas', 'Justicia', 6],
    ['Línea 147', '147', 'Orientación y atención de emergencias en Bogotá.', '24 horas', 'Emergencias', 7]
];

// Servicios de ejemplo para el mapa (se pueden ampliar desde la base de datos)
const SERVICIOS_MAPA = [
    ['Casa Libertad', 'Fundaciones', 'Bogotá', 'Carrera 16 # 34-50', '377 9595', 'Lunes a viernes, 8:00 a 17:00', 'Atención pospenitenciaria, orientación psicosocial, jurídica y laboral.', 4.6155000, -74.0700000, null],
    ['Fundación Acción Interna', 'Atención psicosocial', 'Bogotá', 'Calle 63 # 24-10', '310 260 0134', 'Lunes a viernes, 8:00 a 17:00', 'Acompañamiento psicosocial, formación y oportunidades de empleo.', 4.6486000, -74.0664000, null],
    ['Casa de la Mujer', 'Albergues', 'Bogotá', 'Carrera 7 # 32-16', '195', '24 horas', 'Orientación y protección para mujeres en situación de riesgo.', 4.5981000, -74.0758000, null],
    ['Hospital Universitario San Ignacio', 'Salud', 'Bogotá', 'Carrera 7 # 40-62', '601 594 6161', '24 horas', 'Servicios de salud física y mental.', 4.6280000, -74.0640000, null],
    ['Secretaría Distrital de Salud', 'Salud', 'Bogotá', 'Carrera 32 # 12-81', '601 364 9090', 'Lunes a viernes, 8:00 a 17:00', 'Afiliación, orientación y rutas de atención en salud.', 4.6118000, -74.0820000, null],
    ['Agencia Pública de Empleo SENA', 'Empleo', 'Bogotá', 'Calle 57 # 8-14', '601 546 1500', 'Lunes a viernes, 8:00 a 17:00', 'Intermediación laboral, orientación ocupacional y formación.', 4.6320000, -74.0690000, null],
    ['Comisaría de Familia de Teusaquillo', 'Comisarías de familia', 'Bogotá', 'Calle 39 # 19-30', '601 380 1234', 'Lunes a viernes, 8:00 a 17:00', 'Orientación y protección en casos de violencia intrafamiliar.', 4.6400000, -74.0700000, null],
    ['Universidad Distrital Francisco José de Caldas', 'Educación', 'Bogotá', 'Carrera 7 # 40B-53', '601 323 9300', 'Lunes a viernes, 8:00 a 18:00', 'Programas académicos, cursos y orientación educativa.', 4.6285000, -74.0655000, null],
    ['Fundación Caminos de Esperanza', 'Fundaciones', 'Medellín', 'Carrera 43A # 1-50', '604 444 5566', 'Lunes a viernes, 8:00 a 17:00', 'Acompañamiento a mujeres en procesos de reintegración.', 6.2518000, -75.5636000, null],
    ['Albergue Mujeres en Red', 'Albergues', 'Medellín', 'Calle 44 # 52-20', '604 322 1100', '24 horas', 'Alojamiento temporal y orientación psicosocial.', 6.2442000, -75.5812000, null],
    ['Hospital San Vicente Fundación', 'Salud', 'Medellín', 'Calle 64 # 51D-154', '604 444 1333', '24 horas', 'Atención médica y salud mental.', 6.2518000, -75.5700000, null],
    ['Comisaría de Familia de Belén', 'Comisarías de familia', 'Medellín', 'Carrera 76 # 30-45', '604 385 5555', 'Lunes a viernes, 8:00 a 17:00', 'Protección y orientación familiar.', 6.2300000, -75.5900000, null],
    ['SENA Centro de Servicios Empresariales', 'Empleo', 'Medellín', 'Calle 51 # 57-70', '604 576 0000', 'Lunes a viernes, 8:00 a 17:00', 'Formación, emprendimiento e intermediación laboral.', 6.2600000, -75.5800000, null],
    ['Fundación Semilla de Paz', 'Fundaciones', 'Cali', 'Avenida 6N # 23-45', '602 661 2233', 'Lunes a viernes, 8:00 a 17:00', 'Acompañamiento psicosocial y jurídico para mujeres.', 3.4516000, -76.5320000, null],
    ['Hospital Universitario del Valle', 'Salud', 'Cali', 'Calle 5 # 36-08', '602 620 6000', '24 horas', 'Atención médica, psicológica y psiquiátrica.', 3.4210000, -76.5400000, null],
    ['Comisaría de Familia de Cali Centro', 'Comisarías de familia', 'Cali', 'Calle 10 # 5-30', '602 887 1234', 'Lunes a viernes, 8:00 a 17:00', 'Orientación y protección en violencia intrafamiliar.', 3.4500000, -76.5320000, null],
    ['Agencia de Empleo de Cali', 'Empleo', 'Cali', 'Avenida 6N # 20-30', '602 660 1234', 'Lunes a viernes, 8:00 a 17:00', 'Bolsa de empleo y orientación laboral.', 3.4550000, -76.5350000, null],
    ['Fundación Renacer Caribe', 'Fundaciones', 'Barranquilla', 'Carrera 45 # 70-20', '605 360 1122', 'Lunes a viernes, 8:00 a 17:00', 'Apoyo psicosocial y social a mujeres y familias.', 10.9878000, -74.7889000, null],
    ['Hospital General de Barranquilla', 'Salud', 'Barranquilla', 'Carrera 45 # 70-50', '605 330 7000', '24 horas', 'Atención médica y salud mental.', 10.9800000, -74.7900000, null],
    ['Comisaría de Familia de Barranquilla', 'Comisarías de familia', 'Barranquilla', 'Calle 40 # 44-50', '605 385 1234', 'Lunes a viernes, 8:00 a 17:00', 'Protección y orientación familiar.', 10.9700000, -74.8000000, null],
    ['Albergue Casa de Acogida', 'Albergues', 'Cartagena', 'Calle 30 # 20-15', '605 660 1122', '24 horas', 'Alojamiento temporal y acompañamiento.', 10.3910000, -75.4794000, null],
    ['Hospital Universitario del Caribe', 'Salud', 'Cartagena', 'Carrera 50 # 30-20', '605 655 6000', '24 horas', 'Servicios de salud y atención psicosocial.', 10.4000000, -75.5000000, null],
    ['Unidad de Empleo de Bucaramanga', 'Empleo', 'Bucaramanga', 'Carrera 27 # 35-20', '607 633 1234', 'Lunes a viernes, 8:00 a 17:00', 'Orientación laboral y bolsa de empleo.', 7.1193000, -73.1227000, null],
    ['Fundación Mujer y Vida', 'Fundaciones', 'Bucaramanga', 'Calle 36 # 20-10', '607 645 1122', 'Lunes a viernes, 8:00 a 17:00', 'Acompañamiento psicosocial y jurídico.', 7.1250000, -73.1190000, null]
];

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

    // Migración para bases de datos creadas antes del módulo de acompañamiento
    await pool.query(
        "ALTER TABLE usuarias MODIFY COLUMN rol ENUM('usuaria', 'profesional', 'admin') NOT NULL DEFAULT 'usuaria'"
    );

    for (const nombre of AREAS) await consultar('INSERT IGNORE INTO areas (nombre) VALUES (?)', [nombre]);
    for (const nombre of MOTIVOS) await consultar('INSERT IGNORE INTO motivos (nombre) VALUES (?)', [nombre]);

    for (const [nombre, numero, descripcion, horario, categoria, orden] of LINEAS_AYUDA) {
        await consultar(
            `INSERT IGNORE INTO lineas_ayuda (nombre, numero, descripcion, horario, categoria, orden)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nombre, numero, descripcion, horario, categoria, orden]
        );
    }

    for (const [nombre, categoria, ciudad, direccion, telefono, horario, descripcion, lat, lng, web] of SERVICIOS_MAPA) {
        await consultar(
            `INSERT IGNORE INTO servicios_mapa
                (nombre, categoria, ciudad, direccion, telefono, horario, descripcion, lat, lng, web, creado_en)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
            [nombre, categoria, ciudad, direccion, telefono, horario, descripcion, lat, lng, web]
        );
    }
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
// USUARIAS, PROFESIONALES Y ACCESOS
// ------------------------------------------
const listarUsuarias = async () =>
    (await consultar(
        `SELECT u.id, u.nombre, u.email, u.rol, u.creado_en,
                (SELECT DATE_FORMAT(MAX(a.creado_en), '%Y-%m-%dT%H:%i:%s')
                   FROM accesos a WHERE a.usuaria_id = u.id) AS ultimo_acceso
           FROM usuarias u
          WHERE u.rol = 'usuaria'
          ORDER BY u.nombre`
    )).map(conFecha);

const registrarAcceso = (usuariaId) =>
    consultar('INSERT INTO accesos (usuaria_id, creado_en) VALUES (?, UTC_TIMESTAMP())', [usuariaId]);

const existeProfesional = async () =>
    (await consultar("SELECT 1 AS ok FROM usuarias WHERE rol = 'profesional' LIMIT 1")).length > 0;

const listarProfesionales = async (soloActivos = true) =>
    (await consultar(
        `SELECT u.id, u.nombre, u.email, u.creado_en, p.especialidad, p.descripcion, p.activo
           FROM usuarias u
           INNER JOIN perfiles_profesionales p ON p.usuaria_id = u.id
          WHERE u.rol = 'profesional' ${soloActivos ? 'AND p.activo = 1' : ''}
          ORDER BY u.nombre`
    )).map(conFecha);

const profesionalPorId = async (id) =>
    (await consultar(
        `SELECT u.id, u.nombre, u.email, p.especialidad, p.descripcion, p.activo
           FROM usuarias u
           INNER JOIN perfiles_profesionales p ON p.usuaria_id = u.id
          WHERE u.id = ? AND u.rol = 'profesional' LIMIT 1`,
        [id]
    ))[0];

const crearPerfilProfesional = (usuariaId, especialidad, descripcion) =>
    consultar(
        'INSERT INTO perfiles_profesionales (usuaria_id, especialidad, descripcion, activo) VALUES (?, ?, ?, 1)',
        [usuariaId, especialidad, descripcion || null]
    );

// Crea la cuenta, el perfil y los horarios en una sola operación
const crearProfesionalCompleto = ({ nombre, email, hash, especialidad, descripcion, rangos }) =>
    enTransaccion(async (c) => {
        const [r] = await c.execute(
            `INSERT INTO usuarias (nombre, email, password_hash, rol, creado_en)
             VALUES (?, ?, ?, 'profesional', UTC_TIMESTAMP())`,
            [nombre, email, hash]
        );

        const id = r.insertId;

        await c.execute(
            'INSERT INTO perfiles_profesionales (usuaria_id, especialidad, descripcion, activo) VALUES (?, ?, ?, 1)',
            [id, especialidad, descripcion || null]
        );

        for (const ra of rangos || []) {
            await c.execute(
                'INSERT INTO disponibilidad (profesional_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)',
                [id, ra.dia_semana, ra.hora_inicio, ra.hora_fin]
            );
        }

        return id;
    });

const actualizarPerfilProfesional = (usuariaId, { especialidad, descripcion, activo }) =>
    consultar(
        `UPDATE perfiles_profesionales
            SET especialidad = ?, descripcion = ?, activo = ?
          WHERE usuaria_id = ?`,
        [especialidad, descripcion || null, activo ? 1 : 0, usuariaId]
    );

// Última profesional con la que la usuaria tuvo cita o conversación (para asignar alertas)
const profesionalReciente = async (usuariaId) => {
    const cita = await consultar(
        'SELECT profesional_id FROM citas WHERE usuaria_id = ? ORDER BY fecha_hora DESC, id DESC LIMIT 1',
        [usuariaId]
    );
    if (cita.length) return cita[0].profesional_id;

    const mensaje = await consultar(
        'SELECT profesional_id FROM mensajes WHERE usuaria_id = ? ORDER BY creado_en DESC, id DESC LIMIT 1',
        [usuariaId]
    );
    return mensaje.length ? mensaje[0].profesional_id : null;
};

// ------------------------------------------
// DISPONIBILIDAD
// ------------------------------------------
const listarDisponibilidad = async (profesionalId) =>
    consultar(
        `SELECT id, dia_semana,
                TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
                TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin
           FROM disponibilidad
          WHERE profesional_id = ?
          ORDER BY dia_semana, hora_inicio`,
        [profesionalId]
    );

const tieneDisponibilidad = async (profesionalId) =>
    (await consultar('SELECT 1 AS ok FROM disponibilidad WHERE profesional_id = ? LIMIT 1', [profesionalId])).length > 0;

const reemplazarDisponibilidad = (profesionalId, rangos) =>
    enTransaccion(async (c) => {
        await c.execute('DELETE FROM disponibilidad WHERE profesional_id = ?', [profesionalId]);

        for (const r of rangos) {
            await c.execute(
                'INSERT INTO disponibilidad (profesional_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)',
                [profesionalId, r.dia_semana, r.hora_inicio, r.hora_fin]
            );
        }
    });

// ------------------------------------------
// CITAS
// ------------------------------------------
const SQL_CITAS = `
    SELECT c.id, c.usuaria_id, c.profesional_id,
           DATE_FORMAT(c.fecha_hora, '%Y-%m-%dT%H:%i:%s') AS fecha_hora,
           c.duracion_min, c.modalidad, c.motivo, c.estado, c.notas,
           DATE_FORMAT(c.creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en,
           u.nombre AS usuaria, u.email AS usuaria_email,
           p.nombre AS profesional, p.email AS profesional_email,
           pp.especialidad
      FROM citas c
      INNER JOIN usuarias u ON u.id = c.usuaria_id
      INNER JOIN usuarias p ON p.id = c.profesional_id
      LEFT JOIN perfiles_profesionales pp ON pp.usuaria_id = p.id`;

const crearCita = async ({ usuariaId, profesionalId, fechaHora, duracion, modalidad, motivo }) =>
    (await pool.execute(
        `INSERT INTO citas (usuaria_id, profesional_id, fecha_hora, duracion_min, modalidad, motivo, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [usuariaId, profesionalId, fechaHora, duracion, modalidad, motivo || null]
    ))[0].insertId;

const citasDeUsuaria = async (usuariaId) =>
    consultar(SQL_CITAS + ' WHERE c.usuaria_id = ? ORDER BY c.fecha_hora DESC, c.id DESC LIMIT 100', [usuariaId]);

const citasDeProfesional = async (profesionalId) =>
    consultar(SQL_CITAS + ' WHERE c.profesional_id = ? ORDER BY c.fecha_hora DESC, c.id DESC LIMIT 200', [profesionalId]);

const todasLasCitas = async () =>
    consultar(SQL_CITAS + ' ORDER BY c.fecha_hora DESC, c.id DESC LIMIT 500');

const citaPorId = async (id) =>
    (await consultar(SQL_CITAS + ' WHERE c.id = ? LIMIT 1', [id]))[0];

const cambiarEstadoCita = (id, estado, notas) =>
    consultar('UPDATE citas SET estado = ?, notas = COALESCE(?, notas) WHERE id = ?', [estado, notas || null, id]);

const hayConflictoCita = async (profesionalId, fechaHora, excluirId) => {
    // Dos citas se cruzan si una empieza antes de que termine la otra.
    const condicionExcluir = excluirId ? ' AND id <> ?' : '';
    const parametros = excluirId
        ? [profesionalId, fechaHora, fechaHora, excluirId]
        : [profesionalId, fechaHora, fechaHora];

    const filas = await consultar(
        `SELECT 1 AS ok FROM citas
          WHERE profesional_id = ?
            AND estado IN ('pendiente', 'confirmada')
            AND fecha_hora < DATE_ADD(?, INTERVAL 50 MINUTE)
            AND DATE_ADD(fecha_hora, INTERVAL duracion_min MINUTE) > ?
            ${condicionExcluir}
          LIMIT 1`,
        parametros
    );

    return filas.length > 0;
};

const citasOcupadas = async (profesionalId, desde, hasta) =>
    consultar(
        `SELECT DATE_FORMAT(fecha_hora, '%Y-%m-%dT%H:%i:%s') AS fecha_hora
           FROM citas
          WHERE profesional_id = ? AND estado IN ('pendiente', 'confirmada')
            AND fecha_hora BETWEEN ? AND ?`,
        [profesionalId, desde, hasta]
    );

const contarCitasActivasUsuaria = async (usuariaId) =>
    Number((await consultar(
        `SELECT COUNT(*) AS n FROM citas
          WHERE usuaria_id = ? AND fecha_hora >= (UTC_TIMESTAMP() - INTERVAL 5 HOUR)
            AND estado IN ('pendiente', 'confirmada')`,
        [usuariaId]
    ))[0].n);

// ------------------------------------------
// MENSAJERÍA
// ------------------------------------------
const crearMensaje = async ({ usuariaId, profesionalId, remitente, texto }) =>
    (await pool.execute(
        `INSERT INTO mensajes (usuaria_id, profesional_id, remitente, texto, creado_en)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
        [usuariaId, profesionalId, remitente, texto]
    ))[0].insertId;

const mensajesConversacion = async (usuariaId, profesionalId) =>
    consultar(
        `SELECT id, remitente, texto, leido,
                DATE_FORMAT(creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en
           FROM mensajes
          WHERE usuaria_id = ? AND profesional_id = ?
          ORDER BY creado_en ASC, id ASC
          LIMIT 300`,
        [usuariaId, profesionalId]
    );

const marcarMensajesLeidos = (usuariaId, profesionalId, quien) =>
    consultar(
        `UPDATE mensajes SET leido = 1
          WHERE usuaria_id = ? AND profesional_id = ? AND remitente = ? AND leido = 0`,
        [usuariaId, profesionalId, quien === 'profesional' ? 'usuaria' : 'profesional']
    );

const resumenConversacionesUsuaria = async (usuariaId) =>
    consultar(
        `SELECT p.id AS profesional_id, p.nombre AS profesional, pp.especialidad,
                (SELECT m.texto FROM mensajes m
                  WHERE m.usuaria_id = ? AND m.profesional_id = p.id
                  ORDER BY m.creado_en DESC, m.id DESC LIMIT 1) AS ultimo,
                (SELECT DATE_FORMAT(m.creado_en, '%Y-%m-%dT%H:%i:%s') FROM mensajes m
                  WHERE m.usuaria_id = ? AND m.profesional_id = p.id
                  ORDER BY m.creado_en DESC, m.id DESC LIMIT 1) AS ultimo_en,
                (SELECT COUNT(*) FROM mensajes m
                  WHERE m.usuaria_id = ? AND m.profesional_id = p.id
                    AND m.remitente = 'profesional' AND m.leido = 0) AS sin_leer
           FROM usuarias p
           INNER JOIN perfiles_profesionales pp ON pp.usuaria_id = p.id
          WHERE p.rol = 'profesional' AND pp.activo = 1
          ORDER BY pp.especialidad, p.nombre`,
        [usuariaId, usuariaId, usuariaId]
    );

const resumenConversacionesProfesional = async (profesionalId) =>
    consultar(
        `SELECT u.id AS usuaria_id, u.nombre AS usuaria,
                (SELECT m.texto FROM mensajes m
                  WHERE m.profesional_id = ? AND m.usuaria_id = u.id
                  ORDER BY m.creado_en DESC, m.id DESC LIMIT 1) AS ultimo,
                (SELECT DATE_FORMAT(m.creado_en, '%Y-%m-%dT%H:%i:%s') FROM mensajes m
                  WHERE m.profesional_id = ? AND m.usuaria_id = u.id
                  ORDER BY m.creado_en DESC, m.id DESC LIMIT 1) AS ultimo_en,
                (SELECT COUNT(*) FROM mensajes m
                  WHERE m.profesional_id = ? AND m.usuaria_id = u.id
                    AND m.remitente = 'usuaria' AND m.leido = 0) AS sin_leer
           FROM usuarias u
          WHERE u.rol = 'usuaria' AND (
                EXISTS (SELECT 1 FROM mensajes m WHERE m.profesional_id = ? AND m.usuaria_id = u.id)
             OR EXISTS (SELECT 1 FROM citas c WHERE c.profesional_id = ? AND c.usuaria_id = u.id)
          )
          ORDER BY ultimo_en DESC, u.nombre`,
        [profesionalId, profesionalId, profesionalId, profesionalId, profesionalId]
    );

// ------------------------------------------
// DIARIO EMOCIONAL
// ------------------------------------------
const guardarDiario = async ({ usuariaId, fecha, animo, emociones, nota }) => {
    await consultar(
        `INSERT INTO diario_emocional (usuaria_id, fecha, animo, emociones, nota, creado_en)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           animo = VALUES(animo),
           emociones = VALUES(emociones),
           nota = VALUES(nota),
           creado_en = UTC_TIMESTAMP()`,
        [usuariaId, fecha, animo, emociones || null, nota || null]
    );

    return (await consultar(
        `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, animo, emociones, nota,
                DATE_FORMAT(creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en
           FROM diario_emocional
          WHERE usuaria_id = ? AND fecha = ? LIMIT 1`,
        [usuariaId, fecha]
    ))[0];
};

const diarioDeUsuaria = async (usuariaId, limite = 60) => {
    const n = Math.min(Math.max(Number(limite) || 60, 1), 365);

    return consultar(
        `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, animo, emociones, nota,
                DATE_FORMAT(creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en
           FROM diario_emocional
          WHERE usuaria_id = ?
          ORDER BY fecha DESC, id DESC
          LIMIT ${n}`,
        [usuariaId]
    );
};

const diarioPorDia = async (usuariaId, dias = 30) => {
    const n = Math.min(Math.max(Number(dias) || 30, 1), 365);

    return consultar(
        `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                ROUND(AVG(animo), 1) AS promedio, COUNT(*) AS registros
           FROM diario_emocional
          WHERE usuaria_id = ? AND fecha >= DATE_SUB(DATE(UTC_TIMESTAMP() - INTERVAL 5 HOUR), INTERVAL ${n - 1} DAY)
          GROUP BY fecha
          ORDER BY fecha`,
        [usuariaId]
    );
};

// ------------------------------------------
// TESTS DE BIENESTAR Y ALERTAS
// ------------------------------------------
const guardarTest = async ({ usuariaId, tipo, puntaje, nivel, respuestas, riesgo }) =>
    (await pool.execute(
        `INSERT INTO tests_bienestar (usuaria_id, tipo, puntaje, nivel, respuestas, riesgo, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [usuariaId, tipo, puntaje, nivel, JSON.stringify(respuestas), riesgo ? 1 : 0]
    ))[0].insertId;

const historialTests = async (usuariaId) =>
    consultar(
        `SELECT id, tipo, puntaje, nivel, riesgo,
                DATE_FORMAT(creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en
           FROM tests_bienestar
          WHERE usuaria_id = ?
          ORDER BY creado_en DESC, id DESC
          LIMIT 60`,
        [usuariaId]
    );

const todosLosTests = async () =>
    consultar(
        `SELECT t.id, t.tipo, t.puntaje, t.nivel, t.riesgo,
                DATE_FORMAT(t.creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en,
                u.id AS usuaria_id, u.nombre AS usuaria, u.email AS usuaria_email
           FROM tests_bienestar t
           INNER JOIN usuarias u ON u.id = t.usuaria_id
          ORDER BY t.creado_en DESC, t.id DESC
          LIMIT 500`
    );

const crearAlerta = ({ usuariaId, profesionalId, tipo, nivel, descripcion }) =>
    consultar(
        `INSERT INTO alertas (usuaria_id, profesional_id, tipo, nivel, descripcion, creado_en)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [usuariaId, profesionalId || null, tipo, nivel || 'alto', descripcion]
    );

const SQL_ALERTAS = `
    SELECT a.id, a.tipo, a.nivel, a.descripcion, a.atendida,
           DATE_FORMAT(a.creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en,
           u.id AS usuaria_id, u.nombre AS usuaria, u.email AS usuaria_email,
           p.id AS profesional_id, p.nombre AS profesional
      FROM alertas a
      INNER JOIN usuarias u ON u.id = a.usuaria_id
      LEFT JOIN usuarias p ON p.id = a.profesional_id`;

const alertasDeProfesional = async (profesionalId) =>
    consultar(
        SQL_ALERTAS + ' WHERE (a.profesional_id = ? OR a.profesional_id IS NULL) ORDER BY a.atendida ASC, a.creado_en DESC',
        [profesionalId]
    );

const alertasAdmin = async () =>
    consultar(SQL_ALERTAS + ' ORDER BY a.atendida ASC, a.creado_en DESC LIMIT 500');

const atenderAlerta = (id, profesionalId) =>
    consultar(
        `UPDATE alertas
            SET atendida = 1,
                profesional_id = COALESCE(profesional_id, ?)
          WHERE id = ?`,
        [profesionalId || null, id]
    );

// ------------------------------------------
// LÍNEAS DE AYUDA Y MAPA DE SERVICIOS
// ------------------------------------------
const lineasAyuda = async () =>
    consultar(
        `SELECT id, nombre, numero, descripcion, horario, categoria
           FROM lineas_ayuda
          WHERE activo = 1
          ORDER BY orden, nombre`
    );

const serviciosMapa = async (categoria, ciudad) => {
    let sql = `SELECT id, nombre, categoria, ciudad, direccion, telefono, horario,
                      descripcion, lat, lng, web
                 FROM servicios_mapa
                WHERE 1 = 1`;
    const params = [];

    if (categoria) {
        sql += ' AND categoria = ?';
        params.push(categoria);
    }

    if (ciudad) {
        sql += ' AND ciudad = ?';
        params.push(ciudad);
    }

    sql += ' ORDER BY ciudad, categoria, nombre';
    return consultar(sql, params);
};

const filtrosServicios = async () => {
    const categorias = await consultar('SELECT DISTINCT categoria FROM servicios_mapa ORDER BY categoria');
    const ciudades = await consultar('SELECT DISTINCT ciudad FROM servicios_mapa ORDER BY ciudad');

    return {
        categorias: categorias.map((f) => f.categoria),
        ciudades: ciudades.map((f) => f.ciudad)
    };
};

// ------------------------------------------
// LOGROS LABORALES
// ------------------------------------------
const listarLogros = async () =>
    consultar(
        `SELECT l.id, l.empresa, l.cargo,
                DATE_FORMAT(l.fecha, '%Y-%m-%d') AS fecha,
                DATE_FORMAT(l.creado_en, '%Y-%m-%dT%H:%i:%s') AS creado_en,
                u.id AS usuaria_id, u.nombre AS usuaria
           FROM logros_laborales l
           INNER JOIN usuarias u ON u.id = l.usuaria_id
          ORDER BY l.fecha DESC, l.id DESC
          LIMIT 300`
    );

const crearLogro = ({ usuariaId, empresa, cargo, fecha }) =>
    consultar(
        'INSERT INTO logros_laborales (usuaria_id, empresa, cargo, fecha, creado_en) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
        [usuariaId, empresa, cargo || null, fecha]
    );

const borrarLogro = async (id) =>
    (await pool.execute('DELETE FROM logros_laborales WHERE id = ?', [id]))[0].affectedRows;

// ------------------------------------------
// RESUMEN Y ESTADÍSTICAS
// ------------------------------------------
const contar = async (sql) => Number((await consultar(sql))[0].n);
const uno = async (sql, params = []) => (await consultar(sql, params))[0] || {};

const resumen = async () => ({
    testimoniosPendientes: await contar("SELECT COUNT(*) AS n FROM testimonios WHERE estado = 'pendiente'"),
    testimoniosPublicados: await contar("SELECT COUNT(*) AS n FROM testimonios WHERE estado = 'aprobado'"),
    solicitudesNuevas: await contar("SELECT COUNT(*) AS n FROM solicitudes WHERE estado = 'nueva'"),
    citasPendientes: await contar("SELECT COUNT(*) AS n FROM citas WHERE estado = 'pendiente'"),
    alertasPendientes: await contar('SELECT COUNT(*) AS n FROM alertas WHERE atendida = 0')
});

const estadisticas = async () => {
    const [
        totalUsuarias, activas, desertoras,
        citasRealizadas, citasPendientes, citasConfirmadas, citasCanceladas,
        testsTotal, testsRiesgo, alertasPendientes,
        promedioAnimo, entradasDiario, mensajesTotal, empleosConseguidos, progresoPromedio,
        testimoniosPendientes, testimoniosPublicados, solicitudesNuevas,
        citasPorEstado, citasPorMes, testsPorMes, animoPorDia, nuevosPorMes, logrosPorMes
    ] = await Promise.all([
        uno("SELECT COUNT(*) AS n FROM usuarias WHERE rol = 'usuaria'"),
        uno(`SELECT COUNT(DISTINCT u.id) AS n
               FROM usuarias u
              WHERE u.rol = 'usuaria' AND (
                    EXISTS (SELECT 1 FROM accesos a WHERE a.usuaria_id = u.id AND a.creado_en >= UTC_TIMESTAMP() - INTERVAL 30 DAY)
                 OR EXISTS (SELECT 1 FROM citas c WHERE c.usuaria_id = u.id AND c.creado_en >= UTC_TIMESTAMP() - INTERVAL 30 DAY)
                 OR EXISTS (SELECT 1 FROM diario_emocional d WHERE d.usuaria_id = u.id AND d.creado_en >= UTC_TIMESTAMP() - INTERVAL 30 DAY)
                 OR EXISTS (SELECT 1 FROM tests_bienestar t WHERE t.usuaria_id = u.id AND t.creado_en >= UTC_TIMESTAMP() - INTERVAL 30 DAY)
                 OR EXISTS (SELECT 1 FROM mensajes m WHERE m.usuaria_id = u.id AND m.creado_en >= UTC_TIMESTAMP() - INTERVAL 30 DAY)
              )`),
        uno(`SELECT COUNT(*) AS n
               FROM usuarias u
              WHERE u.rol = 'usuaria'
                AND u.creado_en <= UTC_TIMESTAMP() - INTERVAL 60 DAY
                AND NOT EXISTS (SELECT 1 FROM accesos a WHERE a.usuaria_id = u.id AND a.creado_en >= UTC_TIMESTAMP() - INTERVAL 60 DAY)
                AND NOT EXISTS (SELECT 1 FROM citas c WHERE c.usuaria_id = u.id AND c.creado_en >= UTC_TIMESTAMP() - INTERVAL 60 DAY)
                AND NOT EXISTS (SELECT 1 FROM diario_emocional d WHERE d.usuaria_id = u.id AND d.creado_en >= UTC_TIMESTAMP() - INTERVAL 60 DAY)
                AND NOT EXISTS (SELECT 1 FROM tests_bienestar t WHERE t.usuaria_id = u.id AND t.creado_en >= UTC_TIMESTAMP() - INTERVAL 60 DAY)
                AND NOT EXISTS (SELECT 1 FROM mensajes m WHERE m.usuaria_id = u.id AND m.creado_en >= UTC_TIMESTAMP() - INTERVAL 60 DAY)`),
        uno("SELECT COUNT(*) AS n FROM citas WHERE estado = 'completada' OR (estado = 'confirmada' AND fecha_hora < (UTC_TIMESTAMP() - INTERVAL 5 HOUR))"),
        uno("SELECT COUNT(*) AS n FROM citas WHERE estado = 'pendiente'"),
        uno("SELECT COUNT(*) AS n FROM citas WHERE estado = 'confirmada'"),
        uno("SELECT COUNT(*) AS n FROM citas WHERE estado = 'cancelada'"),
        uno('SELECT COUNT(*) AS n FROM tests_bienestar'),
        uno('SELECT COUNT(*) AS n FROM tests_bienestar WHERE riesgo = 1'),
        uno('SELECT COUNT(*) AS n FROM alertas WHERE atendida = 0'),
        uno("SELECT ROUND(AVG(animo), 1) AS n FROM diario_emocional WHERE fecha >= DATE_SUB(DATE(UTC_TIMESTAMP() - INTERVAL 5 HOUR), INTERVAL 30 DAY)"),
        uno('SELECT COUNT(*) AS n FROM diario_emocional'),
        uno('SELECT COUNT(*) AS n FROM mensajes'),
        uno('SELECT COUNT(*) AS n FROM logros_laborales'),
        uno(`SELECT ROUND(AVG(
                    (CASE WHEN EXISTS (SELECT 1 FROM citas c WHERE c.usuaria_id = u.id AND c.estado = 'completada') THEN 25 ELSE 0 END) +
                    (CASE WHEN EXISTS (SELECT 1 FROM diario_emocional d WHERE d.usuaria_id = u.id AND d.fecha >= DATE_SUB(DATE(UTC_TIMESTAMP() - INTERVAL 5 HOUR), INTERVAL 30 DAY)) THEN 25 ELSE 0 END) +
                    (CASE WHEN EXISTS (SELECT 1 FROM tests_bienestar t WHERE t.usuaria_id = u.id) THEN 25 ELSE 0 END) +
                    (CASE WHEN EXISTS (SELECT 1 FROM mensajes m WHERE m.usuaria_id = u.id) THEN 25 ELSE 0 END)
                ), 0) AS n
               FROM usuarias u WHERE u.rol = 'usuaria'`),
        uno("SELECT COUNT(*) AS n FROM testimonios WHERE estado = 'pendiente'"),
        uno("SELECT COUNT(*) AS n FROM testimonios WHERE estado = 'aprobado'"),
        uno("SELECT COUNT(*) AS n FROM solicitudes WHERE estado = 'nueva'"),
        consultar('SELECT estado, COUNT(*) AS n FROM citas GROUP BY estado'),
        consultar(`SELECT DATE_FORMAT(fecha_hora, '%Y-%m') AS mes, estado, COUNT(*) AS n
                     FROM citas
                    WHERE fecha_hora >= DATE_SUB(
                        DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 5 HOUR, '%Y-%m-01'),
                        INTERVAL 5 MONTH
                    )
                    GROUP BY mes, estado ORDER BY mes`),
        consultar(`SELECT DATE_FORMAT(creado_en, '%Y-%m') AS mes, COUNT(*) AS total, SUM(riesgo) AS riesgo
                     FROM tests_bienestar
                    WHERE creado_en >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
                    GROUP BY mes ORDER BY mes`),
        consultar(`SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, ROUND(AVG(animo), 1) AS promedio, COUNT(*) AS n
                     FROM diario_emocional
                    WHERE fecha >= DATE_SUB(DATE(UTC_TIMESTAMP() - INTERVAL 5 HOUR), INTERVAL 29 DAY)
                    GROUP BY fecha ORDER BY fecha`),
        consultar(`SELECT DATE_FORMAT(creado_en, '%Y-%m') AS mes, COUNT(*) AS n
                     FROM usuarias
                    WHERE rol = 'usuaria' AND creado_en >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
                    GROUP BY mes ORDER BY mes`),
        consultar(`SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, COUNT(*) AS n
                     FROM logros_laborales
                    WHERE fecha >= DATE_SUB(DATE(UTC_TIMESTAMP() - INTERVAL 5 HOUR), INTERVAL 5 MONTH)
                    GROUP BY mes ORDER BY mes`)
    ]);

    const numero = (obj) => Number((obj && obj.n) || 0);
    const total = numero(totalUsuarias);
    const activasN = numero(activas);
    const promedio = promedioAnimo.n;

    return {
        generadoEn: new Date().toISOString(),
        totalUsuarias: total,
        usuariasActivas: activasN,
        usuariasInactivas: Math.max(total - activasN, 0),
        desercion: total ? Math.round((numero(desertoras) / total) * 1000) / 10 : 0,
        citasRealizadas: numero(citasRealizadas),
        citasPendientes: numero(citasPendientes),
        citasConfirmadas: numero(citasConfirmadas),
        citasCanceladas: numero(citasCanceladas),
        testsTotal: numero(testsTotal),
        testsRiesgo: numero(testsRiesgo),
        alertasPendientes: numero(alertasPendientes),
        promedioAnimo: promedio === null ? null : Number(promedio),
        entradasDiario: numero(entradasDiario),
        mensajesTotal: numero(mensajesTotal),
        empleosConseguidos: numero(empleosConseguidos),
        progresoPromedio: Number(progresoPromedio.n || 0),
        testimoniosPendientes: numero(testimoniosPendientes),
        testimoniosPublicados: numero(testimoniosPublicados),
        solicitudesNuevas: numero(solicitudesNuevas),
        citasPorEstado: citasPorEstado.map((f) => ({ estado: f.estado, total: Number(f.n) })),
        citasPorMes: citasPorMes.map((f) => ({ mes: f.mes, estado: f.estado, total: Number(f.n) })),
        testsPorMes: testsPorMes.map((f) => ({
            mes: f.mes,
            total: Number(f.total),
            riesgo: Number(f.riesgo || 0)
        })),
        animoPorDia: animoPorDia.map((f) => ({
            fecha: f.fecha,
            promedio: Number(f.promedio),
            registros: Number(f.n)
        })),
        nuevosPorMes: nuevosPorMes.map((f) => ({ mes: f.mes, total: Number(f.n) })),
        logrosPorMes: logrosPorMes.map((f) => ({ mes: f.mes, total: Number(f.n) }))
    };
};

module.exports = {
    AREAS, MOTIVOS, iniciar,
    crearUsuaria, usuariaPorEmail, usuariaPorId, usuariaConHash, cambiarHash, existeAdmin,
    listarUsuarias, registrarAcceso, existeProfesional,
    listarProfesionales, profesionalPorId, crearPerfilProfesional, crearProfesionalCompleto,
    actualizarPerfilProfesional, profesionalReciente,
    listarDisponibilidad, tieneDisponibilidad, reemplazarDisponibilidad,
    crearCita, citasDeUsuaria, citasDeProfesional, todasLasCitas, citaPorId,
    cambiarEstadoCita, hayConflictoCita, citasOcupadas, contarCitasActivasUsuaria,
    crearMensaje, mensajesConversacion, marcarMensajesLeidos,
    resumenConversacionesUsuaria, resumenConversacionesProfesional,
    guardarDiario, diarioDeUsuaria, diarioPorDia,
    guardarTest, historialTests, todosLosTests,
    crearAlerta, alertasDeProfesional, alertasAdmin, atenderAlerta,
    lineasAyuda, serviciosMapa, filtrosServicios,
    listarLogros, crearLogro, borrarLogro,
    crearTestimonio, testimoniosPublicos, listarTestimonios, estadoTestimonio, borrarTestimonio,
    crearSolicitud, listarSolicitudes, estadoSolicitud, borrarSolicitud,
    resumen, estadisticas
};
