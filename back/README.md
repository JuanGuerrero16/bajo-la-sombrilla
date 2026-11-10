# Bajo la sombrilla — sitio web + API + base de datos MySQL

## Puesta en marcha

1. Instala **Node.js 20 o superior** (https://nodejs.org) y **MySQL 8** (o MariaDB 10.3+, o XAMPP).

2. Crea la base de datos y un usuario. Entra a MySQL (Workbench, phpMyAdmin o la terminal con
   `mysql -u root -p`) y ejecuta:

   ```sql
   CREATE DATABASE bajo_la_sombrilla CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'sombrilla'@'localhost' IDENTIFIED BY 'pon-aqui-una-clave-segura';
   GRANT ALL PRIVILEGES ON bajo_la_sombrilla.* TO 'sombrilla'@'localhost';
   FLUSH PRIVILEGES;
   ```

   Las **tablas se crean solas** cuando arranca el servidor (están definidas en `schema.sql`).
   Si usas XAMPP puedes probar con `DB_USER=root` y `DB_PASSWORD` vacío.

3. En esta carpeta, abre una terminal y ejecuta:

   ```
   npm install
   ```

4. Copia `.env.example` como `.env` y rellénalo:
   - `DB_USER`, `DB_PASSWORD`, `DB_NAME`: los del paso 2.
   - `JWT_SECRET`: genera uno con
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 10 caracteres): la cuenta de administración se crea sola al primer arranque.

5. Arranca el servidor:

   ```
   npm start
   ```

6. Abre http://localhost:3000 (¡no abras los .html con doble clic! Deben cargarse desde el servidor).
   El panel está en http://localhost:3000/admin.html

Si algo falla al conectar, el servidor muestra un mensaje que explica la causa
(MySQL apagado, clave incorrecta o base de datos inexistente).

## Estructura

```
server.js     Servidor y rutas de la API
db.js         Conexión a MySQL y consultas
schema.sql    Definición de las tablas (también puedes importarlo a mano)
../front/     El sitio web (HTML, CSS, JS, imágenes y librerías locales)
.env          Tus claves (no lo compartas ni lo subas a internet)
```

El servidor sirve primero la carpeta `public/` (si existe) y después `../front/`,
así que también puedes abrir todo desde `http://localhost:3000`.

## Módulos nuevos

### Acompañamiento psicosocial (`front/acompanamiento.html`)

- Agendamiento de citas con profesionales: calendario de cupos, disponibilidad
  semanal, confirmación y cancelación.
- Mensajería interna entre usuaria y profesional (se actualiza cada 10 segundos).
- Chat de prueba con 10 mensajes precargados y respuestas automáticas para
  practicar la conversación sin esperar la respuesta de una profesional.
- Diario emocional con estado de ánimo de 1 a 10, emociones y gráfica de los
  últimos 30 días.
- Test de bienestar de ansiedad (GAD-7 adaptada) y autoestima (Rosenberg
  adaptada). Si el resultado indica riesgo, se crea una alerta para el equipo
  profesional.
- Botón flotante de ayuda/emergencia con Línea 155, Línea 106, Línea 123,
  Línea 195, Línea 141, Línea 122 y Línea 147.

### Panel profesional (`front/profesional.html`)

- Confirmar, completar o cancelar citas.
- Responder los mensajes de las usuarias.
- Ver y atender las alertas de riesgo.
- Configurar días y horas de atención.

En desarrollo se crean tres cuentas de demostración (solo si no existe ninguna
profesional):

| Correo | Contraseña | Especialidad |
|---|---|---|
| `psicologa@bajolasombrilla.org` | `Profesional2026*` | Psicología clínica |
| `trabajadora.social@bajolasombrilla.org` | `Profesional2026*` | Trabajo social |
| `abogada@bajolasombrilla.org` | `Profesional2026*` | Orientación jurídica |

Puedes cambiarlas con `PROF_EMAIL` y `PROF_PASSWORD` en `.env`. En producción no
se crean cuentas de demostración: la administración las crea desde su panel.

### Mapa de servicios (`front/mapa.html`)

