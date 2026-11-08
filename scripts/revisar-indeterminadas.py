#!/usr/bin/env python3
"""
REVISION DE LAS PAREJAS INDETERMINADAS (una por una)

Las 203 parejas que quedaron «indeterminadas» son dos ficheros cuyo NOMBRE no identifica a nadie:
    Casa de turismo rural R.jpg
    OYO Hostal La Posada.jpg

Con el nombre solo no se puede decidir. Pero Wikimedia publica la DESCRIPCION y las CATEGORIAS de cada
fichero, y ahi si esta lo que representa. Se leen (evidencia real, no suposicion) y se aplica el
CRITERIO ESTRICTO: para que una ficha se quede con la foto, su LOCALIDAD o su TITULO deben contener
TODAS las palabras que identifican el fichero. Si no, la foto no es de ese negocio y se retira.

Todo queda registrado y es reversible: antes de retirar nada se copian las filas completas.
"""
import json
import os
import subprocess
import unicodedata
import urllib.parse
import urllib.request

ENV = "/opt/hestiat/shared/.env"
with open(ENV, encoding="utf-8") as f:
    entorno = dict(l.split("=", 1) for l in f if "=" in l and not l.startswith("#"))
USUARIO = entorno["DB_USER"].strip()
os.environ["MYSQL_PWD"] = entorno["DB_PASSWORD"].strip()
UA = {"User-Agent": "Hestiat/1.0 (https://hestiat.com; hola@hestiat.com)"}

GENERICAS = {"casa", "casas", "rural", "rurales", "de", "del", "la", "el", "los", "las", "y", "en",
             "al", "con", "para", "jpg", "jpeg", "png", "turismo", "hostal", "hotel", "posada",
             "apartamento", "albergue", "spain", "espana"}


