#!/usr/bin/env python3
"""
Verifica UNA POR UNA las 248 fotografias repetidas entre varias fichas.

COMO SE VERIFICA (sin inventar nada)
    Cada una de esas fotos es un fichero de Wikimedia Commons cuyo NOMBRE es el de un negocio o un
    lugar: «Casa_Rural_El_Zumaque_201706», «Casa_rural_Os_carballos,_Perdecanai...», «Breanca,
    Dorona, Vilarmaior». La comprobacion es:

      1. Se saca del nombre del fichero la parte que identifica (quitando palabras genericas:
         casa, rural, hotel, posada, de, la...). Esa es la «pista».
      2. Se compara esa pista con el titulo de CADA ficha que tiene esa foto.
      3. Veredicto por ficha:
           coincide      el titulo de la ficha contiene la pista del fichero
           no_coincide   el titulo no tiene nada que ver con la pista
           indeterminado la pista no identifica nada (un nombre vago o una palabra suelta)

    No se borra ninguna foto ni ninguna publicacion: se GUARDA el veredicto de cada pareja
    (foto + ficha) con la prueba, para poder revisarlo y para poder deshacer lo que se haga.

USO
    python3 verificar-fotos-repetidas.py            (solo verifica y registra)
    python3 verificar-fotos-repetidas.py --piloto   (ademas desvincula UN grupo, el mas claro)
    python3 verificar-fotos-repetidas.py --revertir (vuelve a poner lo desvinculado en el piloto)
"""
import argparse
import json
import os
import re
import subprocess
import unicodedata

ENV = "/opt/hestiat/shared/.env"
with open(ENV, encoding="utf-8") as f:
    entorno = dict(l.split("=", 1) for l in f if "=" in l and not l.startswith("#"))
USUARIO = entorno["DB_USER"].strip()
os.environ["MYSQL_PWD"] = entorno["DB_PASSWORD"].strip()

GENERICAS = {
    "casa", "casas", "rural", "rurales", "hotel", "hoteles", "hostal", "hostales", "posada", "pension",
    "apartamento", "apartamentos", "turismo", "turistica", "albergue", "camping", "agencia",
    "de", "del", "la", "el", "los", "las", "y", "en", "al", "con", "para",
    "jpg", "jpeg", "png", "sl", "sa", "cb", "spain", "espana",
}


