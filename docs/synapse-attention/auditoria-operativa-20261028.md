# Auditoría operativa de Synapse — 28 de octubre de 2026

## Dictamen

La base original está conservada; la integración funcional sigue incompleta. El riesgo principal es la convivencia de varios escritores, identidades y listas de pendientes, no la pérdida general de las pantallas originales. Conservar un control en el código no demuestra que su flujo sea equivalente de extremo a extremo.

Alcance: comparación del `index.html` original en `9f4a6694cfa38274877fff32b7b95fad5fc3375e` con la rama `lab/attention-continuity-v01` en `6bdd40e106168f1b00b746f1945a33d3745b19bd`; código de servidor/consumidores, pruebas sintéticas y rutas públicas. Publicación de referencia: `f748626`, 39 archivos verificados previamente. Los dos commits posteriores solo preparan el importador del local.

No se autenticó el panel privado ni se leyeron conversaciones reales, documentos, pagos o las reglas actuales con privilegios administrativos. No se puede atribuir la falta de respuesta de un cliente concreto a una causa técnica sin inspeccionar su atención y contrastar el canal original. No se crearon citas, mensajes, contactos, cobros o cambios de permisos durante esta auditoría.

## Evidencia de conservación

- Los 132 IDs de controles/elementos originales están en el administrador actual; sus campos de formulario también. De 74 funciones nombradas originales se conservan 72; las dos del editor semanal se sustituyeron por el nuevo módulo. Esto es evidencia estructural, no certificación funcional.
- `scripts/build-attention-release.cjs` publica `workspace.html` como portada y conserva el administrador en `administracion.html`.
- Pipeline, protocolos, resumen, citas anteriores y exportación/importación continúan en `/administracion?legacy=1`, accesible desde Configuración.
- Directorio, relaciones multirrol, Agenda y Radar consumen `/leads` y `/citas`; Atención tiene su propio almacenamiento y bitácora bajo `/atencion_v1/orgs`.
- Las 13 rutas inspeccionadas respondieron HTTP 200: portada, Directorio, operaciones, Agenda, horarios, Inmuebles, Configuración, administrador anterior, Reservar, operador, atención, Leia y health. Un HTTP 200 no demuestra autorización o funcionamiento privado.
- Suite previa a cambios: 202 pruebas aprobadas, cero fallos. Son pruebas del alcance implementado, no evidencia de que todos los canales estén conectados.

## Hallazgos prioritarios

