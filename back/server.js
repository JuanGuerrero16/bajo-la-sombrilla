// ==========================================
// SERVIDOR · BAJO LA SOMBRILLA
// ==========================================

require("dotenv").config();

const cors = require("cors");

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const db = require("./db");

const PORT = process.env.PORT || 3000;
const PRODUCCION = process.env.NODE_ENV === "production";
const SECRETO = process.env.JWT_SECRET || "";

if (SECRETO.length < 32) {
  console.error(
    "Falta JWT_SECRET en el archivo .env (mínimo 32 caracteres).\n" +
      "Genera uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
  );
  process.exit(1);
}

// ------------------------------------------
// CUENTA DE ADMINISTRACIÓN (se crea una sola vez, al arrancar)
// ------------------------------------------
async function crearAdminInicial() {
  if (await db.existeAdmin()) return;

  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const clave = process.env.ADMIN_PASSWORD || "";

  if (email && clave.length >= 10) {
    try {
      await db.crearUsuaria(
        "Administración",
        email,
        await bcrypt.hash(clave, 12),
        "admin",
      );
      console.log("Cuenta de administración creada: " + email);
    } catch (e) {
      console.error(
        "No se pudo crear la cuenta de administración (¿ya existe una cuenta con ese correo?): " +
          e.message,
      );
      process.exit(1);
    }
  } else {
    console.warn(
      "Aún no existe una cuenta de administración. Define ADMIN_EMAIL y " +
        "ADMIN_PASSWORD (mínimo 10 caracteres) en .env y reinicia el servidor.",
    );
  }
}

// ------------------------------------------
// PROFESIONALES DE DEMOSTRACIÓN (solo en desarrollo)
// ------------------------------------------
async function prepararProfesionales() {
  const existentes = await db.listarProfesionales(false);

  // Asegura que toda profesional tenga horarios aunque se haya creado antes
  for (const p of existentes) {
    if (!(await db.tieneDisponibilidad(p.id))) {
      await db.reemplazarDisponibilidad(p.id, disponibilidadPorDefecto());
    }
  }

  if (process.env.NODE_ENV === "production" || existentes.length) return;

  const clave = process.env.PROF_PASSWORD || "Profesional2026*";
  const cuentas = [
    {
      nombre: "Ana Torres",
      email: process.env.PROF_EMAIL || "psicologa@bajolasombrilla.org",
      especialidad: "Psicología clínica",
      descripcion:
        "Acompañamiento emocional, escucha activa y seguimiento a procesos de ansiedad y autoestima.",
    },
    {
      nombre: "María Gómez",
      email: "trabajadora.social@bajolasombrilla.org",
      especialidad: "Trabajo social",
      descripcion:
        "Orientación en rutas de atención, redes de apoyo, vivienda y acceso a servicios sociales.",
    },
    {
      nombre: "Laura Díaz",
      email: "abogada@bajolasombrilla.org",
      especialidad: "Orientación jurídica",
      descripcion:
        "Acompañamiento en trámites, derechos, denuncias y rutas de protección.",
    },
  ];

  for (const cuenta of cuentas) {
    if (await db.usuariaPorEmail(cuenta.email)) continue;

    await db.crearProfesionalCompleto({
      ...cuenta,
      hash: await bcrypt.hash(clave, 12),
      rangos: disponibilidadPorDefecto(),
    });
  }

  console.log(
    "Profesionales de demostración creadas. Correo: psicologa@bajolasombrilla.org · Contraseña: " +
      clave,
  );
}

// ------------------------------------------
// CONFIGURACIÓN GENERAL
// ------------------------------------------
const app = express();
app.use(
  cors({
    origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.disable("x-powered-by");

app.use(
  helmet({
    // OpenStreetMap exige un Referer válido para servir sus teselas.
    // Sin esta política, Helmet envía "no-referrer" y el mapa recibe 403.
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.tile.openstreetmap.org",
          "https://tile.openstreetmap.org",
        ],
        connectSrc: ["'self'", "https://tile.openstreetmap.org"],
        frameAncestors: ["'none'"],
        // El sitio puede probarse por http://localhost sin HTTPS
        upgradeInsecureRequests: PRODUCCION ? [] : null,
      },
    },
  }),
);

app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

// No guardar en caché las respuestas de la API
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ------------------------------------------
// LÍMITES DE USO (contra abuso y fuerza bruta)
// ------------------------------------------
const limitar = (minutos, limite, mensaje) =>
  rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: limite,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: mensaje },
  });

// Inicio de sesión: solo cuentan los intentos fallidos
const limiteAcceso = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  },
});
const limiteRegistro = limitar(
  60,
  10,
  "Se crearon muchas cuentas desde esta conexión. Intenta de nuevo más tarde.",
);
const limiteEnvios = limitar(
  60,
  20,
  "Has enviado muchos mensajes seguidos. Intenta de nuevo más tarde.",
);

// ------------------------------------------
// VALIDACIÓN
// ------------------------------------------
const texto = (v) => (typeof v === "string" ? v.trim() : "");
const emailValido = (v) =>
  v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const claveValida = (v) => typeof v === "string" && Buffer.byteLength(v) <= 72; // límite de bcrypt
const listaDeTextos = (v) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 20) : [];

const idValido = (v) => (/^\d{1,12}$/.test(String(v || "")) ? Number(v) : null);
const filtro = (v, permitidos) => (permitidos.includes(v) ? v : null);

const falla = (res, estado, mensaje) =>
  res.status(estado).json({ error: mensaje });

// ------------------------------------------
// FECHAS Y DISPONIBILIDAD (hora de Colombia, UTC-5)
// ------------------------------------------
const OFFSET_COLOMBIA = -5 * 60 * 60 * 1000;

// Fecha "de pared" en Colombia, representada en UTC para hacer los cálculos
const ahoraColombia = () => new Date(Date.now() + OFFSET_COLOMBIA);
const fechaColombia = (d = ahoraColombia()) => d.toISOString().slice(0, 10);

const fechaTexto = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(texto(v)) ? texto(v) : null;

const horaTexto = (v) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(texto(v)) ? texto(v) : null;

const normalizarFechaHora = (v) => {
  let s = texto(v).replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) s += ":00";
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/.test(s)) return null;

  const d = new Date(s.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return null;
  // Rechaza fechas imposibles (por ejemplo, 31 de febrero) y segundos sueltos.
  if (d.toISOString().slice(0, 19).replace("T", " ") !== s) return null;

  return s;
};

const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

// Genera los cupos disponibles de una profesional para los próximos días
const generarCupos = (disponibilidad, ocupadas, desde, dias = 14) => {
  const resultado = [];
  const [anio, mes, dia] = desde.split("-").map(Number);
  const ocupadasSet = new Set(
    ocupadas.map((f) => String(f.fecha_hora).slice(0, 16)),
  );

  const ahora = ahoraColombia();
  const claveAhora = ahora.toISOString().slice(0, 16);

  for (let i = 0; i < dias; i += 1) {
    const fecha = new Date(Date.UTC(anio, mes - 1, dia + i));
    const iso = fecha.toISOString().slice(0, 10);
    const diaSemana = fecha.getUTCDay();
    const horas = new Set();

    for (const r of disponibilidad) {
      if (Number(r.dia_semana) !== diaSemana) continue;

      const [hIni, mIni] = String(r.hora_inicio).split(":").map(Number);
      const [hFin, mFin] = String(r.hora_fin).split(":").map(Number);

      let minuto = hIni * 60 + mIni;
      const fin = hFin * 60 + mFin;

      // Cada cita dura 50 minutos y los cupos empiezan cada hora
      while (minuto + 50 <= fin) {
        const hh = String(Math.floor(minuto / 60)).padStart(2, "0");
        const mm = String(minuto % 60).padStart(2, "0");
        const clave = `${iso}T${hh}:${mm}`;

        if (!ocupadasSet.has(clave) && clave > claveAhora) {
          horas.add(`${hh}:${mm}`);
        }

        minuto += 60;
      }
    }

    resultado.push({
      fecha: iso,
      dia: DIAS_SEMANA[diaSemana],
      horas: [...horas].sort(),
    });
  }

  return resultado;
};