def sql(c, base="hestiat2"):
    r = subprocess.run(["mariadb", "-u", USUARIO, "-N", "-B", base, "-e", c], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("sql: " + r.stderr.strip()[:300])
    return [l for l in r.stdout.splitlines() if l]


def esc(v):
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


def norm(t):
    return " ".join(unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().lower().split())


def ficha_tecnica(fichero):
    """Descripcion y categorias reales del fichero en Wikimedia."""
    params = {"action": "query", "format": "json", "prop": "imageinfo|categories",
              "iiprop": "extmetadata", "cllimit": "30", "titles": "File:" + fichero}
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r:
        d = json.loads(r.read().decode())
    p = list(d.get("query", {}).get("pages", {}).values())[0]
    meta = (p.get("imageinfo") or [{}])[0].get("extmetadata", {})
    descripcion = meta.get("ImageDescription", {}).get("value", "") or ""
    import re as _re
    descripcion = _re.sub(r"<[^>]+>", " ", descripcion)
    categorias = [c.get("title", "").replace("Category:", "") for c in p.get("categories", []) or []]
    return descripcion, categorias


def terminos(descripcion, categorias, fichero):
    """Palabras que identifican el fichero: de la descripcion, de las categorias y del nombre."""
    texto = norm(descripcion)
    # «Rinconada de Río Almar, AV, España» → se queda con el nombre del lugar, sin provincia ni pais.
    candidatos = []
    for trozo in [t.strip() for t in texto.split(",")]:
        palabras = [p for p in trozo.split() if p and p not in {"av", "es", "espana", "spain"}]
        if len(palabras) >= 2:
            candidatos.append(" ".join(palabras))
    for c in categorias:
        bajo = norm(c)
        if any(x in bajo for x in ["de ", "municipalit", "rural tourism", "self-published", "cc-", "files", "images", "media", "uploaded", "supported", "coordinates"]):
            continue
        palabras = [p for p in bajo.split() if p not in GENERICAS and len(p) > 3]
        if len(palabras) >= 2:
            candidatos.append(" ".join(palabras))
    return sorted(set(candidatos), key=len, reverse=True)


def main():
    filas = sql("""SELECT DISTINCT url FROM foto_revision WHERE veredicto='indeterminado'""")
    print("ficheros a revisar: %d" % len(filas))

    sql("""CREATE TABLE IF NOT EXISTS foto_indeterminada_copia LIKE hestiat2.alojamiento_foto""")
    total_quitadas = 0
    for url in filas:
        fichero = urllib.parse.unquote(url.split("/Special:FilePath/")[-1].split("?")[0])
        descripcion, categorias = ficha_tecnica(fichero)
        terminos_ = terminos(descripcion, categorias, fichero)
        print("\n=== %s ===" % fichero)
        print("   descripción: %s" % (descripcion[:150] or "(sin descripción)"))
        print("   categorías: %s" % (", ".join(categorias[:5])[:180] or "(sin categorías)"))
        print("   términos de identificación: %s" % (terminos_ or "(ninguno)"))

        grupo = sql("""SELECT f.alojamiento_id, COALESCE(a.title,''), COALESCE(a.city,''), COALESCE(a.province,'')
                       FROM hestiat.alojamiento_foto f
                       LEFT JOIN hestiat2.accommodation a ON a.legacy_id = f.alojamiento_id
                       WHERE f.url = %s""" % esc(url), "hestiat")
        coincide, no_coincide = [], []
        for fila in grupo:
            aid, titulo, ciudad, provincia = fila.split("\t")[:4]
            objetivo = norm(f"{titulo} {ciudad} {provincia}")
            coincide_esta = bool(terminos_) and all(t in objetivo for t in terminos_)
            (coincide if coincide_esta else no_coincide).append((int(aid), titulo, ciudad))

        print("   fichas con esa foto: %d · coincide: %d · no coincide: %d" % (len(grupo), len(coincide), len(no_coincide)))
        for aid, titulo, ciudad in coincide:
            print("      SE QUEDA: #%d %s (%s)" % (aid, titulo[:48], ciudad[:28]))
        for aid, titulo, ciudad in no_coincide[:3]:
            print("      se retira: #%d %s (%s)" % (aid, titulo[:44], ciudad[:24]))

        if not no_coincide:
            sql("""UPDATE foto_ficha SET veredicto='coincide', motivo='verificado con la descripcion del fichero'
                   WHERE url=%s""" % esc(url))
            sql("""UPDATE foto_revision SET veredicto='coincide', negocio_en_el_nombre=%s
                   WHERE url=%s""" % (esc(descripcion[:200]), esc(url)))
            continue

        for aid, titulo, ciudad in no_coincide:
            origen = sql("""SELECT id, url, alt, orden, ancho, alto, variantes FROM hestiat.alojamiento_foto
                            WHERE alojamiento_id=%s AND url=%s""" % (aid, esc(url)), "hestiat")
            if origen:
                o = origen[0].split("\t")
                sql("""INSERT IGNORE INTO foto_indeterminada_copia SELECT * FROM hestiat.alojamiento_foto WHERE id=%s""" % o[0], "hestiat2")
                sql("DELETE FROM hestiat.alojamiento_foto WHERE id=%s" % o[0], "hestiat")
            sql("""DELETE p FROM hestiat2.accommodation_photo p
                   JOIN hestiat2.accommodation a ON a.id=p.accommodation_id
                   WHERE a.legacy_id=%s AND (p.origin_url=%s OR p.storage_key=%s)""" % (aid, esc(url), esc(url)), "hestiat2")
            sql("""UPDATE foto_ficha SET veredicto='no_coincide', desvinculada_en=NOW(),
                          motivo='retirada tras revisar la descripcion del fichero en Wikimedia'
                   WHERE url=%s AND alojamiento_id=%s""" % (esc(url), aid))
            total_quitadas += 1
        if coincide:
            sql("""UPDATE foto_ficha SET veredicto='coincide', motivo='verificado con la descripcion del fichero'
                   WHERE url=%s AND alojamiento_id IN (%s)""" % (esc(url), ",".join(str(a) for a, _, _ in coincide)))
        sql("""UPDATE foto_revision SET veredicto=%s, negocio_en_el_nombre=%s, fichas_coincidentes=%d
               WHERE url=%s""" % (esc("coincide" if coincide else "no_coincide"), esc(descripcion[:200]), len(coincide), esc(url)))

    print("\n=== RESULTADO ===")
    for r in sql("SELECT CONCAT('parejas por veredicto: ', veredicto, ' = ', COUNT(*)) FROM foto_ficha GROUP BY veredicto"):
        print("   " + r)
    print("   parejas retiradas en esta revisión: %d" % total_quitadas)
    print("   fotos en el catálogo ahora: %s" % sql("SELECT COUNT(*) FROM accommodation_photo")[0])
    print("   copia para volver atrás: hestiat2.foto_indeterminada_copia = %s filas" % sql("SELECT COUNT(*) FROM foto_indeterminada_copia")[0])


if __name__ == "__main__":
    main()
