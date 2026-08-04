# Plan de Modificaciones — Julio 2026 (revisión sobre la app funcionando)

> Este documento nace de una revisión de Nicolás sobre la app ya corriendo (capturas de pantalla del panel admin, login y portal productor). No es un rediseño desde cero: son ajustes sobre lo que las Fases 0-9 ya construyeron. Cada sub-fase de abajo dice **qué documento(s) de la planificación original toca**, para que el agente de Claude Code sepa qué releer antes de tocar código.
>
> **Orden de lectura recomendado para el agente:** este archivo completo primero (para tener el panorama), después cada documento original referenciado en el momento de implementar esa sub-fase puntual.

---

## Resumen ejecutivo — qué toca qué

| Sub-fase | Qué cambia | Documentos originales afectados |
|----------|-----------|----------------------------------|
| M0 | Login por usuario, sin auto-registro, roles reducidos | `05-FASE-0-SETUP.md`, `06-FASE-1-AUTH.md`, `07-FASE-2-USUARIOS.md`, `02-MODELO-DATOS.md` |
| M1 | Costo y stock mínimo/seguridad en catálogo | `08-FASE-3-PRODUCTOS.md`, `02-MODELO-DATOS.md` |
| M2 | Proveedores: navegación, alta con usuario, cuenta corriente | `07-FASE-2-USUARIOS.md`, `02-MODELO-DATOS.md`, `03-API-ENDPOINTS.md` |
| M3 | Campañas → "Compras": remitos, órdenes, tablero agregado, desglose de destinos | `09-FASE-4-CAMPANAS.md`, `10-FASE-5-INTENCIONES.md`, `11-FASE-6-COTIZACIONES.md`, `12-FASE-7-ADJUDICACION.md`, `02-MODELO-DATOS.md` |
| M4 | Depósitos + Entregas fusionados en "Stock" | `13-FASE-8-DEPOSITOS-STOCK.md`, `14-FASE-9-ENTREGAS.md` |
| M5 | Pagos del productor (multi-orden, multi-método) y cuenta corriente a proveedor | `02-MODELO-DATOS.md`, `03-API-ENDPOINTS.md`, `15-FASE-10-FACTURACION.md` |
| M6 | Portal productor/proveedor: refuerzos de UI sobre lo ya construido | `10-FASE-5-INTENCIONES.md`, `11-FASE-6-COTIZACIONES.md`, `16-FASE-11-DASHBOARD.md` |

**Importante — M0 sí toca Fase 0 y Fase 1**, que ya están implementadas en código. Específicamente: la pantalla de bienvenida (`App.jsx`, ruteo inicial) es de Fase 0; el login por email y el registro público son de Fase 1. Avisale al agente que relea esos dos documentos junto con la sub-fase M0 de este plan antes de tocar auth.

---

## M0 — Acceso: login por usuario, sin auto-registro, roles reducidos

### Por qué

Hoy el sistema asume que cualquiera puede auto-registrarse como productor y queda pendiente de aprobación. Nicolás confirma que en la operación real **el ADMIN es quien da de alta a cada usuario** (productor o proveedor) y le entrega usuario/contraseña directamente — no hay auto-servicio. Esto simplifica el modelo: se cae toda la máquina de "pendiente de aprobación" porque nunca existe un usuario sin aprobar.

### Qué cambia

1. **Pantalla de bienvenida:** eliminar el `HomePage` de `App.jsx` (el cartel "Plataforma de Compras AUT" con botón "Iniciar sesión"). La ruta `/` redirige directo a `/login` si no hay sesión, o al dashboard del rol si ya está logueado.
2. **Login por usuario, no por email:**
   - Modelo: agregar `Usuario.username String @unique` (nuevo campo, distinto de `email`). El email se conserva porque los canales de notificación (`04-NOTIFICACIONES.md`) siguen mandando por mail.
   - `POST /api/auth/login` cambia su body de `{ email, password }` a `{ username, password }`.
   - Frontend `LoginForm.jsx`: el input "Email" pasa a ser "Usuario". Se agrega un ícono de ojo (`lucide-react` ya está instalado — usar `Eye`/`EyeOff`) para mostrar/ocultar la contraseña, alternando `type="password"` / `type="text"` en el input.
