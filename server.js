// ==========================================
// SERVIDOR · BAJO LA SOMBRILLA
// ==========================================

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('./db');

const PORT = process.env.PORT || 3000;
const PRODUCCION = process.env.NODE_ENV === 'production';
const SECRETO = process.env.JWT_SECRET || '';

if (SECRETO.length < 32) {
    console.error(
        'Falta JWT_SECRET en el archivo .env (mínimo 32 caracteres).\n' +
        'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
    process.exit(1);
}

// ------------------------------------------
// CUENTA DE ADMINISTRACIÓN (se crea una sola vez, al arrancar)
// ------------------------------------------
async function crearAdminInicial() {
    if (await db.existeAdmin()) return;

    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const clave = process.env.ADMIN_PASSWORD || '';

    if (email && clave.length >= 10) {
        try {
            await db.crearUsuaria('Administración', email, await bcrypt.hash(clave, 12), 'admin');
            console.log('Cuenta de administración creada: ' + email);
        } catch (e) {
            console.error('No se pudo crear la cuenta de administración (¿ya existe una cuenta con ese correo?): ' + e.message);
            process.exit(1);
        }
    } else {
        console.warn(
            'Aún no existe una cuenta de administración. Define ADMIN_EMAIL y ' +
            'ADMIN_PASSWORD (mínimo 10 caracteres) en .env y reinicia el servidor.'
        );
    }
}

// ------------------------------------------
// CONFIGURACIÓN GENERAL
// ------------------------------------------
const app = express();

app.disable('x-powered-by');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            // El sitio puede probarse por http://localhost sin HTTPS
            upgradeInsecureRequests: PRODUCCION ? [] : null
        }
    }
}));

app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

// No guardar en caché las respuestas de la API
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// ------------------------------------------
// LÍMITES DE USO (contra abuso y fuerza bruta)
// ------------------------------------------
const limitar = (minutos, limite, mensaje) => rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: limite,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: mensaje }
});

// Inicio de sesión: solo cuentan los intentos fallidos
const limiteAcceso = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }
});
const limiteRegistro = limitar(60, 10, 'Se crearon muchas cuentas desde esta conexión. Intenta de nuevo más tarde.');
const limiteEnvios = limitar(60, 20, 'Has enviado muchos mensajes seguidos. Intenta de nuevo más tarde.');

// ------------------------------------------
// VALIDACIÓN
// ------------------------------------------
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const emailValido = (v) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const claveValida = (v) => typeof v === 'string' && Buffer.byteLength(v) <= 72;   // límite de bcrypt
const listaDeTextos = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 20) : []);

const falla = (res, estado, mensaje) => res.status(estado).json({ error: mensaje });

// Express 4 no captura los errores de funciones async: este envoltorio los envía al manejador de errores
const ruta = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ------------------------------------------
// SESIÓN (cookie httpOnly con un token firmado)
// ------------------------------------------
const emitirSesion = (res, u) => {
    const esAdmin = u.rol === 'admin';
    const duracion = esAdmin ? 2 * 60 * 60 : 7 * 24 * 60 * 60;   // en segundos

    const token = jwt.sign({ id: u.id }, SECRETO, { expiresIn: duracion });

    res.cookie('token', token, {
        httpOnly: true,                 // JavaScript del navegador no puede leerla
        sameSite: 'lax',                // protege contra peticiones desde otros sitios
        secure: PRODUCCION,             // solo por HTTPS cuando está publicado
        maxAge: duracion * 1000
    });
};

// Identifica a la usuaria (si hay sesión) a partir de la cookie
app.use(ruta(async (req, res, next) => {
    req.usuaria = null;

    const token = req.cookies && req.cookies.token;
    if (!token) return next();

    let datos = null;

    try {
        datos = jwt.verify(token, SECRETO);
    } catch (e) {
        return next();   // token inválido o vencido: se trata como "sin sesión"
    }

    // Se consulta siempre: si la cuenta se borra, la sesión deja de valer
    req.usuaria = (await db.usuariaPorId(datos.id)) || null;
    next();
}));

const exigirSesion = (req, res, next) =>
    req.usuaria ? next() : falla(res, 401, 'Inicia sesión para continuar.');

const exigirAdmin = (req, res, next) => {
    if (!req.usuaria) return falla(res, 401, 'Inicia sesión para continuar.');
    if (req.usuaria.rol !== 'admin') return falla(res, 403, 'Esta cuenta no tiene permisos de administración.');
    next();
};

const publica = (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol });

// Hash de relleno: hace que el tiempo de respuesta sea parecido exista o no el correo
const HASH_RELLENO = bcrypt.hashSync('relleno-no-es-una-clave', 12);   // se calcula una sola vez al arrancar

// ==========================================
// RUTAS PÚBLICAS
// ==========================================

