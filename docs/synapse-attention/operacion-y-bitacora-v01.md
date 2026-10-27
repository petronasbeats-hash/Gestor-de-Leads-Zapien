# Synapse Atención · protocolo operativo y bitácora V0.1

Mandato del usuario: pasar del prototipo a operación, aplicar el folio al código,
consultar disponibilidad viva antes de cada atención y usar resúmenes de las
interacciones para seguimiento diario, síntesis y decisiones de mejora continua.

## Disponibilidad y reserva

- Cada nueva atención invoca `createLiveAvailabilityReader`. Se consultan las
  cuatro rutas públicas actuales. Si no responde el proveedor, no ofrecer datos
  anteriores como disponibilidad vigente.
- Se registra el instante observado. Se vuelve a leer y se valida en servidor al
  reservar, porque otro cliente puede ocupar un horario durante la conversación.
- Horario final verificado en esta sesión: todos los días de 09:00 a 20:00,
  intervalos de 30 minutos. La configuración viva es la autoridad; no fijarlo
  como política inmutable.
- El código compartido `shared/reservation-reference.js` conserva los folios ya
  almacenados y el formato `RSV-…` del proyecto. Lo usan Reservar y la conversión
  de HOLD del panel. Una selección o solicitud en proceso no genera un folio de
  éxito. La unicidad global se debe verificar en el gateway de producción.
- Portal público y Monitor deben terminar en el mismo gateway de reserva, con
  autorización, exclusión de horario, idempotencia y escritura trazada. La rama
  recibida aún contiene escrituras directas legacy; este documento no las
  considera una integración segura del Monitor.

## Resumen de cada interacción

La bitácora es privada, por organización y append-only. El cliente no escribe
directamente en ella. La autoridad de servidor valida agente y organización.
La función `prepareEntry` recibe los hechos de la interacción y prepara:

- Referencias a conversación/interacción, fuente, canal e inmueble.
- Resumen de lo que ocurrió, datos confirmados y preguntas abiertas.
- Folio si existe una reserva registrada; ninguna confirmación inventada.
- Siguiente acción, fecha si se conoce y estado pendiente/hecho.
- Fecha real de la interacción y fecha de registro por separado.

Importar una conversación sin fecha no convierte su fecha de atención en hoy.
Los datos personales y las bitácoras reales no se guardan en GitHub. La bitácora
operativa de cliente permanece en almacenamiento privado; los fixtures solo
contienen publicaciones públicas y ejemplos de prueba.

`createRtdbJournal` escribe un evento con transacción y detecta reintentos o
conflictos sin sobrescribirlo. Correcciones se añaden como otra entrada. Falta
validar el adaptador con el proyecto/emulador y conectar los eventos del Monitor;
las pruebas actuales del contrato utilizan un adaptador de memoria.

El registro de reserva debe incluir un evento/outbox duradero en su operación
autoritativa. Si falla el resumen posterior, se reintenta la bitácora, no se crea
otra reserva ni se informa al cliente que su reserva falló si ya fue registrada.

## Seguimiento y mejora continua

`dailyReport` usa America/Mexico_City, conserva pendientes de días anteriores,
lista reservas por folio y agrupa preguntas recurrentes con referencias a las
interacciones. Las propuestas quedan en revisión humana. Un caso individual
también puede documentar una fricción relevante; no es una autorización para
cambiar precios, términos o comportamiento del sistema.

Cadena de trabajo: interacción → resumen → pendiente → seguimiento diario →
síntesis → propuesta → decisión del usuario → cambio → validación del resultado.
Los aprendizajes son registros y reglas revisables; no se promete entrenamiento
automático del modelo ni lectura autónoma de mensajes de Facebook/WhatsApp.

No se configura un reporte programado sin una frecuencia/hora solicitada.

## Estado de implementación y activación

Preparado: contrato de continuidad, prototipo del panel/Monitor, referencia
compartida aplicada a los HTML, lector de disponibilidad viva y adaptador de
bitácora con síntesis diaria. Pruebas de contrato y simulación separadas de la
validación real de RTDB.

Para activar: conectar Firebase, inspeccionar proyecto/reglas/Auth/hosting reales,
integrar el gateway, las invitaciones y los eventos en el Monitor, pasar las
pruebas de concurrencia y regresión y desplegar el candidato revisado. No se
modifican las reglas ni se abre escritura pública para salvar este bloqueo.
