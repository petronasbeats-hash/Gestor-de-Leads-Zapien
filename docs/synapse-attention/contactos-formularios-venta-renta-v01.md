# Contactos y formularios de venta/renta

Estado: definición de flujo para implementación; no modifica el formulario publicado.
Fecha: 27 de octubre de 2026. Complementa agenda-unificada-flujo-v01.md.
Los ejemplos de este documento son genéricos y no contienen datos de clientes.

## Ficha única de persona

El módulo se presenta como Contactos. Sus clasificaciones son Prospecto, Cliente,
Proveedor de servicios, Aliado profesional y Colaborador. Se admiten varias
clasificaciones; ninguna obliga a pasar por un embudo comercial.

La ficha común contiene nombre o alias del canal, apellidos disponibles, teléfono,
correo opcional, fuente de origen, canal de entrada y notas. La captura inicial
admite datos pendientes; no inventa un teléfono ni exige documentos de contrato.
Para confirmar una visita se completan nombre y contacto según el flujo de reserva.
Una reclasificación conserva origen, historial e identificador.

Antes de crear una ficha se buscan coincidencias de teléfono y nombre. Una
coincidencia propone revisar el registro existente; no fusiona personas por
suposición ni trata un teléfono familiar compartido como identidad verificada.

## Relaciones y operaciones

El contacto tiene un identificador estable. La venta o renta tiene otro y agrupa
inmueble, participantes, roles, condiciones y etapa. Los roles pertenecen a la
participación en una operación o a una relación con un inmueble/conjunto.

Una persona puede ser vendedora del inmueble A, propietaria del conjunto B y
compradora del inmueble C. Se mantiene una ficha de persona y relaciones
independientes. Ser propietario no acredita por sí mismo un mandato de gestión,
la condición de arrendador en un contrato ni una autorización de acceso.

La misma operación puede tener varios vendedores, compradores o participantes.
Su contraparte se selecciona desde Contactos; no se mantiene un único enlace
global que se sobrescriba cada vez que la persona realiza otra operación.

## Captura progresiva

1. Buscar o registrar el contacto y sus clasificaciones.
2. Elegir Agregar relación / operación. Seleccionar venta, renta, propiedad,
   servicio u otra relación pertinente, y el rol de la persona.
3. Vincular un inmueble o conjunto existente, o guardar una referencia privada
   pendiente de identificar. Crear una operación privada no publica un inmueble.
4. Mostrar únicamente los campos correspondientes al rol. Precargar los datos
   existentes sin borrar los de otras relaciones.
5. Vincular las contrapartes y registrar la etapa real de esa operación.
6. Guardar y ofrecer siguiente acción, evento de Agenda o resumen de atención.

Las vistas Contacto, Relaciones/operaciones, Agenda y Bitácora se presentan en
pestañas compactas. Presupuesto, precio, condiciones y seguimiento de una
operación no se confunden con datos permanentes de la persona.

## Campos por formulario

| Formulario | Datos específicos iniciales | Datos que se completan al avanzar |
| --- | --- | --- |
| Venta: comprador | Inmueble de interés o búsqueda, rango de presupuesto si lo conoce, zona y plazo deseados | Forma prevista de compra, propuestas, precio acordado, contraparte y preparación de firma |
| Venta: vendedor | Inmueble ofrecido, relación con él, precio solicitado si existe, motivo/plazo de venta | Participación de copropietarios, información documental, autorización de comercialización, comprador y firma |
| Renta: interesado/inquilino | Inmueble o búsqueda, presupuesto mensual, fecha prevista de ingreso y necesidades del espacio | Plazo, requisitos aplicables, aceptación de condiciones, contrato y entrega |
| Renta: propietario/arrendador | Inmueble o conjunto, relación con él, renta pretendida y disponibilidad informada | Servicios incluidos/excluidos, depósito y plazo acordados para ese inmueble, requisitos, contrato e inquilino |
| Proveedor | Especialidad/oficio, contacto, zona de servicio y observaciones | Inmueble, orden de trabajo, alcance, presupuesto y fecha de cada servicio |
| Aliado/colaborador | Especialidad o función y contacto | Participación en expedientes, encargos y eventos pertinentes |

El interesado en renta puede indicar ocupantes o mascotas cuando sea relevante
para el espacio; no se añaden filtros basados en características protegidas.
Los documentos sensibles se solicitan en la etapa que los requiera y por un
canal autorizado. No son requisito del alta básica de contactos.

Los importes distinguen precio solicitado, presupuesto del comprador y precio
acordado. No se copia una política de depósito o plazo de un inmueble a otro.
Probabilidad y valor estimado son datos opcionales de seguimiento comercial,
no campos obligatorios para registrar un cliente, proveedor o propietario.

## Etapas, Agenda y bitácora

Las etapas y sus requisitos dependen de la operación. La firma pendiente o la
escrituración tienen seguimiento propio; clasificar a alguien como Cliente no
marca automáticamente una operación como Cerrado Ganado ni confirma pagos.

Una firma, visita, entrega o servicio abre el flujo de Agenda unificada y conserva
el vínculo con la operación y participantes. Para bloquear un intervalo se
requiere inicio y fin/duración. Una próxima acción con fecha no equivale por sí
sola a una reserva de calendario. Guardar participantes no envía invitaciones.

El historial registra altas, cambios de clasificación, roles y operaciones con
actor, fecha y motivo. Los resúmenes conservan hechos, pendientes y siguiente
acción. Los cambios de contacto del modo invitado requieren revisar la política
vigente de invalidación de enlace; no se declara resuelta en este documento.

## Compatibilidad y límites actuales

El panel publicado aún utiliza leads, con una operación/rol y una contraparte
por ficha. Sus notas permiten conservar información adicional temporalmente,
pero no constituyen un modelo estructurado de múltiples operaciones.
La implementación debe preservar identificadores, teléfono, bitácora, citas,
propiedades y relaciones existentes, con revisión antes de migrar o fusionar.
Los clientes cerrados deben poder vincularse a eventos; el selector manual
vigente excluye Cerrado Ganado y necesita adaptación.

La nueva persistencia requiere autorización privada y una estrategia de
compatibilidad. No se publican fichas personales, operaciones ni documentos
en el catálogo. Cambiar etiquetas visuales no basta para completar este flujo.

## Ejemplo y criterios de aceptación

Una persona registrada como Cliente vende el Lote A a otra persona y también es
propietaria del Conjunto B. Existen dos contactos, una compraventa con ambas
participaciones y una relación adicional de propiedad para el primer contacto.
Finalizar la compraventa conserva la propiedad del conjunto y su seguimiento.

- Cambiar el rol de una operación no borra otros roles ni crea otra persona.
- Registrar un proveedor no exige presupuesto de compra ni una propiedad.
- Crear una operación no sobrescribe la fuente de origen del contacto.
- Reclasificar un prospecto como Cliente conserva su ficha e historial.
- Las contrapartes se vinculan a la operación correspondiente y admiten pluralidad.
- Los formularios respetan datos pendientes y no inventan condiciones o cierres.
- Las citas se vinculan a contactos existentes, incluidos clientes de operaciones cerradas.
- La captura y consulta respetan organización, responsables y permisos privados.
