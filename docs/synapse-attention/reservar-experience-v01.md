# Reservar · Synapse Experience

28 de octubre de 2026 · México. Actualización preparada sobre la navegación
publicada 98c610b. Requiere Firebase Hosting antes de estar disponible al cliente.

## Experiencia pública

Reservar presenta un catálogo con fotografías reales, precio, operación y
características. Búsqueda y filtro permiten explorar sin abrir el selector largo
anterior. No se añaden fotografías de ejemplo, testimonios, disponibilidad de
vivienda ni precios inventados. Estar publicado en catálogo no equivale a estar
vacante; la conversación con el asesor conserva esa distinción.

La dirección pública mantiene el criterio anterior: zona general de ADN y, para
otros inmuebles, zonaPublica si existe. La nueva búsqueda y las tarjetas no
exponen una dirección privada adicional. Los enlaces personalizados por unidad
se conservan y también se admite inmueble para fichas sin unitId. Un enlace a
unidad retirada no selecciona otra vivienda automáticamente.

La ficha agrupa una fotografía principal, miniaturas y galería ampliable, precio,
características, descripción, servicios y requisitos. Las imágenes y enlaces
externos deben ser HTTPS. Se conserva un sustituto de imagen cuando no hay fotos
o falla su descarga. El diseño usa fondo claro cálido, verdes de Synapse,
tipografía legible y distribución adaptable a móvil. Un acceso fijo en móvil
permite saltar al calendario desde cualquier parte de la ficha.

## Calendario → día → hora

El calendario mensual marca los días con horarios; deshabilita días anteriores,
sin disponibilidad o fuera de la ventana existente de reserva. Elegir un día
abre su agenda de horas disponibles. Elegir una hora abre el registro de visita.
Si la ventana cruza de mes, los controles permiten pasar al siguiente o anterior
mes con horarios. Solo se muestra una agenda diaria a la vez.

Se conserva la anticipación mínima existente de un día y la ventana de 14 días.
La fecha de referencia usa America/Mexico_City y las horas corresponden a
Tehuacán. El cálculo de fechas del calendario usa UTC para no desplazarse por la
zona del dispositivo; la comparación de horarios usa el desplazamiento -06:00
de Ciudad de México. No se publica el calendario privado de eventos ni sus
nombres, teléfonos, notas o asuntos.

Las cuatro fuentes públicas deben cargar antes de ofrecer horas. Un error
impide mostrar horarios elegibles y ofrece actualización. Los listeners y la
actualización manual reflejan ocupación nueva. Antes de guardar se vuelven a
leer propiedades, horario, bloqueos y ocupación. Las reclamaciones condicionales
de horario y su limpieza conservan el comportamiento probado anteriormente.

## Servicios y condiciones

El constructor publica una copia de los perfiles de condiciones que ya usa
Atención, eliminando sus notas de fuente. Se reutiliza propertySheet del modelo
compartido. Las condiciones se aplican por grupo y tipo de unidad; no se heredan
entre propiedades distintas. La ficha distingue incluidos, adicionales,
exclusiones y pendientes de confirmar.

YIN y YANG conservan sus perfiles propios. Los inmuebles sin condiciones
configuradas piden consultar depósito, plazo y requisitos al asesor. Esta
entrega no inventa ni aprueba cláusulas de depósito no reembolsable para Arcadia,
Clavel u otra propiedad. Los documentos se solicitan en el momento del proceso
de alquiler, sin exigir subirlos para reservar una visita.

## Registro y comprobante

El formulario muestra inmueble y horario elegidos, identifica campos opcionales
y valida el teléfono con el modelo compartido. Se puede cerrar con teclado y se
mantiene el foco dentro del formulario. La galería admite teclado y cierre.

Después de guardar se muestra el folio real de la reserva y una acción para
copiar sus datos. El estado se presenta como pendiente de confirmación por el
asesor, coherente con el registro guardado. Copiar no crea otra cita ni envía un
mensaje. La página no promete un WhatsApp automático. Un fallo al presentar el
comprobante no libera la reserva ya guardada.

## Validación y publicación

Pasaron 142 pruebas de aplicación: catálogo, filtros, perfiles por unidad,
galería y URLs seguras, calendario mensual y agenda diaria, cambios de mes,
ocupación recién añadida, enlaces retirados, lectura fallida, teléfono incompleto,
copia de folio y regresiones de reservas, Atención, Directorio y Agenda.
Las 11 pruebas del portal también pasaron con TZ=Pacific/Auckland, manteniendo
las fechas mexicanas. Sintaxis y construcción completa verificadas.

Solo necesita Hosting, sin modificar reglas ni desplegar Functions. No se crean
citas de prueba en producción. La revisión visual en navegador del diseño nuevo
queda pendiente de publicar esta versión; se inspeccionó la versión anterior en
producción como referencia.
