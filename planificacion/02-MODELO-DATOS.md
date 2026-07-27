# 02 — Modelo de Datos

> ERD completo + schema Prisma comentado. Esta es la **fuente de verdad** del modelo. Cualquier cambio debe documentarse acá primero antes de tocar código.

---

## Visión general

El modelo se organiza en 6 dominios:

| Dominio | Tablas |
|---------|--------|
| Usuarios y roles | `Usuario`, `Productor`, `Proveedor` |
| Catálogo | `Producto` |
| Compras colectivas | `Campana`, `IntencionCompra`, `Cotizacion`, `Adjudicacion`, `OrdenCompra` |
| Logística | `Deposito`, `StockMovimiento`, `Entrega` |
| Fiscal | `Factura`, `ItemFactura` |
| Soporte | `Notificacion`, `RefreshToken`, `AuditoriaLog` |

> **Nota de actualización (2026-07):** `IntencionCompra.campanaId` pasa a ser **nullable** para soportar el flujo bidireccional productor↔administrador descripto por AUT: un productor puede disparar el proceso ("necesito X para tal fecha") **antes** de que exista una `Campana`/requerimiento, cargando una `IntencionCompra` con `campanaId = null`. Ver nota #9 más abajo y `10-FASE-5-INTENCIONES.md`.

---

## ERD conceptual

```
                                              ┌──────────────┐
                          ┌──────────────────►│   Usuario    │◄────────────────┐
                          │                   └──────────────┘                 │
                          │                          ▲                         │
                          │ (1:1)                    │ (1:N)                   │ (1:1)
                          │                          │                         │
                  ┌───────┴──────┐         ┌─────────┴────────┐        ┌───────┴──────┐
                  │  Productor   │         │  Notificacion    │        │  Proveedor   │
                  └──────────────┘         └──────────────────┘        └──────────────┘
                          │                                                    │
                          │ (1:N)                                              │ (1:N)
                          ▼                                                    ▼
              ┌───────────────────────┐                              ┌──────────────────┐
              │   IntencionCompra     │                              │   Cotizacion     │
              └───────────────────────┘                              └──────────────────┘
                          │                                                    │
                          │ (N:1)                                              │ (N:1)
                          │                                                    │
                          ▼                                                    │
                  ┌──────────────┐◄────────────────────────────────────────────┘
                  │   Campana    │
                  └──────────────┘
                          │
                          │ (1:1) (cuando se adjudica)
                          ▼
                  ┌──────────────────┐
                  │  Adjudicacion    │
                  └──────────────────┘
                          │
                          │ (1:N)
                          ▼
                  ┌──────────────────┐
                  │  OrdenCompra     │
                  └──────────────────┘
                          │
                          │ (1:1)
                          ├──────────────────────┐
                          ▼                      ▼
                  ┌──────────────┐        ┌──────────────┐
                  │   Entrega    │        │   Factura    │
                  └──────────────┘        └──────────────┘
                          │
                          │ (N:1)
                          ▼
                  ┌──────────────┐         ┌──────────────────────┐
                  │   Deposito   │◄────────│  StockMovimiento     │
                  └──────────────┘ (1:N)   └──────────────────────┘

                  ┌──────────────┐
                  │   Producto   │ (referenciado por Campana, ItemFactura, StockMovimiento)
                  └──────────────┘
```

> **No graficado arriba para no saturar el ASCII:** `IntencionCompra.campanaId` es opcional. Sin campaña (`campanaId = null`) es el pedido suelto que el productor carga por su cuenta (bottom-up); con campaña es la intención dentro de un requerimiento que el ADMIN ya abrió (top-down). "Agrupar" (Fase 5) es simplemente asignarle `campanaId` a intenciones sueltas existentes — no crea una entidad nueva. Ver nota #9.

---

## Schema Prisma completo

Archivo: `backend/prisma/schema.prisma`

