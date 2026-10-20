# Synapse PWA — verificación estática del repositorio

Fecha: 2026-10-20. Rama: `feature/synapse-pwa-installable-v1-20261020`.

## Inspección directa de archivos GitHub
- PASS: `index.html` enlaza `/manifest.webmanifest`.
- PASS: `reservar.html` no enlaza un manifest administrativo.
- PASS: `reservar.html` no registra `/sw.js`.
- PASS: cinco llamadas a `listenForSession(db.ref(...))` en `index.html`.
- PASS: `stopSessionListeners()` contiene `ref.off(eventType, callback)`.
- PASS: workflow `pwa-check.yml` incluye `node scripts/check-pwa-session.cjs`.
- BLOCKER: `manifest.webmanifest` no contiene iconos PNG.
- BLOCKER: `manifest.webmanifest` mantiene `scope: "/"`, que incluye el portal público.

## Alcance de evidencia
Las comprobaciones anteriores se realizaron inspeccionando contenido del repositorio. No se ejecutó Node.js contra un checkout, no se confirmó el resultado de GitHub Actions, no se probó en navegador o dispositivo y no se verificaron las reglas efectivas de Firebase.

## Siguientes puertas de calidad
1. Generar PNG 192/512 y Apple touch icon; verificar dimensiones y formato real.
2. Diseñar alcance administrativo bajo ruta o dominio dedicado sin copiar la app a un segundo código divergente.
3. Auditar reglas efectivas de Realtime Database y Storage.
4. Probar logout, login A/B, listeners y renderizado con Firebase Emulator.
5. Ejecutar CI y pruebas en Huawei, iPad y Mac.
6. Reconciliar local/GitHub/producción y solicitar aprobación antes de desplegar.
