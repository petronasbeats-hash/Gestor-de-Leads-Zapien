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

La firma Synapse Conexión v1 es una sucesión propia de tres notas ascendentes:
D5 (587.33 Hz), A5 (880 Hz), E6 (1318.51 Hz), con entradas a 0, 0.16 y 0.34 s.
Las notas duran 0.15, 0.17 y 0.40 s. Cada una combina seno fundamental y segundo
armónico suave, ataque de 8 ms y caída exponencial. Se sintetiza localmente con
Web Audio; no depende de descargar un archivo ni de un servicio de audio.
La muestra de escucha conserva estas frecuencias y envolventes y añade silencio
al final: 0.84 s. No se afirma exclusividad registral ni reconocimiento de marca
adquirido: la asociación se construye con su uso consistente.

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

53 pruebas pasan: metadatos y aislamiento, marcadores, firma y silencio, scripts
reales de cliente y asesor, recepción automática, duplicados, borradores,
pestañas y cierre de sesión; además de las regresiones de acceso, invitado,
operación, release y continuidad de arrendamiento.

E1–E9 pasan en RTDB Emulator con Node 22.14.0. La nueva prueba realiza ocho
reintentos concurrentes de un mensaje y exige una sola recepción, sin cuerpos
de mensaje en la lista y sin acceso fuera de la propiedad autorizada. Detectó
una lectura transitoria vacía del SDK durante un aborto/replay local, mientras
el registro del servidor permanecía intacto. El store ahora ordena las lecturas
y transacciones de una misma organización dentro de cada instancia; otras
organizaciones siguen independientes y las transacciones remotas conservan la
autoridad entre instancias. Una regresión adicional verifica ese orden.

El paquete contiene el módulo compartido tanto en Hosting como en Functions y
exige publicar ambos. El recibo de health añade messageAlerts:true. El entorno
del sitio principal sigue usando https://synapse-core.web.app.

La comprobación visual local en navegador quedó bloqueada por la política de
protocolos del navegador remoto. No se buscó una vía para eludirla; la prueba
visual publicada y la escucha en los dispositivos reales quedan pendientes.
La actualización está preparada para el despliegue del operador, sin declarar
que la versión anterior publicada ya incluye los avisos.