// ------------------------------------------
// TEST DE BIENESTAR
// ------------------------------------------
const TESTS = {
  ansiedad: {
    titulo: "Escala de ansiedad (GAD-7 adaptada)",
    descripcion:
      "Cuestionario breve para identificar señales de ansiedad en las últimas dos semanas.",
    instruccion:
      "Piensa en cómo te has sentido durante las últimas dos semanas y elige la opción que mejor describa tu experiencia.",
    opciones: [
      { texto: "Nunca", valor: 0 },
      { texto: "Varios días", valor: 1 },
      { texto: "Más de la mitad de los días", valor: 2 },
      { texto: "Casi todos los días", valor: 3 },
    ],
    preguntas: [
      "Sentirme nerviosa, ansiosa o con los nervios de punta.",
      "No poder dejar de preocuparme o controlar mis preocupaciones.",
      "Preocuparme demasiado por cosas diferentes.",
      "Tener dificultad para relajarme.",
      "Estar tan inquieta que me cuesta quedarme quieta.",
      "Enojarme o irritarme fácilmente.",
      "Sentir miedo, como si algo terrible pudiera pasar.",
    ],
    calcular(respuestas) {
      const puntaje = respuestas.reduce((a, b) => a + b, 0);
      if (puntaje <= 4) return { puntaje, nivel: "Mínima", riesgo: false };
      if (puntaje <= 9) return { puntaje, nivel: "Leve", riesgo: false };
      if (puntaje <= 14) return { puntaje, nivel: "Moderada", riesgo: false };
      return { puntaje, nivel: "Alta", riesgo: true };
    },
  },
  autoestima: {
    titulo: "Escala de autoestima (Rosenberg adaptada)",
    descripcion:
      "Cuestionario breve para reconocer cómo te valoras y cómo te sientes contigo misma.",
    instruccion:
      "Lee cada frase y elige qué tanto estás de acuerdo con ella pensando en cómo te sientes hoy.",
    opciones: [
      { texto: "Muy de acuerdo", valor: 4 },
      { texto: "De acuerdo", valor: 3 },
      { texto: "En desacuerdo", valor: 2 },
      { texto: "Muy en desacuerdo", valor: 1 },
    ],
    preguntas: [
      "Siento que soy una persona con cualidades positivas.",
      "Soy capaz de hacer las cosas tan bien como la mayoría de las personas.",
      "Tengo motivos para sentirme orgullosa de mí misma.",
      "Puedo hacer frente a mis problemas con fortaleza.",
      "Me acepto tal como soy.",
      "Siento que tengo un lugar importante en mi familia y mi comunidad.",
      "Me trato con respeto y cariño.",
      "Confío en mis capacidades para construir nuevos proyectos.",
      "Reconozco mis logros, aunque sean pequeños.",
      "Me permito pedir ayuda cuando la necesito.",
    ],
    calcular(respuestas) {
      const puntaje = respuestas.reduce((a, b) => a + b, 0);
      if (puntaje >= 30) return { puntaje, nivel: "Alta", riesgo: false };
      if (puntaje >= 20) return { puntaje, nivel: "Media", riesgo: false };
      return { puntaje, nivel: "Baja", riesgo: true };
    },
  },
};

const definicionesTests = () =>
  Object.entries(TESTS).map(([id, t]) => ({
    id,
    titulo: t.titulo,
    descripcion: t.descripcion,
    instruccion: t.instruccion,
    opciones: t.opciones,
    preguntas: t.preguntas,
  }));

const validarRespuestasTest = (tipo, respuestas) => {
  const test = TESTS[tipo];
  if (!test) return null;
  if (!Array.isArray(respuestas) || respuestas.length !== test.preguntas.length)
    return null;

  const valores = test.opciones.map((o) => o.valor);
  if (!respuestas.every((r) => valores.includes(Number(r)))) return null;

  return respuestas.map(Number);
};

// Horario inicial de las nuevas profesionales: lunes a viernes, mañana y tarde
const disponibilidadPorDefecto = () =>
  [1, 2, 3, 4, 5].flatMap((dia) => [
    { dia_semana: dia, hora_inicio: "09:00:00", hora_fin: "12:00:00" },
    { dia_semana: dia, hora_inicio: "14:00:00", hora_fin: "17:00:00" },
  ]);

// Express 4 no captura los errores de funciones async: este envoltorio los envía al manejador de errores
const ruta = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ------------------------------------------
// SESIÓN (cookie httpOnly con un token firmado)
// ------------------------------------------
const emitirSesion = (res, u) => {
  const esAdmin = u.rol === "admin";
  const duracion = esAdmin ? 2 * 60 * 60 : 7 * 24 * 60 * 60; // en segundos

  const token = jwt.sign({ id: u.id }, SECRETO, { expiresIn: duracion });

  res.cookie("token", token, {
    httpOnly: true, // JavaScript del navegador no puede leerla
    sameSite: "lax", // protege contra peticiones desde otros sitios
    secure: PRODUCCION, // solo por HTTPS cuando está publicado
    maxAge: duracion * 1000,
  });
};

// Identifica a la usuaria (si hay sesión) a partir de la cookie
app.use(
  ruta(async (req, res, next) => {
    req.usuaria = null;

    const token = req.cookies && req.cookies.token;
    if (!token) return next();

    let datos = null;

    try {
      datos = jwt.verify(token, SECRETO);
    } catch (e) {
      return next(); // token inválido o vencido: se trata como "sin sesión"
    }

    // Se consulta siempre: si la cuenta se borra, la sesión deja de valer
    req.usuaria = (await db.usuariaPorId(datos.id)) || null;
    next();
  }),
);

const exigirSesion = (req, res, next) =>
  req.usuaria ? next() : falla(res, 401, "Inicia sesión para continuar.");

const exigirAdmin = (req, res, next) => {
  if (!req.usuaria) return falla(res, 401, "Inicia sesión para continuar.");
  if (req.usuaria.rol !== "admin")
    return falla(res, 403, "Esta cuenta no tiene permisos de administración.");
  next();
};

const exigirProfesional = (req, res, next) => {
  if (!req.usuaria) return falla(res, 401, "Inicia sesión para continuar.");
  if (req.usuaria.rol !== "profesional")
    return falla(res, 403, "Esta cuenta no tiene permisos de acompañamiento profesional.");
  next();
};

const publica = (u) => ({
  id: u.id,
  nombre: u.nombre,
  rol: u.rol,
});

// Hash de relleno: hace que el tiempo de respuesta sea parecido exista o no el correo
const HASH_RELLENO = bcrypt.hashSync("relleno-no-es-una-clave", 12); // se calcula una sola vez al arrancar

