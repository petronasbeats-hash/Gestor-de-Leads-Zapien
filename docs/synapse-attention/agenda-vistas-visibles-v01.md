# Agenda · vistas visibles

La vista inicial mostraba los compromisos de un día y las alternativas quedaban dentro de un selector desplegable. Eso hacía difícil descubrir el calendario visual. Esta ampliación muestra Día, Semana y Mes como botones directos y abre Agenda inicialmente en Mes.

- **Mes:** calendario de seis filas con días de lunes a domingo, horas y hasta tres compromisos visibles por fecha. El resto se indica con un contador. Elegir una fecha abre su agenda de día.
- **Semana:** siete columnas continuas, con desplazamiento horizontal si la pantalla es estrecha. Cada compromiso muestra hora de inicio/fin, título y estado, y abre el evento original. El encabezado de cada columna abre el día completo.
- **Día:** compromisos ordenados por hora, con tareas sin horario identificadas por separado. Ver / actualizar abre los datos existentes, participantes, resultado e historial.

La barra muestra el periodo seleccionado, Hoy, fecha y navegación anterior/siguiente según la vista. Los botones indican su selección mediante `aria-pressed`, mantienen foco visible y usan las paletas existentes. Cambiar de vista o abrir un día no guarda, confirma, cancela, duplica ni reprograma eventos. La creación continúa siendo una acción explícita mediante + Evento y toma la fecha seleccionada.

Ruta operativa: `/agenda`. La página histórica `/agenda.html` sigue siendo compatibilidad del portal público; no es el calendario interno nuevo.

Validación: pruebas DOM recorren Mes → Día → evento original por hora, Semana → evento/día, navegación de periodos, ausencia de escrituras y limpieza al salir. El resto de las pruebas de aplicación se ejecuta antes de publicar. No se ha validado visualmente con una sesión productiva privada.

Este cambio solo requiere Hosting. No modifica Functions, reglas, datos de citas, disponibilidad o índices. La evidencia previa del emulador para persistencia sigue separada de la validación de esta interfaz.

## Corrección de contraste del calendario

La captura del operador mostró fondo verde de acción en todas las celdas, con texto gris pequeño. La causa era la especificidad: la regla general `:is(button,a.button)` tenía más peso que `.calendar-cell`, por el selector de enlace con clase dentro de `:is`. Los tests anteriores de tokens de color no detectaban esta combinación real de reglas e herencia.

La corrección usa `button.calendar-cell` para su superficie y define explícitamente el color del día y sus resúmenes. El acento queda para selección, borde y marcador de hoy. Las celdas de otro mes usan fondo neutro y borde discontinuo, con opacidad completa; horarios de 12 px en escritorio y 11 px en móvil. Los resúmenes de Semana también tienen colores explícitos.

Una prueba analiza las hojas reales, aplica su orden/especificidad y resuelve tokens heredados. Reproduce el fondo verde y el contraste insuficiente antes del arreglo; después comprueba contraste de texto calculado de al menos 4.5:1 para Verde/Índigo, Claro/Oscuro, escritorio/móvil, celdas normales/fuera de mes/hoy/seleccionadas y resúmenes semanales. Esto verifica la cascada estática; no sustituye una inspección visual en la sesión productiva.

Solo requiere Hosting. La dependencia de cálculo de especificidad se agrega únicamente al laboratorio de pruebas, no a Functions ni al navegador.

## Aviso heredado fuera de Radar

A petición del operador, una actividad ya cerrada con `occupancyReviewRequired` y sincronización lista deja de generar la tarjeta Revisar bloqueo heredado en Radar. La proyección no modifica citas, historial ni ocupaciones. Un cierre que todavía tenga sincronización pendiente continúa siendo una incidencia visible, y una actividad activa sigue apareciendo como compromiso. La revisión técnica del bloqueo conserva sus mecanismos existentes en Agenda; no se libera ni se borra el marcador al ocultar la tarjeta.

## Formulario de eventos con menos carga inicial

A petición del operador, el formulario presenta primero asunto, tipo/estado, fecha, inicio/fin, lugar y si ocupa disponibilidad. Personas, inmueble, márgenes, operación y notas quedan en un bloque plegable que se abre automáticamente para visitas y firmas, donde se necesitan participantes o inmueble. Plegarlo conserva sus valores. La corrección de registros antiguos queda dentro del historial, fuera de las acciones principales del pie del formulario. Los campos, validaciones, guardado y referencias existentes permanecen; ninguna cita cambia por abrir o plegar detalles.
