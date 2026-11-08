#!/usr/bin/env python3
"""
SEGUNDA PASADA: una FOTO del articulo, no solo su imagen principal.

La imagen principal de un municipio en Wikipedia es muchas veces el escudo o un mapa. En la primera
pasada se descartaron 3.451 localidades por eso. Aqui, para esas, se mira la LISTA DE IMAGENES del
articulo y se toma la primera que parezca una fotografia (misma filtro: ni escudos, ni banderas, ni
mapas, ni logotipos, ni SVG). La direccion se construye con Special:FilePath, el mismo mecanismo que
ya usa el catalogo, y se guarda el articulo de procedencia.
"""
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
NO_FOTO = ["escudo", "coat", "bandera", "flag", "shield", "seal", "sello", "mapa", "map", "locator",
           "ubicacion", "ubicación", "blason", "blasón", "logo", "icono", "icon", "categoria",
           "commons-logo", "wiki", "edit", "ambox", "question", "padlock", "star", "gnome"]


def sql(consulta, base="hestiat2"):
    r = subprocess.run(["mariadb", "-u", USUARIO, "-N", "-B", base, "-e", consulta], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("error sql: " + r.stderr.strip()[:300])
    return [l for l in r.stdout.splitlines() if l]


def esc(v):
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


def normalizar(t):
    return " ".join(unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().lower().split())


def sirve(nombre_fichero):
    bajo = normalizar(nombre_fichero).replace("file:", "")
    if not bajo or bajo.endswith(".svg"):
        return False
    return not any(p in bajo for p in NO_FOTO)


def fotos_de(titulos):
    """Primera imagen que parece una foto, por articulo."""
    salida = {}
    for i in range(0, len(titulos), 40):
        lote = titulos[i:i + 40]
        params = {"action": "query", "format": "json", "prop": "images", "imlimit": "20",
                  "redirects": "1", "titles": "|".join(lote)}
        datos = {}
        for intento in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA}), timeout=45) as r:
                    datos = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:
                if intento == 2:
                    print("   aviso: %s" % str(e)[:80], flush=True)
                else:
                    time.sleep(3 * (intento + 1))
        eq = {normalizar(r.get("from", "")): r.get("to", "") for r in (datos.get("query", {}).get("redirects", []) or [])}
        for pagina in (datos.get("query", {}).get("pages", {}) or {}).values():
            titulo = pagina.get("title", "")
            elegido = None
            for img in pagina.get("images", []) or []:
                if sirve(img.get("title", "")):
                    elegido = img.get("title", "")[len("File:"):]
                    break
            v = {"titulo": titulo, "fichero": elegido,
                 "url": ("https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(elegido) + "?width=960") if elegido else None,
                 "articulo": "https://es.wikipedia.org/wiki/" + urllib.parse.quote(titulo.replace(" ", "_"))}
            salida[normalizar(titulo)] = v
            for pedido, real in eq.items():
                if normalizar(real) == normalizar(titulo):
                    salida[pedido] = v
        time.sleep(0.4)
    return salida


def main():
    pendientes = sql("SELECT tipo, clave, nombre FROM localidad_imagen WHERE url IS NULL ORDER BY tipo, clave")
    print("localidades sin imagen tras la primera pasada: %d" % len(pendientes))
    if not pendientes:
        return
    nombres = sorted({l.split("\t")[2] for l in pendientes})
    print("articulos a consultar: %d" % len(nombres))
    datos = fotos_de(nombres)
    encontradas = 0
    for linea in pendientes:
        tipo, clave, nombre = linea.split("\t")[:3]
        d = datos.get(normalizar(nombre))
        if not d or not d["url"]:
            continue
        sql("""UPDATE localidad_imagen SET url=%s, fuente=%s, fichero=%s, obtenida_en=NOW()
               WHERE tipo=%s AND clave=%s""" % (esc(d["url"]), esc(d["articulo"]), esc(d["fichero"][:255]), esc(tipo), esc(clave)), "hestiat2")
        encontradas += 1
    print("encontradas en la segunda pasada: %d" % encontradas)
    for r in sql("SELECT CONCAT(tipo, ': ', COUNT(*), ' guardadas · ', SUM(url IS NOT NULL), ' con imagen') FROM localidad_imagen GROUP BY tipo"):
        print("   " + r)
    for r in sql("""SELECT CONCAT('fichas sin foto con imagen de su ciudad: ', SUM(li.url IS NOT NULL), ' de ', COUNT(*))
                    FROM accommodation a
                    LEFT JOIN localidad_imagen li ON li.tipo='ciudad' AND li.clave=LOWER(a.city)
                   WHERE a.status='published' AND NOT EXISTS (SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id)"""):
        print("   " + r)
    for r in sql("SELECT CONCAT('con imagen de su provincia (respaldo): ', COUNT(*)) FROM accommodation a JOIN localidad_imagen lp ON lp.tipo='provincia' AND lp.clave=LOWER(a.province) AND lp.url IS NOT NULL WHERE a.status='published' AND NOT EXISTS (SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id)"):
        print("   " + r)


if __name__ == "__main__":
    main()