// ==========================================
// RUTAS PÚBLICAS
// ==========================================

// Crear cuenta
app.post("/api/registro", limiteRegistro, async (req, res, next) => {
  try {
    const nombre = texto(req.body.nombre);
    const email = texto(req.body.email).toLowerCase();
    const clave = req.body.password;

    if (!nombre || nombre.length > 80)
      return falla(
        res,
        400,
        "Escribe un nombre o seudónimo (máximo 80 caracteres).",
      );
    if (!emailValido(email))
      return falla(res, 400, "Escribe un correo electrónico válido.");
    if (typeof clave !== "string" || clave.length < 8)
      return falla(res, 400, "La contraseña debe tener al menos 8 caracteres.");
    if (!claveValida(clave))
      return falla(
        res,
        400,
        "La contraseña es demasiado larga (máximo 72 caracteres).",
      );

    if (await db.usuariaPorEmail(email))
      return falla(
        res,
        409,
        "Ya existe una cuenta con ese correo. Intenta iniciar sesión.",
      );

    let id;

    try {
      id = await db.crearUsuaria(nombre, email, await bcrypt.hash(clave, 12));
    } catch (e) {
      // Dos registros simultáneos con el mismo correo: MySQL rechaza el segundo
      if (e.code === "ER_DUP_ENTRY")
        return falla(
          res,
          409,
          "Ya existe una cuenta con ese correo. Intenta iniciar sesión.",
        );
      throw e;
    }

    const u = await db.usuariaPorId(id);

    emitirSesion(res, u);
    await db.registrarAcceso(id);
    res.status(201).json({ usuaria: publica(u) });
  } catch (e) {
    next(e);
  }
});

// Iniciar sesión (usuarias y administración)
app.post("/api/login", limiteAcceso, async (req, res, next) => {
  try {
    const email = texto(req.body.email).toLowerCase();
    const clave = req.body.password;

    if (
      !emailValido(email) ||
      typeof clave !== "string" ||
      !claveValida(clave)
    ) {
      return falla(res, 400, "Revisa tu correo y tu contraseña.");
    }

    const u = await db.usuariaPorEmail(email);
    const correcta = await bcrypt.compare(
      clave,
      u ? u.password_hash : HASH_RELLENO,
    );

    if (!u || !correcta)
      return falla(res, 401, "Correo o contraseña incorrectos.");

    if (u.rol === "profesional") {
      const perfil = await db.profesionalPorId(u.id);
      if (!perfil || !perfil.activo)
        return falla(
          res,
          403,
          "Tu cuenta profesional está inactiva. Contacta a la administración.",
        );
    }

    emitirSesion(res, u);
    await db.registrarAcceso(u.id);
    res.json({ usuaria: publica(u) });
  } catch (e) {
    next(e);
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: PRODUCCION,
  });
  res.json({ ok: true });
});

// ¿Quién soy? (la página lo usa para saber si la sesión sigue vigente)
app.get("/api/yo", (req, res) => {
  res.json({ usuaria: req.usuaria ? publica(req.usuaria) : null });
});

// Cambiar contraseña (cualquier cuenta con sesión)
app.post(
  "/api/cambiar-clave",
  exigirSesion,
  limiteAcceso,
  async (req, res, next) => {
    try {
      const { actual, nueva } = req.body;
      const u = await db.usuariaConHash(req.usuaria.id);
      const minimo = u.rol === "admin" ? 10 : 8;

      if (
        typeof actual !== "string" ||
        !(await bcrypt.compare(actual, u.password_hash))
      ) {
        return falla(res, 400, "La contraseña actual no es correcta.");
      }
      if (typeof nueva !== "string" || nueva.length < minimo) {
        return falla(
          res,
          400,
          "La contraseña nueva debe tener al menos " + minimo + " caracteres.",
        );
      }
      if (!claveValida(nueva))
        return falla(
          res,
          400,
          "La contraseña es demasiado larga (máximo 72 caracteres).",
        );

      await db.cambiarHash(u.id, await bcrypt.hash(nueva, 12));
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// Testimonios publicados (sección "Voces")
app.get(
  "/api/testimonios",
  ruta(async (req, res) => {
    res.json(
      (await db.testimoniosPublicos()).map((t) => ({
        nombre: t.nombre_publico || "Anónimo",
        texto: t.texto,
        areas: t.areas || "",
        fecha: t.creado_en,
      })),
    );
  }),
);

// Enviar un testimonio (queda "pendiente" hasta que la administración lo apruebe)
app.post(
  "/api/testimonios",
  limiteEnvios,
  ruta(async (req, res) => {
    const modo = req.body.modo;
    const contenido = texto(req.body.texto);

    if (!contenido)
      return falla(res, 400, "Escribe tu testimonio para poder enviarlo.");
    if (contenido.length > 3000)
      return falla(
        res,
        400,
        "El testimonio es demasiado largo (máximo 3000 caracteres).",
      );
    if (!["anonimo", "seudonimo", "nombre"].includes(modo))
      return falla(res, 400, "Elige cómo quieres aparecer.");

    let nombrePublico = null;
    let usuariaId = null;

    if (modo !== "anonimo") {
      if (!req.usuaria)
        return falla(
          res,
          401,
          "Inicia sesión para compartir con tu nombre o seudónimo, o comparte de forma anónima.",
        );

      if (modo === "seudonimo") {
        nombrePublico = texto(req.body.seudonimo).slice(0, 80) || null;
      } else {
        nombrePublico = req.usuaria.nombre;
        usuariaId = req.usuaria.id; // solo se vincula a la cuenta si la persona decide firmar con su nombre
      }
    }

    // Un testimonio anónimo o con seudónimo NO se vincula a la cuenta, aunque haya sesión iniciada.
    await db.crearTestimonio({
      usuariaId,
      nombrePublico,
      texto: contenido,
      areas: listaDeTextos(req.body.areas),
    });

    res.status(201).json({ ok: true });
  }),
);

// Enviar una solicitud de orientación
app.post(
  "/api/solicitudes",
  limiteEnvios,
  ruta(async (req, res) => {
    const nombre = texto(req.body.nombre);
    const contacto = texto(req.body.contacto);
    const mensaje = texto(req.body.mensaje);
    const motivos = listaDeTextos(req.body.motivos);

    if (!motivos.length && !mensaje) {
      return falla(
        res,
        400,
        "Elige al menos una opción o cuéntanos brevemente qué necesitas.",
      );
    }
    if (nombre.length > 80 || contacto.length > 120 || mensaje.length > 2000) {
      return falla(res, 400, "Alguno de los textos es demasiado largo.");
    }

    await db.crearSolicitud({ nombre, contacto, mensaje, motivos });
    res.status(201).json({ ok: true });
  }),
);

// ==========================================
// LÍNEAS DE AYUDA Y MAPA DE SERVICIOS (públicos)
// ==========================================
app.get(
  "/api/lineas-ayuda",
  ruta(async (req, res) => res.json(await db.lineasAyuda())),
);

app.get(
  "/api/servicios-mapa/filtros",
  ruta(async (req, res) => res.json(await db.filtrosServicios())),
);

app.get(
  "/api/servicios-mapa",
  ruta(async (req, res) => {
    const categoria = texto(req.query.categoria).slice(0, 60);
    const ciudad = texto(req.query.ciudad).slice(0, 80);
    res.json(await db.serviciosMapa(categoria || null, ciudad || null));
  }),
);

// ==========================================
// MÓDULO DE ACOMPAÑAMIENTO PSICOSOCIAL
// ==========================================

// Profesionales disponibles para agendar o conversar
app.get(
  "/api/profesionales",
  exigirSesion,
  ruta(async (req, res) => {
    const lista = (await db.listarProfesionales(true)).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      especialidad: p.especialidad,
      descripcion: p.descripcion,
    }));
    res.json(lista);
  }),
);