3. **Se borra el registro público:**
   - Eliminar `POST /api/auth/register`, `RegisterForm.jsx`, `RegisterPage.jsx` y el link "¿No tenés cuenta? Registrate" del login.
   - En su lugar, **el ADMIN crea productores igual que ya crea proveedores hoy**: `POST /api/productores` (nuevo endpoint, análogo a `POST /api/proveedores` que ya existe), con body `{ username, password, email, nombre, apellido, telefono, razonSocial, cuit, condicionFiscal, domicilioFiscal, localidad }`. **`username` y `password` los tipea el ADMIN a mano en el formulario** — no hay generación automática ni envío de credenciales por email; el admin se las comunica a la persona por fuera del sistema. Queda `activo=true` desde el alta — no hay estado intermedio.
   - Esto también cambia el alta de proveedor existente (`proveedores.service.js`, `crear()`): hoy genera una `passwordTemporal` random. Pasa a recibir `username` y `password` del form, igual que productores — se elimina la generación de password aleatoria.
   - Se elimina `Productor.aprobado` / `aprobadoAt` del modelo (ya no tiene sentido: si el admin lo creó, está aprobado). Se elimina el evento `PRODUCTOR_APROBADO` y su listener.
   - Se elimina la pantalla **"Productores pendientes de aprobación"** y los endpoints `GET /productores/pendientes`, `PATCH /:id/aprobar`, `PATCH /:id/rechazar`.
4. **Roles:** `RolUsuario` pasa de 6 a 4 valores.
   - Se eliminan `CONTADOR` y `OPERADOR`.
   - `OPERADOR_DEPOSITO` se conserva y **se redefine como el rol operativo del depósito**: ve movimientos de stock, gestiona qué le corresponde retirar/entregar a cada productor, y carga transferencias entre depósitos. (Antes tenía permisos acotados a "su depósito"; ahora es, en la práctica, quien opera Fase 8/9 día a día.)
   - Todo lo que en `03-API-ENDPOINTS.md` decía `ADMIN, CONTADOR` o `ADMIN, OPERADOR` pasa a `ADMIN` solo (salvo los endpoints de stock/entregas, que quedan `ADMIN, OPERADOR_DEPOSITO`).
   - **Impacto en Fase 10 (Facturación):** los endpoints que eran `ADMIN, CONTADOR` quedan solo `ADMIN` — confirmado que ese rol contable no se reparte con `OPERADOR_DEPOSITO` (ver M5, confirmación de pagos).

### Checklist

- [ ] Migración: `Usuario.username` (unique, not null), baja de `Productor.aprobado/aprobadoAt`, `RolUsuario` con 4 valores.
- [ ] `/api/auth/register` eliminado; `/api/productores` (POST, ADMIN) creado.
- [ ] Login funciona con usuario/contraseña; ojito de mostrar contraseña operativo.
- [ ] No queda ninguna pantalla ni ruta de auto-registro ni de aprobación pendiente.
- [ ] Ningún endpoint sigue aceptando `CONTADOR` u `OPERADOR` como rol permitido.

---

## M1 — Catálogo: costo y stock mínimo/seguridad

### Por qué

Hoy `Producto` no tiene noción de costo ni de umbrales de stock. Sin costo de referencia, calcular el % de ahorro en cada adjudicación depende de que el admin lo tipee a mano cada vez (`precioMinoristaReferencia` en `12-FASE-7-ADJUDICACION.md`). Con un costo de referencia en el catálogo, ese campo se puede **pre-cargar automáticamente** y el admin solo lo ajusta si hace falta. Los umbrales de stock habilitan alertas de reposición en el módulo de Stock (M4).

### Qué cambia

