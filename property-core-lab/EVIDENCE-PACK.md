# Evidence Pack — Property Core V0.1 Foundation

## Execution result
Suite: PROPERTY_CORE_V01_FOUNDATION
Status: PASS

- PC001 lifecycle completo: PASS
- PC002 OCCUPIED → AVAILABLE rechazado: PASS
- PC003 segundo HOLD detectado como conflicto y primer HOLD preservado: PASS
- PC004 Synapse Adapter genera HOLD con source=SYNAPSE_ADAPTER: PASS

## PC001 demonstrated path
AVAILABLE → HOLD → OCCUPIED → VACATED → TURNOVER → MAINTENANCE → VERIFIED → READY → AVAILABLE

## Guarantees demonstrated
1. Una transición válida muta el estado y agrega UNIT_STATE_CHANGED al Event Trace.
2. Una transición inválida no muta el estado y agrega INVALID_TRANSITION_ATTEMPT.
3. Un HOLD competidor no sobrescribe el HOLD activo; agrega CONFLICT_DETECTED.
4. Una intención sintética de Synapse entra por el adapter y conserva source=SYNAPSE_ADAPTER.
5. Todos los objetos de prueba permanecen marcados environment=LAB.

## Scope
Prueba ejecutada fuera de Firebase/Firestore. No se modificaron index.html, agenda.html, reservar.html ni datos de producción.

## Gate
FOUNDATION ENGINE: PROVEN
FIRESTORE INTEGRATION: NOT YET ENABLED
PRODUCTION: UNTOUCHED