// Cupos disponibles de una profesional para los próximos días
app.get(
  "/api/citas/disponibilidad",
  exigirSesion,
  ruta(async (req, res) => {
    const profesionalId = idValido(req.query.profesional_id);
    if (!profesionalId || !(await db.profesionalPorId(profesionalId)))
      return falla(res, 404, "No encontramos esa profesional.");

    const hoy = fechaColombia();
    const desde = fechaTexto(req.query.desde) || hoy;
    if (desde < hoy) return falla(res, 400, "La fecha ya pasó.");

    const disponibilidad = await db.listarDisponibilidad(profesionalId);
    const hasta = new Date(desde + "T00:00:00Z");
    hasta.setUTCDate(hasta.getUTCDate() + 14);
    const ocupadas = await db.citasOcupadas(
      profesionalId,
      desde + " 00:00:00",
      hasta.toISOString().slice(0, 10) + " 23:59:59",
    );

    res.json({
      profesional: await db.profesionalPorId(profesionalId),
      cupos: generarCupos(disponibilidad, ocupadas, desde, 14),
    });
  }),
);

// Citas de la sesión (usuaria, profesional o administración)
app.get(
  "/api/citas",
  exigirSesion,
  ruta(async (req, res) => {
    if (req.usuaria.rol === "profesional")
      return res.json(await db.citasDeProfesional(req.usuaria.id));
    if (req.usuaria.rol === "admin")
      return res.json(await db.todasLasCitas());
    res.json(await db.citasDeUsuaria(req.usuaria.id));
  }),
);

// Agendar una cita
app.post(
  "/api/citas",
  exigirSesion,
  limiteEnvios,
  ruta(async (req, res) => {
    if (req.usuaria.rol !== "usuaria")
      return falla(res, 403, "Solo las usuarias pueden agendar citas.");

    const profesionalId = idValido(req.body.profesional_id);
    const fechaHora = normalizarFechaHora(req.body.fecha_hora);
    const modalidad = filtro(req.body.modalidad, ["virtual", "presencial"]);
    const motivo = texto(req.body.motivo);

    if (!profesionalId || !fechaHora || !modalidad)
      return falla(res, 400, "Revisa la profesional, la fecha y la modalidad.");

    if (motivo.length > 500)
      return falla(res, 400, "El motivo es demasiado largo (máximo 500 caracteres).");

    const profesional = await db.profesionalPorId(profesionalId);
    if (!profesional || !profesional.activo)
      return falla(res, 404, "No encontramos esa profesional disponible.");

    if (fechaHora <= ahoraColombia().toISOString().slice(0, 19).replace("T", " "))
      return falla(res, 400, "Elige una fecha y hora futuras.");

    // El cupo debe pertenecer a un horario de atención de la profesional
    const fecha = new Date(fechaHora.replace(" ", "T") + "Z");
    const dia = fecha.getUTCDay();
    const minutos = fecha.getUTCHours() * 60 + fecha.getUTCMinutes();
    const disponibilidad = await db.listarDisponibilidad(profesionalId);
    const dentroDeHorario = disponibilidad.some((r) => {
      if (Number(r.dia_semana) !== dia) return false;
      const [hi, mi] = r.hora_inicio.split(":").map(Number);
      const [hf, mf] = r.hora_fin.split(":").map(Number);
      const inicio = hi * 60 + mi;
      // Solo se aceptan los mismos cupos que muestra la agenda (cada hora).
      return (
        minutos >= inicio &&
        minutos + 50 <= hf * 60 + mf &&
        (minutos - inicio) % 60 === 0
      );
    });

    if (!dentroDeHorario)
      return falla(res, 400, "Ese horario no está disponible para la profesional.");

    if (await db.hayConflictoCita(profesionalId, fechaHora))
      return falla(res, 409, "Ese horario acaba de ser ocupado. Elige otro.");

    if ((await db.contarCitasActivasUsuaria(req.usuaria.id)) >= 5)
      return falla(
        res,
        400,
        "Ya tienes 5 citas activas. Cancela o espera a completarlas para agendar otra.",
      );

    const id = await db.crearCita({
      usuariaId: req.usuaria.id,
      profesionalId,
      fechaHora,
      duracion: 50,
      modalidad,
      motivo,
    });

    const cita = await db.citaPorId(id);
    res.status(201).json({ cita });
  }),
);

// Cancelar una cita (la usuaria solo puede cancelar las propias)
app.patch(
  "/api/citas/:id",
  exigirSesion,
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return falla(res, 400, "Datos no válidos.");

    const cita = await db.citaPorId(id);
    if (!cita) return falla(res, 404, "No encontramos esa cita.");

    if (req.usuaria.rol !== "usuaria" || cita.usuaria_id !== req.usuaria.id)
      return falla(res, 403, "No puedes modificar esta cita.");

    if (filtro(req.body.estado, ["cancelada"]) === null)
      return falla(res, 400, "Estado no válido.");

    if (cita.estado === "completada" || cita.estado === "cancelada")
      return falla(res, 400, "Esta cita ya no se puede cancelar.");

    await db.cambiarEstadoCita(id, "cancelada");
    res.json({ ok: true });
  }),
);

// Conversaciones de la usuaria
app.get(
  "/api/mensajes",
  exigirSesion,
  ruta(async (req, res) => {
    if (req.usuaria.rol !== "usuaria")
      return falla(res, 403, "Esta vista es para usuarias.");
    res.json(await db.resumenConversacionesUsuaria(req.usuaria.id));
  }),
);

// Mensajes con una profesional
app.get(
  "/api/mensajes/:profesionalId",
  exigirSesion,
  ruta(async (req, res) => {
    if (req.usuaria.rol !== "usuaria")
      return falla(res, 403, "Esta vista es para usuarias.");

    const profesionalId = idValido(req.params.profesionalId);
    if (!profesionalId) return falla(res, 400, "Datos no válidos.");

    const profesional = await db.profesionalPorId(profesionalId);
    if (!profesional) return falla(res, 404, "No encontramos esa profesional.");

    const mensajes = await db.mensajesConversacion(req.usuaria.id, profesionalId);
    await db.marcarMensajesLeidos(req.usuaria.id, profesionalId, "usuaria");

    res.json({ profesional, mensajes });
  }),
);

// Enviar mensaje a una profesional
app.post(
  "/api/mensajes",
  exigirSesion,
  limiteEnvios,
  ruta(async (req, res) => {
    if (req.usuaria.rol !== "usuaria")
      return falla(res, 403, "Esta vista es para usuarias.");

    const profesionalId = idValido(req.body.profesional_id);
    const contenido = texto(req.body.texto);

    if (!profesionalId || !contenido)
      return falla(res, 400, "Escribe un mensaje y elige una profesional.");
    if (contenido.length > 2000)
      return falla(res, 400, "El mensaje es demasiado largo (máximo 2000 caracteres).");

    const profesional = await db.profesionalPorId(profesionalId);
    if (!profesional || !profesional.activo)
      return falla(res, 404, "No encontramos esa profesional disponible.");

    await db.crearMensaje({
      usuariaId: req.usuaria.id,
      profesionalId,
      remitente: "usuaria",
      texto: contenido,
    });

    res.status(201).json({ ok: true });
  }),
);