- `Producto` suma: `costoReferencia Decimal? @db.Decimal(12,4)` (precio de referencia individual/minorista, no el costo interno de AUT — mismo número que hoy se tipea a mano en `precioMinoristaReferencia` al adjudicar), `stockMinimo Decimal? @db.Decimal(12,2)`, `stockSeguridad Decimal? @db.Decimal(12,2)`.
- Al abrir el formulario de adjudicación (`ConfirmarAdjudicacionModal`, Fase 7), `precioMinoristaReferencia` viene pre-cargado con `Producto.costoReferencia` si existe, editable.
- El módulo de Stock (M4) muestra alerta visual cuando `stockActual < stockMinimo` (advertencia) o `< stockSeguridad` (crítico), por depósito y producto.

### Checklist

- [ ] Migración con los 3 campos nuevos, todos nullable. Confirmado: los 275 productos ya importados quedan con `costoReferencia = null`; AUT lo completa de a poco desde el panel de productos, sin segundo import.
- [ ] Form de producto (`ProductoFormPage`) los incluye.
- [ ] Adjudicación pre-carga `precioMinoristaReferencia` desde el catálogo.
- [ ] Stock/Depósitos marca visualmente cuando un producto está bajo el mínimo.

---

## M2 — Proveedores: navegación, alta completa y cuenta corriente

### Por qué

Falta el dato de usuario en el alta (arrastra el mismo cambio de M0: login por usuario). Y falta una vista simétrica a la que ya existe para productores (`13-FASE-8-DEPOSITOS-STOCK.md`, cuenta corriente): **AUT le paga al proveedor recién después de cobrarle a los productores** (regla ya documentada en `00-VISION-NEGOCIO.md`), así que necesita saber, por proveedor, cuánto le compró, cuánto le entregaron, cuánto le pagó y cuánto le debe.

### Qué cambia

1. **Navegación:** el ítem "Proveedores" del menú lateral pasa a tener sub-tabs: **Listado** (lo que hoy se ve) y **Cargar nuevo** (el form, que hoy está siempre visible arriba del listado — se separa en su propia pestaña).
2. **Form de alta:** se agregan los campos `username` y `password` (faltan hoy — ver M0, decisión confirmada: el ADMIN los tipea a mano, sin generación automática). El resto de los campos actuales se mantienen.
3. **Cuenta corriente de proveedor (nueva):** `GET /api/proveedores/:id/cuenta-corriente`, análogo al de productor (`03-API-ENDPOINTS.md`, módulo Cuenta Corriente):
   ```json
   {
     "proveedorId": 5,
     "resumen": {
       "totalAdjudicado": 4500000,
       "totalPagado": 3000000,
       "saldoPendiente": 1500000
     },
     "historialCompras": [
       { "adjudicacionId": 12, "campana": "Glifosato Octubre 2026", "producto": "...", "volumen": 5000, "precioUnitario": 1850.5, "fecha": "2026-10-05" }
     ],
     "pagos": [
       { "pagoProveedorId": 3, "fecha": "2026-10-20", "monto": 3000000, "medioPago": "TRANSFERENCIA" }
     ]
   }
   ```
   Esto requiere un modelo nuevo que **hoy no existe**: `PagoProveedor` (id, proveedorId, fecha, monto, medioPago, adjudicacionId opcional, observaciones, registradoPorId). El sistema actual solo modela plata que entra (`Factura` = AUT→productor); nunca modeló la plata que sale de AUT hacia el proveedor. `totalAdjudicado` sale de sumar `Adjudicacion.volumenTotalAdjudicado × precioFinalUnitario` de las adjudicaciones ganadas por ese proveedor (vía `Cotizacion.proveedorId`). **Carga manual simple (decisión confirmada):** el ADMIN registra fecha, monto y medio cada vez que AUT transfiere; sin conciliación automática contra extracto bancario en v1. Rol habilitado: solo `ADMIN`.
4. **Historial de compras a ese proveedor:** listado de `Adjudicacion` donde `cotizacionGanadora.proveedorId = :id`.

### Checklist

- [ ] Sub-navegación Listado / Cargar nuevo funcionando.
- [ ] Alta de proveedor pide y guarda `username`.
- [ ] Modelo `PagoProveedor` migrado.
- [ ] Endpoint de cuenta corriente de proveedor operativo y consistente con `Adjudicacion`.

---

## M3 — Campañas → "Compras": remitos, órdenes, tablero agregado, desglose de destinos

### Por qué

