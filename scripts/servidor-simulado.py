#!/usr/bin/env python3
"""
SERVIDOR SIMULADO PARA PROBAR EL BUCLE DEL AGENTE SIN GASTAR NADA.

Esto NO es un modelo de IA. Es un servidor local que responde con la MISMA FORMA que la API
compatible con OpenAI, para poder comprobar que el bucle del agente funciona de verdad: que pide una
herramienta, que la herramienta se ejecuta de verdad contra la base de datos, que la respuesta vuelve,
que queda en la auditoría y que el consumo se registra.

Lo que demuestra: la fontanería. Lo que NO demuestra: que un modelo real responda bien. Eso solo se
puede probar con una clave real, y asi se dira.

Uso:  python3 servidor-simulado.py [puerto]
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8899


class Manejador(BaseHTTPRequestHandler):
    contador = {"llamadas": 0}

    def log_message(self, *args):
        pass  # sin ruido en el registro

    def do_POST(self):
        largo = int(self.headers.get("content-length") or 0)
        cuerpo = json.loads(self.rfile.read(largo) or b"{}")
        Manejador.contador["llamadas"] += 1
        n = Manejador.contador["llamadas"]

        # Se pide una herramienta solo cuando la peticion TRAE herramientas (es decir, cuando habla el
        # bucle del agente). La prueba de conexion no las manda, asi que recibe texto y no se confunde.
        # Antes se decidia por numero de llamada y la prueba de conexion se comia la vuelta de la
        # herramienta: el bucle nunca llegaba a ejecutarla.
        pide_herramienta = bool(cuerpo.get("tools")) and not any(m.get("role") == "tool" for m in cuerpo.get("messages", []))
        if pide_herramienta:
            # Primera vuelta: el «modelo» pide una herramienta REAL del agente.
            mensaje = {
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": "call_prueba_1",
                    "type": "function",
                    "function": {"name": "search_public_faq", "arguments": json.dumps({"consulta": "publicar gratis"})},
                }],
            }
        else:
            # Segunda vuelta: ya con el resultado de la herramienta, contesta.
            mensaje = {
                "role": "assistant",
                "content": "Publicar en Hestiat es gratis: sin cuota de publicación y sin comisión de Hestiat. "
                           "(Respuesta generada por el servidor SIMULADO de prueba, no por un modelo real.)",
            }

        respuesta = {
            "id": "chatcmpl-simulado",
            "object": "chat.completion",
            "model": cuerpo.get("model", "modelo-simulado"),
            "choices": [{"index": 0, "message": mensaje, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 120, "completion_tokens": 40, "total_tokens": 160},
        }
        datos = json.dumps(respuesta).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(datos)))
        self.end_headers()
        self.wfile.write(datos)


if __name__ == "__main__":
    print("servidor simulado escuchando en el puerto %d" % PUERTO, flush=True)
    HTTPServer(("127.0.0.1", PUERTO), Manejador).serve_forever()
