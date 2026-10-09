# Operaciones · Clave del modelo de IA (IA_API_KEY)

Procedimiento para el equipo de operaciones de Hestiat. Servidor de producción: **VPS 104.243.34.239**
(hostname `hestiat`). El fichero de entorno es **`/opt/hestiat/shared/.env`** y lo carga el servicio
**`hestiat.service`** mediante `EnvironmentFile`.

Reglas de oro:

- La clave **nunca** se escribe en el repositorio, en el frontend, en un ticket, en un chat ni en una captura.
- La clave **nunca** se pasa como argumento de un comando: quedaría en el historial y en la lista de procesos.
- El fichero se lee **solo en el servidor**, y solo lo lee el backend. La consola no la muestra nunca.

---

## 1. Añadir la clave (primera vez o tras un borrado)

En el servidor, **como root**:

```bash
sudo -i
bash /root/poner-clave-ia.sh
```

El ayudante hace todo el trabajo delicado:

1. pide la clave con `read -s` (no se ve lo que escribes, no queda en el historial);
2. guarda una copia del entorno en `/root/env-antes-de-la-clave-<fecha>.bak`;
3. escribe la línea `IA_API_KEY=…` sustituyendo cualquier intento anterior;
4. deja el propietario y los permisos correctos: **`root:hestiat`, modo `640`**;
5. reinicia `hestiat` y espera a que responda;
6. ejecuta el comprobador y muestra los tres indicadores.

Al terminar debe verse:

```
1) ¿Está la línea en el fichero? ............... 1
2) ¿Cuándo se guardó? .......................... (fecha de ahora)
3) ¿La ve el proceso del servicio? ............. 1
```

Si el 1 sale 0 → no se guardó. Si el 3 sale 0 → falta el reinicio (`systemctl restart hestiat`).

## 2. Comprobar el estado (en cualquier momento)

```bash
bash /root/comprobar-clave.sh
```

Comprueba fichero, fecha de guardado, si el proceso la ve, el estado del servicio y los formatos que
romperían la carga (`export`, espacios alrededor del `=`, nombres alternativos). No muestra valores.

Comprobación manual de los permisos (deben ser exactamente estos):

```bash
stat -c '%A %U:%G' /opt/hestiat/shared/.env     # -rw-r----- root:hestiat
stat -c '%A %U:%G' /opt/hestiat/shared         # drwxr-x--- hestiat:hestiat
systemctl show hestiat -p User --value         # hestiat  (puede leer el fichero por grupo)
sudo -u hestiat test -r /opt/hestiat/shared/.env && echo "el servicio puede leerlo"
```

`640 root:hestiat` es lo correcto: el servicio solo necesita **leer**. No hace falta —y no se debe—
darle escritura ni cambiar el propietario.

## 3. Rotar la clave (cambio periódico o filtración)

El procedimiento es el mismo, y no hay que tocar nada más: el ayudante **reemplaza** la línea anterior.

1. Genera la clave nueva en el panel del proveedor.
2. `bash /root/poner-clave-ia.sh` y pega la nueva.
3. Comprueba los tres indicadores (`bash /root/comprobar-clave.sh`).
4. Valida la conexión real: botón **«Probar conexión»** en `https://hestiat.com/admin/ia`, o
   `bash /root/pruebas-ia-conectada.sh --real`.
5. Revoca la clave antigua en el panel del proveedor **después** de ver la validación en verde.
6. Si algo va mal: el ayudante dejó copia en `/root/env-antes-de-la-clave-<fecha>.bak`
   (`cp -p` esa copia sobre el `.env`, `chown root:hestiat`, `chmod 640`, `systemctl restart hestiat`).

## 4. Validación posterior

```bash
bash /root/pruebas-ia-conectada.sh --real
```

Comprueba: conexión real con el proveedor, conversación completa, una herramienta ejecutada de verdad,
registro en la auditoría, consumo y coste, control del gasto (se corta al llegar al presupuesto) y el
tratamiento de errores. No envía correos comerciales.

Lo que se puede validar **sin** clave: las 16 herramientas con datos reales, los permisos (403 sin
sesión de administración), que no existe ninguna herramienta de SQL ni de borrado masivo, las imágenes
y los registros de correo del dominio (SPF, DKIM, DMARC).

## 5. Alerta automática

El servidor vigila solo, cada 15 minutos (`hestiat-alerta-ia.timer`), y avisa por correo al
administrador cuando:

- la clave está en el fichero pero el servicio no la ve (falta reinicio o se rompieron los permisos);
- la clave no está configurada (un solo aviso, para no llenar el buzón);
- el proveedor **rechaza la credencial** (401/403);
- el proveedor no responde.

Registro: `/var/log/hestiat/alerta-ia.log`. Estado interno: `/var/lib/hestiat/alerta-ia.estado`.
Prueba manual: `bash /root/hestiat-alerta-ia.sh` (no manda nada si el estado no ha cambiado).

## 6. Qué no hay que hacer

- No editar el `.env` con un usuario que no sea root: no podrá guardar y parecerá que sí.
- No añadir `export` delante de la variable ni espacios alrededor del `=`: systemd no lo admite.
- No copiar la clave a un fichero del repositorio ni a `frontend/.env`.
- No reiniciar el servicio sin motivo: cada reinicio es una ventana de unos segundos sin aplicación.
