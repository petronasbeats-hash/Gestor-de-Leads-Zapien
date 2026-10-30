# Visita desde Atención · v0.1

## Resultado

El monitor añade la pestaña **Cita**. El asesor consulta horarios, elige un contacto existente o registra uno nuevo, confirma nombre completo/teléfono/horario con el cliente y guarda la visita. Un mismo evento privado reúne folio RSV, persona, inmueble y referencia de Atención. Agenda y Radar usan ese evento existente; Directorio lo muestra entre los eventos de su participante.

La captura mantiene el nombre/alias, teléfono y enlace originales de Atención. No modifica silenciosamente un contacto existente ni su clasificación. Una persona nueva se registra como prospecto; una visita no demuestra que ya sea inquilino o cliente contractual.

## Flujo operativo

1. Abrir la atención y su pestaña Cita. Se releen propiedades, horarios, bloqueos, ocupación pública y los contactos/eventos privados permitidos por las reglas actuales.
2. Seleccionar explícitamente una persona de Directorio cuando corresponda. Se indican coincidencias; no hay fusión por teléfono/nombre ni actualización automática de datos existentes. Si otro contacto comparte legítimamente el número, debe registrarse/revisarse desde Directorio.
3. Elegir día y hora. Se conservan los próximos 14 días y la anticipación mínima de un día del portal público. Las horas se interpretan en Ciudad de México. No se afirma vacancia comercial por estar publicado.
4. Confirmar con el cliente nombre, teléfono y horario mediante la casilla y pulsar **Reservar y confirmar cita**. La interfaz vuelve a comprobar el inmueble actual de la conversación. El controlador relee las cuatro fuentes públicas antes de llamar al mecanismo de Agenda, que comprueba también eventos privados y reclama el intervalo condicionalmente.
5. Mostrar la cita efectivamente almacenada y su folio. El servidor de Atención comprueba la existencia, estado listo, inmueble, referencia de organización/conversación y agente del evento antes de vincularlo y crear la entrada `reservation_registered` del reporte del día.
6. **Copiar confirmación** o **Preparar en conversación**. Ambas acciones releen el estado actual. Preparar no sobrescribe una respuesta en curso; el asesor revisa y pulsa Enviar por separado. No hay envío automático a ningún canal.

## Consistencia y recuperación

- El ID del evento se deriva de organización/conversación. Dos reintentos o pestañas no crean dos eventos de esa atención. La identidad de la petición incluye los datos elegidos; peticiones distintas no comparten el bloqueo del evento.
- Un contacto nuevo creado antes de fallar la cita permanece en Directorio. Un reintento compatible lo recupera; no se borra a una persona por fallar la reserva.
- Agenda conserva sus transacciones de ocupación, versiones e historial. Un fallo previo al guardado solo libera reclamaciones de esa petición. Un evento ya guardado conserva su folio aun si se perdió la respuesta.
- Si la proyección queda pendiente, **Completar sincronización** recupera el mismo evento. Se retiene la ocupación de manera conservadora y no se ofrece una confirmación lista para compartir hasta que esté sincronizado.
- Si falla la vinculación de la bitácora, se presenta **Completar bitácora**. El reintento solo vincula el evento existente y su folio; no reserva otra vez. El servidor deduplica la entrada aun con otra petición para el mismo evento.
- Las citas históricas que podrían coincidir por persona/teléfono e inmueble se muestran para revisión en Agenda. No se convierten ni enlazan automáticamente. El alta se detiene ante una visita activa de la misma persona e inmueble.
- Reprogramaciones, cancelaciones y nuevas visitas posteriores de esa conversación se gestionan sobre el evento en Agenda. La pestaña muestra el estado canónico al actualizar; no altera citas anteriores al cambiar de inmueble en la conversación.
- Borradores de captura separados por atención permanecen solo en memoria; salir de la cuenta limpia datos y formularios. El navegador advierte al salir de una captura editada.

## Horarios compartidos con Reservar

`shared/visit-availability.js` reúne horarios semanales antiguos/nuevos, duración, intervalos públicos, bloqueos y margen estimado de traslado entre inmuebles con coordenadas conocidas. Reservar y Atención usan el mismo evaluador. Los bloqueos que empiezan dentro de un horario también lo excluyen. Datos inválidos o fallos de lectura no habilitan horas.

Las proyecciones públicas nuevas de visitas incluyen el ID del inmueble para calcular traslados, además de su intervalo e ID de cita. No incluyen nombre, teléfono, organización, conversación ni notas. Sin coordenadas no se calcula traslado. La disponibilidad no incorpora estimaciones de tráfico en vivo.

## Permisos y límites

No se cambian reglas ni membresías. La captura desde el monitor usa el SDK del usuario y los permisos existentes de Agenda/Directorio: la cuenta administradora puede reservar; pertenecer a Atención no concede por sí mismo acceso privado. Los clientes invitados no reciben estos scripts ni pueden llamar la ruta de agente sin autenticación/alcance válido.

La ruta nueva registra la referencia de un evento existente; no es un gateway de reservas abierto al cliente ni un nuevo permiso para escribir Agenda. Las reglas heredadas todavía permiten crear algunas hojas públicas, y otros sitios/escritores antiguos permanecen fuera de esta coordinación. Esta entrega no garantiza autenticidad global de todas las escrituras heredadas ni una transacción atómica entre Agenda y Atención. Si el inmueble cambia concurrentemente, la vinculación se detiene y la cita ya guardada requiere revisión, sin crear otra.

No se crean operaciones comerciales ni se avanza su etapa automáticamente. No se envían recordatorios, mensajes externos ni contratos. El enlace de cliente sigue siendo conversación de invitado; su vista no recibe los datos privados de Directorio/Agenda. `booking:false` sigue describiendo el gateway de cliente pendiente; `operatorVisitRegistration:true` identifica esta capacidad del asesor.

## Validación y publicación

173 pruebas de aplicación aprobadas, incluidas 15 de controlador, interfaz real DOM y vinculación de servidor: alta/reintento, contacto existente, duplicados, horario sobrevenido, bloqueos parciales, traslado, fechas de Ciudad de México, fallos de escritura/respuesta, sincronización y bitácora recuperables, copia/preparación sin envío, conservación/limpieza de borradores y estado cancelado antes de copiar. También regresiones de Reservar, Nexo, temas y navegación.

16 comprobaciones del RTDB Emulator aprobadas con reglas equivalentes a las observadas/aplicadas, SDK real del propietario, competencia de reservas públicas/internas, privacidad de proyección, alta vinculada e impedimento de acceso privado a otro usuario. No se usaron reservas reales para las pruebas.

Requiere publicar **Functions `synapse-attention` y Hosting**, con el constructor de distribución y una carpeta aislada nueva. No se aplica ningún script de reglas. La revisión visual de esta versión desplegada queda pendiente hasta recibir el despliegue del Mac; no se afirma una prueba móvil real.
