# Monitor compacto y respuestas rápidas

## Necesidad observada

Las capturas del 27 de octubre de 2026 muestran un formulario de nueva atención,
una ficha extensa, contacto/enlace, mensajes, resumen, historial y reporte diario
apilados. El operador debe recorrer toda la página para completar una atención.
Solicita encapsular las tareas y tener un combo de respuestas preparadas para
consultas frecuentes, con el tono humano, profesional y fresco de Synapse Experience.

## Comportamiento del candidato

- Bandeja de atenciones a la izquierda y contexto del cliente/inmueble siempre
  visible en la cabecera del área activa. En escritorio se usa la altura de la
  ventana; cada panel contiene su propio recorrido. En ventanas muy bajas se
  permite desplazamiento para conservar accesibles los controles.
- Cuatro pestañas: Conversación, Inmueble, Contacto y enlace, Bitácora. Cambiar
  pestaña conserva los campos. Los mensajes y el editor son la vista inicial.
- Nueva atención y Seguimiento del día se abren en diálogos, sin mantener sus
  formularios largos a la vista. En móvil un botón abre/cierra la bandeja.
- Respuestas rápidas: elegir la consulta, pulsar Preparar respuesta, revisar o
  editar el texto y enviar en Synapse o copiar para Messenger/WhatsApp.
  Preparar o copiar no envía nada ni comparte condiciones automáticamente.
- Respuestas de disponibilidad, servicios, precio, depósito/plazo, requisitos,
  visita, fotografías, gastos y continuidad. Usan exclusivamente el inmueble
  actual y datos estructurados disponibles; conservan los importes desconocidos
  como pendientes de confirmación. Publicación activa no se presenta como prueba
  de desocupación ni de un horario disponible.
- Los borradores de conversación/resumen se conservan en memoria por organización
  y atención. No aparecen en otro cliente. Al cambiar de inmueble, un texto de
  plantilla sin editar se prepara con el nuevo contexto; los textos humanos se
  conservan para revisión. Cerrar sesión elimina estos borradores privados.
- La conexión del invitado o una actualización del historial conserva el texto
  del enlace vigente. Cambio de atención/inmueble, rotación o revocación lo limpia.
  No se obliga a rotar un enlace por un cambio de versión ajeno a la invitación.

## Alcance

Cambian la interfaz del operador, su banco de respuestas y el paquete público.
No cambian el backend, permisos, datos guardados, identidad del invitado ni el
flujo público de conversación sin SMS. No hay respuestas automáticas de Facebook
ni envíos por ese servicio: las respuestas son herramientas del asesor.

La vista del inmueble del cliente permanece disponible con sus fotografías.
La separación de Synapse Agenda interna/Reservar público, la reserva autoritativa
con folio y la vinculación con perfiles HYPE siguen siendo tareas distintas.

## Validación

Pruebas del banco de respuestas y del script real del operador contra el handler:
contexto por inmueble, campos desconocidos, exclusiones YIN, no envío al preparar,
edición, pestañas, borradores aislados, envío explícito, diálogos, reporte y limpieza
de datos al salir. Una prueba comprueba que el enlace sobrevive al acceso del
invitado sin rotación accidental. Se vuelven a comprobar el cliente invitado y
el generador del release. La comprobación visual del nuevo diseño en navegador
publicado queda pendiente del despliegue al canal de validación.

Esta actualización puede publicarse solo en Hosting: no necesita volver a subir
Cloud Functions, ejecutar npm ni modificar la ACL.
