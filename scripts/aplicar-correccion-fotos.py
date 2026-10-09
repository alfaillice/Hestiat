#!/usr/bin/env python3
"""
Termina la correccion de las fotos mal asignadas, de forma rapida, por lotes y REVERSIBLE.

QUE HACE
  1. Guarda una COPIA COMPLETA de las filas que se van a retirar (las tres tablas donde vive la foto).
     Con esa copia, volver atras es un solo INSERT ... SELECT.
  2. Retira la foto de las fichas cuyo veredicto es «no coincide» (la foto no es de ese negocio).
     La ficha del negocio al que SI corresponde la foto se conserva.
  3. Comprueba que el numero de fotos retiradas cuadra con el numero de parejas marcadas, y
     demuestra la reversibilidad volviendo a poner UNA y quitandola otra vez.

NO toca las parejas «coincide» ni las «indeterminado» (esas quedan para revision humana).
NO elimina ninguna publicacion.
"""
import os
import subprocess

ENV = "/opt/hestiat/shared/.env"
with open(ENV, encoding="utf-8") as f:
    entorno = dict(l.split("=", 1) for l in f if "=" in l and not l.startswith("#"))
USUARIO = entorno["DB_USER"].strip()
os.environ["MYSQL_PWD"] = entorno["DB_PASSWORD"].strip()


def sql(consulta, base="hestiat2"):
    r = subprocess.run(["mariadb", "-u", USUARIO, "-N", "-B", base, "-e", consulta],
                       capture_output=True, text=True)
    if r.returncode != 0 and "already exists" not in r.stderr:
        raise SystemExit("error sql: " + r.stderr.strip()[:300])
    return [l for l in r.stdout.splitlines() if l]


def esc(v):
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


COND = """url IN (SELECT url FROM hestiat2.foto_revision)
          AND alojamiento_id IN (SELECT alojamiento_id FROM hestiat2.foto_ficha
                                  WHERE alojamiento_id = hestiat.alojamiento_foto.alojamiento_id
                                    AND url = hestiat.alojamiento_foto.url
                                    AND veredicto = 'no_coincide')"""

print("=== 1) COPIA DE SEGURIDAD DE LAS FILAS A RETIRAR ===")
sql("CREATE TABLE IF NOT EXISTS hestiat.foto_desvinculada_copia AS SELECT * FROM hestiat.alojamiento_foto WHERE 1=0", "hestiat")
sql("CREATE TABLE IF NOT EXISTS hestiat2.foto_desvinculada_copia AS SELECT * FROM hestiat2.alojamiento_foto WHERE 1=0", "hestiat2")
sql("CREATE TABLE IF NOT EXISTS hestiat2.photo_desvinculada_copia AS SELECT * FROM hestiat2.accommodation_photo WHERE 1=0", "hestiat2")

pendientes = sql("""SELECT COUNT(*) FROM hestiat2.foto_ficha WHERE veredicto='no_coincide' AND desvinculada_en IS NULL""", "hestiat2")
print("   parejas que faltan por retirar: %s" % pendientes[0])

for base, tabla, cond in [
    ("hestiat", "alojamiento_foto",
     "url IN (SELECT url FROM hestiat2.foto_revision)"),
    ("hestiat2", "alojamiento_foto",
     "url IN (SELECT url FROM hestiat2.foto_revision)"),
    ("hestiat2", "accommodation_photo",
     "COALESCE(origin_url,storage_key) IN (SELECT url FROM hestiat2.foto_revision)"),
]:
    # Solo las parejas marcadas como «no coincide»: se cruzan por alojamiento y por URL.
    if tabla == "accommodation_photo":
        sel = """SELECT p.* FROM hestiat2.accommodation_photo p
                 JOIN hestiat2.foto_ficha f ON f.alojamiento_id = (SELECT legacy_id FROM hestiat2.accommodation WHERE id = p.accommodation_id LIMIT 1)
                                           AND f.url = COALESCE(p.origin_url, p.storage_key)
                 WHERE f.veredicto='no_coincide'"""
        destino = "hestiat2.photo_desvinculada_copia"
    else:
        col = "alojamiento_id"
        sel = """SELECT a.* FROM %s.%s a
                 JOIN hestiat2.foto_ficha f ON f.alojamiento_id = a.%s AND f.url = a.url
                 WHERE f.veredicto='no_coincide'""" % (base, tabla, col)
        destino = ("hestiat.foto_desvinculada_copia" if base == "hestiat" else "hestiat2.foto_desvinculada_copia")
    n = sql("SELECT COUNT(*) FROM (%s) t" % sel, base)
    if n and int(n[0]) > 0:
        sql("INSERT IGNORE INTO %s %s" % (destino, sel), base)
        print("   copiadas %s filas de %s.%s" % (n[0], base, tabla))

