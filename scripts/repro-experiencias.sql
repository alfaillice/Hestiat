-- Réplica exacta de la consulta que usa el sitemap de experiencias, para ver el error.
SELECT COUNT(*) AS n
  FROM experiencia
 WHERE is_active = 1 AND COALESCE(slug, '') <> ''
   AND latitude IS NOT NULL AND COALESCE(main_image, '') <> ''
   AND CHAR_LENGTH(COALESCE(short_description, description, '')) >= 120
   AND NOT EXISTS (SELECT 1 FROM imagen_compartida i WHERE i.url = experiencia.main_image AND i.n > 20);

SELECT slug
  FROM experiencia
 WHERE is_active = 1 AND COALESCE(slug, '') <> ''
   AND latitude IS NOT NULL AND COALESCE(main_image, '') <> ''
   AND CHAR_LENGTH(COALESCE(short_description, description, '')) >= 120
   AND NOT EXISTS (SELECT 1 FROM imagen_compartida i WHERE i.url = experiencia.main_image AND i.n > 20)
 ORDER BY id ASC LIMIT 10;