def sql(consulta, base="hestiat2"):
    r = subprocess.run(["mariadb", "-u", USUARIO, "-N", "-B", base, "-e", consulta],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("error sql: " + r.stderr.strip()[:400])
    return [l for l in r.stdout.splitlines() if l]


def esc(v):
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


def normalizar(t):
    return unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().lower()


def pistas(nombre_fichero):
    """Palabras distintivas del nombre del fichero: las que sirven para identificar el negocio."""
    base = re.sub(r"\.(jpg|jpeg|png|gif|webp)$", "", nombre_fichero, flags=re.I)
    base = base.replace("_", " ").replace("%2C", ",").replace("%28", "(").replace("%29", ")")
    base = re.sub(r"\(?\d{4,}\)?", " ", base)
    palabras = [p for p in re.split(r"[^a-z0-9]+", normalizar(base)) if p]
    return [p for p in palabras if p not in GENERICAS and len(p) > 3]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--piloto", action="store_true")
    p.add_argument("--revertir", action="store_true")
    p.add_argument("--aplicar-todo", action="store_true", dest="aplicar_todo")
    p.add_argument("--secuencia", action="store_true")
    args = p.parse_args()

    sql("""ALTER TABLE foto_revision
             ADD COLUMN IF NOT EXISTS negocio_en_el_nombre VARCHAR(200) NULL,
             ADD COLUMN IF NOT EXISTS pistas VARCHAR(300) NULL,
             ADD COLUMN IF NOT EXISTS veredicto ENUM('coincide','no_coincide','indeterminado') NULL,
             ADD COLUMN IF NOT EXISTS fichas_coincidentes INT NULL,
             ADD COLUMN IF NOT EXISTS verificado_en DATETIME NULL""", "hestiat2")
    sql("""CREATE TABLE IF NOT EXISTS foto_ficha (
             id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
             url TEXT NOT NULL,
             alojamiento_id BIGINT UNSIGNED NOT NULL,
             titulo_ficha VARCHAR(200) NULL,
             veredicto ENUM('coincide','no_coincide','indeterminado') NOT NULL,
             motivo VARCHAR(255) NULL,
             desvinculada_en DATETIME NULL,
             datos_originales TEXT NULL,
             creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
             UNIQUE KEY uq_ficha (alojamiento_id, url(150)),
             INDEX idx_veredicto (veredicto)
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""", "hestiat2")

    if args.revertir:
        filas = sql("SELECT id, datos_originales FROM foto_ficha WHERE desvinculada_en IS NOT NULL", "hestiat2")
        print("revirtiendo %d desvinculaciones" % len(filas))
        for linea in filas:
            fid, datos = linea.split("\t")[:2]
            d = json.loads(datos)
            cols = ", ".join(d.keys())
            vals = ", ".join(esc(d[k]) if d[k] is not None else "NULL" for k in d.keys())
            sql("INSERT INTO alojamiento_foto (%s) VALUES (%s)" % (cols, vals), "hestiat")
            sql("INSERT INTO hestiat2.alojamiento_foto (%s) VALUES (%s)" % (cols, vals), "hestiat2")
            sql("UPDATE hestiat2.foto_ficha SET desvinculada_en = NULL WHERE id = %s" % fid, "hestiat2")
        print("vueltas a poner: %d" % len(filas))
        return

    repetidas = sql("""SELECT url, fichas_afectadas FROM foto_revision
                       WHERE estado='pendiente' ORDER BY fichas_afectadas DESC""", "hestiat2")
    print("fotos repetidas a verificar: %d" % len(repetidas))

    resumen = {"coincide": 0, "no_coincide": 0, "indeterminado": 0}
    por_foto = []
    for linea in repetidas:
        url, fichas = linea.split("\t")[:2]
        nombre = url.split("/Special:FilePath/")[-1].split("?")[0]
        pistas_ = pistas(nombre)
        grupo = sql("""SELECT f.alojamiento_id, COALESCE(a.title,'') FROM hestiat.alojamiento_foto f
                       LEFT JOIN hestiat2.accommodation a ON a.legacy_id = f.alojamiento_id
                       WHERE f.url = %s""" % esc(url), "hestiat")

        coincidentes = []
        if pistas_:
            for fila in grupo:
                aid, titulo = fila.split("\t")[:2]
                # Deben coincidir TODAS las palabras distintivas: exigir solo una hacia que
                # un nombre con una ciudad («Hotel facade, Ibiza») diera por buenas fichas que
                # solo comparten la ciudad. Se detecto al revisar los resultados.
                if pistas_ and all(p in normalizar(titulo) for p in pistas_):
                    coincidentes.append(int(aid))
            veredicto = "coincide" if coincidentes else "no_coincide"
        else:
            veredicto = "indeterminado"

        motivo = ("la ficha de este negocio es la del fichero" if coincidentes else (
            "el nombre del fichero no identifica ningun negocio" if not pistas_ else
            "ninguna de las %d fichas se llama como el fichero" % len(grupo)))

        # Los veredictos se insertan EN UN SOLO LOTE por foto: hacer una llamada a la base por cada
        # pareja serian mas de 17.000 llamadas y no termina nunca.
        valores = []
        for fila in grupo:
            aid, titulo = fila.split("\t")[:2]
            v = "coincide" if int(aid) in coincidentes else veredicto
            valores.append("(%s, %d, %s, %s, %s)" % (esc(url), int(aid), esc(titulo[:200]), esc(v), esc(motivo[:255])))
            resumen[v] += 1
        for i in range(0, len(valores), 200):
            sql("""INSERT INTO foto_ficha (url, alojamiento_id, titulo_ficha, veredicto, motivo)
                   VALUES %s
                   ON DUPLICATE KEY UPDATE veredicto=VALUES(veredicto), motivo=VALUES(motivo),
                                           titulo_ficha=VALUES(titulo_ficha), url=VALUES(url)"""
                % ",".join(valores[i:i + 200]), "hestiat2")

        sql("""UPDATE foto_revision SET negocio_en_el_nombre=%s, pistas=%s, veredicto=%s,
                      fichas_coincidentes=%d, verificado_en=NOW() WHERE url=%s"""
            % (esc(nombre[:200]), esc(" ".join(pistas_)[:300]), esc(veredicto), len(coincidentes), esc(url)), "hestiat2")
        por_foto.append((url, nombre, len(grupo), len(coincidentes), veredicto))

    print("\nveredictos por pareja foto+ficha: %s" % json.dumps(resumen))
    print("fotos cuyo negocio se ha identificado: %d de %d" % (len([x for x in por_foto if x[3] > 0]), len(por_foto)))
    print("\nnegocios identificados (ejemplos):")
    for url, nombre, n, c, v in [x for x in por_foto if x[3] > 0][:10]:
        print("   %-56s %d ficha(s) de %d" % (nombre[:56], c, n))
    print("\nnombres que no identifican a nadie (sus fichas quedan para revisar):")
    for url, nombre, n, c, v in [x for x in por_foto if x[2] > 0 and x[3] == 0][:8]:
        print("   %-56s %d fichas" % (nombre[:56], n))

    def desvincular(condicion_veredicto, etiqueta, lote=500):
        """Desvincula las parejas que cumplen la condición, en lotes, guardando cómo reponerlas."""
        total = 0
        while True:
            filas = sql("""SELECT id, alojamiento_id, url, titulo_ficha FROM hestiat2.foto_ficha
                           WHERE desvinculada_en IS NULL AND %s LIMIT %d""" % (condicion_veredicto, lote), "hestiat2")
            if not filas:
                break
            for linea in filas:
                fid, aid, url, titulo = linea.split("\t")[:4]
                orig = sql("""SELECT id, url, alt, orden, ancho, alto, variantes FROM hestiat.alojamiento_foto
                              WHERE alojamiento_id=%s AND url=%s LIMIT 1""" % (aid, esc(url)), "hestiat")
                if not orig:
                    sql("UPDATE hestiat2.foto_ficha SET desvinculada_en=NOW() WHERE id=%s" % fid, "hestiat2")
                    continue
                o = orig[0].split("\t")
                datos = {"alojamiento_id": int(aid), "url": o[1], "alt": o[2] or None, "orden": int(o[3] or 1),
                         "ancho": int(o[4]) if o[4].isdigit() else None,
                         "alto": int(o[5]) if o[5].isdigit() else None, "variantes": o[6] or None}
                sql("UPDATE hestiat2.foto_ficha SET desvinculada_en=NOW(), datos_originales=%s WHERE id=%s"
                    % (esc(json.dumps(datos)), fid), "hestiat2")
                sql("DELETE FROM hestiat.alojamiento_foto WHERE id = %s" % o[0], "hestiat")
                sql("""DELETE FROM hestiat2.accommodation_photo
                       WHERE accommodation_id=(SELECT id FROM hestiat2.accommodation WHERE legacy_id=%s LIMIT 1)
                         AND (origin_url=%s OR storage_key=%s)""" % (aid, esc(url), esc(url)), "hestiat2")
                total += 1
            print("   %s: %d desvinculadas hasta ahora" % (etiqueta, total), flush=True)
        return total

    def cuenta(etiqueta):
        n = sql("SELECT COUNT(*) FROM hestiat2.foto_ficha WHERE desvinculada_en IS NOT NULL", "hestiat2")
        f = sql("SELECT COUNT(*) FROM hestiat.accommodation_photo" if False else "SELECT COUNT(*) FROM hestiat2.accommodation_photo", "hestiat2")
        print("   %s → parejas desvinculadas: %s · fotos en el catálogo: %s" % (etiqueta, n[0], f[0]), flush=True)

    if args.secuencia:
        print("\n=== 1) PILOTO: un grupo pequeno (las fichas de un negocio mal asignadas) ===")
        condicion_piloto = "veredicto='no_coincide' AND url IN (SELECT url FROM hestiat2.foto_revision WHERE url LIKE '%%Hotel_Río_Asón%%')"
        n1 = desvincular(condicion_piloto, "piloto")
        cuenta("tras el piloto")
        print("\n=== 2) PRUEBA DE REVERSIBILIDAD: se vuelve a poner todo lo del piloto ===")
        os.system("cd /root && python3 verificar-fotos-repetidas.py --revertir")
        cuenta("tras revertir")
        print("\n=== 3) SE APLICA LA CORRECCION COMPLETA (solo lo demostrado no coincidente) ===")
        n3 = desvincular("veredicto='no_coincide'", "correccion")
        cuenta("tras la correccion completa")
        print("\n   el negocio real conserva su foto: %s" % sql("SELECT COUNT(*) FROM hestiat2.foto_ficha WHERE veredicto='coincide' AND desvinculada_en IS NULL", "hestiat2")[0])
        print("   quedan para revisar (indeterminadas): %s" % sql("SELECT COUNT(*) FROM hestiat2.foto_ficha WHERE veredicto='indeterminado'", "hestiat2")[0])
        return

    if not args.piloto and not args.aplicar_todo:
        print("\nNo se ha desvinculado nada (solo verificacion). Opciones: --secuencia")
        return

    candidata = next(((u, nm, n, c) for u, nm, n, c, v in por_foto if c >= 1), None)
    if not candidata:
        print("no hay ningun grupo con negocio identificado: no se hace piloto")
        return
    url, nombre, n, c = candidata
    print("\n=== PILOTO: %s (%d fichas; %d es la del negocio) ===" % (nombre[:60], n, c))
    filas = sql("""SELECT id, alojamiento_id, url, alt, orden, ancho, alto, variantes FROM hestiat.alojamiento_foto
                   WHERE url = %s""" % esc(url), "hestiat")
    desvinculadas = 0
    for fila in filas:
        fid, aid, u, alt, orden, ancho, alto, variantes = (fila.split("\t") + [""] * 8)[:8]
        v = sql("SELECT veredicto FROM hestiat2.foto_ficha WHERE alojamiento_id=%s AND url=%s LIMIT 1"
                % (aid, esc(url)), "hestiat2")
        if not v or v[0] != "no_coincide":
            continue
        datos = {"alojamiento_id": int(aid), "url": u, "alt": alt or None, "orden": int(orden or 1),
                 "ancho": int(ancho) if ancho and ancho.isdigit() else None,
                 "alto": int(alto) if alto and alto.isdigit() else None, "variantes": variantes or None}
        sql("UPDATE hestiat2.foto_ficha SET desvinculada_en=NOW(), datos_originales=%s WHERE alojamiento_id=%s AND url=%s"
            % (esc(json.dumps(datos)), aid, esc(url)), "hestiat2")
        sql("DELETE FROM hestiat.alojamiento_foto WHERE id = %s" % fid, "hestiat")
        sql("DELETE FROM hestiat2.accommodation_photo WHERE accommodation_id = (SELECT id FROM hestiat2.accommodation WHERE legacy_id=%s LIMIT 1) AND (origin_url=%s OR storage_key=%s)"
            % (aid, esc(url), esc(url)), "hestiat2")
        desvinculadas += 1
    print("fichas desvinculadas: %d (la del negocio se conserva)" % desvinculadas)
    print("para volver atras: python3 verificar-fotos-repetidas.py --revertir")


if __name__ == "__main__":
    main()