| ID / prioridad | Hallazgo y efecto | Evidencia | Mejora y aceptación |
|---|---|---|---|
| A01 · Alta | Reservar y Agenda no comparten una única operación atómica de reserva. El público ocupa una clave de inicio y el interno un intervalo. Una lectura reciente no evita toda carrera entre escritores distintos. | `reservar.html` confirma con `SynapsePublicSlot.claim`; `shared/public-slot-claim.js` distingue claim y claimInterval; `shared/workspace-store.js` arbitra intervalos. | Gateway único de intervalos, idempotencia y folio. Probar dos peticiones concurrentes con inicios diferentes pero solapados, entre canal público e interno; exactamente una debe reservar. No cambiar reglas antes de migrar los clientes públicos. |
| A02 · Alta | Radar no incluye mensajes ni siguientes acciones de Atención. Un pendiente puede estar en el monitor/reporte y faltar en la portada. | `shared/workspace-radar.js:build` solo consume leads/citas; `server/attention-journal.cjs:dailyReport` calcula otra lista. | Una proyección privada común de pendientes, por organización/responsable, con referencia a su origen y cierre idempotente. Una respuesta de cliente crea una sola acción visible en Radar y Atención. |
| A03 · Alta | Messenger y WhatsApp no tienen conectores de mensajes en esta versión. Copiar texto o pulsar wa.me no acredita envío, entrega ni lectura. | Rutas de `server/attention-http.cjs`; enlaces en `shared/workspace-model.js`; polling en `web/attention/attention.js`. | Elección de canal y continuidad manual registrada desde ahora; conectores oficiales en una fase posterior. Estados y métricas deben declarar su fuente y nivel de confirmación. |
| A04 · Alta | Cambiar teléfono revocaba también el enlace de invitado, aunque su acceso depende del secreto del navegador y no del número. Puede interrumpir una atención que estaba funcionando. | `server/attention-service.cjs:updateContact`, prueba de invitado anterior. | Corrección preparada en esta entrega: conserva el vínculo de invitado sin verificar, el hilo y la caducidad. El acceso vinculado a teléfono verificado sigue revocándose cuando cambia el número. No reabre enlaces ya revocados. |
| A05 · Alta | El enlace vence a las 24 horas; emitir otro rota el hilo. Retirar la publicación del inmueble también impide consultar la atención existente. | `invite`, `resolveInvitation`, `inspect` y `guestView` en `server/attention-service.cjs`. | Mostrar vencimiento y causa de inaccesibilidad, avisar al agente antes de rotar, y diseñar recuperación autorizada con continuidad. Separar publicación del catálogo y permisos para continuar una conversación existente. No ampliar acceso o duración silenciosamente. |
| A06 · Alta | «Exportar backup» exporta únicamente `/leads`, incluyendo sus operaciones anidadas. No es respaldo completo del sistema. Importar combina/sobrescribe campos de registros y no es un restore integral con revisión. | `index.html`, manejadores `btn-export`, `import-file` y `saveLead`. | Respaldo versionado privado de contactos/operaciones/citas/catálogo/horarios/Atención; referencias, manifiesto, revisión previa, exportación e intento de restauración en entorno aislado. No incluir credenciales ni publicarlo en Hosting/Git. |
| A07 · Alta | El catálogo y los permisos de Atención se administran por mecanismos distintos. Dar de alta/publicar un inmueble no lo agrega al alcance de una organización/agente. | `server/attention-firebase-authority.cjs:agent`; `catalog`; importador del local no modifica ACL. | Asistente de habilitación: ficha → disponibilidad → publicación → organización/responsables autorizados → prueba de atención. Mostrar qué paso falta sin ampliar permisos automáticamente. |
| A08 · Alta | En Arcadia y Parque Hidalgo las condiciones están en descripción, pero no en el perfil estructurado que usa «Compartir requisitos y condiciones». | `shared/lease-continuity.js` solo lee perfiles/overrides; `lease-config.json` tiene perfiles ADN y cero overrides. | Perfil versionado por inmueble: plazo, política de depósito, importe, periodo compensatorio y requisitos confirmados. Las incógnitas impiden afirmar requisitos/cargos definitivos. No heredar a ADN. |
| A09 · Media | Hay tres contextos de persona: lead/contacto, participante de operación y conversación de Atención. El vínculo explícito se realiza al reservar; aún no es una ficha personal común completa. | `shared/workspace-model.js`, `shared/attention-booking.js`, `server/attention-service.cjs:recordVisit`. | Reutilizar contactId con revisión de coincidencias; mantener alias de canal y fuente original. Unir historial por referencias sin fusionar personas automáticamente por nombre o teléfono. |
| A10 · Media | El borrado antiguo de inmuebles no comprueba referencias a citas/operaciones. El borrado de contacto comprueba operaciones, pero no todas sus citas. | `index.html`, acción remove de propiedades y `deleteLeadRemote`. | Archivar/baja lógica, revisión de dependencias y snapshots históricos. Un inmueble retirado o contacto archivado no debe impedir consultar el historial ni cerrar una actividad real. |
| A11 · Media | Inmuebles usa todavía el editor administrativo largo. No presenta la ficha compartida de Reservar con herramientas operativas. | `index.html:property-workbench` y vista pública separada. | Catálogo visual y ficha con Ficha / Atención y visitas / Arrendamiento / Historial; publicación, inventario y condición física como estados separados. Edición progresiva. |
| A12 · Media | Los protocolos e indicadores anteriores siguen accesibles, pero no están conciliados con las operaciones nuevas. Los contactos nuevos pueden tener etapa heredada «contacto» sin equivalencia comercial. | `saveContact` y pipelines nuevos; dashboard y protocolos en `index.html`. | Migración explícita con vista previa. Medir personas, operaciones, visitas y cierres separadamente; no tratar una persona con varios roles como varias ventas. |
| A13 · Media | Lecturas y transacciones crecen con todo `/leads` o con la organización completa de Atención. Los avisos dependen del monitor abierto y polling. | `shared/workspace-store.js:contactCommand`; `server/attention-store.cjs`; polling de 5/15 segundos. | Medir volumen/latencia, proyecciones e índices por acceso, inbox incremental y avisos globales. Push del navegador es una capacidad futura, no la firma sonora actual. |
| A14 · Media | El paso a contrato, recordatorios y sincronización con motores todavía no está completo. El motor de recordatorios existe como cálculo, pero health mantiene reminders:false. | `server/visit-reminders.cjs`; `attention-http.cjs`; configuración/consumidores de laboratorio. | Integrar por fases con estado de capacidad veraz. Ninguna casilla, fecha vencida o cita realizada debe activar un contrato, obligación financiera o disponibilidad por sí sola. |

