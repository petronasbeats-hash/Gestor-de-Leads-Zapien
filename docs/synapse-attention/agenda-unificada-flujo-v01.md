# Synapse Agenda: registro de todos los compromisos

Estado: flujo definido para implementación. Este documento no despliega una
agenda nueva ni registra eventos reales. Fecha: 27 de octubre de 2026.

## Objetivo

Una agenda interna reúne compromisos de Atención, clientes, inmuebles y operación.
Reservar ofrece al cliente los horarios que esa agenda permite. Cada compromiso
se registra una sola vez y conserva su identidad al cambiar de módulo o canal.

El operador entra desde Agenda → Nuevo evento o desde Agendar en una atención,
cliente o inmueble. El módulo de origen aporta contexto y abre el mismo formulario.
El cliente sigue viendo su cita y los horarios disponibles, sin acceder a la agenda
interna, otros participantes ni motivos de ocupación.

## Tipos y requisitos

| Tipo | Vinculación necesaria | Disponibilidad |
| --- | --- | --- |
| Visita a inmueble | Inmueble, nombre y contacto de la persona que reserva | Ocupa el intervalo y márgenes del responsable |
| Firma de arrendamiento | Participantes; inmueble/expediente si existe | Ocupa el intervalo del responsable |
| Firma de escritura / notaría | Participantes y lugar | Ocupa el intervalo del responsable |
| Reunión | Participantes y lugar o enlace, cuando apliquen | Ocupa el intervalo del responsable |
| Entrega o recepción de inmueble | Inmueble y participantes | Ocupa el intervalo del responsable |
| Mantenimiento / servicio | Inmueble o lugar; responsable | Configurable según asistencia requerida |
| Seguimiento / tarea / vencimiento | Asunto y fecha; cliente o expediente opcional | No bloquea por defecto; puede convertirse en compromiso con hora y duración |
| Otro compromiso / bloqueo personal | Asunto; datos restantes según el caso | Bloquea si se marca como ocupado |

Ningún evento interno exige inventar un teléfono, asociar una propiedad ajena o
crear un prospecto. Los participantes pueden existir como nombres sin cuenta.
Vincularlos a contactos existentes es opcional y no envía invitaciones.

## Flujo de captura

1. Elegir tipo y asunto. La propiedad, cliente y fuente se precargan si se conoce
   el origen; el operador puede completar las vinculaciones pertinentes.
2. Indicar fecha, hora de inicio y fin o duración. La zona operativa es
   America/Mexico_City. Una tarea sin hora admite fecha límite y no ocupa agenda.
3. Añadir lugar, participantes, responsable, notas y márgenes de traslado o
   preparación. Indicar si el evento bloquea disponibilidad. No se presupone
   una duración de firma, reunión o servicio.
4. Revisar cruces con todos los compromisos que ocupen ese responsable o recurso.
   Mostrar el intervalo en conflicto y alternativas. La verificación se repite
   al guardar; una lectura previa de disponibilidad no constituye una reserva.
5. Guardar una sola vez y devolver un identificador, resumen y estado. Mostrar
   el evento inmediatamente en día/semana/mes y en el módulo de origen.
6. Ofrecer el texto de confirmación para copiar o compartir voluntariamente.
   Incluir fecha, hora, lugar, participantes pertinentes e identificador.
   No enviar WhatsApp, correo ni invitaciones automáticamente al guardar.
7. Recordar, confirmar y cerrar el compromiso desde el mismo registro. Los
   recordatorios requieren una capacidad de envío realmente configurada; esta
   definición no declara un trabajador ni una integración operativos.

## Estados e historial

- Provisional: apartado pendiente, visible como tal, con vencimiento definido y
  propietario del bloqueo. No se convierte silenciosamente en cita confirmada.
- Programado: compromiso guardado, pendiente de las confirmaciones que apliquen.
- Confirmado: se registró quién confirmó y cuándo. Un evento interno puede
  confirmarse operativamente sin fingir una aceptación del participante.
- Realizado, cancelado y, cuando corresponda, no asistió: cierre con fecha y motivo.
- Reprogramar conserva el identificador; registra fecha anterior, nueva fecha,
  motivo y responsable del cambio. No crea una segunda cita activa.

El historial registra actor, fecha, origen, cambio y motivo. Una bitácora de
conversación conserva sus notas; una próxima acción con fecha puede vincular un
evento o tarea. Escribir una nota no genera un evento ni duplica uno existente.

## Disponibilidad compartida con Reservar

La ocupación corresponde a intervalos de inicio/fin y márgenes, no solo a la
coincidencia de una hora exacta. Una firma de 11:00 a 12:30 bloquea visitas durante
todo ese periodo, además de los márgenes establecidos. Una tarea de fecha límite
sin asistencia no bloquea visitas.

Cada evento indica responsable y, si aplica, recurso/inmueble. La operación
actual de capacidad global debe conservarse hasta configurar explícitamente una
asignación por agente; no se introduce disponibilidad paralela por suposición.
El público solo recibe ocupación o disponibilidad, nunca asunto, nombres,
teléfonos ni notas internas. Cancelar o reprogramar libera únicamente la
ocupación del propio evento y conserva los demás bloqueos.

Las escrituras deben autorizar organización, actor y recurso, ser idempotentes
por operación y comprobar conflictos de forma atómica. Una cita de Reservar y
su vista en Agenda representan el mismo registro, con referencias de origen;
una recarga, reintento o cambio de canal no vuelve a crearlo.

## Situación vigente y alcance de implementación

El panel publicado en Admin → Citas → Citas dispone de Apartado temporal (HOLD)
y Cita manual. HOLD no exige teléfono ni crea un prospecto, pero solo protege
la clave de fecha/hora elegida: no implementa duración de evento general.
Cita manual exige nombre/teléfono y crea un prospecto si no se vincula uno; por
eso no debe usarse como formulario general de eventos internos.

La ampliación requiere formulario Nuevo evento, persistencia privada con
autorización y auditoría, intervalos de ocupación compartidos con Reservar y
vistas del calendario. También requiere tratar los registros legados sin
duplicarlos ni exponer información privada. No basta con añadir un título al
formulario actual. La API de Atención conserva booking:false y reminders:false
hasta implementar y validar las capacidades correspondientes.

## Criterios de aceptación

- Guardar una firma con dos participantes, lugar y duración sin teléfono ni
  inmueble es válido y no crea un lead.
- Reservar rechaza cualquier visita que cruce el intervalo ocupado o sus
  márgenes, incluso si no coincide con su hora de inicio.
- Un recordatorio sin ocupación no reduce los horarios de visita.
- Cambiar fecha o cancelar actualiza todos los puntos de entrada conservando
  historial, identificador y cualquier otra ocupación ajena.
- Un reintento devuelve el mismo evento; no duplica citas ni confirmaciones.
- Los participantes y motivos de reuniones internas no aparecen públicamente.
- Crear un evento no envía mensajes ni invitaciones sin una acción explícita.
- Los apartados se identifican como provisionales y su caducidad es verificable.
