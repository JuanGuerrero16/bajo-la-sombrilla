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
    rol           ENUM('usuaria', 'admin') NOT NULL DEFAULT 'usuaria',
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
