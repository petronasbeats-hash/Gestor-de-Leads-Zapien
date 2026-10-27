# Ficha, visita y continuidad hacia arrendamiento · V0.1

## Comportamiento solicitado

La ficha del inmueble permanece en ambas vistas: asesor y cliente. Muestra
fotografías de catálogo, renta, descripción, servicios y amenidades incluidos,
exclusiones, cargos adicionales y puntos por confirmar. Cambiar de inmueble
actualiza la ficha y conserva la referencia del inmueble de origen.

`shared/lease-continuity.js` resuelve perfiles declarativos por grupo/tipo de
unidad y permite configuración por publicación. No incorpora excepciones de
YIN 05 dentro del motor. Las referencias fotográficas pertenecen a las
publicaciones existentes; el prototipo incorpora una muestra de fotografías
reales de YIN 05 sin alterarlas.

## Requisitos y condiciones en el momento adecuado

- El asesor puede compartir el paquete desde la atención, antes o después de
  reservar según el momento comercial. Una respuesta frecuente prepara texto;
  no lo envía automáticamente.
- Al reservar, el cliente dispone de una consulta opcional del paquete. No se
  exige entregar documentos para hacer una visita.
- El paquete conserva inmueble y versión de condiciones. Una versión anterior
  o de otra unidad exige revisión de nuevo.
- ADN: seis meses y depósito de un mes. Lista documental recuperada de
  `ADN_Resident_Guide_V1.pdf` y `ADN_Suites_Studios_Brochure.pdf`: INE/contacto
  del arrendatario; INE, comprobante de domicilio actualizado y contacto del aval.
- El brochure antiguo decía seis o doce meses y presentaba amenidades de forma
  general. Se aplican las correcciones posteriores del usuario: seis meses;
  Sky Terrace, Jardín Botánico y lavado/tendido exclusivos de YANG.
- No se heredan los requisitos ni condiciones de ADN a Casa Clavel u otras
  publicaciones. Las condiciones sin configuración permanecen por confirmar.

## Recordatorios previos

`server/visit-reminders.cjs` calcula avisos a 48 horas, 24 horas y una hora de la
cita. Omite ventanas vencidas o anteriores al momento de reserva. Una reserva de
20 horas de anticipación conserva solo el aviso de una hora.

Los jobs se identifican por organización, cita, revisión y ventana. Al
reprogramar, se cancelan los jobs pendientes de la revisión anterior. Cancelar,
marcar como realizada/no asistida o dar de baja avisos suprime futuros jobs.
Los avisos ya enviados permanecen en el historial.

La fuente de captación no determina el transporte: un lead de Marketplace que
continúa en Synapse conserva su fuente, pero el canal actual puede ser Synapse.
Un canal sin integración automática produce una tarea manual, nunca un envío
ficticio. El registro de un job no equivale a entrega. La entrega requiere
confirmación del proveedor y conciliación de reintentos.

En este candidato no hay un worker desplegado ni una integración de envío
activada. No se crearon recordatorios personales de ChatGPT para citas
inexistentes. La automatización pertenece al sistema y se alimentará de las
reservas reales una vez conectada la integración de producción.

## Después de la visita

El seguimiento y el botón del cliente se habilitan cuando el asesor registra la
visita como realizada; no se infiere asistencia porque pasó la hora. El asesor
puede preparar una respuesta de seguimiento para conocer interés, resolver
dudas y ofrecer continuar. El momento del envío posterior es configurable;
no se fija silenciosamente otro plazo de seguimiento en este cambio.

El cliente puede elegir «Quiero continuar con mi contrato de arrendamiento».
El formulario confirma inmueble/renta/depósito/plazo, nombre/contacto, declara
con qué requisitos cuenta y propone una fecha de firma opcional.

El resultado es una solicitud `pending_review`, con firma `proposed` y contrato
`not_generated`. Los checks del cliente son declaraciones, no recepción ni
validación de documentos. La documentación permanecerá en BUNKER; su validación,
disponibilidad del inmueble, autorización y cita de firma se revisan antes de
preparar un contrato definitivo. La solicitud no genera ni firma un contrato.

## Evidencia y activación

La bitácora debe registrar: paquete compartido/consultado, versión de condiciones,
plan de avisos, entrega real o fallo, realización de la visita, respuesta de
interés, solicitud de arrendamiento, faltantes y propuesta de firma. Cada paso
produce una siguiente acción para el asesor y alimenta el reporte diario.

Las pruebas de contrato/simulación cubren estas transiciones. Persistencia real,
worker de recordatorios, entrega de mensajes, BUNKER y despliegue continúan
pendientes de la conexión e integración de Firebase. Instalar el CLI en el Mac o
añadir el plugin no activa por sí solo un Monitor todavía no desplegado.
