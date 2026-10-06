# ADN Suites & Studios — Intake Facebook V1

Fecha de corte: 2026-10-05
Estado: PREPARADO PARA CARGA CONTROLADA
Origen comercial: publicaciones activas en Facebook
Fotos: carga manual por unidad en Synapse Storage

## Invariantes

- propertyGroupId: `adn-suites-studios`
- propertyName: `ADN Suites & Studios`
- operacion: `Renta`
- Cada unidad conserva identidad propia.
- No inventar dirección, coordenadas ni datos no verificados.
- YIN NO incluye Sky Terrace, Jardín Botánico ni área de lavado/tendido.
- Estacionamiento: cajón con costo adicional, sujeto a disponibilidad.
- Contrato: 6 meses.
- Depósito: 1 mes de renta.

## Lote preparado

| unitId | nombre | unitNumber | unitType | category | precio | m2c | baños | fotos |
|---|---|---:|---|---|---:|---:|---:|---|
| yang-10 | ADN · YANG 10 · Suite Sierra | 10 | SUITE | YANG · Suite privada · Baño completo | 3500 | 18.14 | 1 | manual |
| yang-09 | ADN · YANG 09 · Suite 1-1 | 09 | SUITE | YANG · Suite 1-1 · Baño compartido | 3000 | 13.11 | 0.5 | manual |
| yang-08 | ADN · YANG 08 · Suite 1-1 | 08 | SUITE | YANG · Suite 1-1 · Baño compartido | 3000 | 10.40 | 0.5 | manual |
| yang-07 | ADN · YANG 07 · Suite Espiral | 07 | SUITE | YANG · Suite privada · Baño completo | 3500 | 14.34 | 1 | manual |
| yang-06 | ADN · YANG 06 | 06 | SUITE | YANG · Suite privada · Baño completo | 3500 | 20.00 | 1 | manual |
| yang-04 | ADN · YANG 04 · Suite Sótano | 04 | SUITE | YANG · Suite privada · Baño completo | 3500 | 12.60 | 1 | manual |
| yin-01 | ADN · YIN 01 · Studio | 01 | STUDIO | YIN · Studio privado | 2800 | 12 | null | manual |
| yin-06 | ADN · YIN 06 · Studio | 06 | STUDIO | YIN · Studio privado | 2800 | 12 | null | manual |
| yin-05 | ADN · YIN 05 · Studio | 05 | STUDIO | YIN · Studio privado | 2800 | 12 | null | manual |

### Notas de superficie

- YANG 10: 18.14 m² corresponde a habitación medida; baño sin medida independiente confirmada.
- YANG 09: 13.11 m² corresponde a espacio privado; baño 1:1 compartido no se suma como superficie exclusiva.
- YANG 08: 10.40 m² corresponde a espacio privado; baño 1:1 compartido no se suma como superficie exclusiva.
- YANG 07: 14.34 m² = habitación 9.87 + baño 4.47.
- YANG 06: 20.00 m² = habitación 15.32 + baño 4.68.
- YANG 04: 12.60 m² = habitación 9.60 + baño 3.00.
- YIN: ~12 m² se usa como superficie comercial aproximada hasta levantamiento individual.

## Descripciones base

### YANG 10
Suite Sierra. Habitación amplia con baño privado completo y preparación para tarja. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

### YANG 09
Suite 1-1 con 13.11 m² aprox. de espacio privado y baño compartido 1:1. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

### YANG 08
Suite 1-1 con 10.40 m² aprox. de espacio privado y baño compartido 1:1. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

### YANG 07
Suite Espiral, 14.34 m² totales aprox., baño privado completo, ventanal tipo balcón, ventanal amplio en baño y preparación para tarja. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

### YANG 06
Suite amplia de 20 m² totales aprox. con baño privado completo. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

### YANG 04
Suite Sótano, 12.60 m² totales aprox., baño privado completo. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

### YIN 01
Studio privado de aproximadamente 12 m². Internet y agua incluidos, calentador solar y espacio para motos/bicicletas. No incluye amenidades exclusivas YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

### YIN 06
Studio privado de aproximadamente 12 m². Internet y agua incluidos, calentador solar y espacio para motos/bicicletas. No incluye amenidades exclusivas YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

### YIN 05
Studio privado de aproximadamente 12 m². Internet y agua incluidos, calentador solar y espacio para motos/bicicletas. No incluye amenidades exclusivas YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.

## Gate antes de escribir en producción

1. Confirmar dirección/lat/lng de la propiedad madre desde un registro ADN ya validado, si existe; no inventarlos.
2. Verificar que cada `unitId` no exista ya en `propiedades` para evitar duplicados.
3. Crear/editar las nueve unidades manteniendo `engineVersion: 1.0`.
4. Subir fotos manualmente por unidad.
5. Validar Reservar: unidad visible → ficha → horario → reserva.
6. Validar Admin: reserva → cita → lead → propiedadId/unidad correcta.
7. Sólo después declarar el lote ACTIVE.

## Resultado esperado

Facebook → enlace Synapse → unidad ADN exacta → reserva → cita → lead → seguimiento.