// Crear cuenta
app.post('/api/registro', limiteRegistro, async (req, res, next) => {
    try {
        const nombre = texto(req.body.nombre);
        const email = texto(req.body.email).toLowerCase();
        const clave = req.body.password;

        if (!nombre || nombre.length > 80) return falla(res, 400, 'Escribe un nombre o seudónimo (máximo 80 caracteres).');
        if (!emailValido(email)) return falla(res, 400, 'Escribe un correo electrónico válido.');
        if (typeof clave !== 'string' || clave.length < 8) return falla(res, 400, 'La contraseña debe tener al menos 8 caracteres.');
        if (!claveValida(clave)) return falla(res, 400, 'La contraseña es demasiado larga (máximo 72 caracteres).');

        if (await db.usuariaPorEmail(email)) return falla(res, 409, 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.');

        let id;

        try {
            id = await db.crearUsuaria(nombre, email, await bcrypt.hash(clave, 12));
        } catch (e) {
            // Dos registros simultáneos con el mismo correo: MySQL rechaza el segundo
            if (e.code === 'ER_DUP_ENTRY') return falla(res, 409, 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.');
            throw e;
        }

        const u = await db.usuariaPorId(id);

        emitirSesion(res, u);
        res.status(201).json({ usuaria: publica(u) });
    } catch (e) { next(e); }
});

// Iniciar sesión (usuarias y administración)
app.post('/api/login', limiteAcceso, async (req, res, next) => {
    try {
        const email = texto(req.body.email).toLowerCase();
        const clave = req.body.password;

        if (!emailValido(email) || typeof clave !== 'string' || !claveValida(clave)) {
            return falla(res, 400, 'Revisa tu correo y tu contraseña.');
        }

        const u = await db.usuariaPorEmail(email);
        const correcta = await bcrypt.compare(clave, u ? u.password_hash : HASH_RELLENO);

        if (!u || !correcta) return falla(res, 401, 'Correo o contraseña incorrectos.');

        emitirSesion(res, u);
        res.json({ usuaria: publica(u) });
    } catch (e) { next(e); }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: PRODUCCION });
    res.json({ ok: true });
});

// ¿Quién soy? (la página lo usa para saber si la sesión sigue vigente)
app.get('/api/yo', (req, res) => {
    res.json({ usuaria: req.usuaria ? publica(req.usuaria) : null });
});

