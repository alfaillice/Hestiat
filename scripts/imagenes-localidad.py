#!/usr/bin/env python3
"""
IMAGEN DE REFERENCIA POR LOCALIDAD

Para las 17.270 fichas sin foto propia, cada alojamiento muestra la imagen de referencia de SU
LOCALIDAD, sacada del articulo de la Wikipedia en espanol del municipio. Se guarda con su
procedencia (el articulo del que sale) para que siempre se pueda comprobar de donde viene.

NO se inventa ninguna imagen: o hay un articulo con imagen, o no hay imagen y queda el hueco suave.

FILTRO: se descartan los escudos, banderas, sellos y mapas (que son lo que Wikipedia devuelve muchas
veces como imagen principal de un municipio) y los ficheros SVG. Una foto de referencia que fuera un
escudo seria peor que no poner nada.

USO
    python3 imagenes-localidad.py --contar     (solo dice a cuantas localidades afecta)
    python3 imagenes-localidad.py              (consulta y guarda)
"""
import argparse
import json
import os
import subprocess
import time
import unicodedata
import urllib.parse
import urllib.request

ENV = "/opt/hestiat/shared/.env"
with open(ENV, encoding="utf-8") as f:
    entorno = dict(l.split("=", 1) for l in f if "=" in l and not l.startswith("#"))
USUARIO = entorno["DB_USER"].strip()
os.environ["MYSQL_PWD"] = entorno["DB_PASSWORD"].strip()
UA = "Hestiat/1.0 (https://hestiat.com; hola@hestiat.com) imagen de referencia de municipios"
API = "https://es.wikipedia.org/w/api.php"

NO_FOTO = ["escudo", "coat", "bandera", "flag", "shield", "seal", "sellos", "mapa", "map", "locator",
           "ubicacion", "ubicación", "distrito", "provincia de", "blason", "blasón", "logo", "sello"]


def sql(consulta, base="hestiat2"):
    r = subprocess.run(["mariadb", "-u", USUARIO, "-N", "-B", base, "-e", consulta],
                       capture_output=True, text=True)
    if r.returncode != 0 and "already exists" not in r.stderr:
        raise SystemExit("error sql: " + r.stderr.strip()[:300])
    return [l for l in r.stdout.splitlines() if l]


def esc(v):
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


def normalizar(t):
    t = unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return " ".join(t.split())


def es_foto(url, nombre_fichero):
    if not url or url.lower().endswith(".svg"):
        return False
    bajo = normalizar(nombre_fichero)
    return not any(p in bajo for p in NO_FOTO)


