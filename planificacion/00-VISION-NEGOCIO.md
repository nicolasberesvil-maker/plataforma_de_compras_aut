# 00 — Visión del Negocio

> Documento de contexto. Si el agente de desarrollo no entiende el negocio, va a tomar decisiones técnicas que no encajan con la realidad operativa. Este archivo es lectura obligatoria.

---

## Quién es AUT

**Asociación Unión Tamberos** es una cooperativa de productores agropecuarios con sede en **Franck, provincia de Santa Fe (Argentina)**. Agrupa aproximadamente **280 productores socios**, principalmente del rubro tambero (lechero) y agrícola (maíz, trigo, soja).

AUT actúa como intermediario y agente comercial de sus socios. La plataforma de compras es una iniciativa estratégica para potenciar el poder de compra colectivo.

---

## El problema que resuelve

### Modelo actual (el que queremos cambiar)

Cada productor compra sus insumos (glifosato, herbicidas, fertilizantes, semillas, inoculantes, balanceados, sanidad animal) **de forma individual** a un distribuidor minorista. Esto genera tres fugas de rentabilidad:

| Fuga | Problema | Consecuencia |
|------|----------|--------------|
| Poder de negociación | Volúmenes pequeños | Precios minoristas, sin descuentos por escala |
| Inteligencia de mercado | Negociación a ciegas | El productor no sabe qué precio paga el vecino |
| Logística | Múltiples fletes fragmentados | El costo de flete por litro/kilo se dispara |

### Modelo propuesto (lo que construimos)

Una **plataforma digital de compras colectivas** que funciona en 4 pasos:

1. **Planificación anticipada**: AUT abre una "Campaña de compra" para un insumo específico (ej. "Glifosato 48% — Octubre 2026").
2. **Agrupación de fuerzas**: cada productor socio ingresa su intención de compra individual (litros, kilos) desde la app/web.
3. **Licitación por volumen**: AUT consolida el volumen total (ej. 20.000 litros) y emite un RFQ (Request for Quotation) a múltiples proveedores/laboratorios. Los proveedores compiten por el negocio.
4. **Ahorro directo**: AUT elige al ganador, recibe la factura mayorista y la ramifica automáticamente en facturas individuales para cada productor, trasladándole el descuento mayorista íntegro.

---

## Glosario del dominio

| Término | Definición técnica |
|---------|--------------------|
| **Socio / Productor** | Productor agropecuario miembro de AUT, usuario final de la plataforma. |
| **Proveedor** | Laboratorio, distribuidor mayorista o fabricante que cotiza en las licitaciones. |
| **Campaña** | Período definido por AUT donde se agrupa la demanda de un producto específico. Tiene fecha de cierre y volumen mínimo. |
| **Intención de compra** | Pedido individual no vinculante (mientras la campaña esté abierta) que un productor carga dentro de una campaña. |
| **RFQ (Request for Quotation)** | Solicitud formal de cotización que AUT envía a proveedores con el volumen consolidado. |
| **Cotización** | Oferta concreta de un proveedor en respuesta a un RFQ (precio unitario, plazo, condiciones). |
| **Adjudicación** | Acto formal por el cual AUT elige al proveedor ganador y cierra la campaña. |
| **Orden de compra** | Compromiso firme de compra de un productor individual, derivada de la adjudicación. |
| **Depósito** | Galpón físico de AUT donde llega la mercadería antes de entregarla a los productores. AUT tiene varios: Franck, Progreso, Colonia Nueva, etc. |
| **Entrega** | Vínculo entre una orden de compra y su destino físico (retiro en depósito o entrega directa en campo). |
| **Stock movimiento** | Cada entrada o salida de mercadería de un depósito. El stock actual se calcula sumando todos los movimientos. |
| **Factura** | Comprobante fiscal emitido al productor. En v1 son comprobantes internos (B); en v2 se integra con AFIP para facturación electrónica con CAE. |

---

## Reglas de negocio críticas

Estas reglas vienen del cuestionario respondido por AUT y son **no negociables** en el diseño:

### Productos a gestionar (v1)

- Agroquímicos (glifosato, herbicidas, fertilizantes)
- Nutrición animal (núcleos, balanceados)
- Sanidad animal (vacunas, antibióticos)
- Semillas (maíz, trigo, soja)
- Inoculantes

**Sin cadena de frío** ni requisitos especiales de almacenamiento en v1.

### Logística

Modalidad **mixta**, definida campaña por campaña:

- **Retiro en depósito**: el proveedor entrega en un galpón central de AUT, los productores van a retirar.
- **Entrega en campo**: el proveedor entrega directamente en cada campo del productor.

Cuando hay retiro en depósito, **AUT necesita gestionar el stock de cada galpón** (ingresos, egresos, productor que retiró).

### Pagos

**Productor → AUT**: vía echeq (corriente y a plazo), tarjetas agro, o **canje cereal** (forma muy típica del sector). También se aceptan transferencias y débito de cuenta corriente del socio.

