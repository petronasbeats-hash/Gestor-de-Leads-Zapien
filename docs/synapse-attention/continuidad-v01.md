# Synapse Attention Experience · continuidad V0.1

Decisión funcional expresada por Sebastián en esta sesión. Estado: contrato y
prototipo de revisión y código candidato; integración de producción pendiente.
Esta rama prepara una referencia de folio compartida para el código de Reservar
y del panel. No publica esos cambios ni modifica reglas, autenticación o registros reales.

## Recorrido

Panel de continuidad del asesor → contexto del cliente e inmueble → pregunta
inicial → invitación personal → Monitor de Atención del cliente → día y horario
de Reservar → nombre/contacto → registro único de reserva y folio → seguimiento.

El chat es la vía de registro. El cliente no vuelve a buscar el inmueble ni a
capturar datos que ya haya confirmado. Puede preguntar sin reservar.

## Entrada del asesor

- Nombre visible o alias de Facebook. Apellidos y teléfono si se conocen.
- Fuente: Marketplace Facebook, Facebook, WhatsApp, Casa Login,
  HYPE by Synapse Experience o Directa. Casa Login conserva el nombre indicado
  por el usuario; su integración y significado técnico siguen por definir.
- Canal de entrada: Messenger, WhatsApp, Web o HYPE. Canal actual: Synapse Atención.
- Publicaciones activas del catálogo de Reservar. Activo no equivale por sí solo
  a disponibilidad contractual del inmueble.
- Preguntas frecuentes: ¿Sigue disponible?, servicios, depósito/contrato,
  requisitos y agendar visita. Respuestas preparadas para revisión del asesor,
  basadas en la ficha; no inventar costos ni requisitos faltantes.

La fuente original se conserva al continuar desde otro canal. Un visitante de
Marketplace que abre Synapse sigue atribuido a Marketplace/Messenger. La entrada
directa o HYPE directa no sobrescribe una referencia de Marketplace o WhatsApp.
El inmueble origen se conserva separado del interés actual.

## Invitación y monitor

El servidor autorizado genera una invitación opaca, revocable, con caducidad y
alcance de conversación/organización. No colocar nombre, teléfono ni leadId en la
URL. El enlace no verifica la identidad de la persona ni autoriza consultar un
historial o documentos anteriores. Recuperar atención existente requiere la
verificación adicional acordada. Folio de reserva y credencial de acceso son
cosas distintas.

Texto propuesto: «Para continuar con tu solicitud sobre [inmueble], abre este
enlace. Ahí puedes consultar información, conversar y elegir un horario de visita:
[enlace personal]».

El monitor abre el inmueble ya seleccionado, muestra la conversación y las
preguntas frecuentes, y permite reservar sin salir de la atención. Los documentos
permanecen en BUNKER; HYPE es un proveedor independiente cuando esté configurado.

## Registro de visita

1. Consultar el mismo proveedor de disponibilidad que Reservar, incluyendo
   duración, días activos, rangos, citas ocupadas, bloqueos y traslados.
2. Seleccionar día/hora y completar o confirmar nombre y número de contacto.
   Apellidos opcionales. Un número escrito no acredita titularidad ni autoriza
   fusionar un lead existente.
3. Enviar el comando al mismo gateway confiable del portal público, con identidad
   autorizada, conversationId y requestId idempotente.
4. El gateway vuelve a validar catálogo/horario, autoriza, reclama el espacio y
   persiste la reserva y referencias de seguimiento. Mantener la política global
   del calendario hasta validar cambios de capacidad/multiunidad.
5. Mostrar «Reserva registrada» solo tras respuesta persistida con citaId,
   leadId y folio autoritativo. La cita puede conservar estado pendiente de
   validación. Un reintento devuelve la misma reserva y el mismo folio.
6. Si se ocupó el horario, preservar datos/chat, actualizar opciones y pedir otra
   elección. La selección visual nunca equivale a una reserva.

## Verificación de esta revisión

Se leyeron únicamente las rutas públicas que usa Reservar:
`disponibilidad/horarios`, `disponibilidad/bloqueos`, `citas_publicas` y
`propiedades`. Sin escritura de producción ni consultas a leads/teléfonos.

Configuración final consultada sin caché: todos los días de lunes a domingo
activos de 09:00 a 20:00, duración 30 minutos, margen 10 minutos.
No fijar estos datos en producción: futuras ediciones deben reflejarse desde el
proveedor compartido. El fixture es una copia para revisar, no una agenda viva.

La corrección del usuario quedó verificada en la lectura final sin caché. Las
primeras lecturas devolvieron la configuración anterior; no inferir un fallo de
guardado a partir de una respuesta en caché. No fue necesario modificar la
configuración real: el usuario ya había guardado el cambio.

El catálogo público devolvió once publicaciones activas. La copia utilizada
excluye direcciones exactas, coordenadas y datos de clientes. Las franjas de la
demostración se calcularon con el generador del portal usando los datos completos
solo de forma interna; se exportaron únicamente fechas/horas por publicación.

## Diferencia de versiones y límite actual

- Rama base: `lab/property-experience-v2`, commit
  `9f4a6694cfa38274877fff32b7b95fad5fc3375e`.
- En la rama, Reservar incorpora folio `RSV-…`. En el HTML leído de producción,
  el registro de cita todavía no incluía ese folio ni el parámetro de unidad.
- El portal y el laboratorio existentes todavía no ofrecen el gateway de
  producción compartido requerido por este contrato. Sus escrituras directas y
  validaciones de identidad no deben ampliarse al nuevo monitor.
- El adaptador de `lab/property-engine-v2` está restringido al emulador y a IDs
  LAB/2099; no se transforma aquí en un adaptador de producción.

Pendiente real: conectar disponibilidad viva, invitaciones verificables,
mensajería con control de acceso y gateway de reserva compartido. Pasar las
pruebas reales de concurrencia, identidad y regresión antes de publicar. El
prototipo usa mensajes en memoria y folios DEMO; no crea reservas reales.