```prisma
// ============================================================
// CONFIGURACIÓN
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ============================================================
// USUARIOS Y ROLES
// ============================================================

// Tabla central de autenticación.
// Cualquier persona que se loguea es un Usuario.
// El rol determina qué endpoints puede usar.
model Usuario {
  id              Int       @id @default(autoincrement())
  email           String    @unique
  passwordHash    String    @map("password_hash")
  rol             RolUsuario
  activo          Boolean   @default(true)

  // Datos personales mínimos
  nombre          String
  apellido        String
  telefono        String?

  // Auditoría
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  ultimoLoginAt   DateTime? @map("ultimo_login_at")

  // Relaciones 1:1 con extensiones del usuario
  productor       Productor?
  proveedor       Proveedor?

  // Relaciones 1:N
  refreshTokens   RefreshToken[]
  notificaciones  Notificacion[]
  campanasCreadas Campana[]      @relation("CampanasCreadas")
  movimientosStock StockMovimiento[]

  @@map("usuarios")
}

enum RolUsuario {
  PRODUCTOR
  PROVEEDOR
  ADMIN
  OPERADOR
  CONTADOR
  OPERADOR_DEPOSITO
}

// Extensión del Usuario cuando el rol es PRODUCTOR.
// Datos fiscales y de actividad agropecuaria.
model Productor {
  id                Int      @id @default(autoincrement())
  usuarioId         Int      @unique @map("usuario_id")
  usuario           Usuario  @relation(fields: [usuarioId], references: [id])

  razonSocial       String   @map("razon_social")
  cuit              String   @unique
  condicionFiscal   CondicionFiscal @map("condicion_fiscal")
  domicilioFiscal   String   @map("domicilio_fiscal")
  localidad         String

  // Para tracking de aprobación por AUT (regla D.3)
  aprobado          Boolean  @default(false)
  aprobadoAt        DateTime? @map("aprobado_at")

  // Relaciones
  intenciones       IntencionCompra[]
  ordenes           OrdenCompra[]
  entregas          Entrega[]

  createdAt         DateTime @default(now()) @map("created_at")

  @@map("productores")
}

enum CondicionFiscal {
  RESPONSABLE_INSCRIPTO
  MONOTRIBUTISTA
  EXENTO
  CONSUMIDOR_FINAL
}

// Extensión del Usuario cuando el rol es PROVEEDOR.
// Régimen cerrado: AUT da de alta manualmente (regla C.4).
model Proveedor {
  id                Int      @id @default(autoincrement())
  usuarioId         Int      @unique @map("usuario_id")
  usuario           Usuario  @relation(fields: [usuarioId], references: [id])

  razonSocial       String   @map("razon_social")
  cuit              String   @unique
  condicionFiscal   CondicionFiscal @map("condicion_fiscal")
  domicilioFiscal   String   @map("domicilio_fiscal")

  // Aprobación manual de AUT
  estadoAprobacion  EstadoAprobacion @default(PENDIENTE) @map("estado_aprobacion")
  notasInternas     String?  @map("notas_internas") @db.Text

  // Relaciones
  cotizaciones      Cotizacion[]

  createdAt         DateTime @default(now()) @map("created_at")

  @@map("proveedores")
}

enum EstadoAprobacion {
  PENDIENTE
  APROBADO
  RECHAZADO
  SUSPENDIDO
}

// ============================================================
// CATÁLOGO DE PRODUCTOS
// ============================================================

// Catálogo de insumos que AUT gestiona.
// La alícuota IVA se guarda en el producto porque varía
// entre 21% y 10,5% según el tipo (regla B.2).
model Producto {
  id                Int      @id @default(autoincrement())
  // @unique porque el seed (08-FASE-3-PRODUCTOS.md) hace upsert por nombre
  // para poder re-ejecutarse sin duplicar filas al importar el catálogo real.
  nombre            String   @unique
  descripcion       String?  @db.Text
  categoria         CategoriaProducto
  unidadMedida      UnidadMedida @map("unidad_medida")
  alicuotaIva       Decimal  @map("alicuota_iva") @db.Decimal(5, 2)
  activo            Boolean  @default(true)

  // Relaciones
  intenciones       IntencionCompra[]
  campanas          Campana[]
  itemsFactura      ItemFactura[]
  movimientosStock  StockMovimiento[]

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("productos")
}

enum CategoriaProducto {
  AGROQUIMICO
  FERTILIZANTE
  SEMILLA
  INOCULANTE
  NUTRICION_ANIMAL
  SANIDAD_ANIMAL
  OTRO
}

enum UnidadMedida {
  LITRO
  KILO
  UNIDAD
  TONELADA
  BOLSA
}

// ============================================================
// COMPRAS COLECTIVAS (núcleo del sistema)
// ============================================================

// Una Campaña es la unidad genérica de "proceso de compra".
// AUT define el producto y el TIPO de proceso. Según el tipo, algunas
// reglas (volumen mínimo, fecha de cierre, licitación) aplican o no.
// Sigue una máquina de estados estricta que depende del tipo.
//
// Nota de diseño (por qué NO se creó una entidad nueva por cada tipo):
// todo el flujo aguas abajo (IntencionCompra → Cotizacion → Adjudicacion →
// OrdenCompra → Entrega → Factura) cuelga de Campana. Generalizar Campana con
// un discriminador `tipo` reutiliza esa cañería en lugar de duplicarla en
// tablas polimórficas. Ver 09-FASE-4-CAMPANAS.md para los tres flujos.
model Campana {
  id                Int      @id @default(autoincrement())
  productoId        Int      @map("producto_id")
  producto          Producto @relation(fields: [productoId], references: [id])

  // Discriminador de proceso (regla nueva C.0)
  tipo              TipoCompra @default(COLECTIVA)

  nombre            String   // Ej: "Glifosato 48% - Octubre 2026"
  descripcion       String?  @db.Text

  // Reglas de negocio (C.1)
  // volumenMinimo es opcional: solo COLECTIVA/CONTINUA lo usan. DIRECTA no.
  volumenMinimo     Decimal? @map("volumen_minimo") @db.Decimal(12, 2)
  volumenMaximo     Decimal? @map("volumen_maximo") @db.Decimal(12, 2)

  // Ventanas de tiempo
  // fechaCierre es opcional: DIRECTA se adjudica al instante y CONTINUA no cierra
  // (queda abierta indefinidamente y AUT dispara "tandas"). Solo COLECTIVA la exige.
  fechaApertura     DateTime @map("fecha_apertura")
  fechaCierre       DateTime? @map("fecha_cierre")
  fechaCierreCotizaciones DateTime? @map("fecha_cierre_cotizaciones")

  // Cuándo se espera que llegue la mercadería (regla nueva D.2). Es una
  // ESTIMACIÓN DECLARATIVA que el ADMIN comunica al abrir/armar el
  // requerimiento (ej: "se espera para fines de agosto"), ANTES de que
  // exista siquiera una cotización. No confundir con `Entrega.fechaEstimada`,
  // que es el dato concreto que se calcula DESPUÉS de adjudicar, a partir del
  // `plazoEntregaDias` del proveedor ganador. Uno es la promesa temprana al
  // productor; el otro es el compromiso logístico real post-adjudicación.
  fechaEstimadaRecepcion DateTime? @map("fecha_estimada_recepcion")

  // Compras CONTINUA: el proceso "padre" (siempre abierto) agrupa demanda y,
  // cada vez que AUT decide comprar, genera una "tanda" hija (una Campana
  // COLECTIVA o DIRECTA) que sigue el flujo normal de adjudicación. Así la
  // Adjudicacion sigue siendo 1:1 con la tanda hija, sin relajar el modelo.
  campanaPadreId    Int?      @map("campana_padre_id")
  campanaPadre      Campana?  @relation("CampanaTandas", fields: [campanaPadreId], references: [id])
  tandas            Campana[] @relation("CampanaTandas")

  // Lockout antes del cierre (regla C.2)
  // En cuántas horas antes del cierre se bloquea la edición de intenciones
  horasLockoutEdicion Int    @default(0) @map("horas_lockout_edicion")

  estado            EstadoCampana @default(BORRADOR)

  // Auditoría
  creadaPorId       Int      @map("creada_por_id")
  creadaPor         Usuario  @relation("CampanasCreadas", fields: [creadaPorId], references: [id])
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  canceladaAt       DateTime? @map("cancelada_at")
  motivoCancelacion String?  @map("motivo_cancelacion") @db.Text

  // Relaciones
  intenciones       IntencionCompra[]
  cotizaciones      Cotizacion[]
  adjudicacion      Adjudicacion?

  @@index([estado])
  @@index([fechaCierre])
  @@map("campanas")
}

enum EstadoCampana {
  BORRADOR        // AUT la está configurando
  ABIERTA         // Productores pueden cargar intenciones
  EN_LICITACION   // Cerrada para productores, proveedores cotizan (solo COLECTIVA)
  ADJUDICADA      // AUT eligió ganador / cargó la compra directa
  CERRADA         // Entregada y facturada
  CANCELADA       // Por volumen insuficiente o decisión de AUT
}

// Tipo de proceso de compra. Determina qué reglas y qué máquina de estados aplican.
// - COLECTIVA: el caso insignia. Agrupa volumen, exige volumen mínimo y fecha de
//   cierre, y pasa por licitación (EN_LICITACION) antes de adjudicar.
// - DIRECTA:   compra puntual/individual a un proveedor ya elegido. Sin volumen
//   mínimo ni licitación: se adjudica directo (ABIERTA/BORRADOR → ADJUDICADA).
// - CONTINUA:  proceso permanente por producto. No cierra: acumula intenciones y
//   AUT dispara "tandas" (campañas hijas) cuando decide comprar.
enum TipoCompra {
  COLECTIVA
  DIRECTA
  CONTINUA
}

// Intención de compra individual de un productor. Es el ÚNICO punto de
// entrada del productor al sistema de compras — no importa si ya hay una
// campaña armada o no (regla D.1, nota #9 más abajo).
//
// - Con `campanaId` seteado: vive dentro de una `Campana` que el ADMIN ya
//   abrió (camino top-down, Fase 4). Es MODIFICABLE mientras la campaña esté
//   ABIERTA (regla C.2) y NO es vinculante hasta que la campaña se adjudica.
// - Con `campanaId = null`: es un pedido suelto que el productor cargó por su
//   cuenta, sin esperar que exista campaña (camino bottom-up, Fase 5). El
//   ADMIN la ve en una bandeja de pendientes y "agrupa" una o más intenciones
//   sueltas del mismo producto asignándoles el `campanaId` de una `Campana`
//   nueva o existente — agrupar es un UPDATE de `campanaId`, no una
//   conversión entre entidades distintas.
model IntencionCompra {
  id                Int      @id @default(autoincrement())

  // Nullable: null = pedido suelto todavía sin campaña (bottom-up).
  campanaId         Int?     @map("campana_id")
  campana           Campana? @relation(fields: [campanaId], references: [id])

  productorId       Int      @map("productor_id")
  productor         Productor @relation(fields: [productorId], references: [id])

  // Obligatorio siempre: cuando no hay campaña todavía, es la única forma de
  // saber qué producto pidió el productor. Cuando se agrupa, debe coincidir
  // con el producto de la Campana a la que se asigna (se valida en el service).
  productoId        Int      @map("producto_id")
  producto          Producto @relation(fields: [productoId], references: [id])

  volumen           Decimal  @db.Decimal(12, 2)
  observaciones     String?  @db.Text

  // Para cuándo lo necesita el productor (regla D.1). Sirve de insumo para que
  // el ADMIN defina `Campana.fechaEstimadaRecepcion` cuando arma el
  // requerimiento a partir de varias intenciones con fechas distintas.
  fechaDeseada      DateTime? @map("fecha_deseada")

  // Preferencias logísticas (regla A.2)
  modalidadEntregaPreferida ModalidadEntrega? @map("modalidad_entrega_preferida")
  // FK a Deposito se agrega recién en la migración de Fase 8 (ese modelo
  // todavía no existe). Hasta entonces, RETIRO_EN_DEPOSITO no fija depósito.
  // Dirección puntual cuando modalidadEntregaPreferida = ENTREGA_EN_CAMPO.
  // Se valida como obligatoria en el service para ese caso (ver Fase 5).
  direccionEntregaCampo     String?  @map("direccion_entrega_campo") @db.Text

  // Forma de pago que el productor PREFIERE (no es la definitiva: eso se fija
  // en OrdenCompra.formaPago recién al adjudicar, cuando ya hay condiciones
  // reales del proveedor ganador).
  formaPagoPreferida        FormaPago? @map("forma_pago_preferida")

  estado            EstadoIntencion @default(PENDIENTE)
  motivoDescarte     String?  @map("motivo_descarte") @db.Text

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Un productor solo puede tener UNA intención por campaña. No aplica a
  // pedidos sueltos: MySQL no considera duplicados los NULL en un índice
  // único, así que un mismo productor puede tener varias intenciones con
  // campanaId = null (permitido, regla resuelta en PENDIENTES.md #1).
  @@unique([campanaId, productorId])
  @@index([estado])
  @@index([productoId, estado])
  @@map("intenciones_compra")
}

enum EstadoIntencion {
  PENDIENTE   // Cargada por el productor. Suelta (sin campaña) o dentro de una ABIERTA.
  AGRUPADA    // Suelta que el ADMIN incorporó a una Campana (quedó con campanaId set)
  DESCARTADA  // El ADMIN decidió no avanzar con ella (solo aplica a las sueltas)
}

// Cotización de un proveedor en respuesta a una campaña en licitación.
// Modelo de sobre cerrado (regla C.6): los proveedores no se ven entre sí.
model Cotizacion {
  id                Int      @id @default(autoincrement())
  campanaId         Int      @map("campana_id")
  campana           Campana  @relation(fields: [campanaId], references: [id])
  proveedorId       Int      @map("proveedor_id")
  proveedor         Proveedor @relation(fields: [proveedorId], references: [id])

  // Precio "de contado" (regla D.3): es la base sobre la que se calcula
  // cualquier financiación, junto con tasaInteresMensual.
  precioUnitario    Decimal  @map("precio_unitario") @db.Decimal(12, 4)
  monedaPrecio      Moneda   @default(ARS) @map("moneda_precio")
  plazoEntregaDias  Int      @map("plazo_entrega_dias")

  // % de interés mes a mes para pago financiado (regla D.3, ej: "1,5% mensual").
  // Es un campo estructurado además de condicionesPago (texto libre) porque
  // el comparador de adjudicación (Fase 7) necesita un número para poder
  // ordenar/comparar ofertas financiadas entre proveedores, no solo texto.
  tasaInteresMensual Decimal? @map("tasa_interes_mensual") @db.Decimal(5, 2)

  condicionesPago   String   @map("condiciones_pago") @db.Text
  observaciones     String?  @db.Text
  validaHasta       DateTime @map("valida_hasta")

  // Si se adjudicó esta cotización
  esGanadora        Boolean  @default(false) @map("es_ganadora")

  createdAt         DateTime @default(now()) @map("created_at")

  // Un proveedor solo puede tener UNA cotización por campaña
  // (si quiere cambiarla, se edita la existente)
  @@unique([campanaId, proveedorId])
  @@map("cotizaciones")
}

enum Moneda {
  ARS
  USD
}

// Acto formal por el cual AUT cierra la campaña y elige al ganador.
// Una sola adjudicación por campaña (regla C.3).
model Adjudicacion {
  id                Int      @id @default(autoincrement())
  campanaId         Int      @unique @map("campana_id")
  campana           Campana  @relation(fields: [campanaId], references: [id])
  cotizacionGanadoraId Int   @map("cotizacion_ganadora_id")

  // Cálculos al momento del cierre (snapshot histórico)
  volumenTotalAdjudicado Decimal @map("volumen_total_adjudicado") @db.Decimal(12, 2)
  precioFinalUnitario    Decimal @map("precio_final_unitario") @db.Decimal(12, 4)
  ahorroEstimadoTotal    Decimal? @map("ahorro_estimado_total") @db.Decimal(12, 2)
  precioMinoristaReferencia Decimal? @map("precio_minorista_referencia") @db.Decimal(12, 4)

  // % de ahorro agregado (regla D.4): (precioMinoristaReferencia - precioFinalUnitario) / precioMinoristaReferencia.
  // Se guarda como snapshot (igual que ahorroEstimadoTotal) para que el
  // dashboard y las notificaciones no dependan de recalcular con precios que
  // cambian con el tiempo. Ver nota #3 más abajo.
  porcentajeAhorro       Decimal? @map("porcentaje_ahorro") @db.Decimal(5, 2)

  motivoEleccion    String?  @db.Text

  adjudicadaAt      DateTime @default(now()) @map("adjudicada_at")

  // Relaciones
  ordenes           OrdenCompra[]

  @@map("adjudicaciones")
}

// Compromiso firme de compra de un productor, derivado de la adjudicación.
// Una orden por cada productor que tenía intención al momento del cierre.
model OrdenCompra {
  id                Int      @id @default(autoincrement())
  adjudicacionId    Int      @map("adjudicacion_id")
  adjudicacion      Adjudicacion @relation(fields: [adjudicacionId], references: [id])
  productorId       Int      @map("productor_id")
  productor         Productor @relation(fields: [productorId], references: [id])

  // Datos finales (pueden diferir de la intención si AUT prorrateó)
  volumenFinal      Decimal  @map("volumen_final") @db.Decimal(12, 2)
  precioUnitario    Decimal  @map("precio_unitario") @db.Decimal(12, 4)
  subtotal          Decimal  @db.Decimal(14, 2)
  iva               Decimal  @db.Decimal(14, 2)
  total             Decimal  @db.Decimal(14, 2)

  // Ahorro individual de ESTE productor en ESTA orden (regla D.4), prorrateado
  // desde Adjudicacion.ahorroEstimadoTotal según su volumenFinal. Se muestra en
  // la notificación ORDEN_GENERADA ("te ahorraste $X, un Y% vs. comprar solo").
  ahorroEstimado    Decimal? @map("ahorro_estimado") @db.Decimal(14, 2)
  porcentajeAhorro  Decimal? @map("porcentaje_ahorro") @db.Decimal(5, 2)

  estadoPago        EstadoPago @default(PENDIENTE) @map("estado_pago")
  formaPago         FormaPago? @map("forma_pago")
  cuotas            Int       @default(1)

  // Relaciones 1:1
  entrega           Entrega?
  factura           Factura?

  createdAt         DateTime @default(now()) @map("created_at")

  @@map("ordenes_compra")
}

enum EstadoPago {
  PENDIENTE
  PARCIAL
  PAGADO
  VENCIDO
  CANCELADO
}

enum FormaPago {
  TRANSFERENCIA
  ECHEQ_CORRIENTE
  ECHEQ_PLAZO
  TARJETA_AGRO
  CANJE_CEREAL
  CUENTA_CORRIENTE
  EFECTIVO
}

// ============================================================
// LOGÍSTICA Y DEPÓSITOS
// ============================================================

// Galpón físico de AUT donde llega y se almacena mercadería.
// Multi-depósito: AUT tiene varios (Franck, Progreso, Colonia Nueva, etc).
// NO se borran nunca, solo se desactivan (preserva histórico).
model Deposito {
  id                Int      @id @default(autoincrement())
  nombre            String
  localidad         String
  direccion         String
  responsable       String?
  telefonoContacto  String?  @map("telefono_contacto")
  horarioAtencion   String?  @map("horario_atencion")
  capacidadMaxima   Decimal? @map("capacidad_maxima") @db.Decimal(12, 2)
  activo            Boolean  @default(true)

  // Relaciones
  movimientosStock  StockMovimiento[]
  entregas          Entrega[]
  intencionesPreferidas IntencionCompra[]

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("depositos")
}

// Libro de movimientos de stock (patrón append-only).
// El stock actual NO se guarda como un campo mutable, sino que se calcula
// sumando todos los movimientos. Esto garantiza auditabilidad fiscal.
model StockMovimiento {
  id                Int      @id @default(autoincrement())
  depositoId        Int      @map("deposito_id")
  deposito          Deposito @relation(fields: [depositoId], references: [id])
  productoId        Int      @map("producto_id")
  producto          Producto @relation(fields: [productoId], references: [id])

  tipo              TipoMovimientoStock
  cantidad          Decimal  @db.Decimal(12, 2)  // Siempre positivo
  signo             Int      // +1 ingreso, -1 egreso, +1 o -1 en ajustes

  // Trazabilidad
  entregaId         Int?     @map("entrega_id")
  entrega           Entrega? @relation(fields: [entregaId], references: [id])

  // Origen del movimiento (uno de estos según el tipo)
  proveedorOrigen   String?  @map("proveedor_origen")  // Para INGRESO_PROVEEDOR
  observaciones     String?  @db.Text

  // Quién ejecutó
  ejecutadoPorId    Int      @map("ejecutado_por_id")
  ejecutadoPor      Usuario  @relation(fields: [ejecutadoPorId], references: [id])

  fecha             DateTime @default(now())

  @@index([depositoId, productoId])
  @@index([fecha])
  @@map("stock_movimientos")
}

enum TipoMovimientoStock {
  INGRESO_PROVEEDOR              // Llegada de mercadería tras adjudicación
  EGRESO_PRODUCTOR               // Retiro de un productor
  AJUSTE_INVENTARIO_POSITIVO     // Conteo físico arroja más que sistema
  AJUSTE_INVENTARIO_NEGATIVO     // Conteo físico arroja menos (rotura, etc)
  TRANSFERENCIA_SALIDA           // Mueve a otro depósito (egreso)
  TRANSFERENCIA_ENTRADA          // Mueve a otro depósito (ingreso)
  DEVOLUCION_PROVEEDOR           // Vuelve al proveedor
}

// Entrega física asociada a una orden de compra.
// Define modalidad (retiro vs campo) y el depósito si corresponde.
// Tiene su propia máquina de estados.
model Entrega {
  id                Int      @id @default(autoincrement())
  ordenCompraId     Int      @unique @map("orden_compra_id")
  ordenCompra       OrdenCompra @relation(fields: [ordenCompraId], references: [id])

  productorId       Int      @map("productor_id")
  productor         Productor @relation(fields: [productorId], references: [id])

  modalidad         ModalidadEntrega
  estado            EstadoEntrega @default(PENDIENTE)

  // Si es retiro en depósito, qué depósito
  depositoId        Int?     @map("deposito_id")
  deposito          Deposito? @relation(fields: [depositoId], references: [id])

  // Si es entrega en campo
  direccionCampo    String?  @map("direccion_campo")

  // Tiempos
  fechaEstimada     DateTime? @map("fecha_estimada")
  fechaDisponibleDesde DateTime? @map("fecha_disponible_desde")
  fechaEntregadaAt  DateTime? @map("fecha_entregada_at")

  observaciones     String?  @db.Text

  // Quién recibió/retiró (puede ser un tercero autorizado)
  recibidaPorNombre String?  @map("recibida_por_nombre")
  recibidaPorDni    String?  @map("recibida_por_dni")

  // Movimientos de stock derivados
  movimientosStock  StockMovimiento[]

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@index([estado])
  @@map("entregas")
}

enum ModalidadEntrega {
  RETIRO_EN_DEPOSITO
  ENTREGA_EN_CAMPO
}

enum EstadoEntrega {
  PENDIENTE                  // Adjudicada pero mercadería no llegó
  EN_TRANSITO                // El proveedor está en camino
  DISPONIBLE_PARA_RETIRO     // Llegó al depósito, productor puede retirar
  EN_RUTA_A_CAMPO            // Yendo al campo del productor
  ENTREGADA                  // Confirmada por el productor
  CANCELADA
}

// ============================================================
// FACTURACIÓN (v1: comprobantes internos; v2: AFIP CAE)
// ============================================================

// Factura emitida al productor.
// En v1 son comprobantes internos (numeración propia).
// En v2 se integran con AFIP y traen CAE.
model Factura {
  id                Int      @id @default(autoincrement())
  ordenCompraId     Int      @unique @map("orden_compra_id")
  ordenCompra       OrdenCompra @relation(fields: [ordenCompraId], references: [id])

  tipo              TipoFactura  // A si productor es RI, B si Monotributo
  numero            String   @unique
  puntoVenta        String?  @map("punto_venta")

  // Importes
  subtotalNeto      Decimal  @map("subtotal_neto") @db.Decimal(14, 2)
  iva               Decimal  @db.Decimal(14, 2)
  percepcionesIIBB  Decimal? @map("percepciones_iibb") @db.Decimal(14, 2)
  otrasPercepciones Decimal? @map("otras_percepciones") @db.Decimal(14, 2)
  total             Decimal  @db.Decimal(14, 2)

  // Para v2 (AFIP)
  cae               String?
  caeVencimiento    DateTime? @map("cae_vencimiento")

  // PDF generado
  pdfUrl            String?  @map("pdf_url")

  emitidaAt         DateTime @default(now()) @map("emitida_at")

  // Detalle (1:N)
  items             ItemFactura[]

  @@map("facturas")
}

enum TipoFactura {
  A        // Para Responsables Inscriptos
  B        // Para Monotributistas y Consumidores Finales
  C        // Para Monotributistas que emiten (no aplica acá pero por completitud)
}

// Líneas de detalle de una factura.
model ItemFactura {
  id                Int      @id @default(autoincrement())
  facturaId         Int      @map("factura_id")
  factura           Factura  @relation(fields: [facturaId], references: [id])
  productoId        Int      @map("producto_id")
  producto          Producto @relation(fields: [productoId], references: [id])

  descripcion       String
  cantidad          Decimal  @db.Decimal(12, 2)
  precioUnitario    Decimal  @map("precio_unitario") @db.Decimal(12, 4)
  alicuotaIva       Decimal  @map("alicuota_iva") @db.Decimal(5, 2)
  subtotal          Decimal  @db.Decimal(14, 2)

  @@map("items_factura")
}

// ============================================================
// NOTIFICACIONES
// ============================================================

// Historial persistente de notificaciones por usuario.
// Aunque la notif llegue por email y por socket, queda registrada acá
// para que el usuario la vea cuando entre al portal (campanita).
model Notificacion {
  id                Int      @id @default(autoincrement())
  usuarioId         Int      @map("usuario_id")
  usuario           Usuario  @relation(fields: [usuarioId], references: [id])

  tipo              TipoNotificacion
  titulo            String
  mensaje           String   @db.Text

  // Para deep-linking desde la campanita
  enlaceRelativo    String?  @map("enlace_relativo")
  metadatos         Json?    // Datos extra (campanaId, ordenId, etc.)

  leida             Boolean  @default(false)
  leidaAt           DateTime? @map("leida_at")

  createdAt         DateTime @default(now()) @map("created_at")

  @@index([usuarioId, leida])
  @@index([createdAt])
  @@map("notificaciones")
}

enum TipoNotificacion {
  SOLICITUD_RECIBIDA      // Para ADMIN/OPERADOR: un productor cargó una solicitud suelta
  SOLICITUD_AGRUPADA      // Para el productor: su solicitud se sumó a un requerimiento
  SOLICITUD_DESCARTADA    // Para el productor: el ADMIN no avanzó con su solicitud
  CAMPANA_ABIERTA
  CAMPANA_PROXIMA_A_CERRAR
  CAMPANA_CERRADA
  CAMPANA_ADJUDICADA
  ORDEN_GENERADA
  ENTREGA_DISPONIBLE
  ENTREGA_DESPACHADA
  ENTREGA_CONFIRMADA
  FACTURA_EMITIDA
  PAGO_VENCIDO
  PROVEEDOR_APROBADO
  RFQ_RECIBIDO            // Para proveedores
  COTIZACION_RECHAZADA    // Para proveedores
  COTIZACION_ADJUDICADA   // Para proveedores
}

// ============================================================
// SEGURIDAD Y AUDITORÍA
// ============================================================

// Refresh tokens para renovar access tokens.
// Se rota en cada uso (single-use).
model RefreshToken {
  id                Int      @id @default(autoincrement())
  usuarioId         Int      @map("usuario_id")
  usuario           Usuario  @relation(fields: [usuarioId], references: [id])

  tokenHash         String   @unique @map("token_hash")
  expiraAt          DateTime @map("expira_at")
  revocadoAt        DateTime? @map("revocado_at")

  createdAt         DateTime @default(now()) @map("created_at")

  @@index([usuarioId])
  @@map("refresh_tokens")
}

// Log auditable de acciones críticas.
// No es para todas las requests, solo para acciones que cambian estado de negocio:
// abrir campaña, adjudicar, anular factura, ajuste de stock, etc.
model AuditoriaLog {
  id                Int      @id @default(autoincrement())
  usuarioId         Int?     @map("usuario_id")
  accion            String
  entidad           String   // "Campana", "OrdenCompra", etc.
  entidadId         Int?     @map("entidad_id")
  datosAntes        Json?    @map("datos_antes")
  datosDespues      Json?    @map("datos_despues")
  ipOrigen          String?  @map("ip_origen")
  createdAt         DateTime @default(now()) @map("created_at")

  @@index([entidad, entidadId])
  @@index([usuarioId])
  @@map("auditoria_logs")
}
```

