# Synapse PWA V1 — rama de preparación (NO desplegada)

Objetivo: instalar Synapse en Mac y Huawei, sin modificar flujos de reserva.

Archivos iniciales: manifest.webmanifest e iconos SVG provisionales. **No declarar lista la instalación** hasta generar PNG de 192 y 512 px, vincular manifest en index.html, agenda.html y reservar.html, validar rutas HTTPS, evaluar service worker sin caché de datos de clientes y verificar instalación en dispositivos reales.

**Bloqueadores previos al deploy:** reconciliar diferencias entre versión local/producción y GitHub main; probar Admin, Agenda, Reservar y sincronización; verificar seguridad; aprobar deploy explícitamente.

**Huawei sin GMS:** el navegador puede ofrecer acceso directo en vez de WebAPK. No prometer notificaciones push.

**Política de caché:** nunca cachear API Firebase, respuestas autenticadas, datos de clientes, citas ni documentos. Network-only para contenido dinámico; offline solo shell estático después de pruebas.

Estado: PREPARACIÓN, no integrado, no probado, no desplegado.