// Diario emocional: historial y gráfica
app.get(
  "/api/diario",
  exigirSesion,
  ruta(async (req, res) => {
    if (req.usuaria.rol !== "usuaria")
      return falla(res, 403, "Esta vista es para usuarias.");

    res.json({
      entradas: await db.diarioDeUsuaria(req.usuaria.id, 60),
      serie: await db.diarioPorDia(req.usuaria.id, 30),
    });
  }),
);

// Diario emocional: guardar o actualizar la entrada de hoy
app.post(
  "/api/diario",
  exigirSesion,
  limiteEnvios,
  ruta(async (req, res) => {
    if (req.usuaria.rol !== "usuaria")
      return falla(res, 403, "Esta vista es para usuarias.");

    const animo = Number(req.body.animo);
    const emociones = listaDeTextos(req.body.emociones)
      .slice(0, 8)
      .map((e) => e.slice(0, 30));
    const nota = texto(req.body.nota);

    if (!Number.isInteger(animo) || animo < 1 || animo > 10)
      return falla(res, 400, "Elige un estado de ánimo entre 1 y 10.");
    if (nota.length > 1000)
      return falla(res, 400, "La nota es demasiado larga (máximo 1000 caracteres).");

    const entrada = await db.guardarDiario({
      usuariaId: req.usuaria.id,
      fecha: fechaColombia(),
      animo,
      emociones: emociones.join(", "),
      nota,
    });

    res.status(201).json({
      entrada,
      serie: await db.diarioPorDia(req.usuaria.id, 30),
    });
  }),
);

// Definiciones de los test (sin la lógica de puntuación)
app.get(
  "/api/tests/definiciones",
  exigirSesion,
  ruta(async (req, res) => res.json(definicionesTests())),
);

// Historial de test de la usuaria
app.get(
  "/api/tests/historial",
  exigirSesion,
  ruta(async (req, res) => {
    if (req.usuaria.rol !== "usuaria")
      return falla(res, 403, "Esta vista es para usuarias.");
    res.json(await db.historialTests(req.usuaria.id));
  }),
);

// Realizar un test de bienestar
app.post(
  "/api/tests",
  exigirSesion,
  limiteEnvios,
  ruta(async (req, res) => {
    if (req.usuaria.rol !== "usuaria")
      return falla(res, 403, "Esta vista es para usuarias.");

    const tipo = filtro(req.body.tipo, Object.keys(TESTS));
    if (!tipo) return falla(res, 400, "Test no válido.");

    const respuestas = validarRespuestasTest(tipo, req.body.respuestas);
    if (!respuestas)
      return falla(res, 400, "Responde todas las preguntas del test.");

    const test = TESTS[tipo];
    const resultado = test.calcular(respuestas);

    await db.guardarTest({
      usuariaId: req.usuaria.id,
      tipo,
      puntaje: resultado.puntaje,
      nivel: resultado.nivel,
      respuestas,
      riesgo: resultado.riesgo,
    });

    if (resultado.riesgo) {
      const profesionalId = await db.profesionalReciente(req.usuaria.id);
      await db.crearAlerta({
        usuariaId: req.usuaria.id,
        profesionalId,
        tipo: "test",
        nivel: "alto",
        descripcion: `${test.titulo}: puntaje ${resultado.puntaje}, nivel ${resultado.nivel}. Se recomienda contacto prioritario.`,
      });
    }

    res.status(201).json({
      tipo,
      titulo: test.titulo,
      ...resultado,
      recomendacion: resultado.riesgo
        ? "Tu resultado sugiere un nivel de riesgo. Se generó una alerta para el equipo profesional. Si necesitas apoyo inmediato, usa el botón de ayuda o llama a la Línea 106."
        : "Gracias por hacer el test. Puedes repetirlo periódicamente para ver tu evolución.",
    });
  }),
);

// ==========================================
// RUTAS DEL PANEL PROFESIONAL
// ==========================================
const prof = express.Router();
prof.use(exigirProfesional);

prof.get(
  "/citas",
  ruta(async (req, res) => res.json(await db.citasDeProfesional(req.usuaria.id))),
);

prof.patch(
  "/citas/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    const estado = filtro(req.body.estado, [
      "confirmada",
      "completada",
      "cancelada",
    ]);
    const notas = texto(req.body.notas).slice(0, 1000);

    if (!id || !estado) return falla(res, 400, "Datos no válidos.");

    const cita = await db.citaPorId(id);
    if (!cita) return falla(res, 404, "No encontramos esa cita.");
    if (cita.profesional_id !== req.usuaria.id)
      return falla(res, 403, "No puedes modificar esta cita.");

    await db.cambiarEstadoCita(id, estado, notas || null);
    res.json({ ok: true });
  }),
);

prof.get(
  "/conversaciones",
  ruta(async (req, res) =>
    res.json(await db.resumenConversacionesProfesional(req.usuaria.id)),
  ),
);

prof.get(
  "/mensajes/:usuariaId",
  ruta(async (req, res) => {
    const usuariaId = idValido(req.params.usuariaId);
    if (!usuariaId) return falla(res, 400, "Datos no válidos.");

    const usuaria = await db.usuariaPorId(usuariaId);
    if (!usuaria || usuaria.rol !== "usuaria")
      return falla(res, 404, "No encontramos esa usuaria.");

    const mensajes = await db.mensajesConversacion(usuariaId, req.usuaria.id);
    await db.marcarMensajesLeidos(usuariaId, req.usuaria.id, "profesional");

    res.json({
      usuaria: { id: usuaria.id, nombre: usuaria.nombre },
      mensajes,
    });
  }),
);

prof.post(
  "/mensajes",
  limiteEnvios,
  ruta(async (req, res) => {
    const usuariaId = idValido(req.body.usuaria_id);
    const contenido = texto(req.body.texto);

    if (!usuariaId || !contenido)
      return falla(res, 400, "Escribe un mensaje y elige una usuaria.");
    if (contenido.length > 2000)
      return falla(res, 400, "El mensaje es demasiado largo (máximo 2000 caracteres).");

    const usuaria = await db.usuariaPorId(usuariaId);
    if (!usuaria || usuaria.rol !== "usuaria")
      return falla(res, 404, "No encontramos esa usuaria.");

    await db.crearMensaje({
      usuariaId,
      profesionalId: req.usuaria.id,
      remitente: "profesional",
      texto: contenido,
    });

    res.status(201).json({ ok: true });
  }),
);

prof.get(
  "/alertas",
  ruta(async (req, res) =>
    res.json(await db.alertasDeProfesional(req.usuaria.id)),
  ),
);

prof.patch(
  "/alertas/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return falla(res, 400, "Datos no válidos.");
    await db.atenderAlerta(id, req.usuaria.id);
    res.json({ ok: true });
  }),
);

prof.get(
  "/disponibilidad",
  ruta(async (req, res) =>
    res.json(await db.listarDisponibilidad(req.usuaria.id)),
  ),
);