---

## Notas críticas sobre el modelo

### 1. Stock como libro append-only

**NO modificar el patrón.** `StockMovimiento` es la fuente de verdad del stock. El stock actual se calcula:

```sql
SELECT producto_id,
       SUM(cantidad * signo) AS stock_actual
FROM stock_movimientos
WHERE deposito_id = ?
GROUP BY producto_id;
```

Esto garantiza:
- Auditoría fiscal (reconstruir saldos a cualquier fecha).
- Sin race conditions en operaciones concurrentes.
- Trazabilidad completa: cada unidad de stock tiene origen y destino.

Si por performance hay que materializar el stock actual en una vista o tabla derivada, eso se hace **después de probar que hay un bottleneck real**, y siempre como espejo del libro de movimientos.

### 2. Separación Intención / Orden

`IntencionCompra` y `OrdenCompra` son entidades distintas porque tienen ciclos de vida distintos:

- La intención se puede editar, borrar, modificar volumen.
- La orden es inmutable una vez generada (es un compromiso firme y fiscal).

Cuando AUT adjudica la campaña, se ejecuta una transacción que:
1. Crea la `Adjudicacion`.
2. Por cada `IntencionCompra` válida, crea una `OrdenCompra` con el volumen final.
3. Por cada `OrdenCompra`, crea una `Entrega` (estado PENDIENTE).
4. Emite los eventos de notificación.

