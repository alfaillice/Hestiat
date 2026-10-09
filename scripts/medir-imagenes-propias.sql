-- Cuantas fichas tienen imagen PROPIA y cuantas comparten una imagen de stock.
-- Se cuenta cada imagen UNA vez (agregado) y luego se cruza: nada de subconsultas por fila, que
-- sobre 94.000 filas son cuadraticas y se cuelgan.

SELECT CONCAT('   servicios con imagen propia (hasta 3 fichas): ', COUNT(*))
  FROM servicio_turistico s
  JOIN (SELECT main_image m, COUNT(*) n FROM servicio_turistico
         WHERE COALESCE(main_image,'') <> '' GROUP BY main_image) g ON g.m = s.main_image
 WHERE s.is_active = 1 AND g.n <= 3;

SELECT CONCAT('   experiencias con imagen propia (hasta 3): ', COUNT(*))
  FROM experiencia e
  JOIN (SELECT main_image m, COUNT(*) n FROM experiencia
         WHERE COALESCE(main_image,'') <> '' GROUP BY main_image) g ON g.m = e.main_image
 WHERE e.is_active = 1 AND g.n <= 3;

SELECT CONCAT('   SERVICIOS aptos exigiendo imagen propia: ', COUNT(*))
  FROM servicio_turistico s
  JOIN (SELECT main_image m, COUNT(*) n FROM servicio_turistico
         WHERE COALESCE(main_image,'') <> '' GROUP BY main_image) g ON g.m = s.main_image
 WHERE s.is_active = 1 AND g.n <= 3
   AND CHAR_LENGTH(COALESCE(s.short_description,'')) >= 120
   AND (COALESCE(s.website_url,'') <> '' OR COALESCE(s.phone,'') <> '' OR COALESCE(s.email,'') <> '');

SELECT CONCAT('   EXPERIENCIAS aptas exigiendo imagen propia: ', COUNT(*))
  FROM experiencia e
  JOIN (SELECT main_image m, COUNT(*) n FROM experiencia
         WHERE COALESCE(main_image,'') <> '' GROUP BY main_image) g ON g.m = e.main_image
 WHERE e.is_active = 1 AND g.n <= 3
   AND CHAR_LENGTH(COALESCE(e.short_description, e.description, '')) >= 120
   AND e.latitude IS NOT NULL;
