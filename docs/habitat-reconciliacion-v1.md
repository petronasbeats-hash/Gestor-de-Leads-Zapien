# Habitat Lab · Reconciliación autorizada V1

Estado: diseño de laboratorio. No desplegar a producción.

## Problema validado

El flujo público actual puede llegar a este estado:

1. `claimSlot()` gana la transacción en `citas_publicas/{slotKey}`.
2. El slot queda `status: "confirmed"`.
3. Falla la creación posterior de `citas/{citaId}`.
4. El slot queda huérfano.

La auditoría de integridad ya detecta este caso como:

`CONFIRMED_SLOT_WITHOUT_CITA`

## Principio

El navegador público NO debe liberar ni reparar slots confirmados.

La reconciliación debe ejecutarse bajo autoridad confiable (Admin SDK / Cloud Function / proceso de servidor) y debe ser idempotente.

## Invariantes

- Un slot confirmado pertenece exactamente a un `citaId`.
- Un slot confirmado no se elimina si su propietario cambió.
- La reconciliación nunca crea una segunda cita para el mismo slot.
- La recuperación puede repetirse sin cambiar el resultado.
- Toda reparación genera evidencia de sistema.
- Si hay ambigüedad, se marca para revisión; no se adivina.

## Estados propuestos

En `citas_publicas/{slotKey}`:

- `confirmed`: claim válido y cita existente.
- `recovery_required`: claim confirmado sin cita asociada.
- `released_by_reconciler`: tombstone opcional, sólo si la UI aprende a ignorarlo.

No introducir `released_by_reconciler` en producción todavía: la UI actual considera ocupado cualquier nodo existente.

## Estrategia V1 segura

### Detectar

Leer:

- `citas_publicas/{slotKey}`
- `citas/{slot.citaId}`

Si el slot está confirmado y la cita no existe, registrar incidencia.

### Reparar

Dos políticas posibles:

A. **Completar cita** si existe evidencia suficiente y durable para reconstruirla.
B. **Liberar slot** sólo si la operación es autorizada, el slot sigue perteneciendo al mismo `citaId` y no existe cita.

Para el flujo actual, V1 debe preferir B porque el claim no contiene todos los datos del cliente necesarios para reconstruir una cita completa.

### Compare-and-delete autorizado

La liberación debe usar una transacción del lado servidor:

```js
ref.transaction(current => {
  if (!current) return;
  if (current.citaId !== expectedCitaId) return;
  if (current.status !== "confirmed") return;
  return null;
});
```

Después debe verificarse que la transacción haya sido comprometida.

## Evidencia

Registrar bajo un log de sistema separado:

`system_events/{eventId}`

Campos mínimos:

- `type: "HABITAT_ORPHAN_SLOT_DETECTED"`
- `slotKey`
- `citaId`
- `detectedAt`
- `action`
- `result`
- `source: "habitat_reconciler_v1"`

No incluir datos personales innecesarios.

## Próxima prueba

Crear un reconciliador exclusivo de emulador que:

1. cree un fixture huérfano;
2. lo detecte;
3. ejecute compare-and-delete con autoridad de servidor;
4. confirme que el slot desaparece;
5. repita la reconciliación y compruebe idempotencia;
6. pruebe que rechaza borrar un slot cuyo `citaId` cambió.

## Bloqueadores antes de producción

- Firebase Admin SDK / función confiable.
- Reglas RTDB que impidan a clientes públicos reparar o borrar claims.
- Prueba de idempotencia.
- Prueba de cambio de propietario.
- Event Trace / system event persistente.
- Decidir migración futura de `slotKey` global a alcance por unidad.