### 3. Snapshots históricos en Adjudicacion

Los campos `precioFinalUnitario`, `precioMinoristaReferencia`, `ahorroEstimadoTotal` se guardan al momento de adjudicar. Aunque el precio minorista de referencia del producto cambie meses después, el cálculo histórico del ahorro queda fijo.

Mismo principio en `OrdenCompra`: precio, IVA y total se guardan, no se recalculan dinámicamente.

### 4. Multi-rol del Usuario

Un usuario tiene **un solo rol** en v1. No soportamos un usuario que sea simultáneamente Productor y Operador. Si AUT pide eso en v2, se modela con una tabla `UsuarioRol` (N:N).

### 5. Soft delete vs hard delete

Convención general: **no borramos nada que tenga historia fiscal o que esté referenciado por otras tablas**. Usamos campos `activo` (boolean) o `estado: 'CANCELADA'`.

Sí se pueden borrar:
- Intenciones de compra de campañas todavía abiertas (es solo intención).
- Productos del catálogo si nunca fueron parte de una campaña.
- Notificaciones leídas con más de 90 días (job de limpieza).

### 6. Decimales y monedas

- **Volúmenes**: `Decimal(12, 2)` — hasta 9.999.999.999,99 unidades.
- **Precios unitarios**: `Decimal(12, 4)` — 4 decimales porque productos químicos se cotizan con precios precisos.
- **Importes totales**: `Decimal(14, 2)` — hasta 999.999.999.999,99 pesos.

