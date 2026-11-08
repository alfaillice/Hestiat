DROP TABLE IF EXISTS imagen_compartida;
CREATE TABLE imagen_compartida (
  url VARCHAR(400) PRIMARY KEY,
  n INT NOT NULL,
  INDEX idx_n (n)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO imagen_compartida (url, n)
  SELECT main_image, COUNT(*) FROM (
    SELECT CAST(main_image AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_general_ci AS main_image
      FROM experiencia WHERE is_active = 1 AND COALESCE(main_image, '') <> ''
    UNION ALL
    SELECT CAST(main_image AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_general_ci
      FROM servicio_turistico WHERE is_active = 1 AND COALESCE(main_image, '') <> ''
  ) t WHERE main_image IS NOT NULL GROUP BY main_image;

SELECT CONCAT('imágenes registradas: ', COUNT(*)) FROM imagen_compartida;
SELECT CONCAT('usadas por más de 20 fichas: ', COUNT(*)) FROM imagen_compartida WHERE n > 20;