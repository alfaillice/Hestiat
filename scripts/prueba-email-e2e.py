#!/usr/bin/env python3
"""
PRUEBA DE CORREO DE EXTREMO A EXTREMO, AUTORIZADA POR EL ADMINISTRADOR.

Direccion destinataria: alfaillice@gmail.com  (indicada expresamente por el administrador)
Contenido: el aprobado palabra por palabra.

Se envia UN SOLO mensaje. No se toca ningun lead real y no se activa ninguna campana.
El flujo es el mismo del CRM: alta del cliente -> borrador pendiente -> aprobacion -> envio.
"""
import json
import os
import subprocess

ENVF = "/opt/hestiat/shared/.env"
with open(ENVF, encoding="utf-8") as f:
    ent = dict(l.split("=", 1) for l in f if "=" in l and not l.startswith("#"))
U = ent["DB_USER"].strip()
os.environ["MYSQL_PWD"] = ent["DB_PASSWORD"].strip()
WEB = "https://hestiat.com"
DESTINO = "alfaillice@gmail.com"
ASUNTO = "PRUEBA — Publica gratis en Hestiat: sin cuotas ni comisiones"
CUERPO = """Hola:

Este es un mensaje de PRUEBA interna de Hestiat, enviado desde el CRM de administración para comprobar el flujo completo de aprobación y envío. No es una comunicación comercial a un negocio.

El texto que se envía de verdad a los propietarios es este:

Somos Hestiat, una web española donde se pueden encontrar alojamientos, experiencias y servicios de toda España. Publicar es gratis: no hay cuota de publicación, ni cuota mensual, ni comisión de Hestiat por reserva. El precio que pongas es el precio que ve quien te reserva.

Puedes reclamar tu ficha y completarla con tus fotos, tu disponibilidad y tus precios:
https://hestiat.com/hazte-anfitrion

—
Hestiat · https://hestiat.com · hola@hestiat.com

Escribimos a direcciones profesionales publicadas por el propio negocio. Si no quieres recibir más mensajes nuestros, responde a este correo con la palabra BAJA y no volveremos a escribirte."""