// Cambiar contraseña (cualquier cuenta con sesión)
app.post('/api/cambiar-clave', exigirSesion, limiteAcceso, async (req, res, next) => {
    try {
        const { actual, nueva } = req.body;
        const u = await db.usuariaConHash(req.usuaria.id);
        const minimo = u.rol === 'admin' ? 10 : 8;

        if (typeof actual !== 'string' || !(await bcrypt.compare(actual, u.password_hash))) {
            return falla(res, 400, 'La contraseña actual no es correcta.');
        }
        if (typeof nueva !== 'string' || nueva.length < minimo) {
            return falla(res, 400, 'La contraseña nueva debe tener al menos ' + minimo + ' caracteres.');
        }
        if (!claveValida(nueva)) return falla(res, 400, 'La contraseña es demasiado larga (máximo 72 caracteres).');

        await db.cambiarHash(u.id, await bcrypt.hash(nueva, 12));
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// Testimonios publicados (sección "Voces")
app.get('/api/testimonios', ruta(async (req, res) => {
    res.json((await db.testimoniosPublicos()).map((t) => ({
        nombre: t.nombre_publico || 'Anónimo',
        texto: t.texto,
        areas: t.areas || '',
        fecha: t.creado_en
    })));
}));

// Enviar un testimonio (queda "pendiente" hasta que la administración lo apruebe)
app.post('/api/testimonios', limiteEnvios, ruta(async (req, res) => {
    const modo = req.body.modo;
    const contenido = texto(req.body.texto);

    if (!contenido) return falla(res, 400, 'Escribe tu testimonio para poder enviarlo.');
    if (contenido.length > 3000) return falla(res, 400, 'El testimonio es demasiado largo (máximo 3000 caracteres).');
    if (!['anonimo', 'seudonimo', 'nombre'].includes(modo)) return falla(res, 400, 'Elige cómo quieres aparecer.');

    let nombrePublico = null;
    let usuariaId = null;

    if (modo !== 'anonimo') {
        if (!req.usuaria) return falla(res, 401, 'Inicia sesión para compartir con tu nombre o seudónimo, o comparte de forma anónima.');

        if (modo === 'seudonimo') {
            nombrePublico = texto(req.body.seudonimo).slice(0, 80) || null;
        } else {
            nombrePublico = req.usuaria.nombre;
            usuariaId = req.usuaria.id;   // solo se vincula a la cuenta si la persona decide firmar con su nombre
        }
    }

    // Un testimonio anónimo o con seudónimo NO se vincula a la cuenta, aunque haya sesión iniciada.
    await db.crearTestimonio({
        usuariaId,
        nombrePublico,
        texto: contenido,
        areas: listaDeTextos(req.body.areas)
    });

    res.status(201).json({ ok: true });
}));

// Enviar una solicitud de orientación
app.post('/api/solicitudes', limiteEnvios, ruta(async (req, res) => {
    const nombre = texto(req.body.nombre);
    const contacto = texto(req.body.contacto);
    const mensaje = texto(req.body.mensaje);
    const motivos = listaDeTextos(req.body.motivos);

    if (!motivos.length && !mensaje) {
        return falla(res, 400, 'Elige al menos una opción o cuéntanos brevemente qué necesitas.');
    }
    if (nombre.length > 80 || contacto.length > 120 || mensaje.length > 2000) {
        return falla(res, 400, 'Alguno de los textos es demasiado largo.');
    }

    await db.crearSolicitud({ nombre, contacto, mensaje, motivos });
    res.status(201).json({ ok: true });
}));

// ==========================================
// RUTAS DE ADMINISTRACIÓN
// ==========================================
const admin = express.Router();
admin.use(exigirAdmin);

const idValido = (v) => /^\d{1,12}$/.test(v) ? Number(v) : null;
const filtro = (v, permitidos) => (permitidos.includes(v) ? v : null);

admin.get('/resumen', ruta(async (req, res) => res.json(await db.resumen())));

admin.get('/testimonios', ruta(async (req, res) => {
    res.json(await db.listarTestimonios(filtro(req.query.estado, ['pendiente', 'aprobado', 'rechazado'])));
}));

admin.patch('/testimonios/:id', ruta(async (req, res) => {
    const id = idValido(req.params.id);
    const estado = filtro(req.body.estado, ['pendiente', 'aprobado', 'rechazado']);

    if (!id || !estado) return falla(res, 400, 'Datos no válidos.');
    if (!(await db.estadoTestimonio(id, estado))) return falla(res, 404, 'No encontramos ese testimonio.');
    res.json({ ok: true });
}));

admin.delete('/testimonios/:id', ruta(async (req, res) => {
    const id = idValido(req.params.id);

    if (!id) return falla(res, 400, 'Datos no válidos.');
    if (!(await db.borrarTestimonio(id))) return falla(res, 404, 'No encontramos ese testimonio.');
    res.json({ ok: true });
}));

admin.get('/solicitudes', ruta(async (req, res) => {
    res.json(await db.listarSolicitudes(filtro(req.query.estado, ['nueva', 'atendida'])));
}));

admin.patch('/solicitudes/:id', ruta(async (req, res) => {
    const id = idValido(req.params.id);
    const estado = filtro(req.body.estado, ['nueva', 'atendida']);

    if (!id || !estado) return falla(res, 400, 'Datos no válidos.');
    if (!(await db.estadoSolicitud(id, estado))) return falla(res, 404, 'No encontramos esa solicitud.');
    res.json({ ok: true });
}));

admin.delete('/solicitudes/:id', ruta(async (req, res) => {
    const id = idValido(req.params.id);

    if (!id) return falla(res, 400, 'Datos no válidos.');
    if (!(await db.borrarSolicitud(id))) return falla(res, 404, 'No encontramos esa solicitud.');
    res.json({ ok: true });
}));

// Descargar solicitudes en CSV (se abre en Excel)
admin.get('/solicitudes.csv', ruta(async (req, res) => {
    // Si una celda empieza con = + - @ Excel podría ejecutarla como fórmula: se neutraliza
    const celda = (v) => {
        let s = String(v == null ? '' : v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
    };

    const filas = [['Fecha', 'Nombre', 'Contacto', 'Motivos', 'Mensaje', 'Estado']];

    (await db.listarSolicitudes(null)).forEach((s) =>
        filas.push([s.creado_en, s.nombre, s.contacto, s.motivos, s.mensaje, s.estado])
    );

    res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="solicitudes-bajo-la-sombrilla.csv"'
    });
    res.send('\ufeff' + filas.map((f) => f.map(celda).join(',')).join('\r\n'));
}));

app.use('/api/admin', admin);

// Cualquier otra ruta de la API
app.use('/api', (req, res) => falla(res, 404, 'No encontrado.'));

// ==========================================
// SITIO WEB (carpeta public)
// ==========================================
app.get('/', (req, res) => res.redirect('/Bajo_la_sombrilla.html'));
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------
// ERRORES
// ------------------------------------------
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
        return falla(res, 400, 'Solicitud no válida.');
    }
    console.error(err);
    falla(res, 500, 'Ocurrió un error en el servidor. Intenta de nuevo.');
});

// ------------------------------------------
// ARRANQUE
// ------------------------------------------
(async () => {
    try {
        await db.iniciar();          // crea las tablas si no existen
        await crearAdminInicial();
    } catch (e) {
        const pistas = {
            ECONNREFUSED: 'MySQL no está encendido o el host/puerto de .env no es correcto.',
            ER_ACCESS_DENIED_ERROR: 'Usuario o contraseña de MySQL incorrectos (revisa DB_USER y DB_PASSWORD en .env).',
            ER_BAD_DB_ERROR: 'La base de datos no existe. Créala primero (ver README.md) y revisa DB_NAME en .env.'
        };

        console.error('No se pudo conectar con la base de datos: ' + (pistas[e.code] || e.message));
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log('Bajo la sombrilla funcionando en http://localhost:' + PORT);
    });
})();
