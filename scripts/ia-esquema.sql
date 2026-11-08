-- =============================================================================
-- Hestiat AI Manager — esquema (solo añade tablas, no toca ninguna existente)
--
-- Se aplica sobre hestiat2, la base del catálogo y de lo nuevo. Todas las tablas son
-- nuevas y de creación segura (IF NOT EXISTS): si ya existen, no se toca nada.
--
-- LO QUE SE REUTILIZA, Y POR QUÉ:
--   · `admin_auditoria` (ya existía, 201 filas): ahí se registra CADA acción del agente, en la
--     misma traza que el resto de la administración, para que no haya dos auditorías distintas.
--   · `campana_envio` (ya existía, 6.013 envíos reales): de ahí salen las estadísticas de campaña
--     que el agente puede consultar. No se inventan cifras.
--
-- LO QUE ES NUEVO, Y POR QUÉ:
--   · El consumo (modelo, tokens, coste) no cabe en la auditoría genérica y hace falta para poder
--     controlar el gasto: `ia_consumo`.
--   · El CRM, los tickets y los borradores de campaña no existían: `lead`, `lead_contacto`,
--     `ticket`, `ticket_mensaje`, `ia_campana`.
--   · Las bajas de correo necesitan su propia lista para poder respetarlas: `email_exclusion`.
-- =============================================================================

-- Conversaciones y mensajes del agente (contexto y consola de administración)
CREATE TABLE IF NOT EXISTS ia_conversacion (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NULL,
  canal ENUM('admin','soporte','crm','operaciones') NOT NULL DEFAULT 'admin',
  titulo VARCHAR(200) NULL,
  estado ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_usuario (usuario_id),
  INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_mensaje (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversacion_id BIGINT UNSIGNED NOT NULL,
  papel ENUM('usuario','asistente','herramienta','sistema') NOT NULL,
  contenido MEDIUMTEXT NULL,
  herramienta VARCHAR(60) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversacion (conversacion_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Consumo y coste por llamada al modelo (para poder limitar el gasto)
CREATE TABLE IF NOT EXISTS ia_consumo (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversacion_id BIGINT UNSIGNED NULL,
  tarea VARCHAR(80) NULL,
  proveedor VARCHAR(40) NULL,
  modelo VARCHAR(80) NULL,
  tokens_entrada INT NOT NULL DEFAULT 0,
  tokens_salida INT NOT NULL DEFAULT 0,
  coste_estimado DECIMAL(12,6) NOT NULL DEFAULT 0,
  moneda CHAR(3) NOT NULL DEFAULT 'USD',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fecha (creado_en),
  INDEX idx_modelo (modelo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CRM: potenciales clientes (alojamientos, experiencias, servicios)
CREATE TABLE IF NOT EXISTS lead (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empresa VARCHAR(200) NULL,
  tipo_negocio ENUM('alojamiento','experiencia','servicio','otro') NOT NULL DEFAULT 'otro',
  localidad VARCHAR(120) NULL,
  provincia VARCHAR(120) NULL,
  pais VARCHAR(80) NOT NULL DEFAULT 'España',
  web VARCHAR(255) NULL,
  dominio VARCHAR(160) NULL,
  email VARCHAR(200) NULL,
  telefono VARCHAR(60) NULL,
  contacto_nombre VARCHAR(160) NULL,
  fuente ENUM('catalogo','reclamacion','solicitud','manual','agente','web') NOT NULL DEFAULT 'manual',
  estado ENUM('DETECTED','RESEARCHED','CONTACT_READY','CONTACTED','REPLIED','INTERESTED','REGISTERED','PUBLISHED','NOT_INTERESTED','OPT_OUT','INVALID') NOT NULL DEFAULT 'DETECTED',
  excluido TINYINT NOT NULL DEFAULT 0,
  notas TEXT NULL,
  responsable VARCHAR(120) NULL,
  publicacion_id BIGINT UNSIGNED NULL,
  detectado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- El email es único para poder deduplicar, pero puede estar vacío (varios vacíos no chocan).
  UNIQUE KEY uq_lead_email (email),
  INDEX idx_dominio (dominio),
  INDEX idx_estado (estado),
  INDEX idx_localidad (localidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CRM: historial de contactos con cada potencial cliente
CREATE TABLE IF NOT EXISTS lead_contacto (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT UNSIGNED NOT NULL,
  canal ENUM('email','telefono','web','otro') NOT NULL DEFAULT 'email',
  asunto VARCHAR(255) NULL,
  cuerpo MEDIUMTEXT NULL,
  resultado ENUM('enviado','entregado','respondido','rebotado','sin_respuesta','cancelado') NULL,
  autor VARCHAR(120) NULL,
  aprobado_por VARCHAR(120) NULL,
  enviado_en DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lead (lead_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Atención al cliente
CREATE TABLE IF NOT EXISTS ticket (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(24) NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  contacto_email VARCHAR(200) NULL,
  contacto_nombre VARCHAR(160) NULL,
  asunto VARCHAR(255) NOT NULL,
  categoria ENUM('como_funciona','publicacion','alojamiento','experiencia','servicio','registro','edicion','reserva','cancelacion','cuenta_acceso','tecnico','otro') NOT NULL DEFAULT 'otro',
  prioridad ENUM('baja','normal','alta','urgente') NOT NULL DEFAULT 'normal',
  estado ENUM('OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  responsable VARCHAR(120) NULL,
  resolucion TEXT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cerrado_en DATETIME NULL,
  UNIQUE KEY uq_ticket_codigo (codigo),
  INDEX idx_estado (estado),
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_mensaje (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  autor ENUM('usuario','agente','persona') NOT NULL DEFAULT 'usuario',
  contenido MEDIUMTEXT NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket (ticket_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Borradores de campaña. Nada se envía sin aprobación humana explícita.
CREATE TABLE IF NOT EXISTS ia_campana (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  objetivo VARCHAR(255) NULL,
  segmento TEXT NULL,
  asunto VARCHAR(255) NULL,
  cuerpo MEDIUMTEXT NULL,
  estado ENUM('borrador','pendiente_aprobacion','aprobada','enviada','cancelada') NOT NULL DEFAULT 'borrador',
  creada_por VARCHAR(120) NULL,
  aprobada_por VARCHAR(120) NULL,
  aprobada_en DATETIME NULL,
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lista de exclusión: quien pide no recibir comunicaciones, no las recibe nunca.
CREATE TABLE IF NOT EXISTS email_exclusion (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(200) NOT NULL,
  motivo VARCHAR(160) NULL,
  origen ENUM('usuario','rebote','manual','sistema') NOT NULL DEFAULT 'manual',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exclusion_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuración de autonomía del agente (valores seguros por defecto)
CREATE TABLE IF NOT EXISTS ia_config (
  clave VARCHAR(60) NOT NULL,
  valor VARCHAR(255) NOT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ia_config (clave, valor) VALUES
  -- Nivel 3 = puede escribir lo que las políticas permiten (crear leads, tickets, bajas), pero las
  -- acciones SENSIBLES (enviar correo, tocar publicaciones) siguen exigiendo confirmación explícita
  -- y queda registrado quién la dio. Con nivel 2 el CRM y las incidencias no funcionarían.
  ('nivel_autonomia', '3'),                 -- 1 lectura · 2 preparación · 3 ejecución autorizada
  ('envios_requieren_aprobacion', '1'),     -- ningún email comercial sale sin aprobación humana
  ('limite_llamadas_por_hora', '120'),
  ('limite_gasto_diario_usd', '5'),
  ('modelo_economico', 'gpt-4.1-mini'),
  ('modelo_potente', 'gpt-4.1');