def consultar(titulos):
    """Imagen principal de una lista de articulos (maximo 50 por llamada)."""
    salida = {}
    for i in range(0, len(titulos), 50):
        lote = titulos[i:i + 50]
        params = {
            "action": "query", "format": "json", "prop": "pageimages",
            "piprop": "thumbnail|original|name", "pithumbsize": "960",
            "redirects": "1", "titles": "|".join(lote),
        }
        url = API + "?" + urllib.parse.urlencode(params)
        datos = {}
        for intento in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=45) as r:
                    datos = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:
                if intento == 2:
                    print("   aviso: fallo consultando %d titulos: %s" % (len(lote), str(e)[:80]), flush=True)
                else:
                    time.sleep(3 * (intento + 1))
        # Los redireccionamientos se resuelven: se mapea el titulo pedido al titulo real.
        equivalencias = {}
        for red in datos.get("query", {}).get("redirects", []) or []:
            equivalencias[normalizar(red.get("from", ""))] = red.get("to", "")
        for pagina in (datos.get("query", {}).get("pages", {}) or {}).values():
            titulo = pagina.get("title", "")
            fichero = pagina.get("pageimage", "")
            fuente = pagina.get("thumbnail", {}).get("source") or pagina.get("original", {}).get("source")
            datos_foto = {"titulo": titulo, "url": fuente if es_foto(fuente, fichero) else None,
                          "fichero": fichero,
                          "articulo": "https://es.wikipedia.org/wiki/" + urllib.parse.quote(titulo.replace(" ", "_"))}
            salida[normalizar(titulo)] = datos_foto
            for pedido, real in equivalencias.items():
                if normalizar(real) == normalizar(titulo):
                    salida[pedido] = datos_foto
        time.sleep(0.4)
    return salida


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--contar", action="store_true")
    args = p.parse_args()

    sql("""CREATE TABLE IF NOT EXISTS localidad_imagen (
             id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
             clave VARCHAR(180) NOT NULL,
             tipo ENUM('ciudad','provincia') NOT NULL,
             nombre VARCHAR(180) NOT NULL,
             url TEXT NULL,
             fuente TEXT NULL,
             fichero VARCHAR(255) NULL,
             obtenida_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
             UNIQUE KEY uq_localidad (tipo, clave)
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""")

    ciudades = sql("""SELECT city, province, COUNT(*) FROM accommodation a
                      WHERE a.status='published' AND city IS NOT NULL AND city<>''
                        AND NOT EXISTS (SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id)
                      GROUP BY city, province ORDER BY COUNT(*) DESC""")
    provincias = sorted({l.split("\t")[1] for l in ciudades if l.split("\t")[1]})
    print("localidades a consultar: %d · provincias: %d" % (len(ciudades), len(provincias)))
    if args.contar:
        return

    ya = {l.split("\t")[0] + "|" + l.split("\t")[1] for l in sql("SELECT tipo, clave FROM localidad_imagen")}
    pendientes_ciudad = [c for c, pr, n in (l.split("\t")[:3] for l in ciudades) if "ciudad|" + normalizar(c) not in ya]
    print("ciudades por consultar: %d (ya guardadas: %d)" % (len(pendientes_ciudad), len(ya)))

    datos_ciudad = consultar(pendientes_ciudad)
    con_foto = 0
    sin_foto = 0
    for linea in ciudades:
        ciudad, provincia, n = linea.split("\t")[:3]
        d = datos_ciudad.get(normalizar(ciudad))
        if not d:
            continue
        if d["url"]:
            con_foto += 1
        else:
            sin_foto += 1
        sql("""INSERT INTO localidad_imagen (clave, tipo, nombre, url, fuente, fichero)
               VALUES (%s,'ciudad',%s,%s,%s,%s)
               ON DUPLICATE KEY UPDATE url=VALUES(url), fuente=VALUES(fuente), fichero=VALUES(fichero)"""
            % (esc(normalizar(ciudad)), esc(ciudad[:180]), esc(d["url"]) if d["url"] else "NULL",
               esc(d["articulo"]), esc(d["fichero"][:255])), "hestiat2")
    print("ciudades con imagen de referencia: %d · descartadas (escudo, bandera, mapa o sin imagen): %d" % (con_foto, sin_foto))

    pendientes_prov = [pr for pr in provincias if "provincia|" + normalizar(pr) not in ya]
    datos_prov = consultar(pendientes_prov)
    con_prov = 0
    for provincia in provincias:
        d = datos_prov.get(normalizar(provincia.split("/")[0]))
        if not d or not d["url"]:
            continue
        sql("""INSERT INTO localidad_imagen (clave, tipo, nombre, url, fuente, fichero)
               VALUES (%s,'provincia',%s,%s,%s,%s)
               ON DUPLICATE KEY UPDATE url=VALUES(url), fuente=VALUES(fuente), fichero=VALUES(fichero)"""
            % (esc(normalizar(provincia)), esc(provincia[:180]), esc(d["url"]), esc(d["articulo"]), esc(d["fichero"][:255])), "hestiat2")
        con_prov += 1
    print("provincias con imagen de referencia: %d de %d" % (con_prov, len(provincias)))

    resumen = sql("""SELECT CONCAT(tipo, ': ', COUNT(*), ' guardadas · ', SUM(url IS NOT NULL), ' con imagen')
                     FROM localidad_imagen GROUP BY tipo""")
    for r in resumen:
        print("   " + r)
    cobertura = sql("""SELECT CONCAT('fichas sin foto que podrian mostrar imagen de su ciudad: ',
                        SUM(li.url IS NOT NULL), ' de ', COUNT(*))
                       FROM accommodation a
                       LEFT JOIN localidad_imagen li ON li.tipo='ciudad' AND li.clave=LOWER(a.city)
                      WHERE a.status='published' AND NOT EXISTS (SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id)""")
    print("   " + (cobertura[0] if cobertura else ""))


if __name__ == "__main__":
    main()
