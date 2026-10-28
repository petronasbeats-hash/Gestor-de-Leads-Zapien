# Contactos, operaciones y Agenda: primera versión operativa

Estado: código preparado en esta rama. No publicado ni validado contra las reglas
reales del proyecto. Fecha operativa: 27 de octubre de 2026, México.

## Uso

- `/contactos`: buscar antes de registrar; seleccionar una o varias clasificaciones.
  El proveedor admite especialidad sin teléfono ni datos de compraventa.
- Desde una ficha, agregar una operación y seleccionar sus participantes/roles.
  Una misma persona puede vender un inmueble y conservar otra relación de propiedad.
  La contraparte abre la misma operación, sin duplicar el expediente.
- Cada operación presenta Datos, Acciones e Historial. Registrar una evidencia
  exige una nota. Avanzar vuelve a comprobar requisitos y eventos actuales.
- Una operación existente puede comenzar en su etapa real con un motivo explícito.
  No se simula que sus etapas anteriores ocurrieron en Synapse.
- `/agenda`: calendario interno por día, semana o mes. Registrar tipo, asunto,
  participantes, lugar, fecha y duración. Una tarea sin hora no bloquea visitas.
- Guardar devuelve un folio `AGD-…`. Copiar confirmación prepara texto; no lo envía.
  Cambiar fecha o cancelar exige motivo. Marcar realizado/no asistió exige que el
  evento haya comenzado en la zona America/Mexico_City.
- Administración conserva el pipeline anterior y los datos existentes. Sus
  acciones de estado, cancelación y reprogramación abren el mismo evento en Agenda.
  Atención tiene enlaces a Contactos y Agenda en otra pestaña para conservar chat
  y avisos Nexo. Esta versión no transforma el chat en un calendario embebido.

## Acción rectora por flujo

| Flujo | Acciones principales |
| --- | --- |
| Venta | Registrar necesidades, visita, propuesta, acuerdo, documentación, escritura y cierre |
| Renta | Registrar necesidades, visita, requisitos, condiciones, contrato, entrega y seguimiento |
| Servicio | Registrar alcance/cotización, programar trabajo, registrar realización y cierre |
| Propiedad | Registrar relación y mantenerla vigente independientemente de otras operaciones |
| Otra relación | Registrar contexto y seguimiento |

Los eventos de visita/firma/entrega/servicio deben pertenecer a la operación y
constar como realizados para satisfacer la etapa. Una firma necesita las partes
correspondientes; una cita futura, cancelada o pendiente de sincronizar no basta.
Las comprobaciones humanas guardan nota, actor y fecha: son declaraciones del
operador, no validación documental, jurídica ni aceptación automática del cliente.

## Datos y permisos

Se reutilizan las rutas privadas `leads` y `citas`, sin migrar identificadores ni
añadir una raíz de contactos pública. La estructura `_synapse` de cada contacto
contiene clasificaciones, operaciones y referencias a operaciones compartidas.
Las mutaciones de contactos usan transacción sobre `leads`, conservan campos
desconocidos/bitácora y revisan versión e idempotencia. Un teléfono compartido
requiere revisión y nunca fusiona personas; su índice conserva la ficha anterior.

Los eventos privados incluyen participantes, lugar e historial. `citas_publicas`
solo recibe identificadores y ocupación: no nombres, teléfonos, asuntos o notas.
La persona que ancla el almacenamiento de una operación no representa por ello
al propietario legal. Las clasificaciones tampoco otorgan permisos de acceso.

La primera versión utiliza al administrador existente, con capacidad global.
No incorpora delegación multiagente. La transacción sobre todos los contactos
supone lectura y contención de ese conjunto privado; para mayor escala deberán
separarse agregados con un servicio de autorización y migración explícita.

## Ocupación, concurrencia y recuperación

Antes de guardar se releen horarios, bloqueos, citas y contactos; una visita
comprueba además su inmueble publicado. Una transacción de ocupación reclama el
intervalo y todos los horarios públicos semanales que cruza. El evento privado se
guarda con versión y después se finaliza la proyección. Reservar relee sus cuatro
fuentes y reclama la clave con transacción condicional. Las visitas/HOLD manuales
también protegen intervalos completos.