Es el corazón operativo del pedido de Nicolás. Varias cosas ya estaban resueltas conceptualmente en el diseño (el flujo de `SolicitudCompra` → agrupar → `Campana`, y el campo `direccionEntregaCampo` por intención), pero faltaba: (a) el nombre visible "Compras" en vez de "Campañas", (b) un lugar para cargar el remito cuando llega la mercadería, y (c) que el admin vea todo agregado por producto en una sola pantalla antes de armar la cotización.

### Qué cambia

1. **Renombrar en la UI, no en el modelo.** La tabla sigue llamándose `Campana` en Prisma/backend — cambiar el nombre técnico implicaría tocar 6 fases ya implementadas (migraciones, imports, tests) por un cambio cosmético. Se resuelve en la capa de presentación: el sidebar dice "Compras", los títulos de página dicen "Compra", pero rutas internas y el modelo de datos no cambian. Si en algún momento se justifica un rename real de tabla, se hace aparte con su propia migración — no mezclarlo con esta sub-fase.
2. **Submódulo "Remito":** modelo nuevo `Remito` (id, campanaId, proveedorId, numero, fecha, cantidadRecibida, depositoId, observaciones, adjuntoUrl?, registradoPorId). Se carga cuando llega la mercadería del proveedor adjudicado y **dispara automáticamente** el `StockMovimiento` de tipo `INGRESO_PROVEEDOR` (la lógica ya existe en `13-FASE-8-DEPOSITOS-STOCK.md`, `registrarIngreso`; ahora queda atada a un comprobante formal en vez de cargarse suelta). Roles habilitados: `ADMIN` u `OPERADOR_DEPOSITO` (decisión confirmada).
3. **Vista "Órdenes de compra" dentro del detalle de la Compra:** ya existe el modelo `OrdenCompra` (Fase 7) — se agrega una pestaña en el detalle de la campaña que lista las órdenes generadas por esa adjudicación (hoy solo se ven desde "Mis órdenes" del productor o el listado admin suelto).
4. **Botón "Avisar a productores":** reenvío manual del evento de notificación (`CAMPANA_ABIERTA` o uno nuevo `COMPRA_ACTUALIZADA`) — útil si alguien no vio el aviso original o si se actualizó algo del pedido.
5. **Tablero de intenciones agregadas por producto:** el admin necesita ver, en una sola pantalla, la suma de TODO lo pedido de un mismo producto — tanto lo que cargó él mismo (campañas que arrancó por su cuenta) como lo que juntó de solicitudes de productores — y de ahí armar la cotización con un clic. Nuevo endpoint `GET /api/solicitudes/tablero?agruparPor=producto` que devuelve, por producto, el total pendiente de agrupar (`SolicitudCompra` en estado `PENDIENTE`) + el total ya cargado directamente en campañas propias en `BORRADOR`/`ABIERTA` sin cerrar. Desde ahí, el botón "Armar cotización" dispara el `POST /api/solicitudes/agrupar` que ya está diseñado en `10-FASE-5-INTENCIONES.md`.
6. **Estados visibles de cotización:** no hace falta campo nuevo — se deriva de datos que ya existen (`Campana.estado` + si tiene o no `Cotizacion` cargada), pero se pide como badge explícito en la UI: `SIN_COTIZAR` (EN_LICITACION sin cotizaciones), `COTIZADO` (EN_LICITACION con ≥1 cotización), `ADJUDICADO` (estado ADJUDICADA/CERRADA).
7. **Desglose de direcciones de entrega al proveedor:** cuando la campaña pasa a `EN_LICITACION` y se arma el RFQ, incluir la lista de destinos (uno por productor, tomado de `IntencionCompra.direccionEntregaCampo` / `depositoPreferidoId`) — esto **ya está en el diseño** (`03-API-ENDPOINTS.md`, módulo Campañas: *"en ese pedido debe especificar los lugares de entrega que cada productor especificó antes"*). Lo que falta es que se vea explícitamente en la pantalla del RFQ (admin) y en el detalle de la orden que recibe el proveedor ganador — no es un cambio de modelo, es un cambio de qué se renderiza.

### Checklist