prof.put(
  "/disponibilidad",
  ruta(async (req, res) => {
    const rangos = Array.isArray(req.body.rangos) ? req.body.rangos.slice(0, 21) : [];
    const limpios = [];

    for (const r of rangos) {
      const dia = Number(r.dia_semana);
      const inicio = horaTexto(r.hora_inicio);
      const fin = horaTexto(r.hora_fin);

      if (!Number.isInteger(dia) || dia < 0 || dia > 6 || !inicio || !fin)
        return falla(res, 400, "Revisa los días y las horas de disponibilidad.");
      if (fin <= inicio)
        return falla(res, 400, "La hora final debe ser mayor que la inicial.");

      limpios.push({ dia_semana: dia, hora_inicio: inicio + ":00", hora_fin: fin + ":00" });
    }

    await db.reemplazarDisponibilidad(req.usuaria.id, limpios);
    res.json({ ok: true });
  }),
);

app.use("/api/profesional", prof);

// ==========================================
// RUTAS DE ADMINISTRACIÓN
// ==========================================
const admin = express.Router();
admin.use(exigirAdmin);

admin.get(
  "/resumen",
  ruta(async (req, res) => res.json(await db.resumen())),
);

admin.get(
  "/testimonios",
  ruta(async (req, res) => {
    res.json(
      await db.listarTestimonios(
        filtro(req.query.estado, ["pendiente", "aprobado", "rechazado"]),
      ),
    );
  }),
);

admin.patch(
  "/testimonios/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    const estado = filtro(req.body.estado, [
      "pendiente",
      "aprobado",
      "rechazado",
    ]);

    if (!id || !estado) return falla(res, 400, "Datos no válidos.");
    if (!(await db.estadoTestimonio(id, estado)))
      return falla(res, 404, "No encontramos ese testimonio.");
    res.json({ ok: true });
  }),
);

admin.delete(
  "/testimonios/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);

    if (!id) return falla(res, 400, "Datos no válidos.");
    if (!(await db.borrarTestimonio(id)))
      return falla(res, 404, "No encontramos ese testimonio.");
    res.json({ ok: true });
  }),
);

admin.get(
  "/solicitudes",
  ruta(async (req, res) => {
    res.json(
      await db.listarSolicitudes(
        filtro(req.query.estado, ["nueva", "atendida"]),
      ),
    );
  }),
);

admin.patch(
  "/solicitudes/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    const estado = filtro(req.body.estado, ["nueva", "atendida"]);

    if (!id || !estado) return falla(res, 400, "Datos no válidos.");
    if (!(await db.estadoSolicitud(id, estado)))
      return falla(res, 404, "No encontramos esa solicitud.");
    res.json({ ok: true });
  }),
);

admin.delete(
  "/solicitudes/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);

    if (!id) return falla(res, 400, "Datos no válidos.");
    if (!(await db.borrarSolicitud(id)))
      return falla(res, 404, "No encontramos esa solicitud.");
    res.json({ ok: true });
  }),
);

// Descargar solicitudes en CSV (se abre en Excel)
admin.get(
  "/solicitudes.csv",
  ruta(async (req, res) => {
    // Si una celda empieza con = + - @ Excel podría ejecutarla como fórmula: se neutraliza
    const celda = (v) => {
      let s = String(v == null ? "" : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };

    const filas = [
      ["Fecha", "Nombre", "Contacto", "Motivos", "Mensaje", "Estado"],
    ];

    (await db.listarSolicitudes(null)).forEach((s) =>
      filas.push([
        s.creado_en,
        s.nombre,
        s.contacto,
        s.motivos,
        s.mensaje,
        s.estado,
      ]),
    );

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="solicitudes-bajo-la-sombrilla.csv"',
    });
    res.send("\ufeff" + filas.map((f) => f.map(celda).join(",")).join("\r\n"));
  }),
);

// ------------------------------------------
// ESTADÍSTICAS Y REPORTES
// ------------------------------------------
admin.get(
  "/estadisticas",
  ruta(async (req, res) => res.json(await db.estadisticas())),
);

admin.get(
  "/usuarias",
  ruta(async (req, res) => res.json(await db.listarUsuarias())),
);

admin.get(
  "/citas",
  ruta(async (req, res) => res.json(await db.todasLasCitas())),
);

admin.patch(
  "/citas/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    const estado = filtro(req.body.estado, [
      "pendiente",
      "confirmada",
      "completada",
      "cancelada",
    ]);

    if (!id || !estado) return falla(res, 400, "Datos no válidos.");
    if (!(await db.citaPorId(id)))
      return falla(res, 404, "No encontramos esa cita.");

    await db.cambiarEstadoCita(id, estado);
    res.json({ ok: true });
  }),
);

// ------------------------------------------
// ALERTAS DE RIESGO
// ------------------------------------------
admin.get(
  "/alertas",
  ruta(async (req, res) => res.json(await db.alertasAdmin())),
);

admin.patch(
  "/alertas/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return falla(res, 400, "Datos no válidos.");
    await db.atenderAlerta(id, null);
    res.json({ ok: true });
  }),
);

admin.get(
  "/tests",
  ruta(async (req, res) => res.json(await db.todosLosTests())),
);

// ------------------------------------------
// PROFESIONALES
// ------------------------------------------
admin.get(
  "/profesionales",
  ruta(async (req, res) => res.json(await db.listarProfesionales(false))),
);

admin.post(
  "/profesionales",
  ruta(async (req, res) => {
    const nombre = texto(req.body.nombre);
    const email = texto(req.body.email).toLowerCase();
    const clave = req.body.password;
    const especialidad = texto(req.body.especialidad);
    const descripcion = texto(req.body.descripcion);

    if (!nombre || nombre.length > 80)
      return falla(res, 400, "Escribe el nombre de la profesional (máximo 80 caracteres).");
    if (!emailValido(email))
      return falla(res, 400, "Escribe un correo electrónico válido.");
    if (typeof clave !== "string" || clave.length < 10)
      return falla(res, 400, "La contraseña debe tener al menos 10 caracteres.");
    if (!claveValida(clave))
      return falla(res, 400, "La contraseña es demasiado larga (máximo 72 caracteres).");
    if (!especialidad || especialidad.length > 120)
      return falla(res, 400, "Escribe la especialidad (máximo 120 caracteres).");
    if (descripcion.length > 1000)
      return falla(res, 400, "La descripción es demasiado larga.");

    if (await db.usuariaPorEmail(email))
      return falla(res, 409, "Ya existe una cuenta con ese correo.");

    const id = await db.crearProfesionalCompleto({
      nombre,
      email,
      hash: await bcrypt.hash(clave, 12),
      especialidad,
      descripcion,
      rangos: disponibilidadPorDefecto(),
    });

    res.status(201).json({ id });
  }),
);

admin.patch(
  "/profesionales/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return falla(res, 400, "Datos no válidos.");

    const actual = await db.profesionalPorId(id);
    if (!actual) return falla(res, 404, "No encontramos esa profesional.");

    const especialidad = texto(req.body.especialidad) || actual.especialidad;
    const descripcion =
      typeof req.body.descripcion === "string"
        ? texto(req.body.descripcion)
        : actual.descripcion;
    const activo =
      typeof req.body.activo === "boolean" ? req.body.activo : Boolean(actual.activo);

    if (especialidad.length > 120 || descripcion.length > 1000)
      return falla(res, 400, "Alguno de los textos es demasiado largo.");

    await db.actualizarPerfilProfesional(id, { especialidad, descripcion, activo });
    res.json({ ok: true });
  }),
);

