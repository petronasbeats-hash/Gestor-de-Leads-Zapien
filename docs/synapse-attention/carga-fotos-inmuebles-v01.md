# Carga de fotografías en Inmuebles

La edición de inmuebles expone un selector nativo de archivos visible, con
etiqueta asociada, selección múltiple y acceso por teclado. Sustituye la etiqueta
con aspecto de botón que activaba un input con `display:none`.

La ficha explica los pasos: seleccionar archivos, esperar las miniaturas y guardar
los cambios. El resultado no afirma que las fotos ya estén asociadas al inmueble
antes de guardar. Los errores completos y parciales permanecen visibles; una carga
fallida deja de terminar con el estado vacío. La ausencia de sesión o almacenamiento
también muestra un motivo visible y permite volver a elegir el mismo archivo.

La prueba en producción anterior al cambio abrió correctamente el selector oculto
de Arcadia en Chrome. No se reprodujo el fallo del equipo del usuario y no se
subieron archivos reales durante el diagnóstico. La mejora elimina la dependencia
de esa activación indirecta, sin atribuir una causa no comprobada al navegador.

No se cambian reglas, permisos, rutas de Storage, publicación, precios, contratos
ni datos de clientes. Las fotos siguen usando la carga existente y el guardado
explícito de la misma ficha; no se duplican inmuebles. La publicación requiere
Hosting. Un problema posterior de autorización de Storage se debe diagnosticar
con su error concreto, sin abrir permisos como solución general.

Validación: selector visible en HTML real, etiqueta y acceso por teclado; cargas
simuladas completas/parciales; conservación de las fotos previas y avisos de falta
de sesión o almacenamiento. Estas pruebas no certifican permisos de producción.

La comprobación focalizada aprobó 9/9 pruebas (fotos, inventario y build).
La suite general ejecutada el 30 de octubre de 2026 aprobó 271/272: el caso
existente de Radar con una cita fija del 29 de octubre esperaba `confirmada`,
pero la fecha ya pasada propone `realizada`. No se modificó Agenda para esta
corrección. El release contiene 68 archivos y se verificaron sus 67 hashes.