No es una transacción única entre todas las raíces: si falla la finalización,
el evento queda con sincronización pendiente y conserva ocupación conservadora.
Abrir el mismo evento y usar **Completar sincronización** reintenta la misma
acción, sin duplicar historial. No compartir una confirmación de horario mientras
aparezca ese estado. Un fallo antes de guardar el evento revierte solo sus propias
reclamaciones. La limpieza de huérfanos exige ausencia del evento privado y
vencimiento del bloqueo técnico; no equivale a caducidad comercial de un HOLD.

Una cita antigua con bloqueo sin `citaId` no se libera por inferencia. El formulario
ofrece confirmar la revisión de la cita original. Solo acepta un marcador simple,
el mismo inmueble y ausencia de otra cita privada activa en ese intervalo. Guarda
la revisión en el historial; si no coincide o es ambiguo, requiere revisión
adicional y conserva el bloqueo. Un fallo privado restaura el marcador original.

La protección cubre los escritores actualizados del sitio `synapse-core`.
Otros sitios, pestañas con código antiguo, cambios de configuración durante una
reserva o escrituras externas pueden ignorarla. No se afirma exclusión global
contra todos esos escritores: requiere gateway y reglas reales validadas.

## Activación

Preparar una copia aislada del commit y ejecutar desde ella:

```bash
node scripts/check-workspace-access.cjs \
  --project gestor-leads-zapien \
  --instance gestor-leads-zapien-default-rtdb
```

Este paso lee reglas con el Firebase CLI ya autenticado, sin imprimir UID ni
credenciales y sin modificarlas. Verifica las expresiones conocidas del dueño,
permisos de transacción y esquemas compatibles. Ante
`WORKSPACE_PERMISSIONS_REQUIRE_REVIEW` detener la publicación y revisar la salida
de comprobaciones; no habilitar escritura pública ni cambiar reglas por intuición.
El archivo temporal de reglas se elimina al terminar.

Si pasa, construir la salida nueva con `build-attention-release.cjs --site
synapse-core --legacy-root RUTA_ORIGINAL --out RUTA_NUEVA`, y publicar desde esa
salida con `firebase deploy --only hosting --project gestor-leads-zapien`.
No se necesitan funciones nuevas, instalación de paquetes ni cambios de ACL para
esta publicación. La salida contiene dependencias estáticas del sitio anterior;
el constructor falla si faltan. No mezclar la raíz de trabajo sucia con la salida.

Después de publicar: verificar `/contactos`, `/agenda`, `/reservar` y Atención;
confirmar con dos sesiones que un intervalo ocupado deja de ofrecerse. Revisar
primero los clientes existentes y luego clasificarlos/vincularlos explícitamente.
Esta implementación no crea eventos reales ni reclasifica personas automáticamente.

## Verificación y límites

Verificación de esta versión: 111 pruebas de aplicación y 11 comprobaciones del
emulador pasaron. La construcción completa produjo 37 archivos, 21 públicos;
se verificaron sus hashes y el WAV Nexo conserva el SHA-256 aprobado.

La suite de aplicación cubre modelo, formularios DOM, portal público, escrituras
manuales anteriores, compatibilidad, permisos de preflight y regresiones de
Atención/Nexo. El emulador aislado usa únicamente `demo-synapse-workspace`, datos
ficticios y SDK cliente real; prueba permisos privados, idempotencia, concurrencia,
cancelación, proyección pública, bloqueos legados y cruce de escritores públicos.
Sus reglas son una fixture: no prueban las reglas reales de producción.

```bash
npm ci --prefix lab/workspace --ignore-scripts
npm ci --prefix attention-functions --ignore-scripts
node --test tests/workspace*.test.cjs tests/public-slot-claim.test.cjs
npm exec --yes --package=node@22.14.0 --package=firebase-tools@14.22.0 -- \
  firebase emulators:exec --only database --project demo-synapse-workspace \
  --config lab/workspace/firebase.json 'node lab/workspace/emulator.test.cjs'
```

No hay verificación visual en navegador de esta versión todavía. No se habilitan
recordatorios programados, envío automático, generación/firma de contratos,
reservas dentro del chat ni vencimiento comercial de HOLD. La Agenda nueva no
permite crear provisionales hasta implementar ese ciclo. Los eventos con hora
son del mismo día. `/agenda.html` permanece como página pública antigua; la agenda
interna es `/agenda`. El sitio `gestor-leads-zapien.web.app` no se despliega aquí.
