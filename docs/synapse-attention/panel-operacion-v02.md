# Panel de operación Synapse · v0.2

## Navegación y densidad

El menú se agrupa en Día a día (Radar, Atención y Agenda), Gestión (Directorio e Inmuebles) y herramientas secundarias. Es plegable en escritorio y abre como panel lateral en móvil. La preferencia guarda únicamente expanded/collapsed; no nombres, búsquedas ni conversaciones. Nueva atención abre su formulario después de autenticar, sin crear datos automáticamente. Los diálogos y borradores conservan su protección al navegar.

Radar presenta filas compactas con prioridad, asunto/contexto, fecha/hora y acciones. Su resumen mantiene los conteos; no se suprimen tareas por saturación visual. Las tarjetas que estaban marcadas Registrar resultado no demuestran que hubo actividad real.

## Corrección histórica y pruebas

Corregir / cerrar registro anterior permite cerrar una cita incompleta conservando los campos originales. No exige inventar participante, inmueble ni duración. Pide motivo/resultado; para realizada/no asistió exige fecha real o declaración explícita de fecha desconocida. La corrección se guarda con responsable, fecha de registro, estado anterior y resultado. Usa comparación de la instantánea actual para no borrar una edición concurrente, ocupación por referencia y sincronización recuperable del mismo evento.

Un bloqueo sin citaId se libera solamente tras revisión explícita, coincidencia de inmueble y ausencia de otra cita que lo explique. Si sigue siendo ambiguo, se conserva como revisión de ocupación separada. Una sincronización pendiente se repara antes de modificarla.

El operador identificó siete tarjetas de prueba en su captura: Mini Departamento Serdan (08/08 11:30, 27/08 17:00, 07/09 09:30); Cuarto 8 Dr Manuel Pereyra Mejia 124 (27/08 11:30 y 17:30); ADN YANG 10 Suite Sierra (07/10 09:00 y 09:30), todas de 2026. `scripts/archive-radar-test-events.cjs` selecciona exactamente esos títulos/fechas/horas. No selecciona el seguimiento de Dana ni fichas de contacto/otras operaciones.

El script parte en modo de revisión. Con --apply exige un directorio nuevo de respaldo privado, relee las coincidencias antes de escribir y aplica un PATCH atómico de campos concretos: cancelada, clasificación explícita como prueba e historial; nunca realizada. Mantiene los datos originales y libera solo ocupaciones con citaId propio, en la fecha esperada. No adivina bloqueos sin referencia. Una coincidencia ausente, duplicada, ya cerrada inesperadamente, pendiente de sincronizar o cambiada detiene el lote. Las comprobaciones antes/después no equivalen a un CAS contra escritores externos entre la última lectura y el PATCH: se debe ejecutar sin editar simultáneamente esas siete citas. La limpieza real todavía no está aplicada; se ejecuta desde el CLI autenticado del Mac, con respaldo fuera de Hosting.

## Horario semanal

Los siete días tienen interruptor y rangos independientes. Se copian horarios desde un día a destinos elegidos en el borrador; no se publican por copiar ni por activar una casilla. El guardado valida horas, fin posterior, cruces, rangos compatibles con duración y valores de traslado. Conserva campos desconocidos y el margen cero. Los días ausentes no se abren solos. Una transacción compara la versión leída para impedir sobreescribir cambios remotos; la interfaz conserva el borrador para revisar o recargar.

La disponibilidad publicada sigue siendo la fuente de Reservar y Atención. Se muestra un conteo teórico semanal antes de citas/bloqueos/traslados. No se cambió la semana real en producción durante las pruebas.

## Inventario operativo

En Inmuebles aparecen conteos, búsqueda, filtro y distintivo Disponible / En contrato de alquiler / En mantenimiento / Por confirmar. La publicación conserva su indicador independiente. Los registros sin clasificación quedan Por confirmar, no se infiere vacancia por estar publicados. Guardar estado es una acción explícita, protegida por permisos y comparación de la clasificación actual; conserva otros campos del inmueble.

`inventario` solo contiene estado operativo informado y fecha de actualización; no se colocan datos de arrendatarios, avales o contratos privados en propiedades, que es un nodo público. Es una declaración operativa del responsable, no una validación jurídica ni evidencia automática de contrato. En contrato/mantenimiento excluyen nuevas horas de visita en Reservar y Atención, y el escritor interno de Agenda impide nuevas visitas. No se cancelan citas existentes automáticamente. Los registros Por confirmar mantienen el comportamiento de revisión humana anterior.

No se modifica el motor probatorio de Property Core ni se afirma una garantía global frente a escritores/sitios antiguos. El estado no verifica por sí solo documentos ni titularidad.

## Expediente de renta y aval

Renta permite el rol Aval, vinculado a una persona existente del Directorio. El formulario muestra nombre y teléfono de la ficha para evitar otra captura de identidad. Añade ciudad del inmueble, domicilio/ciudad del aval, fecha de comprobante opcional, revisión Pendiente / Recibido / Revisado actualizado y confirmación manual de residencia en la misma ciudad. El formulario no aprueba un expediente por guardar estos datos; pueden quedar pendientes mientras se reúnen.

Los perfiles ADN YIN/YANG pasan a versión v2 e incluyen nombre completo de arrendatario y aval, sus teléfonos, INE y el requisito de comprobante actualizado con residencia local. No se inventa una antigüedad máxima para el comprobante. No cambian plazo/depósito/amenidades ni se trasladan condiciones ADN a Casa Login u otros inmuebles sin perfil configurado. Los paquetes de condiciones anteriores requieren volver a compartirse bajo la versión nueva.

Este cambio registra datos y revisión documental. No habilita adjuntar/custodiar INE o comprobantes en BUNKER, generar contratos ni enviar documentos automáticamente. Los datos del aval se guardan en la operación privada, no en el catálogo público.

## WhatsApp y contacto

Directorio ofrece Abrir WhatsApp cuando el número registrado es válido. La acción lleva a wa.me/52 seguido del número; no incluye mensaje ni confirma un envío. Guardar contacto genera una vCard local con nombre completo y teléfono, escapando los separadores de campos. Atención ofrece el mismo acceso para un teléfono registrado en la conversación. La creación de una ficha conserva el formulario habitual; no sincroniza automáticamente la agenda de WhatsApp ni manda mensajes.

## Validación y despliegue

202 pruebas de aplicación/DOM/prototipo aprobadas y 21 comprobaciones con SDK real del RTDB Emulator, permisos equivalentes a los aplicados y datos ficticios. Incluyen cierres históricos incompletos, respaldo/selección exacta de pruebas, rangos/competencia de horarios, estados de inventario, privacidad del aval, navegación y enlaces/vCard sin envío. Las acciones reales de clientes, inventario, horarios y los siete registros de prueba aún no se han cambiado durante esta preparación.

Requiere Functions synapse-attention (configuración actualizada de requisitos) y Hosting; no cambios de reglas. La inspección visual de la versión desplegada queda pendiente de publicación. No se afirma prueba móvil real.
