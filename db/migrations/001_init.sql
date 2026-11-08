-- ============================================================================
-- Hestiat 2.0 — Migración 001: esquema inicial
-- Motor: MariaDB 11.4 / MySQL 8 (utf8mb4)
-- Idempotente en lo posible (IF NOT EXISTS). Reversible: ver 001_down.sql
--
-- Principios:
--   · Claves, índices, claves foráneas y restricciones explícitas.
--   · Nada de borrado destructivo: los estados de ciclo de vida sustituyen al DELETE.
--   · El precio distingue real de orientativo y guarda su fuente.
--   · Las fotos guardan su procedencia externa para trazabilidad.
--   · Sin valoraciones inventadas: la media sale de reseñas reales.
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------- usuarios --
CREATE TABLE IF NOT EXISTS user (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email           VARCHAR(191)    NOT NULL,
  email_verified_at DATETIME      NULL,
  password_hash   VARCHAR(255)    NULL,             -- NULL si solo usa OAuth
  display_name    VARCHAR(120)    NOT NULL,
  phone           VARCHAR(32)     NULL,
  locale          VARCHAR(8)      NOT NULL DEFAULT 'es',
  country         CHAR(2)         NULL,
  city            VARCHAR(120)    NULL,
  bio             TEXT            NULL,
  avatar_key      VARCHAR(255)    NULL,             -- clave en almacén propio (nunca URL externa)
  avatar_origin_url VARCHAR(1024) NULL,
  role            ENUM('user','host','admin') NOT NULL DEFAULT 'user',
  status          ENUM('active','blocked','deleted') NOT NULL DEFAULT 'active',
  blocked_reason  VARCHAR(255)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_email (email),
  KEY idx_user_role_status (role, status),
  KEY idx_user_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_identity (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  provider    ENUM('password','google','apple') NOT NULL,
  subject     VARCHAR(191)    NOT NULL,             -- identificador en el proveedor
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_identity (provider, subject),
  KEY idx_identity_user (user_id),
  CONSTRAINT fk_identity_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_session (
  id          CHAR(64)        NOT NULL,             -- token opaco
  user_id     BIGINT UNSIGNED NOT NULL,
  ip_hash     CHAR(64)        NULL,                 -- nunca la IP en claro
  user_agent  VARCHAR(255)    NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME        NOT NULL,
  revoked_at  DATETIME        NULL,
  PRIMARY KEY (id),
  KEY idx_session_user (user_id),
  KEY idx_session_expires (expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------- alojamiento --
CREATE TABLE IF NOT EXISTS accommodation (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id         BIGINT UNSIGNED NULL,           -- id en ppxgfdyc_hestiat.alojamiento
  slug              VARCHAR(191)    NOT NULL,
  title             VARCHAR(255)    NOT NULL,
  description       MEDIUMTEXT      NULL,
  type              VARCHAR(80)     NULL,
  category          VARCHAR(120)    NULL,
  address           VARCHAR(255)    NULL,
  city              VARCHAR(120)    NULL,
  province          VARCHAR(120)    NULL,
  postal_code       VARCHAR(16)     NULL,
  country           CHAR(2)         NOT NULL DEFAULT 'ES',
  lat               DECIMAL(10,7)   NULL,
  lng               DECIMAL(10,7)   NULL,
  capacity          SMALLINT UNSIGNED NULL,
  bedrooms          SMALLINT UNSIGNED NULL,
  beds              SMALLINT UNSIGNED NULL,
  baths             SMALLINT UNSIGNED NULL,
  price_per_night   DECIMAL(10,2)   NULL,
  indicative_price  DECIMAL(10,2)   NULL,
  currency          CHAR(3)         NOT NULL DEFAULT 'EUR',
  cleaning_fee      DECIMAL(10,2)   NULL,
  price_type        ENUM('real','indicative','estimated') NOT NULL DEFAULT 'indicative',
  price_source      VARCHAR(255)    NULL,
  price_checked_at  DATETIME        NULL,
  instant_booking   TINYINT(1)      NOT NULL DEFAULT 0,
  stars             TINYINT UNSIGNED NULL,
  -- agregados de reseñas: mantenidos por el sistema, nunca inventados
  review_score      DECIMAL(3,2)    NULL,
  review_count      INT UNSIGNED    NOT NULL DEFAULT 0,
  review_distribution JSON          NULL,
  status            ENUM('draft','published','paused','archived') NOT NULL DEFAULT 'draft',
  host_id           BIGINT UNSIGNED NULL,
  published_at      DATETIME        NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accommodation_slug (slug),
  UNIQUE KEY uq_accommodation_legacy (legacy_id),
  KEY idx_accommodation_geo (lat, lng),
  KEY idx_accommodation_province (province, status),
  KEY idx_accommodation_price (price_per_night),
  KEY idx_accommodation_host (host_id),
  KEY idx_accommodation_status_pub (status, published_at),
  CONSTRAINT fk_accommodation_host FOREIGN KEY (host_id) REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accommodation_photo (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  accommodation_id BIGINT UNSIGNED NOT NULL,
  storage_key    VARCHAR(255)    NULL,              -- clave en R2 propio (lo que servimos)
  variants       JSON            NULL,              -- {original, w800, w400, ...}
  origin_url     VARCHAR(1024)   NULL,              -- URL externa de la que procede (trazabilidad)
  width          INT UNSIGNED    NULL,
  height         INT UNSIGNED    NULL,
  alt            VARCHAR(255)    NULL,
  sort_order     INT             NOT NULL DEFAULT 0,
  is_primary     TINYINT(1)      NOT NULL DEFAULT 0,
  license        VARCHAR(120)    NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_photo_accommodation (accommodation_id, sort_order),
  KEY idx_photo_primary (accommodation_id, is_primary),
  KEY idx_photo_storage (storage_key),
  CONSTRAINT fk_photo_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accommodation_amenity (
  accommodation_id BIGINT UNSIGNED NOT NULL,
  amenity          VARCHAR(80)     NOT NULL,
  PRIMARY KEY (accommodation_id, amenity),
  KEY idx_amenity_lookup (amenity),
  CONSTRAINT fk_amenity_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------- reservas y disponibilidad --
CREATE TABLE IF NOT EXISTS reservation (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id         BIGINT UNSIGNED NULL,
  code              VARCHAR(32)     NOT NULL,
  accommodation_id  BIGINT UNSIGNED NOT NULL,
  guest_id          BIGINT UNSIGNED NULL,
  guest_name        VARCHAR(160)    NULL,
  guest_email       VARCHAR(191)    NULL,
  guest_phone       VARCHAR(32)     NULL,
  check_in          DATE            NOT NULL,
  check_out         DATE            NOT NULL,
  guests            SMALLINT UNSIGNED NULL,
  total_amount      DECIMAL(10,2)   NULL,
  currency          CHAR(3)         NOT NULL DEFAULT 'EUR',
  status            ENUM('pending','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'pending',
  source            ENUM('direct','ical','manual','other') NOT NULL DEFAULT 'direct',
  external_uid      VARCHAR(191)    NULL,
  notes             TEXT            NULL,
  checked_in_at     DATETIME        NULL,
  cancelled_at      DATETIME        NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reservation_code (code),
  UNIQUE KEY uq_reservation_external (accommodation_id, external_uid),
  KEY idx_reservation_dates (accommodation_id, check_in, check_out),
  KEY idx_reservation_status (status),
  CONSTRAINT fk_reservation_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservation_guest FOREIGN KEY (guest_id) REFERENCES user (id) ON DELETE SET NULL,
  CONSTRAINT chk_reservation_dates CHECK (check_out > check_in)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS availability (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  accommodation_id  BIGINT UNSIGNED NOT NULL,
  day               DATE            NOT NULL,
  is_available      TINYINT(1)      NOT NULL DEFAULT 1,
  price_override    DECIMAL(10,2)   NULL,
  min_nights        TINYINT UNSIGNED NULL,
  note              VARCHAR(255)    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_availability_day (accommodation_id, day),
  CONSTRAINT fk_availability_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------ reseñas reales --
CREATE TABLE IF NOT EXISTS review (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  accommodation_id  BIGINT UNSIGNED NOT NULL,
  reservation_id    BIGINT UNSIGNED NULL,           -- obligatorio para reseñas de estancia
  user_id           BIGINT UNSIGNED NULL,
  author_name       VARCHAR(120)    NULL,
  score             TINYINT UNSIGNED NOT NULL,      -- 1..5
  cleanliness       TINYINT UNSIGNED NULL,
  location_score    TINYINT UNSIGNED NULL,
  communication     TINYINT UNSIGNED NULL,
  value_score       TINYINT UNSIGNED NULL,
  comment           TEXT            NULL,
  language          VARCHAR(8)      NULL,
  origin            ENUM('stay','channel') NOT NULL DEFAULT 'stay',
  origin_url        VARCHAR(1024)   NULL,           -- si viene de un canal: enlace verificable
  status            ENUM('pending','published','rejected') NOT NULL DEFAULT 'pending',
  host_reply        TEXT            NULL,
  host_reply_at     DATETIME        NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_reservation (reservation_id),
  KEY idx_review_accommodation (accommodation_id, status, created_at),
  CONSTRAINT fk_review_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE CASCADE,
  CONSTRAINT fk_review_reservation FOREIGN KEY (reservation_id) REFERENCES reservation (id) ON DELETE SET NULL,
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE SET NULL,
  CONSTRAINT chk_review_score CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------ iCal --
CREATE TABLE IF NOT EXISTS calendar_feed (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  accommodation_id  BIGINT UNSIGNED NOT NULL,
  channel           ENUM('airbnb','booking','vrbo','other') NOT NULL,
  url               VARCHAR(1024)   NOT NULL,
  active            TINYINT(1)      NOT NULL DEFAULT 1,
  last_sync_at      DATETIME        NULL,
  last_status       ENUM('ok','error','never') NOT NULL DEFAULT 'never',
  last_error        VARCHAR(500)    NULL,
  events_imported   INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feed (accommodation_id, channel),
  KEY idx_feed_active (active, last_sync_at),
  CONSTRAINT fk_feed_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS calendar_export_token (
  accommodation_id BIGINT UNSIGNED NOT NULL,
  token            CHAR(64)        NOT NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (accommodation_id),
  UNIQUE KEY uq_export_token (token),
  CONSTRAINT fk_export_accommodation FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------- auditoría --
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id     BIGINT UNSIGNED NULL,
  actor_label  VARCHAR(120)    NULL,                -- p. ej. 'sistema:cron'
  action       VARCHAR(80)     NOT NULL,
  entity       VARCHAR(60)     NULL,
  entity_id    BIGINT UNSIGNED NULL,
  detail       JSON            NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_action (action, created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------- migraciones aplicadas --
CREATE TABLE IF NOT EXISTS schema_migration (
  version     VARCHAR(32)     NOT NULL,
  name        VARCHAR(191)    NOT NULL,
  checksum    CHAR(64)        NOT NULL,
  applied_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB;