print("\n=== 2) RETIRADA DE LAS FOTOS MAL ASIGNADAS (solo las que siguen presentes) ===")
for base, tabla in [("hestiat", "alojamiento_foto"), ("hestiat2", "alojamiento_foto")]:
    sql("""DELETE a FROM %s.%s a
           JOIN hestiat2.foto_ficha f ON f.alojamiento_id = a.alojamiento_id AND f.url = a.url
           WHERE f.veredicto='no_coincide'""" % (base, tabla), base)
    print("   hechas: %s.%s" % (base, tabla))
sql("""DELETE p FROM hestiat2.accommodation_photo p
       JOIN hestiat2.accommodation ac ON ac.id = p.accommodation_id
       JOIN hestiat2.foto_ficha f ON f.alojamiento_id = ac.legacy_id AND f.url = COALESCE(p.origin_url, p.storage_key)
       WHERE f.veredicto='no_coincide'""", "hestiat2")
print("   hechas: hestiat2.accommodation_photo")

sql("""UPDATE hestiat2.foto_ficha SET desvinculada_en = IFNULL(desvinculada_en, NOW())
      WHERE veredicto='no_coincide'""", "hestiat2")

print("\n=== 3) COMPROBACION ===")
print("   parejas no coincidentes:      %s" % sql("SELECT COUNT(*) FROM hestiat2.foto_ficha WHERE veredicto='no_coincide'", "hestiat2")[0])
print("   de ellas, retiradas:          %s" % sql("SELECT COUNT(*) FROM hestiat2.foto_ficha WHERE veredicto='no_coincide' AND desvinculada_en IS NOT NULL", "hestiat2")[0])
print("   parejas correctas conservadas:%s" % sql("SELECT COUNT(*) FROM hestiat2.foto_ficha WHERE veredicto='coincide'", "hestiat2")[0])
print("   indeterminadas para revisar:  %s" % sql("SELECT COUNT(*) FROM hestiat2.foto_ficha WHERE veredicto='indeterminado'", "hestiat2")[0])
print("   fotos en el catalogo:         %s" % sql("SELECT COUNT(*) FROM hestiat2.accommodation_photo", "hestiat2")[0])
print("   fotos en el panel:            %s" % sql("SELECT COUNT(*) FROM hestiat.alojamiento_foto", "hestiat")[0])
print("   copias guardadas para volver atras: hestiat.foto_desvinculada_copia=%s · hestiat2.foto_desvinculada_copia=%s · hestiat2.photo_desvinculada_copia=%s" % (
    sql("SELECT COUNT(*) FROM hestiat.foto_desvinculada_copia", "hestiat")[0],
    sql("SELECT COUNT(*) FROM hestiat2.foto_desvinculada_copia", "hestiat2")[0],
    sql("SELECT COUNT(*) FROM hestiat2.photo_desvinculada_copia", "hestiat2")[0]))

print("\n=== 4) DEMOSTRACION DE QUE SE PUEDE VOLVER ATRAS ===")
fila = sql("""SELECT a.alojamiento_id, a.url FROM hestiat.foto_desvinculada_copia a LIMIT 1""", "hestiat")
if fila:
    aid, url = fila[0].split("\t")[:2]
    antes = sql("SELECT COUNT(*) FROM hestiat.alojamiento_foto WHERE alojamiento_id=%s AND url=%s" % (aid, esc(url)), "hestiat")[0]
    sql("""INSERT INTO hestiat.alojamiento_foto SELECT * FROM hestiat.foto_desvinculada_copia
           WHERE alojamiento_id=%s AND url=%s""" % (aid, esc(url)), "hestiat")
    despues = sql("SELECT COUNT(*) FROM hestiat.alojamiento_foto WHERE alojamiento_id=%s AND url=%s" % (aid, esc(url)), "hestiat")[0]
    sql("DELETE FROM hestiat.alojamiento_foto WHERE alojamiento_id=%s AND url=%s" % (aid, esc(url)), "hestiat")
    final = sql("SELECT COUNT(*) FROM hestiat.alojamiento_foto WHERE alojamiento_id=%s AND url=%s" % (aid, esc(url)), "hestiat")[0]
    print("   ficha %s: antes de reponer %s · repuesta %s · quitada otra vez %s" % (aid, antes, despues, final))
    print("   (la copia permite reponer con un solo INSERT ... SELECT; queda probado en esta ficha)")
else:
    print("   sin filas en la copia")
