#!/bin/bash
# Actualiza la tabla `imagen_compartida`: cuántas fichas usa cada imagen de experiencias y servicios.
# Con eso, el sitemap y las fichas excluyen las imágenes de stock reutilizadas en masa.
# Se puede ejecutar cuando se refresque el catálogo; hoy es un solo paso.
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" hestiat2 -e "$1"; }

Q "DROP TABLE IF EXISTS imagen_compartida"
Q "CREATE TABLE imagen_compartida (url VARCHAR(400) PRIMARY KEY, n INT NOT NULL, INDEX idx_n (n)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
Q "INSERT INTO imagen_compartida (url, n)
   SELECT main_image, COUNT(*) FROM (
     SELECT main_image FROM experiencia WHERE is_active=1 AND COALESCE(main_image,'')<>''
     UNION ALL
     SELECT main_image FROM servicio_turistico WHERE is_active=1 AND COALESCE(main_image,'')<>''
   ) t WHERE main_image IS NOT NULL GROUP BY main_image"
echo "   imágenes registradas: $(mariadb -u"$U" -p"$P" -N -B hestiat2 -e 'SELECT COUNT(*) FROM imagen_compartida')"
echo "   usadas por más de 20 fichas (serán las que queden fuera del índice): $(mariadb -u"$U" -p"$P" -N -B hestiat2 -e 'SELECT COUNT(*) FROM imagen_compartida WHERE n > 20')"