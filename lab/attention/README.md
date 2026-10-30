# Continuidad de Synapse Attention · revisión V0.1

Prueba local del panel de continuidad, invitación, monitor y registro de reserva.
No escribe datos reales. No incorpora autenticación, mensajería persistida ni un
gateway de producción; el gateway en la vista es solo una simulación en memoria.

```bash
node --test lab/attention/continuity-contract.test.cjs lab/attention/preview.test.cjs
node lab/attention/build-preview.cjs /workspace/synapse-panel-continuidad.html
```

`fixtures/public-snapshot.json` conserva una copia de las publicaciones y horarios
públicos consultados. Las horas se obtuvieron ejecutando el generador real del
HTML publicado en una VM sin acceso a red ni a `process`/`require`. No contiene
teléfonos, nombres de clientes, direcciones exactas, coordenadas ni folios reales.
La copia no se actualiza sola; no usarla como autoridad para reservar.

El contrato recibe el gateway compartido del portal; rechaza respuestas parciales
o para otro inmueble/horario. La exclusión concurrente, persistencia, idempotencia
y autorización deben comprobarse en ese gateway con RTDB antes de publicar.

Especificación: `docs/synapse-attention/continuidad-v01.md`.
