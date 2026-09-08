# Hestiat — Cloudflare R2

## Flujo
1. El navegador pide una URL firmada a Hestiat.
2. Hestiat genera una `PutObject` firmada durante 10 minutos.
3. El navegador sube la imagen directamente a R2.
4. Hestiat registra la URL y metadatos en `ListingPhoto`.

## Variables
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

## Producción
Antes de publicar:
- comprobar que el `listingId` pertenece al anfitrión autenticado;
- limitar MIME/tamaño también en servidor;
- configurar CORS del bucket;
- usar un dominio CDN real;
- añadir procesamiento de imágenes/thumbnails;
- añadir eliminación de objetos huérfanos;
- evitar aceptar URLs arbitrarias al registrar fotos.
