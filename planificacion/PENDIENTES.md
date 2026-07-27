# Pendientes abiertos (estado al arrancar Fase 4)

> Resumen ejecutivo de todo lo que quedó abierto. El detalle y el razonamiento de cada punto está en `DECISIONES-PENDIENTES.md` y en la sección correspondiente de cada doc de fase — acá solo se listan para no perderlos de vista, con quién los resuelve y si frenan a Fase 4.

## ¿Sigo con Fase 4?

**Sí.** Ninguno de los puntos abiertos bloquea Fase 4 (Campañas). Los puntos #1 y #4 (antes #2 y #5 en `DECISIONES-PENDIENTES.md`) ya se resolvieron con Nicolás (2026-07) y quedaron incorporados a la documentación de Fase 4. Los de negocio que siguen abiertos (#2, #3) afectan Fase 5/Fase 9, no el núcleo de campañas; los técnicos (#5-#8) son pulido posterior o dependen de un modelo (`Campana`) que justamente se crea en esta fase.

## Tabla de pendientes

| # | Pendiente | Quién resuelve | ¿Bloquea Fase 4? | Dónde está el detalle |
|---|-----------|-----------------|-------------------|------------------------|
| 1 | Permitir múltiples `IntencionCompra` sueltas (`campanaId = null`) pendientes del mismo producto/productor, o bloquear/fusionar | Nicolás — **RESUELTO 2026-07:** se permiten múltiples, solo advertencia UX (queda como estaba implementado) | No | `DECISIONES-PENDIENTES.md` #2 |
| 2 | Fecha de cierre "48 hs recomendadas" al agrupar solicitudes: ¿sugerencia editable o mínimo obligatorio? | Nicolás | No — afecta Fase 5 | `DECISIONES-PENDIENTES.md` #3 |
| 3 | Entrega directa proveedor→productor: ¿reutilizar `ENTREGA_EN_CAMPO` o modalidad nueva? (impacta si necesitan reportar logística AUT vs. directa) | Nicolás | No — afecta Fase 9 | `DECISIONES-PENDIENTES.md` #4 |
| 4 | `/auth/forgot-password` y `/auth/reset-password`: en qué fase se implementan | Nicolás — **RESUELTO 2026-07:** se implementan en Fase 4 junto con `email.service.js`. Ya agregado como tarea (sección 6, modelo `PasswordResetToken`) en `09-FASE-4-CAMPANAS.md` | No | `DECISIONES-PENDIENTES.md` #5 |
| 5 | `unidadMedida` de varios de los 275 productos se infirió por heurística de texto (sufijo "x lt/kg/25 kg" etc.) | Alguien de AUT (revisión manual de la lista antes de producción) | No | `08-FASE-3-PRODUCTOS.md`, nota final de la sección 3 |
| 6 | Alícuota de IVA (10,5% agroquímicos/fertilizantes, 21% inoculantes) es referencial | El contador de AUT | No, pero sí antes de facturar en serio | `08-FASE-3-PRODUCTOS.md`, nota final de la sección 3 |
| 7 | Nombres de producto tal cual figuran en la lista del proveedor (mayúsculas/abreviaturas tipo "AGROQ", "x lt") | Nicolás/AUT (si quieren mostrarle al productor un nombre más prolijo) | No — es dato, no arquitectura | `08-FASE-3-PRODUCTOS.md`, punto 191 |
| 8 | `productos.service.js` → `desactivar()` no valida todavía "no desactivar si hay campañas activas" (regla original del doc) porque el modelo `Campana` no existe hasta ahora | El desarrollo, en esta misma Fase 4 (agregar el chequeo en cuanto exista `Campana`) | Se resuelve **dentro** de Fase 4, no la bloquea | `backend/src/modules/productos/productos.service.js` (comentario `TODO(nicolas, fase-4)`) |

## Próximo paso

Fase 5 completa (2026-07-27, tag `v0.5-fase-5-intenciones-solicitudes`): intenciones/pedidos sueltos unificados, agrupar atómico, notificaciones reales (BD + Socket.io + email), portal productor y bandeja ADMIN. Arrancar [`11-FASE-6-COTIZACIONES.md`](./11-FASE-6-COTIZACIONES.md). El punto 2 de esta tabla (fecha de cierre 48hs) sigue pendiente de confirmación de Nicolás — se implementó como sugerencia editable, no bloquea.

## Decisión tomada al arrancar Fase 4 (2026-07-27)

`SolicitudCompra` e `IntencionCompra` se unificaron en un solo modelo `IntencionCompra` con `campanaId` nullable (antes eran dos entidades separadas vinculadas por `campanaGeneradaId`/`solicitudOrigenId`). Motivo: son la misma acción del productor ("necesito este producto") con o sin campaña encima; separarlas solo agregaba una tabla y una conversión sin regla de negocio distinta. Se actualizó `02-MODELO-DATOS.md` (modelo + nota #9), `09-FASE-4-CAMPANAS.md` (tarea 1) y `10-FASE-5-INTENCIONES.md` (tarea 1, con nota de que el resto del doc de Fase 5 todavía habla de `SolicitudCompra` y hay que releerlo contra el modelo nuevo antes de implementar esa fase).
