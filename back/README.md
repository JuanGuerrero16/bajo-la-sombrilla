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
public/       El sitio web (HTML, CSS, JS, imágenes)
.env          Tus claves (no lo compartas ni lo subas a internet)
```

## Tablas

| Tabla | Para qué sirve |
|---|---|
| `usuarias` | Cuentas (rol `usuaria` o `admin`), contraseña guardada con bcrypt |
| `testimonios` | Testimonios (`pendiente`, `aprobado`, `rechazado`) |
| `areas` + `testimonio_areas` | Áreas de interés de cada testimonio (relación muchos a muchos) |
| `solicitudes` | Solicitudes de orientación (`nueva`, `atendida`) |
| `motivos` + `solicitud_motivos` | Motivos de cada solicitud (relación muchos a muchos) |

Las fechas se guardan en hora UTC.

## API

Públicas: `POST /api/registro`, `POST /api/login`, `POST /api/logout`, `GET /api/yo`,
`GET /api/testimonios`, `POST /api/testimonios`, `POST /api/solicitudes`.

Con sesión: `POST /api/cambiar-clave`.

Solo administración (`/api/admin/...`): `resumen`, `testimonios`, `solicitudes`,
`solicitudes.csv` y cambios de estado / eliminación.

## Antes de publicarlo en internet

- Usa **HTTPS** y pon `NODE_ENV=production` en `.env` (activa las cookies seguras).
- Si lo pones detrás de un proxy (Nginx, Render, Railway…), añade `app.set('trust proxy', 1);` en `server.js` para que los límites de intentos funcionen bien.
- Usa un usuario de MySQL solo para esta base de datos (como en el paso 2), nunca `root`.
- Haz copias de seguridad de la base de datos (`mysqldump bajo_la_sombrilla > copia.sql`) y cuida `.env`: contienen información sensible.
