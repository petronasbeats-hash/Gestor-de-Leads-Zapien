# Synapse PWA — Gate de seguridad administrativa V0.1

Estado: AUDITORÍA PENDIENTE. Sin cambios en producción.

## Evidencia verificada en GitHub
- `index.html` inicializa Firebase Auth, llama `signInWithEmailAndPassword` y `onAuthStateChanged`.
- El acceso a la UI depende del estado de sesión, pero **esto no demuestra** autorización efectiva en Realtime Database ni Storage.
- `manifest.webmanifest` todavía tiene `scope: "/"`; `/reservar` comparte origen.
- `sw.js` no intercepta solicitudes ni guarda datos en caché.

## Condiciones de aprobación
1. Identificar y auditar las reglas efectivamente desplegadas de RTDB y Storage, no inferirlas del frontend.
2. Negar lecturas/escrituras administrativas a usuarios sin autenticar, con permisos por rol y organización; probar accesos REST directos.
3. Mantener ruta pública /reservar accesible para clientes **solo** con permisos estrictamente limitados a crear solicitudes válidas; no permitir listar leads ni modificar citas ajenas.
4. Definir alcance instalable bajo ruta/subdominio administrativo sin incluir portal público; comprobar Firebase Hosting rewrites, URLs relativas y login antes de mover archivos.
5. Comprobar cierre de sesión, sesión caducada, segundo dispositivo, carga de fotos y limpieza de UI.
6. Confirmar que no se guardan credenciales, datos de clientes, fotografías privadas o respuestas Firebase en caché PWA.
7. Probar en Huawei sin GMS, iPad Safari y Mac; no prometer notificaciones push.
8. Conciliar versiones local/GitHub/producción y desplegar solo con autorización expresa.

## Nota de arquitectura
No copiar `index.html` a `/admin/index.html` como atajo: puede bifurcar versiones y romper rutas o lógica. Primero definir routing y reconciliar el árbol desplegable. El `scope` del manifest delimita experiencia instalable, **no permisos**.

## Resultado
Bloqueado para publicación hasta demostrar controles reales de backend y separación administrativa/pública.
