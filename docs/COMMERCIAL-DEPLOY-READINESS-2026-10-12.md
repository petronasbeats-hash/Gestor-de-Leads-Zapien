# Synapse Comercial — Gate de preparación de despliegue (12 octubre 2026)

**Estado: NO AUTORIZADO PARA DEPLOY.** Documento de auditoría; no modifica comportamiento.

## Fuente verificada
- Rama `main`: `index.html` (2476 líneas), `agenda.html` (610), `reservar.html` (645).
- No se encontró `firebase.json`, `.firebaserc` ni `package.json` en la raíz de `main` al consultar GitHub.
- Existe evidencia de trabajo local anterior sobre un `index.html` de ~3165 líneas; **no está demostrada** la equivalencia entre GitHub, copia local y versión desplegada.
- `synapse-gate-lab` y su Recovery V3.2 son un proyecto de laboratorio independiente. No deben bloquear el deploy comercial ni incorporarse por accidente.

## Riesgo confirmado por lectura de código
- `index.html` marca `citas_publicas/{fecha}_{hora}` con `.set()` antes de completar la escritura de `citas` (aprox. línea 1866). Si una etapa posterior falla, existe riesgo de horario ocupado sin cita. No se ha probado el comportamiento de la versión local más reciente.
- `agenda.html` y `reservar.html` escriben tanto `citas_publicas` como `citas` en un `db.ref().update(updates)` (aprox. líneas 564 y 596). Esta atomicidad multipath es distinta de la ruta manual del administrador. **No concluir** que toda reserva pública tiene el mismo fallo.

## Gate antes de producción
- [ ] Obtener versión local más reciente de `index.html`, `agenda.html`, `reservar.html`, `404.html`, `firebase.json` y `.firebaserc`; identificar hashes y diferencias respecto de `main`.
- [ ] Confirmar qué archivos y configuración corresponden al sitio efectivamente desplegado.
- [ ] Revisar reglas de Firebase y permisos, sin exponer secretos ni escribir en datos reales durante pruebas.
- [ ] Unificar la reserva manual para no dejar `citas_publicas` huérfanas cuando falla la creación de la cita.
- [ ] Probar reserva pública, reserva manual, cambios de estado, cancelación/liberación de horario, cambios de inmueble, vinculación de leads y retrocompatibilidad multiunidad.
- [ ] Probar idempotencia/concurrencia, errores de red y recuperación ante escritura parcial en emulador o entorno aislado.
- [ ] Preparar respaldo, plan de rollback y lista de archivos exactos para deploy.
- [ ] Obtener autorización explícita antes de desplegar a producción.

## Caso de aceptación: Heber y Nora
Una visita para Heber el 12/10/2026 17:30 en 16 Norte Departamento 6; Nora queda como lead relacionado y posible cohabitante, sin asistencia programada. La cita previa de Nora solo podrá conciliarse al comprobar que es la misma oportunidad; conservar procedencia, historial y trazabilidad. **No se han escrito estos datos en Firebase**.

## Alcance
Este archivo solo documenta hallazgos y próximos controles. No certifica disponibilidad de deploy ni implica aprobación para merge a `main`.


## Revisión adicional del flujo manual (12 octubre)
- En `index.html`, `crearLeadDesdeCitaManual` escribe `leads/{id}` antes de crear `citas/{id}` (aprox. 1813–1841). Si falla la cita, puede quedar un lead sin cita; requiere estrategia de recuperación o enlace posterior.
- En `index.html` (aprox. 1878–1889), el objeto `updates` contiene simultáneamente `citas/{id}` y `citas/{id}/historial/{traceId}`. **Riesgo adicional:** rutas ancestro/descendiente solapadas en una misma actualización multipath; comprobar contra emulador, no asumir que la escritura funciona.
- La escritura de `citas_publicas` se realiza antes de esas operaciones, agravando la posibilidad de una ocupación huérfana.
- En `agenda.html` y `reservar.html`, aunque la actualización multipath de `citas_publicas` y `citas` es conjunta, **no equivale a exclusión concurrente**: dos clientes podrían competir por el mismo horario sin una precondición transaccional o regla de seguridad adecuada. Requiere prueba específica con emulador.
- No modificar datos reales para probar estos escenarios.

