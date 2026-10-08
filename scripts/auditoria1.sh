#!/usr/bin/env bash
# Auditoría: catálogo, roles, relaciones usuario→publicación y estados. Solo lectura.
set -u
U=$(grep '^DB_USER=' /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep '^DB_PASSWORD=' /opt/hestiat/shared/.env | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }

echo "=== CATÁLOGO REAL ==="
Q "SELECT CONCAT('experiencias: ', COUNT(*), ' · activas: ', SUM(is_active=1)) FROM experiencia"
Q "SELECT CONCAT('servicios: ', COUNT(*), ' · activos: ', SUM(is_active=1)) FROM servicio_turistico"
Q "SELECT CONCAT('accommodation (lo que ve la web): ', COUNT(*), ' · publicados: ', SUM(status='published')) FROM accommodation"
Q "SELECT CONCAT('alojamiento (esquema del editor): ', COUNT(*), ' · activos: ', SUM(activo=1)) FROM alojamiento"
Q "SELECT CONCAT('registros de prueba del motor de enriquecimiento: ', COUNT(*)) FROM catalogo_enriquecimiento"

echo
echo "=== ROLES ==="
L "SHOW COLUMNS FROM usuario LIKE 'rol'"
L "SELECT CONCAT(rol, ': ', COUNT(*)) FROM usuario GROUP BY rol"
L "SELECT CONCAT('usuarios: ', COUNT(*), ' · activos: ', SUM(activo=1), ' · verificados: ', SUM(verificado_en IS NOT NULL)) FROM usuario"
L "SELECT CONCAT('sesiones vivas: ', COUNT(*)) FROM usuario_sesion WHERE expira_en > NOW()"
echo "tablas de usuarios: $(L 'SHOW TABLES' | tr '\n' ' ')"

echo
echo "=== RELACIÓN USUARIO → PUBLICACIÓN ==="
echo "alojamiento_anfitrion: $(Q 'SHOW COLUMNS FROM alojamiento_anfitrion' | awk '{print $1}' | tr '\n' ' ')"
Q "SELECT CONCAT('  relaciones: ', COUNT(*), ' · alojamientos distintos: ', COUNT(DISTINCT alojamiento_id), ' · usuarios distintos: ', COUNT(DISTINCT usuario_id)) FROM alojamiento_anfitrion"
Q "SELECT CONCAT('  alojamientos con dueño: ', (SELECT COUNT(DISTINCT alojamiento_id) FROM alojamiento_anfitrion), ' de ', (SELECT COUNT(*) FROM alojamiento), ' en el esquema del editor')"
echo "columnas de propiedad en experiencia/servicio: $(Q "SELECT COALESCE(GROUP_CONCAT(COLUMN_NAME), '(ninguna)') FROM information_schema.columns WHERE table_schema='hestiat2' AND table_name IN ('experiencia','servicio_turistico') AND (COLUMN_NAME LIKE '%user%' OR COLUMN_NAME LIKE '%owner%' OR COLUMN_NAME LIKE '%propiet%' OR COLUMN_NAME LIKE '%anfitrion%' OR COLUMN_NAME LIKE '%email%' OR COLUMN_NAME LIKE '%contact%')")"
echo "tablas de relación para experiencia/servicio: $(Q "SELECT COALESCE(GROUP_CONCAT(table_name), '(ninguna)') FROM information_schema.tables WHERE table_schema='hestiat2' AND (table_name LIKE '%experiencia_usuario%' OR table_name LIKE '%servicio_usuario%' OR table_name LIKE '%propietario%' OR table_name LIKE '%proveedor%')")"
Q "SELECT CONCAT('  solicitudes de alta (vínculo actual con proveedores): ', COUNT(*), ' · emails distintos: ', COUNT(DISTINCT email)) FROM solicitud_catalogo"
echo "  reclamaciones de propiedad: $(Q 'SHOW COLUMNS FROM reclama_propiedad' | awk '{print $1}' | tr '\n' ' ')"
Q "SELECT CONCAT('  reclamaciones registradas: ', COUNT(*)) FROM reclama_propiedad"

echo
echo "=== ESTADOS DE PUBLICACIÓN ==="
echo "accommodation.status: $(Q "SELECT GROUP_CONCAT(CONCAT(status,':',n) SEPARATOR ' · ') FROM (SELECT status, COUNT(*) n FROM accommodation GROUP BY status) x")"
echo "alojamiento (activo/auditoría): $(Q "SELECT GROUP_CONCAT(CONCAT(activo,'/',COALESCE(estado_auditoria,'-'),':',n) SEPARATOR ' · ') FROM (SELECT activo, estado_auditoria, COUNT(*) n FROM alojamiento GROUP BY activo, estado_auditoria) x")"
echo "experiencia (activa|calidad|verificación|disponibilidad): $(Q "SELECT GROUP_CONCAT(CONCAT(is_active,'|',COALESCE(quality_status,'-'),'|',COALESCE(verification_status,'-'),'|',COALESCE(availability_status,'-'),':',n) SEPARATOR ' · ') FROM (SELECT is_active, quality_status, verification_status, availability_status, COUNT(*) n FROM experiencia GROUP BY is_active, quality_status, verification_status, availability_status ORDER BY n DESC LIMIT 5) x")"
echo "servicio (activo|calidad): $(Q "SELECT GROUP_CONCAT(CONCAT(is_active,'|',COALESCE(quality_status,'-'),':',n) SEPARATOR ' · ') FROM (SELECT is_active, quality_status, COUNT(*) n FROM servicio_turistico GROUP BY is_active, quality_status ORDER BY n DESC LIMIT 4) x")"
echo "columnas de fechas y borrado lógico: $(Q "SELECT GROUP_CONCAT(DISTINCT COLUMN_NAME) FROM information_schema.columns WHERE table_schema='hestiat2' AND table_name IN ('experiencia','servicio_turistico','accommodation','alojamiento') AND (COLUMN_NAME LIKE '%deleted%' OR COLUMN_NAME LIKE '%borrado%' OR COLUMN_NAME LIKE '%suspend%' OR COLUMN_NAME LIKE '%creado%' OR COLUMN_NAME LIKE '%created%' OR COLUMN_NAME LIKE '%actualizado%' OR COLUMN_NAME LIKE '%updated%')")"

echo
echo "=== TABLAS DEL PROYECTO (agrupadas) ==="
Q "SELECT GROUP_CONCAT(table_name ORDER BY table_name SEPARATOR ' ') FROM information_schema.tables WHERE table_schema='hestiat2'"
echo "--- base original (hestiat) ---"
L "SELECT GROUP_CONCAT(table_name ORDER BY table_name SEPARATOR ' ') FROM information_schema.tables WHERE table_schema='hestiat'"
