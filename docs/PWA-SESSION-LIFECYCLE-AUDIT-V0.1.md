# Synapse PWA — auditoría del ciclo de sesión V0.1

Estado: hallazgo de revisión estática; no equivale a una vulnerabilidad explotada ni a una prueba dinámica.

## Evidencia en index.html
- Firebase Auth usa `onAuthStateChanged(user => ...)`.
- Con usuario: `showApp()`, `startListening()`, `loadAdminData()`.
- Sin usuario: `showLogin()`, `db.ref('leads').off()`, `leads = {}`.
- `startListening()` registra `db.ref('leads').on('value', ...)`.
- `loadAdminData()` registra al menos listeners sobre `disponibilidad/horarios`, `citas_publicas` y `citas`.
- `loadAdminData()` utiliza la bandera `adminDataLoaded` para evitar registrar nuevamente; hay que comprobar su ciclo al cambiar usuario.

## Riesgo a verificar
El cierre de sesión observado no desconecta explícitamente todos los listeners iniciados por `loadAdminData()`. Es posible que queden callbacks o estado de UI tras logout o cambio de cuenta; el comportamiento real depende de reglas Firebase y de la ejecución del navegador. No declarar fuga de datos sin reproducirla.

## Plan de corrección (no aplicado)
1. Inventariar **todos** los listeners `.on()` y sus referencias; registrar callbacks exactos para `.off()` simétricos.
2. Centralizar `startSession(user)` y `stopSession()` de forma idempotente, conservando módulos existentes.
3. En `stopSession()`: desconectar listeners de sesión, cancelar operaciones/efectos pendientes donde corresponda, limpiar estructuras privadas y ocultar vistas, restablecer `adminDataLoaded`.
4. No duplicar suscripciones al reingresar ni dejar listeners del usuario anterior.
5. Probar login A → logout → login B; logout con conexión lenta; cambio de sesión durante carga de fotos; permisos revocados; cierre/reapertura de PWA.
6. Verificar reglas RTDB/Storage desplegadas para que ninguna consulta no autorizada tenga éxito, independientemente del estado visual.
7. Mantener `/reservar` público con permisos mínimos; no reutilizar sus listeners como listeners administrativos.

## Gate
Bloquea declaración de PWA lista para uso privado hasta validación en emulador y dispositivos. No desplegar cambios de sesión sin pruebas de regresión.