## Criterios de aceptación específicos
1. Reserva manual: crea una cita y una ocupación vinculada, o ninguna ocupación nueva si falla.
2. Reserva pública: no permite dos confirmaciones exitosas incompatibles para el mismo horario.
3. Cambio/cancelación: libera solo la ocupación perteneciente a la cita correcta; preserva bitácora.
4. Reintento de red: no duplica lead ni cita cuando el primer intento sí se confirmó.
5. Falla de permisos: el usuario recibe error explícito y la base queda consistente.

## Decisión operativa — folio público de confirmación (12 octubre 2026)
- **No cambiar el flujo actual de Habitat en producción por ahora.** La reserva de Alexia Motte del sábado 17/10/2026 a las 10:00 debe conservarse sin recreación ni alteración.
- El WhatsApp actual comparte nombre, fecha/hora, dirección y ubicación, pero no muestra folio público. Es una **mejora pendiente**, no un incidente que justifique un hotfix inmediato.
- El usuario indica que la funcionalidad de folio ya fue revisada en laboratorio. **Recuperar y auditar esa implementación antes de escribir otra**, verificando si existe en una rama, archivos locales o documentación.
- Requisitos de aceptación: folio único y estable asociado a `citas/{id}`; visible al confirmar; compartible en WhatsApp; consultable en administración; conservarse al reprogramar; sin duplicar citas; compatible con registros anteriores sin folio; no exponer identificadores internos sensibles.
- Implementación en rama aislada, pruebas en entorno controlado y deploy solo tras aprobación expresa. No mezclar con Recovery V3.2.

## Backlog aprobado — Radar de Compromisos Comerciales (12 octubre 2026)

**Decisión del usuario:** aprobados los puntos 1, 2, 3 y 4; **aplazar implementación hasta concluir pendientes actuales** de consolidación y deploy comercial. No bloquear el deploy por este módulo.

1. **Tarjeta radar por oportunidad:** mostrar persona, inmueble, estado comercial, importes comprometidos, recibidos y pendientes, fechas de cada abono, siguiente acción, firma/entrega prevista y tareas de acondicionamiento. No confundir promesa de pago con pago acreditado.
2. **Seguimiento operativo inmediato:** conservar resultado de cita `Realizada / Interesado` independiente de etapa comercial `Apartado comprometido / pendiente de pago`; campos de próxima acción, fecha, prioridad y monto esperado.
3. **Radar automatizado reutilizable:** acciones del día, compromisos por vencer/vencidos, alertas de pagos, acondicionamiento, contrato y entrega; una alerta vencida no implica declarar incumplimiento sin validación. Registro de evidencias y cierre/reprogramación explícitos.
4. **Integración con agenda y trazabilidad:** evento/recordatorio de seguimiento sin duplicar reservas; secuencia `Visita → Interés → Compromiso → Recordatorio → Evidencia → Siguiente acción`. Preparar integración futura con Property Core y Cobranza Core.

**Piloto de aceptación:** Heber, 16 Norte Departamento 6, renta MXN 2,500; compromisos de MXN 1,250 el 14/10/2026 y MXN 1,250 el 20/10/2026, firma/entrega prevista 01/11/2026, tareas de electricidad, vidrios, limpieza, llaves y verificación CFE. Los importes son promesas hasta existir evidencia de recepción. No editar registros reales como parte de este backlog.

**Arquitectura:** genérico por `organizationId`, cliente, inmueble, cita y compromiso; no codificar excepciones específicas para Heber. Implementación en rama futura aislada, con pruebas y autorización de despliegue.
