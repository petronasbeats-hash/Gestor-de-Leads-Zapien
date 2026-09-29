# Property Core V0.1 — Foundation LAB

Entorno aislado para demostrar el ciclo de vida de una unidad sin modificar Synapse Core en producción.

## Regla
Producción permanece intacta. Los datos de esta carpeta son sintéticos y llevan environment=LAB.

## Pruebas de aceptación
- TEST-PC-001: lifecycle completo AVAILABLE → HOLD → OCCUPIED → VACATED → TURNOVER → MAINTENANCE → VERIFIED → READY → AVAILABLE.
- TEST-PC-002: bloquear transición inválida OCCUPIED → AVAILABLE.
- TEST-PC-003: detectar segundo HOLD sobre una unidad ya apartada.
- TEST-PC-004: contrato mínimo de integración Synapse Adapter.

Cada transición válida genera un Event Trace append-only. Cada rechazo genera evidencia de conflicto sin mutar el estado.