**Financiación**: hasta 9 cuotas en pesos (1-3% mensual) o hasta 6 cuotas en dólar abierto (0,5-1% mensual). El interés varía por proveedor.

**AUT → Proveedor**: AUT paga al proveedor **solo después de cobrar a los productores**. La plataforma debe garantizar este orden — AUT no anticipa fondos propios.

### Fiscal

- AUT usa **BIT** como sistema contable.
- **v1**: comprobantes internos. AUT exporta y carga manualmente en BIT.
- **v2 (futuro)**: integración con AFIP vía web service, facturas electrónicas con CAE.
- Alícuotas de IVA: 21% (estándar), 10,5% (algunos agroquímicos/fertilizantes), 27%.
- Productores socios: **mixtos** (Responsables Inscriptos y Monotributistas). El sistema debe manejar ambos casos.
- AUT es **agente de percepción de IIBB Santa Fe**, percepción IVA por operaciones de canje de granos. En LPG es agente de retención de IVA y Ganancias. Por pagos es agente de retención de Ganancias por la RG 830.

### Reglas de campañas

- **Volumen mínimo**: AUT define un volumen mínimo por campaña. Si no se alcanza al cierre, **AUT decide manualmente** caso por caso (puede aceptar el volumen menor, cancelar, o completar la diferencia).
- **Edición de intenciones**: el productor puede modificar su intención **mientras la campaña esté abierta**. Una vez cerrada, no puede editar.
- **Adjudicación**: AUT decide manualmente al ganador considerando precio + plazo de entrega + reputación + condiciones de pago. NO es automático por precio más bajo.
- **AUT puede rechazar todas las cotizaciones y relanzar la licitación.**

### Proveedores

- Régimen **cerrado**: AUT da de alta manualmente solo a proveedores de confianza.
- Estimación: ~20 proveedores activos en el primer año.

### Visibilidad

- **Entre productores**: ven el total acumulado y la cantidad de productores sumados, pero NO los nombres ni cantidades individuales (anonimato relativo, transparencia agregada).
- **Entre proveedores**: NO ven las cotizaciones de los otros (modelo de sobre cerrado). Solo AUT ve todas las cotizaciones.

### Padrón

- 280 productores socios totales.
- Estimación de **50 usuarios activos** en los primeros 6 meses.
- Padrón existente en Excel y base de datos interna.

### Notificaciones (v1)

Canales obligatorios desde el día 1:
- Email
- Notificaciones in-app (campanita)

Eventos a notificar:
- Apertura de nueva campaña de un insumo de interés.
- 48 hs antes del cierre si no cargó intención.
- Cierre de campaña.
- Adjudicación de proveedor y precio final.
- Mercadería disponible para retiro o despachada.
- Emisión de factura.
- Recordatorio de pago.

---

## Prioridades de implementación

Según ranking explícito de AUT (de más crítico a menos):

1. Que el productor pueda sumarse a una compra **desde el celular**.
2. Que las **notificaciones** sean automáticas.
3. Que AUT pueda gestionar la **licitación** con proveedores.
4. Que se **emitan facturas** automáticamente.
5. Que haya un **dashboard** con indicadores de ahorro.

**Esto define el orden del roadmap.** Primero el portal mobile + notificaciones (Fases 1-7), después facturación (10), al final el dashboard (11).

---

## Caso de uso piloto

**Siembra de maíz 2026.** Esta es la campaña real con la que AUT quiere estrenar el sistema. El target de entrega operativa es **3-4 meses desde el inicio del desarrollo**.

---

## KPIs que mide AUT

El dashboard de v1 debe mostrar:

- Ahorro acumulado generado a los productores (en pesos y en %).
- Volumen total transaccionado por insumo y por período.
- Cantidad de productores activos vs total de socios (tasa de adopción).
- Balance IVA Crédito vs Débito Fiscal.
- Ranking de proveedores por volumen / mejor precio histórico.
- Top productores (por volumen comprado).
- **Forma de pago y plazo más adoptado por el productor** (input estratégico para AUT).

---

## Visión a v2 (no condiciona v1, pero conviene tener presente)

- Compra de servicios (siembra, fumigación, transporte) además de insumos.
- Marketplace de venta de granos (productores venden producción a través de AUT).
- Integración con maquinaria / IoT.
- App móvil nativa (v1 es PWA responsive).
- Multi-tenant: extender a otras cooperativas.

---

## Por qué este sistema es estratégico (no es "una app más")

Tres razones que el agente debe tener presentes:

1. **Es una herramienta financiera, no un e-commerce**. La métrica de éxito es "pesos ahorrados al productor", no "tickets emitidos".
2. **Tiene implicancias fiscales serias**. Cada operación impacta en IVA crédito/débito, percepciones, retenciones. El modelo de datos debe ser trazable y auditable.
3. **El usuario final no es un usuario digital**. El productor agropecuario tiene 50-65 años promedio, usa celular pero no es nativo digital. La UX debe ser **brutalmente simple**: una pantalla, dos botones, lenguaje claro.

Si una decisión técnica entra en conflicto con cualquiera de estos tres puntos, ganan estos puntos.