**Nunca usar `Float` para dinero.** Genera errores de redondeo inadmisibles en facturación.

### 7. Indexado

Índices definidos en el schema:
- `campanas.estado` (filtros frecuentes por estado)
- `campanas.fechaCierre` (job de cierre automático)
- `entregas.estado` (tablero de entregas pendientes)
- `stock_movimientos(deposito_id, producto_id)` (cálculo de stock)
- `notificaciones(usuario_id, leida)` (campanita del usuario)

Si en producción aparece un query lento, se agregan más índices entonces — no antes.

### 8. Campana es un "proceso de compra" genérico (tipo)

`Campana` no representa solo la campaña estacional: es la unidad genérica de compra, con un discriminador `tipo` (`COLECTIVA`, `DIRECTA`, `CONTINUA`). La razón es de arquitectura: todo el flujo fiscal-logístico posterior (intención → cotización → adjudicación → orden → entrega → factura) ya cuelga de `Campana`. Meter un discriminador reutiliza esa cañería; crear entidades paralelas (`CompraDirecta`, `CompraContinua`) obligaría a duplicarla o a volver polimórficas todas las FKs, con más superficie de bug y peor auditabilidad.

Consecuencias en el modelo:
- `volumenMinimo` y `fechaCierre` pasan a ser **nullable** (solo `COLECTIVA` los exige).
- `CONTINUA` usa la self-relation `campanaPadre` / `tandas`: el proceso continuo no se adjudica a sí mismo; genera campañas hijas ("tandas") que sí siguen el flujo normal. Así `Adjudicacion` sigue siendo 1:1 con la tanda y no hay que relajar esa restricción.
- La máquina de estados deja de ser única: cada `tipo` tiene su mapa de transiciones válidas. Detalle en `09-FASE-4-CAMPANAS.md`.