// ------------------------------------------
// LOGROS LABORALES (indicador "empleos conseguidos")
// ------------------------------------------
admin.get(
  "/logros",
  ruta(async (req, res) => res.json(await db.listarLogros())),
);

admin.post(
  "/logros",
  ruta(async (req, res) => {
    const usuariaId = idValido(req.body.usuaria_id);
    const empresa = texto(req.body.empresa);
    const cargo = texto(req.body.cargo);
    const fecha = fechaTexto(req.body.fecha) || fechaColombia();

    if (!usuariaId || !empresa)
      return falla(res, 400, "Elige una usuaria y escribe la empresa.");
    if (empresa.length > 120 || cargo.length > 120)
      return falla(res, 400, "Alguno de los textos es demasiado largo.");

    const usuaria = await db.usuariaPorId(usuariaId);
    if (!usuaria || usuaria.rol !== "usuaria")
      return falla(res, 404, "No encontramos esa usuaria.");

    await db.crearLogro({ usuariaId, empresa, cargo, fecha });
    res.status(201).json({ ok: true });
  }),
);

admin.delete(
  "/logros/:id",
  ruta(async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return falla(res, 400, "Datos no válidos.");
    if (!(await db.borrarLogro(id)))
      return falla(res, 404, "No encontramos ese logro.");
    res.json({ ok: true });
  }),
);