## Riesgos que requieren verificación adicional

Las reglas compartidas previamente por el operador conservaban creación pública y lectura por número de índice. Las fixtures observadas no son una lectura administrativa actual. El diagnóstico `check-workspace-access.cjs` comprueba compatibilidad funcional; sus valores true no certifican seguridad ni permisos por organización. Auditar reglas reales y retirar escritores públicos antiguos de forma coordinada con el gateway (A01), sin bloquear reservas existentes ni probar ataques/escrituras en producción.

No se inspeccionó el móvil real ni se certificó accesibilidad completa por teclado/lector; los controles tienen pruebas DOM parciales. Antes de retirar el panel anterior hace falta una matriz de paridad y recorrido autenticado completo con datos sintéticos.

## Orden recomendado

1. Continuidad de atención: A02–A05, con canal elegido, responsable y próxima acción; publicar primero la corrección acotada A04.
2. Integridad y recuperación: A01, A06, A07, A10; un solo escritor por proceso y respaldo restaurable.
3. Ficha común y condiciones: A08, A09, A11, A12.
4. Integraciones de solo lectura con Property Core y Cobranza Core; después activación verificada, traslados de referencias e inbox/outbox persistentes.
5. Automatización y crecimiento: A13–A14, con medición y gates explícitos.

No se recomienda otra reestructuración general ni eliminar el administrador anterior ahora. Conviene completar recorridos concretos: consulta → respuesta por canal elegido → visita → resultado → requisitos → contrato → entrega → seguimiento.

## Validación de esta entrega

Se reprodujeron A01 y A02 únicamente con datos sintéticos en memoria: una clave pública de 09:00 se pudo agregar junto al intervalo interno 09:10–09:40, y una acción de Atención no creó un pendiente en Radar. No se reprodujeron con reservas reales.

La entrega añade contratos/consumidores puros de integración y la corrección A04. Suite ampliada: 215 pruebas, cero fallos; incluye 12 de fronteras de integración y una regresión adicional de continuidad. El build mantiene 39 archivos públicos, 55 archivos totales incluyendo manifiesto; el nuevo módulo de integración no se incorpora al paquete desplegable ni está conectado al navegador. No se reejecutaron las pruebas Firestore del repositorio de Cobranza ni los gates productivos.

La selección de canal por el cliente, bandeja unificada de Radar, respaldo completo, gateway único, perfiles de Arcadia/local y conectores externos siguen siendo trabajo pendiente: no se presentan como activados por estos documentos.
