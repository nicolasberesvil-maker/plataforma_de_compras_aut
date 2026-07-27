# Decisiones Pendientes

> Generado según `AGENT-INSTRUCTIONS.md` ("Reglas para crear nuevas decisiones"): son puntos donde tomé una decisión técnica razonable para poder avanzar, pero que dependen de una definición de negocio que le corresponde a Nicolás/AUT confirmar antes de codear. No los resolví por mi cuenta más allá de lo mínimo para no bloquear el resto del diseño.

---

## 1. Alcance del catálogo real de productos (`Producto`) — RESUELTO

**Contexto:** subiste `Lista USD - 2026-07-22T150816.251.xls`. Tiene dos hojas:

- **Hoja "USD"**: lista de precios de un proveedor de agroquímicos y fertilizantes (precio de contado en USD, escalas de cuotas 2/4/6, canje en granos), organizada en secciones: Glifosato, Herbicidas, Graminicidas, Insecticidas, Fungicidas, Aceites y coadyuvantes, Curasemillas, Fertilizantes, Inoculantes.
- **Hoja "Articulos"**: **2.951 filas** (`CODIGO`, `ARTICULO`), maestro de artículos genérico de un distribuidor/ERP que incluye de todo — agroquímicos y semillas, pero también ropa de trabajo, tambores vacíos, arandelas, jeringas, ferretería de tambo, etc.

**Resuelto (2026-07):** confirmaste tomar de la Hoja "USD" **todas** las secciones de insumos: agroquímicos (Glifosato/Herbicidas/Graminicidas/Insecticidas/Fungicidas), fertilizantes, aceites/coadyuvantes, curasemillas e inoculantes. Ya está volcado en `08-FASE-3-PRODUCTOS.md`: **275 productos**, deduplicados (varias filas del Excel repetían el mismo producto solo por condición de pago distinta — "Cta.y Ord" vs. contado — y se fusionaron en una sola fila de catálogo). Mapeo de categorías: aceites/coadyuvantes → `AGROQUIMICO` (no hay categoría propia en el enum para adyuvantes de aplicación); curasemillas químicos → `AGROQUIMICO`; los ítems de "Curasemillas" que en el Excel arrancan con "INOC" (inoculante + fungicida combinado) e "Inoculantes" → `INOCULANTE`.

**La Hoja "Articulos" (2.951 SKUs genéricos) queda fuera de alcance por decisión tuya** — no se importa, ni completa ni filtrada. El catálogo v1 se arma solo con la Hoja "USD".

**Detalles menores que quedan abiertos, sin bloquear nada:**
- La `unidadMedida` de cada producto se infirió con una heurística de texto (ver nota en `08-FASE-3-PRODUCTOS.md`) — conviene una revisión manual antes de producción, en particular los que quedaron en `UNIDAD` por defecto.
- Los nombres quedaron tal cual figuran en la lista del proveedor (mayúsculas, abreviaturas). Si querés nombres más prolijos para mostrarle al productor, es un cambio de datos puntual, no de arquitectura.

---

## 2. Duplicidad de `SolicitudCompra` pendientes — RESUELTO

**Resuelto (2026-07):** Nicolás confirmó permitir múltiples solicitudes PENDIENTES del mismo producto por productor, sin constraint único y sin bloqueo — el service solo avisa "ya tenés una solicitud pendiente de este producto" como advertencia de UX. Queda tal cual estaba implementado.

**Por qué:** un productor podría necesitar el mismo insumo en dos momentos distintos (ej. una entrega para siembra y otra para resiembra), y bloquearlo por unique constraint obligaría a un modelo más rígido del que el negocio pidió.

---

## 3. Fecha de cierre "recomendada 48 hs" al agrupar solicitudes

Implementé la fecha de cierre del requerimiento (`POST /api/solicitudes/agrupar`) como un campo **pre-cargado en el formulario a "ahora + 48 hs"**, pero totalmente editable por el ADMIN — no hay ninguna validación que fuerce las 48 hs. Interpreté "recomendado 48 hs" como una sugerencia de default, no una regla dura. Si en realidad querés que sea un mínimo obligatorio (ej. no se puede cerrar antes de 48 hs desde que se armó), avisame para agregar la validación en `campanas.schemas.js` / `solicitudes.schemas.js`.

---

## 4. Entrega directa proveedor→productor: ¿modalidad nueva o reutilizar `ENTREGA_EN_CAMPO`?

Para el botón de confirmación del productor (regla D.5) reutilicé la modalidad `ENTREGA_EN_CAMPO` que ya existía, y solo cambié quién puede confirmar (antes solo ADMIN, ahora también el productor dueño). No agregué una modalidad `ENTREGA_DIRECTA_PROVEEDOR` separada porque, a nivel de datos, el destino físico es el mismo (el campo del productor) y no vi que necesitáramos distinguir "AUT coordinó la logística" de "el proveedor fue directo" para ningún reporte o regla fiscal.

**Confirmame:** ¿necesitás reportar por separado cuántas entregas fueron coordinadas por AUT vs. directas proveedor-productor (por ejemplo, para medir carga logística de los depósitos)? Si sí, agrego el distingo como una modalidad nueva o un booleano en `Entrega`.

---

## 5. `/auth/forgot-password` y `/auth/reset-password` sin implementar — RESUELTO

**Resuelto (2026-07):** Nicolás confirmó priorizarlo en Fase 4, junto con `email.service.js`. Ya está agregado como tarea (sección 6) en `09-FASE-4-CAMPANAS.md`, con el modelo `PasswordResetToken`, los métodos de service y la plantilla de email correspondiente.

---

## Cómo responder

Podés contestar cada punto en el chat o directamente editando este archivo. En cuanto tenga tu respuesta actualizo los documentos afectados. Quedan abiertos los puntos 3 (fecha de cierre 48 hs) y 4 (entrega directa proveedor→productor) — afectan `10-FASE-5-INTENCIONES.md` y `02-MODELO-DATOS.md`/`14-FASE-9-ENTREGAS.md` respectivamente. Ver estado consolidado en `PENDIENTES.md`.
