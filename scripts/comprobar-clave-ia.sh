#!/bin/bash
# =============================================================================
# Comprueba si la clave del modelo está guardada y cargada por el servicio.
#
# NO muestra ningún valor: solo cuenta y comprueba. Sirve para que el administrador pueda verificar
# en un segundo que la clave llegó a donde el servicio la lee, sin tener que fiarse de nadie.
#
# Instalado en el servidor como /root/comprobar-clave.sh
# =============================================================================
ENVF=/opt/hestiat/shared/.env

echo "1) ¿Está la linea en el fichero? ............... $(grep -c '^IA_API_KEY=' $ENVF) (tiene que ser 1)"
echo "2) ¿Cuándo se guardó el fichero? ............... $(stat -c '%y' $ENVF) (debe ser de ahora)"
echo "3) ¿La ve el proceso del servicio? ............. $(tr '\0' '\n' < /proc/$(systemctl show hestiat -p MainPID --value)/environ 2>/dev/null | grep -c '^IA_API_KEY=') (tiene que ser 1)"
echo "4) ¿Cómo está el servicio? ..................... $(systemctl is-active hestiat) · arrancado $(systemctl show hestiat -p ActiveEnterTimestamp --value)"
echo "5) Otros nombres o formatos que romperían la carga:"
echo "     lineas con 'api_key' u 'openai' en cualquier forma: $(grep -ci 'api_key\|openai' $ENVF)"
echo "     lineas que empiezan por 'export ' (systemd no lo admite): $(grep -c '^export ' $ENVF)"
echo "     lineas con espacios alrededor del igual (tampoco): $(grep -cE '^[A-Z_]+ +=' $ENVF)"
echo
echo "Si el 1 o el 3 salen 0, la clave no está donde el servicio la lee: no se puede conectar el agente."
echo "Prueba final, cuando los tres primeros números estén bien:  bash /root/pruebas-ia-conectada.sh --real"