### 9. Flujo bidireccional: un solo modelo, `campanaId` nullable

El sistema soporta dos puntos de entrada al mismo proceso de compra, ambos sobre el mismo modelo `IntencionCompra`:

- **Top-down (Fase 4):** el ADMIN crea la `Campana` y la abre; los productores cargan `IntencionCompra` directamente dentro de ella (`campanaId` seteado desde el alta).
- **Bottom-up (Fase 5, regla D.1):** un productor carga una `IntencionCompra` suelta (`campanaId = null`) diciendo qué necesita, para cuándo, a qué dirección y cómo prefiere pagar. El ADMIN la revisa en una bandeja de pendientes y, si decide avanzar, **agrupa** una o más intenciones sueltas (típicamente del mismo producto) en una `Campana`. Esa operación, en una transacción:
  1. Crea la `Campana` (con `fechaCierre` sugerida a +48 hs y `fechaEstimadaRecepcion` que carga el ADMIN).
  2. Hace `UPDATE` de `campanaId` y `estado = AGRUPADA` sobre cada `IntencionCompra` suelta incluida — no crea filas nuevas, no hay conversión entre entidades.
  3. Abre la campaña (`ABIERTA`) y dispara `CAMPANA_ABIERTA` (a todos los productores, por si alguien más quiere sumarse) + `INTENCION_AGRUPADA` (personalizado, a cada productor cuya intención entró).