// ------------------------------------------
// EXPORTACIÓN A EXCEL
// ------------------------------------------
admin.get(
  "/reportes/estadisticas.xlsx",
  ruta(async (req, res) => {
    const [e, citas, tests, alertas, logros, usuarias] = await Promise.all([
      db.estadisticas(),
      db.todasLasCitas(),
      db.todosLosTests(),
      db.alertasAdmin(),
      db.listarLogros(),
      db.listarUsuarias(),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Bajo la sombrilla";
    wb.created = new Date();

    const crearHoja = (nombre, columnas, filas) => {
      const ws = wb.addWorksheet(nombre);
      ws.columns = columnas;
      ws.addRows(filas);
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4A2260" },
      };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      return ws;
    };

    crearHoja(
      "Resumen",
      [
        { header: "Indicador", key: "indicador", width: 42 },
        { header: "Valor", key: "valor", width: 24 },
      ],
      [
        { indicador: "Fecha de generación", valor: new Date().toLocaleString("es-CO") },
        { indicador: "Usuarias registradas", valor: e.totalUsuarias },
        { indicador: "Usuarias activas (30 días)", valor: e.usuariasActivas },
        { indicador: "Usuarias inactivas", valor: e.usuariasInactivas },
        { indicador: "Deserción estimada (%)", valor: e.desercion },
        { indicador: "Citas realizadas", valor: e.citasRealizadas },
        { indicador: "Citas pendientes", valor: e.citasPendientes },
        { indicador: "Citas confirmadas", valor: e.citasConfirmadas },
        { indicador: "Citas canceladas", valor: e.citasCanceladas },
        { indicador: "Empleos conseguidos", valor: e.empleosConseguidos },
        { indicador: "Progreso promedio (%)", valor: e.progresoPromedio },
        { indicador: "Tests realizados", valor: e.testsTotal },
        { indicador: "Tests con indicador de riesgo", valor: e.testsRiesgo },
        { indicador: "Alertas pendientes", valor: e.alertasPendientes },
        { indicador: "Promedio de ánimo (30 días)", valor: e.promedioAnimo ?? "Sin datos" },
        { indicador: "Entradas del diario", valor: e.entradasDiario },
        { indicador: "Mensajes enviados", valor: e.mensajesTotal },
        { indicador: "Solicitudes nuevas", valor: e.solicitudesNuevas },
      ],
    );

    crearHoja(
      "Citas",
      [
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Hora", key: "hora", width: 9 },
        { header: "Usuaria", key: "usuaria", width: 28 },
        { header: "Profesional", key: "profesional", width: 28 },
        { header: "Especialidad", key: "especialidad", width: 24 },
        { header: "Modalidad", key: "modalidad", width: 14 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Motivo", key: "motivo", width: 45 },
      ],
      citas.map((c) => {
        const [fecha, hora] = String(c.fecha_hora || "").split("T");
        return {
          fecha,
          hora: String(hora || "").slice(0, 5),
          usuaria: c.usuaria,
          profesional: c.profesional,
          especialidad: c.especialidad || "",
          modalidad: c.modalidad,
          estado: c.estado,
          motivo: c.motivo || "",
        };
      }),
    );

    crearHoja(
      "Tests",
      [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Usuaria", key: "usuaria", width: 28 },
        { header: "Tipo", key: "tipo", width: 16 },
        { header: "Puntaje", key: "puntaje", width: 10 },
        { header: "Nivel", key: "nivel", width: 14 },
        { header: "Riesgo", key: "riesgo", width: 10 },
      ],
      tests.map((t) => ({
        fecha: String(t.creado_en).replace("T", " ").slice(0, 19),
        usuaria: t.usuaria,
        tipo: t.tipo,
        puntaje: t.puntaje,
        nivel: t.nivel,
        riesgo: t.riesgo ? "Sí" : "No",
      })),
    );

    crearHoja(
      "Alertas",
      [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Usuaria", key: "usuaria", width: 28 },
        { header: "Tipo", key: "tipo", width: 12 },
        { header: "Nivel", key: "nivel", width: 10 },
        { header: "Descripción", key: "descripcion", width: 60 },
        { header: "Atendida", key: "atendida", width: 11 },
        { header: "Profesional", key: "profesional", width: 28 },
      ],
      alertas.map((a) => ({
        fecha: String(a.creado_en).replace("T", " ").slice(0, 19),
        usuaria: a.usuaria,
        tipo: a.tipo,
        nivel: a.nivel,
        descripcion: a.descripcion,
        atendida: a.atendida ? "Sí" : "No",
        profesional: a.profesional || "Sin asignar",
      })),
    );

    crearHoja(
      "Logros laborales",
      [
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Usuaria", key: "usuaria", width: 28 },
        { header: "Empresa", key: "empresa", width: 30 },
        { header: "Cargo", key: "cargo", width: 28 },
      ],
      logros.map((l) => ({
        fecha: l.fecha,
        usuaria: l.usuaria,
        empresa: l.empresa,
        cargo: l.cargo || "",
      })),
    );

    crearHoja(
      "Usuarias",
      [
        { header: "Nombre", key: "nombre", width: 30 },
        { header: "Correo", key: "email", width: 34 },
        { header: "Registro", key: "registro", width: 20 },
        { header: "Último acceso", key: "ultimo", width: 20 },
      ],
      usuarias.map((u) => ({
        nombre: u.nombre,
        email: u.email,
        registro: String(u.creado_en || "").replace("T", " ").slice(0, 19),
        ultimo: u.ultimo_acceso
          ? String(u.ultimo_acceso).replace("T", " ").slice(0, 19)
          : "Sin registro",
      })),
    );

    crearHoja(
      "Citas por mes",
      [
        { header: "Mes", key: "mes", width: 12 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Total", key: "total", width: 10 },
      ],
      e.citasPorMes,
    );

    crearHoja(
      "Tests por mes",
      [
        { header: "Mes", key: "mes", width: 12 },
        { header: "Total", key: "total", width: 10 },
        { header: "Con riesgo", key: "riesgo", width: 12 },
      ],
      e.testsPorMes,
    );

    crearHoja(
      "Ánimo por día",
      [
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Promedio", key: "promedio", width: 12 },
        { header: "Registros", key: "registros", width: 12 },
      ],
      e.animoPorDia,
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reporte-bajo-la-sombrilla.xlsx"',
    );

    await wb.xlsx.write(res);
    res.end();
  }),
);

// ------------------------------------------
// EXPORTACIÓN A PDF
// ------------------------------------------
admin.get(
  "/reportes/estadisticas.pdf",
  ruta(async (req, res) => {
    const [e, tests, alertas, logros] = await Promise.all([
      db.estadisticas(),
      db.todosLosTests(),
      db.alertasAdmin(),
      db.listarLogros(),
    ]);

    const doc = new PDFDocument({
      margin: 46,
      size: "A4",
      bufferPages: true,
      info: { Title: "Reporte Bajo la sombrilla" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reporte-bajo-la-sombrilla.pdf"',
    );
    doc.pipe(res);

    const morado = "#4A2260";
    const naranja = "#F28C28";
    const tinta = "#2B1810";

    doc.font("Helvetica-Bold").fontSize(22).fillColor(morado);
    doc.text("BAJO LA SOMBRILLA", { align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor(tinta);
    doc.text("Reporte de acompañamiento psicosocial y programa", { align: "center" });
    doc.text("Generado: " + new Date().toLocaleString("es-CO"), { align: "center" });
    doc.moveDown(1.2);

    doc.font("Helvetica-Bold").fontSize(14).fillColor(morado);
    doc.text("Resumen de indicadores");
    doc.moveDown(0.5);

    const indicadores = [
      ["Usuarias registradas", e.totalUsuarias],
      ["Usuarias activas (30 días)", e.usuariasActivas],
      ["Usuarias inactivas", e.usuariasInactivas],
      ["Deserción estimada", e.desercion + "%"],
      ["Citas realizadas", e.citasRealizadas],
      ["Citas pendientes", e.citasPendientes],
      ["Citas confirmadas", e.citasConfirmadas],
      ["Citas canceladas", e.citasCanceladas],
      ["Empleos conseguidos", e.empleosConseguidos],
      ["Progreso promedio", e.progresoPromedio + "%"],
      ["Tests realizados", e.testsTotal],
      ["Tests con riesgo", e.testsRiesgo],
      ["Alertas pendientes", e.alertasPendientes],
      ["Promedio de ánimo (30 días)", e.promedioAnimo ?? "Sin datos"],
      ["Entradas del diario", e.entradasDiario],
      ["Mensajes enviados", e.mensajesTotal],
    ];

    indicadores.forEach(([label, valor]) => {
      if (doc.y > 760) doc.addPage();
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(10).fillColor(morado);
      doc.text(label, 48, y, { width: 290 });
      doc.font("Helvetica").fontSize(10).fillColor(tinta);
      doc.text(String(valor), 350, y, { width: 210, align: "right" });
      doc.moveDown(0.35);
    });

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(morado);
    doc.text("Citas por estado");
    doc.moveDown(0.4);
    e.citasPorEstado.forEach((c) => {
      doc.font("Helvetica").fontSize(10).fillColor(tinta);
      doc.text(`${c.estado}: ${c.total}`);
    });

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(morado);
    doc.text("Citas por mes");
    doc.moveDown(0.4);
    if (e.citasPorMes.length) {
      e.citasPorMes.slice(-18).forEach((c) => {
        doc.font("Helvetica").fontSize(10).fillColor(tinta);
        doc.text(`${c.mes} · ${c.estado}: ${c.total}`);
      });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor(tinta).text("Sin citas registradas.");
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(morado);
    doc.text("Tests de bienestar recientes");
    doc.moveDown(0.4);
    if (tests.length) {
      tests.slice(0, 15).forEach((t) => {
        if (doc.y > 760) doc.addPage();
        doc.font("Helvetica").fontSize(9).fillColor(tinta);
        doc.text(
          `${String(t.creado_en).slice(0, 10)} · ${t.usuaria} · ${t.tipo} · ${t.puntaje} pts · ${t.nivel}${t.riesgo ? " · RIESGO" : ""}`,
        );
      });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor(tinta).text("Sin tests registrados.");
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(morado);
    doc.text("Alertas de riesgo");
    doc.moveDown(0.4);
    const pendientes = alertas.filter((a) => !a.atendida);
    if (pendientes.length) {
      pendientes.slice(0, 15).forEach((a) => {
        if (doc.y > 760) doc.addPage();
        doc.font("Helvetica-Bold").fontSize(9).fillColor(naranja);
        doc.text(`${String(a.creado_en).slice(0, 10)} · ${a.usuaria} · ${a.nivel.toUpperCase()}`);
        doc.font("Helvetica").fontSize(9).fillColor(tinta);
        doc.text(a.descripcion, { width: 500 });
        doc.moveDown(0.35);
      });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor(tinta).text("No hay alertas pendientes.");
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(morado);
    doc.text("Empleos conseguidos");
    doc.moveDown(0.4);
    if (logros.length) {
      logros.slice(0, 25).forEach((l) => {
        if (doc.y > 760) doc.addPage();
        doc.font("Helvetica").fontSize(9).fillColor(tinta);
        doc.text(`${l.fecha} · ${l.usuaria} · ${l.empresa}${l.cargo ? " · " + l.cargo : ""}`);
      });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor(tinta).text("Sin logros registrados.");
    }

    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i += 1) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor("#777777");
      doc.text(
        `Bajo la sombrilla · Reporte generado automáticamente · Página ${i + 1} de ${rango.count}`,
        46,
        800,
        { align: "center", width: 503 },
      );
    }

    doc.end();
  }),
);

app.use("/api/admin", admin);

// Cualquier otra ruta de la API
app.use("/api", (req, res) => falla(res, 404, "No encontrado."));

// ==========================================
// SITIO WEB (carpeta public)
// ==========================================
app.get("/", (req, res) => res.redirect("/Bajo_la_sombrilla.html"));
app.use(express.static(path.join(__dirname, "public")));

// En este repositorio el sitio está en la carpeta "front".
// Se sirve también desde ahí para poder probar todo con `npm start`.
app.use(express.static(path.join(__dirname, "..", "front")));

// ------------------------------------------
// ERRORES
// ------------------------------------------
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return falla(res, 400, "Solicitud no válida.");
  }
  console.error(err);
  falla(res, 500, "Ocurrió un error en el servidor. Intenta de nuevo.");
});

// ------------------------------------------
// ARRANQUE
// ------------------------------------------
(async () => {
  try {
    await db.iniciar(); // crea las tablas si no existen
    await crearAdminInicial();
    await prepararProfesionales();
  } catch (e) {
    const pistas = {
      ECONNREFUSED:
        "MySQL no está encendido o el host/puerto de .env no es correcto.",
      ER_ACCESS_DENIED_ERROR:
        "Usuario o contraseña de MySQL incorrectos (revisa DB_USER y DB_PASSWORD en .env).",
      ER_BAD_DB_ERROR:
        "La base de datos no existe. Créala primero (ver README.md) y revisa DB_NAME en .env.",
    };

    console.error(
      "No se pudo conectar con la base de datos: " +
        (pistas[e.code] || e.message),
    );
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log("Bajo la sombrilla funcionando en http://localhost:" + PORT);
  });
})();