- [ ] Sidebar dice "Compras"; rutas y modelo (`Campana`) sin tocar.
- [ ] Modelo `Remito` migrado; cargarlo genera el `StockMovimiento` correspondiente.
- [ ] Detalle de Compra tiene pestaña de Órdenes de compra.
- [ ] Botón "Avisar a productores" operativo.
- [ ] Tablero agregado por producto con acceso directo a "Armar cotización".
- [ ] Badges de estado (Sin cotizar / Cotizado / Adjudicado) visibles.
- [ ] El RFQ y la orden al proveedor muestran el desglose de direcciones de entrega.

---

## M4 — Stock (fusión de Depósitos + Entregas)

### Por qué

Nicolás quiere que "Entregas" deje de ser un ítem de menú separado y viva dentro de "Depósitos", renombrado "Stock" — porque conceptualmente son la misma operación: qué hay en el depósito, qué mueve, y qué le corresponde retirar a cada productor.

### Qué cambia

- **Navegación:** se fusionan los ítems "Depósitos" y "Entregas" del sidebar en uno solo, **"Stock"**, con sub-tabs: Depósitos (alta/listado), Movimientos, Retiros/Entregas, Transferencias. No hay cambio de modelo — `Deposito`, `StockMovimiento` y `Entrega` (Fases 8 y 9) siguen siendo entidades separadas como están diseñadas; esto es reorganización de navegación, no de datos.
- **"Cuánto tiene que retirar cada cliente":** ya resuelto por el diseño de Entregas (`14-FASE-9-ENTREGAS.md`, estado `DISPONIBLE_PARA_RETIRO`) + la cuenta corriente de productor (`13-FASE-8-DEPOSITOS-STOCK.md`, sección 4). Se pide reforzar que, dentro de "Stock", haya una vista puntual "Qué falta retirar" filtrable por depósito, que es básicamente `GET /api/entregas?estado=DISPONIBLE_PARA_RETIRO&depositoId=X`.
- **Movimientos atados a la orden de compra:** ya existe en el modelo (`StockMovimiento.entregaId` → `Entrega.ordenCompraId`) — se pide que el listado de movimientos (`MovimientosStockPage`) muestre explícitamente a qué orden de compra corresponde cada ingreso/egreso, no solo depósito+producto+cantidad.

### Checklist

- [ ] Un solo ítem de menú "Stock" con las 4 sub-tabs.
- [ ] Vista "Qué falta retirar" por depósito.
- [ ] Listado de movimientos muestra la orden de compra asociada cuando aplica.

---

## M5 — Pagos del productor (multi-orden, multi-método) y refuerzo de cuenta corriente

### Por qué

Hoy el productor no tiene forma de **declarar** un pago — solo `ADMIN`/`CONTADOR` pueden `PATCH /ordenes/:id/marcar-pagada` sobre una orden a la vez, con una sola forma de pago (`OrdenCompra.formaPago`, un único enum). Nicolás pide que el productor pueda decir "estoy pagando esto" indicando a qué orden(es)/factura(s) aplica, y que un mismo pago se pueda partir en más de un medio (ej. mitad transferencia, mitad e-cheq).

### Qué cambia

Requiere dos modelos nuevos (hoy no existen):

- **`Pago`**: `id, productorId, fecha, montoTotal, observaciones, estado (DECLARADO | CONFIRMADO | RECHAZADO), registradoPorId`.
- **`PagoAplicacion`**: `id, pagoId, ordenCompraId (o facturaId), montoAplicado` — permite que un pago cancele una o varias órdenes/facturas parcial o totalmente.
- **`PagoMedio`**: `id, pagoId, formaPago, monto` — permite que un pago se componga de más de un medio de pago (la suma de `PagoMedio.monto` debe igualar `Pago.montoTotal`).

Flujo: el productor carga el pago desde "Mi cuenta" (`POST /api/pagos`, PRODUCTOR), eligiendo a qué orden(es)/factura(s) aplica y con qué medio(s). Queda en `DECLARADO`. **Solo `ADMIN`** lo confirma (`PATCH /api/pagos/:id/confirmar`, decisión confirmada — `OPERADOR_DEPOSITO` no tiene acceso a este endpoint) cuando efectivamente ve la plata acreditada — recién ahí impacta en `OrdenCompra.estadoPago`.