El ADMIN también puede armar una `Campana` sin ninguna intención previa (el camino top-down de siempre) — ambos caminos conviven en la misma tabla porque `campanaId` es opcional.

**Por qué se decidió unificar (en vez de `SolicitudCompra` + `IntencionCompra` separadas, que fue el diseño inicial):** conceptualmente ambas son la misma acción del productor — "necesito este producto" — con o sin campaña encima; separar la entidad solo agregaba una tabla y una conversión sin aportar una regla de negocio distinta. El costo (regla `@@unique([campanaId, productorId])` y validaciones como lockout/volumen máximo, que solo tienen sentido cuando hay campaña) se resuelve en el service con un simple `if (campanaId)`, no en el schema — y MySQL ya trata cada fila con `campanaId = null` como no-duplicada en el índice único, así que la regla de PENDIENTES.md #1 (permitir varios pedidos sueltos del mismo producto/productor) sale gratis.

### 10. Entrega directa proveedor→productor: confirma el productor, no solo AUT

Cuando la modalidad es `ENTREGA_EN_CAMPO`, la mercadería puede llegar directo del proveedor al campo del productor sin pasar por un depósito de AUT. En ese caso **el productor es quien está físicamente presente**, así que debe poder confirmar la recepción él mismo (botón "Confirmé que recibí mi pedido"), no depender de que un operador de AUT lo cargue después. Esto es un cambio de **autorización** sobre el endpoint ya existente `confirmar-entrega-campo` (ahora acepta `ADMIN` **o** `PRODUCTOR` dueño de la entrega), no un cambio de modelo — ver `14-FASE-9-ENTREGAS.md`.

---

## Migraciones

Cada fase del roadmap genera **una migración Prisma**. Nunca editar una migración ya aplicada; se crea una nueva.

Comando:
```bash
npx prisma migrate dev --name <nombre-descriptivo>
```

Convención de nombres de migración:
- `init` — creación inicial
- `add_<entidad>` — nueva tabla
- `add_<campo>_to_<entidad>` — nueva columna
- `fix_<descripcion>` — corrección