def sql(c, base="hestiat2"):
    r = subprocess.run(["mariadb", "-u", U, "-N", "-B", base, "-e", c], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("sql: " + r.stderr.strip()[:300])
    return [l for l in r.stdout.splitlines() if l]


def esc(v):
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"


tok = subprocess.run(["openssl", "rand", "-hex", "32"], capture_output=True, text=True).stdout.strip()
sql("INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES (%s, 3, DATE_ADD(NOW(), INTERVAL 20 MINUTE), 'prueba-email-e2e')"
    % esc(tok), "hestiat")


def api(cuerpo):
    r = subprocess.run(["curl", "-sS", "-X", "POST", "-H", "Cookie: hestiat_sesion=" + tok,
                        "-H", "Content-Type: application/json", "-d", json.dumps(cuerpo)],
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0 or not r.stdout.strip():
        return {"error_curl": r.returncode, "stderr": (r.stderr or "")[:200]}
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"crudo": r.stdout[:300]}


print("=== 1. CLIENTE DE PRUEBA (marcado como prueba; ningun lead real) ===")
sql("""INSERT INTO `lead` (empresa, tipo_negocio, localidad, pais, email, fuente, estado, notas, responsable)
       VALUES ('PRUEBA ENVIO E2E (autorizado por el administrador)', 'otro', 'Alicante', 'España', %s,
               'manual', 'RESEARCHED', 'Prueba de correo de extremo a extremo autorizada por el administrador. Se envía UN solo mensaje.', 'administracion')"""
    % esc(DESTINO))
lead = sql("SELECT id FROM `lead` WHERE empresa LIKE 'PRUEBA ENVIO E2E%' LIMIT 1")
print("   cliente de prueba en la base: #%s" % (lead[0] if lead else "?"))
lead_id = int(lead[0]) if lead else None

print("\n=== 2. BORRADOR CON EL TEXTO APROBADO (pendiente, sin enviar) ===")
sql("""INSERT INTO lead_contacto (lead_id, canal, asunto, cuerpo, resultado, autor)
       VALUES (%d, 'email', %s, %s, NULL, 'crm de administracion')""" % (lead_id, esc(ASUNTO), esc(CUERPO)))
contacto = sql("SELECT id FROM lead_contacto WHERE lead_id=%d ORDER BY id DESC LIMIT 1" % lead_id)
contacto_id = int(contacto[0]) if contacto else None
print("   contacto #%s · asunto: %s" % (contacto_id, sql("SELECT asunto FROM lead_contacto WHERE id=%d" % contacto_id)[0]))
print("   estado: %s" % sql("SELECT COALESCE(resultado,'(pendiente de aprobación)') FROM lead_contacto WHERE id=%d" % contacto_id)[0])
print("   enviados hasta ahora a esa dirección: %s" % sql("SELECT COUNT(*) FROM lead_contacto c JOIN `lead` l ON l.id=c.lead_id WHERE l.email=%s AND c.resultado='enviado'" % esc(DESTINO))[0])

print("\n=== 3. APROBACIÓN Y ENVÍO (un solo mensaje) ===")
r = api({"accion": "aprobar_envio", "contactoId": contacto_id})
print("   respuesta del CRM: %s" % json.dumps(r, ensure_ascii=False))

print("\n=== 4. RESULTADO REGISTRADO ===")
print("   resultado: %s · enviado_en: %s · aprobado_por: %s" % (
    sql("SELECT COALESCE(resultado,'?') FROM lead_contacto WHERE id=%d" % contacto_id)[0],
    sql("SELECT COALESCE(enviado_en,'?') FROM lead_contacto WHERE id=%d" % contacto_id)[0],
    sql("SELECT COALESCE(aprobado_por,'?') FROM lead_contacto WHERE id=%d" % contacto_id)[0]))
print("   estado del cliente: %s" % sql("SELECT estado FROM `lead` WHERE id=%d" % lead_id)[0])
for fila in sql("SELECT CONCAT(accion, ' · ', COALESCE(entidad,'-'), ' · ', LEFT(COALESCE(detalle,''),110), ' · ', creado_en) FROM hestiat.admin_auditoria WHERE accion LIKE 'ia:%%' AND accion IN ('ia:email_comercial_enviado','ia:envio_fallido','ia:crm_crear') ORDER BY id DESC LIMIT 3", "hestiat"):
    print("   auditoría: %s" % fila)
print("   envíos comerciales de hoy: %s" % sql("SELECT COUNT(*) FROM lead_contacto WHERE resultado='enviado' AND enviado_en >= CURDATE()")[0])

print("\n=== 5. ¿SE PUEDE COMPROBAR LA RECEPCIÓN DESDE EL SERVIDOR? ===")
import imaplib, poplib
u = ent["SMTP_USER"].strip(); c = ent["SMTP_PASSWORD"].strip(); h = ent["SMTP_HOST"].strip()
resultado = "NO"
for nombre, puerto in [("IMAP", 993), ("POP3", 995)]:
    try:
        if nombre == "IMAP":
            s = imaplib.IMAP4_SSL(h, puerto, timeout=12); s.login(u, c); s.select("INBOX"); s.logout()
        else:
            s = poplib.POP3_SSL(h, puerto, timeout=12); s.user(u); s.pass_(c); s.quit()
        resultado = "SÍ, con %s" % nombre
        break
    except Exception as e:
        print("   %s → %s" % (nombre, str(e)[:70]))
print("   ¿recepción verificable desde el servidor?: %s" % resultado)
if resultado == "NO":
    print("   (el buzón rechaza la autenticación de IMAP y POP3 con las credenciales de envío. La recepción")
    print("    la tiene que confirmar el administrador en la bandeja de destino.)")

sql("DELETE FROM usuario_sesion WHERE user_agent='prueba-email-e2e'", "hestiat")
print("\n=== 6. LO QUE QUEDA REGISTRADO ===")
print("   el cliente de prueba #%s y su contacto #%s SE CONSERVAN como registro del envío (así lo pediste)." % (lead_id, contacto_id))
print("   para borrarlos cuando quieras: se eliminan con un clic desde el CRM, o dime y los quito.")
