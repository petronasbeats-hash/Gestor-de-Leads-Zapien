# Agenda · vistas visibles

La vista inicial mostraba los compromisos de un día y las alternativas quedaban dentro de un selector desplegable. Eso hacía difícil descubrir el calendario visual. Esta ampliación muestra Día, Semana y Mes como botones directos y abre Agenda inicialmente en Mes.

- **Mes:** calendario de seis filas con días de lunes a domingo, horas y hasta tres compromisos visibles por fecha. El resto se indica con un contador. Elegir una fecha abre su agenda de día.
- **Semana:** siete columnas continuas, con desplazamiento horizontal si la pantalla es estrecha. Cada compromiso muestra hora de inicio/fin, título y estado, y abre el evento original. El encabezado de cada columna abre el día completo.
- **Día:** compromisos ordenados por hora, con tareas sin horario identificadas por separado. Ver / actualizar abre los datos existentes, participantes, resultado e historial.

La barra muestra el periodo seleccionado, Hoy, fecha y navegación anterior/siguiente según la vista. Los botones indican su selección mediante `aria-pressed`, mantienen foco visible y usan las paletas existentes. Cambiar de vista o abrir un día no guarda, confirma, cancela, duplica ni reprograma eventos. La creación continúa siendo una acción explícita mediante + Evento y toma la fecha seleccionada.

Ruta operativa: `/agenda`. La página histórica `/agenda.html` sigue siendo compatibilidad del portal público; no es el calendario interno nuevo.

Validación: pruebas DOM recorren Mes → Día → evento original por hora, Semana → evento/día, navegación de periodos, ausencia de escrituras y limpieza al salir. El resto de las pruebas de aplicación se ejecuta antes de publicar. No se ha validado visualmente con una sesión productiva privada.

Este cambio solo requiere Hosting. No modifica Functions, reglas, datos de citas, disponibilidad o índices. La evidencia previa del emulador para persistencia sigue separada de la validación de esta interfaz.
