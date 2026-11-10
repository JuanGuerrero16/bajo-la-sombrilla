-- ==========================================================
-- Bajo la sombrilla - esquema de la base de datos
-- Compatible con MySQL 5.7+, MySQL 8 y MariaDB 10.3+
--
-- El servidor ejecuta este archivo solo al arrancar (es seguro repetirlo).
-- Tambien puedes importarlo a mano desde Workbench o phpMyAdmin.
-- Las fechas se guardan en hora UTC.
-- ==========================================================

CREATE TABLE IF NOT EXISTS usuarias (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre        VARCHAR(80)  NOT NULL,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    rol           ENUM('usuaria', 'profesional', 'admin') NOT NULL DEFAULT 'usuaria',
    creado_en     DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarias_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS areas (
    id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(80)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_areas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS testimonios (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuaria_id     INT UNSIGNED NULL,
    nombre_publico VARCHAR(80)  NULL,
    texto          TEXT         NOT NULL,
    estado         ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
    creado_en      DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_testimonios_estado (estado),
    CONSTRAINT fk_testimonios_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS testimonio_areas (
    testimonio_id INT UNSIGNED NOT NULL,
    area_id       INT UNSIGNED NOT NULL,
    PRIMARY KEY (testimonio_id, area_id),
    CONSTRAINT fk_ta_testimonio FOREIGN KEY (testimonio_id) REFERENCES testimonios (id) ON DELETE CASCADE,
    CONSTRAINT fk_ta_area       FOREIGN KEY (area_id)       REFERENCES areas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS motivos (
    id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(80)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_motivos_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitudes (
    id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre    VARCHAR(80)  NULL,
    contacto  VARCHAR(120) NULL,
    mensaje   TEXT         NULL,
    estado    ENUM('nueva', 'atendida') NOT NULL DEFAULT 'nueva',
    creado_en DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_solicitudes_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitud_motivos (
    solicitud_id INT UNSIGNED NOT NULL,
    motivo_id    INT UNSIGNED NOT NULL,
    PRIMARY KEY (solicitud_id, motivo_id),
    CONSTRAINT fk_sm_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes (id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_motivo    FOREIGN KEY (motivo_id)    REFERENCES motivos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- MÓDULO DE ACOMPAÑAMIENTO PSICOSOCIAL
-- ==========================================================

-- Perfil de las cuentas con rol "profesional"
CREATE TABLE IF NOT EXISTS perfiles_profesionales (
    usuaria_id   INT UNSIGNED NOT NULL,
    especialidad VARCHAR(120) NOT NULL,
    descripcion  TEXT         NULL,
    activo       TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (usuaria_id),
    CONSTRAINT fk_perfil_prof_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Horarios semanales de atención de cada profesional
-- dia_semana: 0 = domingo, 1 = lunes, ... 6 = sábado
CREATE TABLE IF NOT EXISTS disponibilidad (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    profesional_id INT UNSIGNED NOT NULL,
    dia_semana    TINYINT UNSIGNED NOT NULL,
    hora_inicio   TIME NOT NULL,
    hora_fin      TIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_disponibilidad_prof (profesional_id),
    CONSTRAINT fk_disponibilidad_prof
        FOREIGN KEY (profesional_id) REFERENCES usuarias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Citas agendadas entre una usuaria y una profesional
CREATE TABLE IF NOT EXISTS citas (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuaria_id    INT UNSIGNED NOT NULL,
    profesional_id INT UNSIGNED NOT NULL,
    fecha_hora    DATETIME     NOT NULL,
    duracion_min  SMALLINT UNSIGNED NOT NULL DEFAULT 50,
    modalidad     ENUM('virtual', 'presencial') NOT NULL DEFAULT 'virtual',
    motivo        VARCHAR(500) NULL,
    estado        ENUM('pendiente', 'confirmada', 'completada', 'cancelada') NOT NULL DEFAULT 'pendiente',
    notas         TEXT         NULL,
    creado_en     DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_citas_usuaria (usuaria_id),
    KEY idx_citas_profesional (profesional_id),
    KEY idx_citas_fecha (fecha_hora),
    KEY idx_citas_estado (estado),
    CONSTRAINT fk_citas_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE CASCADE,
    CONSTRAINT fk_citas_profesional
        FOREIGN KEY (profesional_id) REFERENCES usuarias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mensajería interna entre usuaria y profesional
CREATE TABLE IF NOT EXISTS mensajes (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuaria_id     INT UNSIGNED NOT NULL,
    profesional_id INT UNSIGNED NOT NULL,
    remitente      ENUM('usuaria', 'profesional') NOT NULL,
    texto          TEXT         NOT NULL,
    leido          TINYINT(1)   NOT NULL DEFAULT 0,
    creado_en      DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_mensajes_conversacion (usuaria_id, profesional_id, creado_en),
    KEY idx_mensajes_profesional (profesional_id, leido),
    CONSTRAINT fk_mensajes_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE CASCADE,
    CONSTRAINT fk_mensajes_profesional
        FOREIGN KEY (profesional_id) REFERENCES usuarias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Diario emocional: una entrada por día y por usuaria
CREATE TABLE IF NOT EXISTS diario_emocional (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuaria_id INT UNSIGNED NOT NULL,
    fecha      DATE         NOT NULL,
    animo      TINYINT UNSIGNED NOT NULL,
    emociones  VARCHAR(200) NULL,
    nota       TEXT         NULL,
    creado_en  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_diario_usuaria_fecha (usuaria_id, fecha),
    KEY idx_diario_fecha (fecha),
    CONSTRAINT fk_diario_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Resultados de los test de bienestar (ansiedad / autoestima)
CREATE TABLE IF NOT EXISTS tests_bienestar (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuaria_id INT UNSIGNED NOT NULL,
    tipo       ENUM('ansiedad', 'autoestima') NOT NULL,
    puntaje    SMALLINT UNSIGNED NOT NULL,
    nivel      VARCHAR(30) NOT NULL,
    respuestas TEXT         NOT NULL,
    riesgo     TINYINT(1)   NOT NULL DEFAULT 0,
    creado_en  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_tests_usuaria (usuaria_id),
    KEY idx_tests_riesgo (riesgo),
    CONSTRAINT fk_tests_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alertas para el equipo profesional cuando hay indicadores de riesgo
CREATE TABLE IF NOT EXISTS alertas (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuaria_id     INT UNSIGNED NOT NULL,
    profesional_id INT UNSIGNED NULL,
    tipo           ENUM('test', 'diario') NOT NULL,
    nivel          ENUM('medio', 'alto') NOT NULL DEFAULT 'alto',
    descripcion    VARCHAR(300) NOT NULL,
    atendida       TINYINT(1)   NOT NULL DEFAULT 0,
    creado_en      DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_alertas_pendientes (atendida, creado_en),
    KEY idx_alertas_profesional (profesional_id, atendida),
    CONSTRAINT fk_alertas_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE CASCADE,
    CONSTRAINT fk_alertas_profesional
        FOREIGN KEY (profesional_id) REFERENCES usuarias (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Líneas de atención y emergencia
CREATE TABLE IF NOT EXISTS lineas_ayuda (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre      VARCHAR(120) NOT NULL,
    numero      VARCHAR(40)  NOT NULL,
    descripcion VARCHAR(300) NULL,
    horario     VARCHAR(120) NULL,
    categoria   VARCHAR(60)  NULL,
    orden       INT UNSIGNED NOT NULL DEFAULT 0,
    activo      TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_lineas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Servicios que se muestran en el mapa interactivo
CREATE TABLE IF NOT EXISTS servicios_mapa (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre      VARCHAR(140) NOT NULL,
    categoria   VARCHAR(60)  NOT NULL,
    ciudad      VARCHAR(80)  NOT NULL,
    direccion   VARCHAR(200) NULL,
    telefono    VARCHAR(80)  NULL,
    horario     VARCHAR(140) NULL,
    descripcion VARCHAR(400) NULL,
    lat         DECIMAL(10, 7) NOT NULL,
    lng         DECIMAL(10, 7) NOT NULL,
    web         VARCHAR(300) NULL,
    creado_en   DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_servicios_nombre_ciudad (nombre, ciudad),
    KEY idx_servicios_categoria (categoria),
    KEY idx_servicios_ciudad (ciudad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registro de accesos para calcular usuarias activas y deserción
CREATE TABLE IF NOT EXISTS accesos (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuaria_id INT UNSIGNED NOT NULL,
    creado_en  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_accesos_usuaria_fecha (usuaria_id, creado_en),
    CONSTRAINT fk_accesos_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Logros laborales reportados por la administración (para el indicador "empleos conseguidos")
CREATE TABLE IF NOT EXISTS logros_laborales (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuaria_id INT UNSIGNED NOT NULL,
    empresa    VARCHAR(120) NOT NULL,
    cargo      VARCHAR(120) NULL,
    fecha      DATE         NOT NULL,
    creado_en  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_logros_fecha (fecha),
    CONSTRAINT fk_logros_usuaria
        FOREIGN KEY (usuaria_id) REFERENCES usuarias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
