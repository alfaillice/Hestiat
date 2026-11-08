#!/usr/bin/env python3
"""
Hestiat — convierte las referencias de foto que son PÁGINAS de Wikimedia Commons en
referencias al FICHERO de imagen real, sin cambiar de fotografía.

EL PROBLEMA
    En la base hay 17.612 fotos apuntando a direcciones como
        https://commons.wikimedia.org/wiki/File:Cacabelos_(65961131).jpg
    Eso es una página web, no una imagen: como <img src> no se ve nada y la ficha acaba
    mostrando una imagen de ambientación.

LO QUE HACE
    Para cada una de esas direcciones pregunta a la API de Wikimedia por ESE MISMO fichero
    (mismo nombre de archivo) y obtiene su imagen real (960 px). Comprueba que la respuesta
    de la API es la misma página de la que veníamos: si no coincide, NO la toca y la deja
    marcada para revisión. Nunca inventa ni sustituye por otra fotografía.

GARANTÍAS
    · Guarda la dirección original, la procedencia y el resultado en `foto_url_correccion`.
    · `--revertir` deshace los cambios leyendo ese registro.
    · `--simular` no modifica nada: solo informa de lo que haría.
    · Actualiza las tres tablas que hoy guardan la misma dirección, para que no queden
      descuadradas: hestiat.alojamiento_foto, hestiat2.alojamiento_foto y
      hestiat2.accommodation_photo (esta última es la que lee la ficha pública).

USO
    python3 corregir-fotos-commons.py --simular --limite 20
    python3 corregir-fotos-commons.py --limite 20
    python3 corregir-fotos-commons.py --todos
    python3 corregir-fotos-commons.py --revertir
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ENV = "/opt/hestiat/shared/.env"
API = "https://commons.wikimedia.org/w/api.php"
UA = "Hestiat/1.0 (https://hestiat.com; hola@hestiat.com) contacto para corregir enlaces de fotos"
TABLAS = [
    ("hestiat", "alojamiento_foto", "url"),
    ("hestiat2", "alojamiento_foto", "url"),
    ("hestiat2", "accommodation_photo", "origin_url"),
]
PATRON_PAGINA = re.compile(r"^https?://commons(?:\.m)?\.wikimedia\.org/wiki/File:(.+)$")


def env(clave):
    with open(ENV, encoding="utf-8") as f:
        for linea in f:
            if linea.startswith(clave + "="):
                return linea.split("=", 1)[1].strip()
    raise SystemExit("falta %s en el entorno" % clave)


USUARIO = env("DB_USER")
os.environ["MYSQL_PWD"] = env("DB_PASSWORD")


def sql(consulta, base="hestiat"):
    r = subprocess.run(["mariadb", "-u", USUARIO, "-N", "-B", base, "-e", consulta],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("error de base de datos: " + r.stderr.strip()[:400])
    return [l for l in r.stdout.splitlines() if l]


def esc(v):
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


def api_ficheros(nombres):
    """Pregunta a la API de Commons por esos ficheros exactos. Devuelve {titulo: datos}."""
    salida = {}
    # La API de Commons devuelve los títulos con ESPACIOS aunque se pidan con guiones bajos
    # («File:Hotel_Los_Nogales.jpg» vuelve como «File:Hotel Los Nogales.jpg»). Comparar sin
    # normalizar fue el motivo de que los ficheros parecieran inexistentes: se normalizan los
    # dos lados para que la clave siempre coincida.
    normalizar = lambda t: t.replace(" ", "_")
    for i in range(0, len(nombres), 50):
        lote = nombres[i:i + 50]
        parametros = {
            "action": "query", "format": "json", "prop": "imageinfo",
            "iiprop": "url|size|mime", "iiurlwidth": "960",
            "titles": "|".join("File:" + n for n in lote),
        }
        url = API + "?" + urllib.parse.urlencode(parametros)
        pet = urllib.request.Request(url, headers={"User-Agent": UA})
        for intento in range(3):
            try:
                with urllib.request.urlopen(pet, timeout=45) as resp:
                    datos = json.loads(resp.read().decode("utf-8"))
                break
            except Exception as e:  # red o límite de peticiones
                if intento == 2:
                    print("   aviso: fallo consultando %d ficheros: %s" % (len(lote), e), flush=True)
                    datos = {}
                else:
                    time.sleep(3 * (intento + 1))
        for pagina in (datos.get("query", {}).get("pages", {}) or {}).values():
            titulo = pagina.get("title", "")
            nombre = titulo[len("File:"):] if titulo.startswith("File:") else titulo
            info = (pagina.get("imageinfo") or [{}])[0]
            salida[normalizar(nombre)] = {
                "existe": "missing" not in pagina,
                "thumburl": info.get("thumburl"),
                "url": info.get("url"),
                "descriptionurl": info.get("descriptionurl"),
                "mime": info.get("mime"),
                "ancho": info.get("width"),
                "alto": info.get("height"),
                "tituloApi": titulo,
            }
        time.sleep(0.4)  # cortesía con el servidor de Wikimedia
    return salida


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limite", type=int, default=0)
    p.add_argument("--todos", action="store_true")
    p.add_argument("--simular", action="store_true")
    p.add_argument("--revertir", action="store_true")
    args = p.parse_args()

    if args.revertir:
        filas = sql("SELECT id, url_original, url_nueva, tabla FROM hestiat2.foto_url_correccion "
                    "WHERE revertida_en IS NULL", base="hestiat2")
        print("revirtiendo %d correcciones" % len(filas), flush=True)
        n = 0
        for linea in filas:
            rid, original, nueva, tabla = linea.split("\t")[:4]
            # `tabla` guarda todas las tablas afectadas separadas por comas (la misma dirección vive
            # en las tres). Se revierten todas para que no quede ninguna descuadrada.
            for destino in tabla.split(","):
                base, tb = destino.split(".")
                col = "origin_url" if tb == "accommodation_photo" else "url"
                sql("UPDATE %s SET %s=%s WHERE %s=%s" % (tb, col, esc(original), col, esc(nueva)), base=base)
            sql("UPDATE hestiat2.foto_url_correccion SET revertida_en=NOW() WHERE id=%s" % rid, base="hestiat2")
            n += 1
            if n % 100 == 0:
                print("   revertidas %d" % n, flush=True)
        print("revertidas: %d" % n)
        return

    pendientes = sql("SELECT id, alojamiento_id, url FROM alojamiento_foto "
                     "WHERE url LIKE '%%wikimedia.org/wiki/File:%%' ORDER BY id")
    print("referencias que son páginas de Commons: %d" % len(pendientes), flush=True)
    if args.limite:
        pendientes = pendientes[:args.limite]
    if not args.todos and not args.limite:
        print("nada que hacer: usa --limite N (prueba), --todos o --simular")
        return

    porNombre = {}
    for linea in pendientes:
        fid, aid, url = linea.split("\t")[:3]
        m = PATRON_PAGINA.match(url)
        if not m:
            continue
        # El nombre del fichero se normaliza igual que las respuestas de la API (sin espacios).
        nombre = urllib.parse.unquote(m.group(1)).replace(" ", "_")
        porNombre.setdefault(nombre, []).append((int(fid), int(aid), url))

    print("ficheros distintos a consultar: %d" % len(porNombre), flush=True)
    datos = api_ficheros(list(porNombre.keys()))

    verificados, no_verificados, saltados = [], [], []
    for nombre, filas in porNombre.items():
        d = datos.get(nombre)
        if not d or not d.get("existe") or not d.get("thumburl"):
            no_verificados.append((nombre, filas, "la API no encuentra el fichero"))
            continue
        # COMPROBACIÓN DE IDENTIDAD: la respuesta tiene que señalar a la MISMA página de la que venimos.
        desc = urllib.parse.unquote(d.get("descriptionurl") or "").replace("https://", "http://")
        esperada_base = urllib.parse.unquote(filas[0][2]).replace("commons.m.wikimedia.org", "commons.wikimedia.org").replace("https://", "http://")
        coincide = desc.split("#")[0].rstrip("/") == esperada_base.rstrip("/")
        if not coincide:
            no_verificados.append((nombre, filas, "la API devuelve otra página: " + (d.get("descriptionurl") or "?")))
            continue
        if not (d.get("mime") or "").startswith("image/"):
            no_verificados.append((nombre, filas, "el fichero no es una imagen (%s)" % d.get("mime")))
            continue
        verificados.append((nombre, filas, d))

    print("verificados: %d · sin poder verificar: %d" % (len(verificados), len(no_verificados)), flush=True)
    for nombre, filas, motivo in no_verificados[:10]:
        print("   SIN CAMBIAR: %s → %s" % (nombre[:60], motivo[:90]), flush=True)

    if args.simular:
        print("\nSIMULACIÓN: no se ha modificado nada.")
        for nombre, filas, d in verificados[:15]:
            print("   %s\n      %s\n   →  %s" % (nombre[:70], filas[0][2][:80], d["thumburl"][:100]))
        return

    aplicados = 0
    for nombre, filas, d in verificados:
        nueva = d["thumburl"]
        original = filas[0][2]
        afectadas = {}
        for base, tb, col in TABLAS:
            # Se cuenta antes de actualizar (leer «Rows matched» del mensaje de mariadb no era fiable).
            antes = int(sql("SELECT COUNT(*) FROM %s WHERE %s=%s" % (tb, col, esc(original)), base=base)[0] or 0)
            if antes:
                sql("UPDATE %s SET %s=%s WHERE %s=%s" % (tb, col, esc(nueva), col, esc(original)), base=base)
            afectadas[base + "." + tb] = antes
        sql("INSERT INTO foto_url_correccion (tabla, alojamiento_id, url_original, url_nueva, procedencia, mime, verificado, filas_afectadas) "
            "VALUES (%s,%s,%s,%s,%s,%s,1,%s)" % (
                esc(",".join(afectadas.keys())), filas[0][1], esc(original), esc(nueva),
                esc(d.get("descriptionurl") or ""), esc(d.get("mime") or ""),
                sum(afectadas.values())), base="hestiat2")
        aplicados += 1
        if aplicados % 200 == 0:
            print("   aplicados %d" % aplicados, flush=True)
    print("corregidas: %d · sin poder verificar: %d" % (aplicados, len(no_verificados)), flush=True)


if __name__ == "__main__":
    main()