Mapa interactivo con **Leaflet + OpenStreetMap** y filtros por categoría y ciudad.
Incluye fundaciones, albergues, centros de salud, oficinas de empleo, comisarías
de familia, educación y atención psicosocial. Los datos iniciales se cargan en
la tabla `servicios_mapa`.

### Panel administrativo (`front/admin.html`)

- Dashboard con Chart.js: citas por mes, tests con riesgo, promedio de ánimo,
  usuarias activas/inactivas, empleos conseguidos, progreso promedio y deserción.
- Gestión de citas, alertas, profesionales y empleos conseguidos.
- Exportación del reporte a **Excel** (`.xlsx`) y **PDF** con el resumen y los
  datos de citas, tests, alertas y logros laborales.

## Tablas

| Tabla | Para qué sirve |
|---|---|
| `usuarias` | Cuentas (rol `usuaria`, `profesional` o `admin`), contraseña con bcrypt |
| `testimonios` | Testimonios (`pendiente`, `aprobado`, `rechazado`) |
| `areas` + `testimonio_areas` | Áreas de interés de cada testimonio |
| `solicitudes` | Solicitudes de orientación (`nueva`, `atendida`) |
| `motivos` + `solicitud_motivos` | Motivos de cada solicitud |
| `perfiles_profesionales` | Especialidad, descripción y estado de cada profesional |
| `disponibilidad` | Días y horas de atención de cada profesional |
| `citas` | Citas (`pendiente`, `confirmada`, `completada`, `cancelada`) |
| `mensajes` | Mensajería interna usuaria ↔ profesional |
| `diario_emocional` | Una entrada por día: ánimo, emociones y nota |
| `tests_bienestar` | Puntaje, nivel y riesgo de cada test |
| `alertas` | Alertas de riesgo para el equipo profesional |
| `lineas_ayuda` | Líneas de atención y emergencia |
| `servicios_mapa` | Servicios y coordenadas del mapa |
| `accesos` | Registro de ingresos para calcular actividad y deserción |
| `logros_laborales` | Empleos conseguidos (indicador del dashboard) |

Las fechas de creación se guardan en UTC. Las citas y el diario se manejan en
hora de Colombia (UTC-5) para que los horarios coincidan con la vida real.

## API

Públicas: `POST /api/registro`, `POST /api/login`, `POST /api/logout`, `GET /api/yo`,
`GET /api/testimonios`, `POST /api/testimonios`, `POST /api/solicitudes`,
`GET /api/lineas-ayuda`, `GET /api/servicios-mapa`, `GET /api/servicios-mapa/filtros`.

Con sesión de usuaria: `POST /api/cambiar-clave`, `GET /api/profesionales`,
`GET/POST /api/citas`, `PATCH /api/citas/:id`, `GET/POST /api/mensajes`,
`GET/POST /api/diario`, `GET /api/tests/definiciones`, `GET /api/tests/historial`,
`POST /api/tests`.

Con sesión de profesional (`/api/profesional/...`): `GET/PATCH citas`,
`GET/POST mensajes`, `GET/PATCH alertas`, `GET/PUT disponibilidad`.

Solo administración (`/api/admin/...`): `resumen`, `estadisticas`, `testimonios`,
`solicitudes`, `citas`, `alertas`, `profesionales`, `logros`, `usuarias`,
`reportes/estadisticas.xlsx`, `reportes/estadisticas.pdf` y cambios de estado /
eliminación.

## Antes de publicarlo en internet

- Usa **HTTPS** y pon `NODE_ENV=production` en `.env` (activa las cookies seguras).
- Si lo pones detrás de un proxy (Nginx, Render, Railway…), añade `app.set('trust proxy', 1);` en `server.js` para que los límites de intentos funcionen bien.
- Usa un usuario de MySQL solo para esta base de datos (como en el paso 2), nunca `root`.
- Si publicas el frontend en un dominio diferente al del backend, define
  `window.SOMBRILLA_API_URL = "https://tu-backend..."` antes de cargar `auth.js`
  o `script.js` (si el mismo servidor sirve el sitio y la API, no hace falta).
- Haz copias de seguridad de la base de datos (`mysqldump bajo_la_sombrilla > copia.sql`) y cuida `.env`: contienen información sensible.
