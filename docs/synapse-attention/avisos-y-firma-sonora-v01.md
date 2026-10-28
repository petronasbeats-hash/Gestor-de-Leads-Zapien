# Avisos de mensajes y firma sonora de Synapse

## Uso

El asesor ve un contador de mensajes nuevos, una insignia en cada atención y
el número de pendientes en el título de la pestaña. Ver mensajes nuevos abre
la primera atención con pendientes. El cliente tiene el mismo contador y la
misma firma sonora cuando responde el asesor.

Ambos activan el botón Activar sonido Synapse. Al pulsarlo se escucha una muestra;
el mismo botón permite silenciar. No se solicita permiso de notificaciones del
sistema. El navegador necesita una interacción para habilitar audio, por lo que
al volver a abrir o recargar la página se activa de nuevo. Volumen o silencio del
dispositivo también afectan al aviso.

La firma elegida por el usuario el 27 de octubre de 2026 es **Synapse Nexo v1**:
dos toques cálidos y un cierre redondo, con una pausa antes de la última nota.
Sus frecuencias base son C♯5 (554.37 Hz), G♯5 (830.61 Hz) y F♯5 (739.99 Hz),
con entradas a 0.025, 0.145 y 0.395 s; duración total de 0.98 s. Los primeros
toques combinan modos de resonancia de madera y el cierre añade una modulación
suave al inicio. Tiene colas cortas, nivel moderado y margen antes del recorte.

Ambas vistas reproducen el mismo archivo PCM mono de 44.1 kHz y 16 bits:
`assets/audio/synapse-nexo-v1.wav`. Sus bytes coinciden exactamente con la muestra
Nexo elegida, sin reconstruirla con otro sintetizador. Se descarga al activar el
sonido, se decodifica con Web Audio y se conserva en memoria durante la página;
los avisos siguientes reutilizan ese audio. Si falla la descarga se puede
reintentar y los avisos visuales siguen disponibles. Silenciar o cerrar sesión
cancela una activación pendiente y detiene el audio en curso. El archivo se sirve
desde el mismo sitio, sin servicios de audio externos. Sustituye Conexión v1.
No se afirma exclusividad registral ni reconocimiento de marca adquirido:
la asociación se construye con su uso consistente.

## Recepción y lectura

- Se consultan mensajes cada cinco segundos en primer plano y cada quince en
  segundo plano. El navegador puede retrasar temporizadores si suspende la
  pestaña. Volver a ella o recuperar conexión solicita una actualización.
- Funciona mientras la página está abierta. No hay push con el navegador cerrado
  ni alertas de conversaciones que continúan exclusivamente en Messenger o WhatsApp.
- Solo los mensajes recibidos disparan sonido; los propios no. Los reintentos
  idempotentes y consultas repetidas no vuelven a sonar por el mismo mensaje.
- La carga inicial presenta pendientes históricos posteriores a la última
  respuesta, sin reproducir sonidos antiguos. Los marcadores de lectura se
  conservan en este navegador, separados por usuario/organización o por hash
  del enlace del cliente. Se guardan identificadores y contadores, sin nombres,
  teléfonos, mensajes ni tokens en texto claro.
- Un mensaje se considera leído cuando la conversación está visible, la ventana
  tiene foco y el hilo está al final. Abrir la ficha, otro cliente o un diálogo
  conserva el pendiente. Si el usuario está leyendo mensajes anteriores, se
  conserva su posición de desplazamiento.
- El refresco automático no reinicia el editor, contacto, resumen ni enlace
  compartible. Cerrar sesión detiene consultas y sonido y restaura el título.
  Respuestas tardías se descartan después de cambiar de organización o sesión.
- Si el asesor cambia el inmueble o comparte condiciones, la vista del cliente
  actualiza ese contexto sin borrar su mensaje pendiente; un cambio de inmueble
  se anuncia para que revise la ficha antes de continuar.

## Servidor y límites

La lista de atenciones añade metadatos de recepción solo después de filtrar las
propiedades autorizadas del principal. El cliente invitado mantiene su acceso
por token/secreto y recibe exclusivamente su hilo. No cambian las reglas RTDB,
proveedores Auth, contratos, reservas, folios ni envíos a servicios externos.

La consulta del agregado de organización y las vistas de cliente conservan la
estrategia de lectura de V0.1. La frecuencia de consulta incrementa lecturas y
ejecuciones mientras se usa la atención. La escala y la optimización del agregado
siguen siendo un límite documentado; no se declara una infraestructura de push.

## Validación y publicación

54 pruebas pasan: metadatos y aislamiento, marcadores, firma y silencio, scripts
reales de cliente y asesor, recepción automática, duplicados, borradores,
pestañas y cierre de sesión; además de las regresiones de acceso, invitado,
operación, release y continuidad de arrendamiento. La prueba de audio verifica
que se reproduce el PCM completo elegido, que se carga/decodifica una vez por
página y que una descarga fallida admite reintento. Incluye cancelación si se
silencia antes de terminar la descarga. El release conserva los bytes del WAV.

E1–E9 pasan en RTDB Emulator con Node 22.14.0. La nueva prueba realiza ocho
reintentos concurrentes de un mensaje y exige una sola recepción, sin cuerpos
de mensaje en la lista y sin acceso fuera de la propiedad autorizada. Detectó
una lectura transitoria vacía del SDK durante un aborto/replay local, mientras
el registro del servidor permanecía intacto. El store ahora ordena las lecturas
y transacciones de una misma organización dentro de cada instancia; otras
organizaciones siguen independientes y las transacciones remotas conservan la
autoridad entre instancias. Una regresión adicional verifica ese orden.

La versión de avisos 840d64e fue desplegada en Hosting y Functions y verificada
por HTTP 200, igualdad de archivos y health con messageAlerts:true. Este cambio
de firma solo exige publicar Hosting: el servidor mantiene el contrato de
metadatos ya desplegado. El builder incluye el WAV como dependencia explícita,
incluso si no existe en los estáticos originales de la Mac. El entorno del
sitio principal sigue usando https://synapse-core.web.app.

La comprobación visual local en navegador quedó bloqueada por la política de
protocolos del navegador remoto. No se buscó una vía para eludirla; la prueba
visual publicada y la escucha en los dispositivos reales quedan pendientes.
La firma Nexo queda preparada para publicación. La versión anterior publicada
conserva Conexión v1 hasta completar ese despliegue.
