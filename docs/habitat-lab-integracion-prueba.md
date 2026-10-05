# Habitat Lab — prueba integral de reserva (solo emuladores)

Estado: experimental. No desplegar ni mezclar con main.

## Aislamiento
La versión de laboratorio de `reservar.html` rechaza dominios distintos de localhost/127.0.0.1 y fuerza RTDB `demo-synapse-lab` en 127.0.0.1:9000 y Auth en 127.0.0.1:9099. **Nunca probar contra datos reales**. El formulario necesita `lab/habitat/habitat-availability.js` y `lab/habitat/habitat-slot-claim.js` bajo el mismo servidor HTTP.

## Procedimiento manual
1. Arrancar Firebase RTDB/Auth emulators y verificar namespace `demo-synapse-lab`.
2. Cargar los fixtures ficticios LAB-HAB-PROP-01/YANG-01 disponibles y LAB-HAB-PROP-02/YANG-02 ocupados; configurar horarios de laboratorio.
3. Abrir dos ventanas privadas del formulario local, seleccionar el mismo horario futuro libre de YANG-01 y preparar dos identidades ficticias.
4. Confirmar casi simultáneamente. Verificar un solo `citas_publicas/{fecha_hora}` con `status:confirmed`, `citaId` del ganador, y exactamente una `citas/{citaId}` vinculada.
5. Verificar que el perdedor recibe aviso de horario tomado, que YANG-02 no permite visita y que otros horarios libres siguen visibles.
6. Repetir la prueba `node habitat-slot-claim.test.js` y `node habitat-slot-claim.emulator.test.js` desde el directorio con `firebase@10.7.1`.

## Fallos pendientes / puerta de salida
- El claim queda `confirmed` antes de crear lead y cita. Si estas escrituras fallan, puede quedar un horario huérfano. **No está listo para producción**.
- Falta una operación privilegiada de reconciliación/compensación, con comprobación de propiedad del claim y trazabilidad append-only. No borrar desde cliente.
- Falta validar reglas RTDB y disponibilidad/versiones de unidad en autoridad confiable.
- El modelo actual usa clave global fecha_hora, no slots independientes por unidad.
- Una prueba manual no sustituye pruebas de fallo inducido, recarga entre operaciones, concurrencia entre clientes independientes y reglas.
