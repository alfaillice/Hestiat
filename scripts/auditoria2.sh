#!/usr/bin/env bash
# Auditoría 2: relaciones de propiedad reales, correo, reservas, caché y almacenamiento. Solo lectura.
set -u
U=$(grep '^DB_USER=' /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep '^DB_PASSWORD=' /opt/hestiat/shared/.env | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }

echo "=== TABLAS DE PROPIEDAD / ORGANIZADOR / PROVEEDOR ==="
for t in experiencia_organizador servicio_proveedor experiencia_dato_fuente servicio_dato_fuente; do
  echo "· $t"
  echo "  columnas: $(Q "SHOW COLUMNS FROM $t" | awk '{print $1}' | tr '\n' ' ')"
  echo "  filas: $(Q "SELECT COUNT(*) FROM $t")"
done

echo
echo "=== LA DIFERENCIA DE 2 FILAS ENTRE ESQUEMAS ==="
Q "SELECT CONCAT('accommodation: ', COUNT(*)) FROM accommodation"
Q "SELECT CONCAT('alojamiento: ', COUNT(*)) FROM alojamiento"
echo "  ¿ids en alojamiento que no están en accommodation? $(Q "SELECT COALESCE(GROUP_CONCAT(legacy_id), '(ninguno)') FROM alojamiento WHERE legacy_id NOT IN (SELECT id FROM accommodation) LIMIT 5")"
echo "  alojamientos con dueño (detalle): $(Q "SELECT GROUP_CONCAT(CONCAT(alojamiento_id,'→usuario ',usuario_id,' (',rol,')') SEPARATOR ' · ') FROM alojamiento_anfitrion")"

echo
echo "=== CORREO Y RECUPERACIÓN ==="
echo "tablas de correo/tokens: $(Q "SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema='hestiat2' AND (table_name LIKE '%reset%' OR table_name LIKE '%verific%' OR table_name LIKE '%correo%' OR table_name LIKE '%email%')")"
Q "SELECT CONCAT('  verificacion_correo: ', COUNT(*), ' filas · usados: ', SUM(usado=1)) FROM verificacion_correo"
L "SELECT CONCAT('  usuario_reset (legacy): ', COUNT(*)) FROM usuario_reset"
echo "  variables de correo definidas: $(grep -c '^SMTP_' /opt/hestiat/shared/.env) (sin mostrar valores)"
echo "  remitente configurado: $(grep '^SMTP_FROM=' /opt/hestiat/shared/.env | cut -d= -f2-)"
echo "  servidor SMTP: $(grep '^SMTP_HOST=' /opt/hestiat/shared/.env | cut -d= -f2-):$(grep '^SMTP_PORT=' /opt/hestiat/shared/.env | cut -d= -f2-) (TLS: $(grep '^SMTP_SECURE=' /opt/hestiat/shared/.env | cut -d= -f2-))"

echo
echo "=== RESERVAS Y DISPONIBILIDAD ==="
L "SELECT CONCAT('reservas: ', COUNT(*), ' · por estado: ', COALESCE(GROUP_CONCAT(DISTINCT estado), '-')) FROM reserva"
L "SELECT CONCAT('  última reserva: ', COALESCE(MAX(creado_en), 'ninguna')) FROM reserva"
Q "SELECT CONCAT('disponibilidad (días bloqueados/importados): ', COUNT(*), ' · alojamientos: ', COUNT(DISTINCT alojamiento_id)) FROM disponibilidad"
echo "  ical: $(Q "SELECT CONCAT('feeds: ', COUNT(*)) FROM ical_feed" 2>/dev/null || echo 'sin ical_feed')"

echo
echo "=== FOTOS Y ALMACENAMIENTO ==="
Q "SELECT CONCAT('accommodation_photo: ', COUNT(*), ' · con origen externo: ', SUM(origin_url IS NOT NULL)) FROM accommodation_photo"
L "SELECT CONCAT('alojamiento_foto (legacy): ', COUNT(*)) FROM alojamiento_foto"
echo "  ¿cuántas fotos apuntan a R2?: $(Q "SELECT CONCAT(SUM(COALESCE(origin_url,storage_key) LIKE '%r2.dev%'), ' de ', COUNT(*)) FROM accommodation_photo")"
echo "  espacio de la release: $(du -sh /opt/hestiat/app 2>/dev/null | cut -f1) · releases guardadas: $(ls /opt/hestiat/releases | wc -l)"

echo
echo "=== BACKUPS ==="
ls -la /opt/hestiat/backups 2>/dev/null | tail -4
echo "  copias de la base: $(ls /opt/hestiat/backups/*.sql.gz 2>/dev/null | wc -l) · más reciente: $(ls -t /opt/hestiat/backups/*.sql.gz 2>/dev/null | head -1)"
echo "  tarea programada de copia: $(crontab -l 2>/dev/null | grep -c -i 'backup\|dump\|mariadb-dump') línea(s) en root"
echo "  temporizadores systemd: $(systemctl list-timers --no-pager 2>/dev/null | grep -c hestiat) de Hestiat"
systemctl list-timers --no-pager 2>/dev/null | grep -i hestiat | head -3

echo
echo "=== CACHÉ Y LOGS ==="
echo "  caché de nginx: $(find /var/cache/nginx/hestiat -type f 2>/dev/null | wc -l) ficheros · $(du -sh /var/cache/nginx/hestiat 2>/dev/null | cut -f1)"
echo "  logs: $(du -sh /var/log/hestiat 2>/dev/null | cut -f1) · rotación: $(ls /etc/logrotate.d/ | grep -c hestiat) fichero(s)"
echo "  journald: $(journalctl --disk-usage 2>/dev/null | tail -1)"
echo "  memoria en uso ahora: $(free -m | awk 'NR==2 {print $3\" MB de \"$2}') · swap: $(free -m | awk 'NR==3 {print $3\" MB\"}')"
echo "  buffer pool: $(mariadb -u"$U" -p"$P" -N -B -e "SELECT CONCAT(ROUND(@@innodb_buffer_pool_size/1048576),' MB')")"