### Checklist

- [ ] Modelos `Pago`, `PagoAplicacion`, `PagoMedio` migrados.
- [ ] Productor puede declarar un pago aplicándolo a 1+ órdenes/facturas con 1+ medios de pago.
- [ ] `OrdenCompra.estadoPago` se actualiza recién al confirmar (no al declarar).
- [ ] "Mi cuenta" del productor muestra historial de pagos declarados/confirmados junto a la cuenta corriente ya existente (Fase 8).

---

## M6 — Portal Productor y Proveedor: consolidación

### Por qué

La mayoría de lo pedido acá **ya está resuelto por el diseño existente** (Fases 5, 6 y 8) — esta sub-fase es, sobre todo, verificar que esté bien expuesto en la UI, no diseño nuevo.

### Qué cambia (o se verifica)

**Productor:**
- Notificación de nueva compra con la especificación completa (producto, cantidad pedida por el grupo, fecha estimada de recepción, forma de pago que definió el proveedor ganador) → ya existe el evento `CAMPANA_ABIERTA` y los campos (`fechaEstimadaRecepcion` de M... ya en el modelo desde la vuelta anterior). Verificar que el detalle de campaña en el portal productor muestre estos datos, no solo nombre y fecha de cierre.
- Generar su propio "requerimiento de compra" (para cuándo, cuánto, dónde entregar/retirar, qué producto, forma de pago) → esto es exactamente `SolicitudCompra` (Fase 5, ya diseñado y visible como "Pedidos sueltos" en la captura que compartiste).
- Ver estado de cuenta y movimientos/histórico → cuenta corriente de productor (Fase 8) + historial de pagos (M5, nuevo).
- Emitir un pago aplicándolo a orden/factura con múltiples métodos → M5.

**Proveedor:**
- Ver qué se está pidiendo cotizar, para cuándo podría entregar, definir precio → ya resuelto en Fase 6 (`CampanasParaCotizarPage`, `CotizacionForm`).

### Checklist

- [ ] Detalle de campaña en portal productor muestra especificación completa, no solo nombre/fecha.
- [ ] "Pedidos sueltos" (Solicitudes) accesible y funcional desde el portal productor.
- [ ] "Mi cuenta" reúne cuenta corriente + pagos en una sola vista.

---

## Decisiones confirmadas por Nicolás (2026-08-03)

Ya no son preguntas abiertas — son reglas a implementar tal cual:

1. **Usuario y contraseña iniciales:** el ADMIN los tipea a mano en el formulario de alta (tanto para productor como para proveedor) y se los comunica él mismo a la persona por fuera del sistema. No hay generación automática ni envío de credenciales por email.
2. **Quién confirma pagos (M5):** solo `ADMIN`. `OPERADOR_DEPOSITO` no tiene acceso a `PATCH /api/pagos/:id/confirmar`.
3. **Quién carga el Remito (M3):** `ADMIN` u `OPERADOR_DEPOSITO`, ambos habilitados.
4. **Pago a Proveedor (M2):** carga manual simple. El ADMIN carga fecha, monto y medio cada vez que AUT le transfiere al proveedor — sin conciliación automática contra extracto bancario en v1.
5. **Costo de referencia por producto (M1):** queda vacío (`null`) para los 275 productos recién importados. AUT lo va completando de a poco desde el panel de productos a medida que arma compras y confirma precios con cada proveedor. No hay un segundo import de precios en esta etapa.

---

## Orden sugerido de implementación

M0 primero (todo lo demás depende de cómo quede la autenticación y los roles). Después M1 y M2 pueden ir en paralelo (no dependen entre sí). M3 depende de M1 (costo de referencia) parcialmente pero puede arrancar antes. M4 depende de que M3 tenga los remitos para que "ingreso atado a orden de compra" tenga sentido completo. M5 conviene dejarlo para el final porque es la pieza más nueva (dos modelos que no existían) y se apoya en que M0 (roles) ya esté resuelto.
