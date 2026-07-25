# Plataforma de Compras Colectivas — AUT

> **Cliente:** Asociación Unión Tamberos (AUT) — Cooperativa de productores agropecuarios.
> **Desarrolla:** SENA Web Systems.
> **Objetivo:** Pasar del modelo de compra atomizada al modelo de compra mayorista agrupada vía licitación inversa.

---

## ¿Qué hace esta plataforma?

Agrupa la demanda individual de productores socios (litros de glifosato, kilos de semilla, etc.), lanza un pedido consolidado a múltiples proveedores en formato RFQ (Request for Quotation), adjudica al mejor postor y traslada el ahorro mayorista íntegro a cada productor.

**Resultado:** el productor accede a precios de gran escala sin dejar de ser un comprador individual.

---

## Documentación del proyecto

Esta carpeta está pensada para que **un agente de desarrollo (Claude Code, Cursor, etc.) o un desarrollador humano** pueda implementar el sistema fase por fase. La lectura recomendada es secuencial.

### Documentos transversales (leer primero)

| # | Archivo | Propósito |
|---|---------|-----------|
| 00 | [`docs/00-VISION-NEGOCIO.md`](./docs/00-VISION-NEGOCIO.md) | Contexto del dominio. Qué problema resuelve. Glosario. |
| 01 | [`docs/01-ARQUITECTURA.md`](./docs/01-ARQUITECTURA.md) | Stack, capas, decisiones técnicas y su justificación. |
| 02 | [`docs/02-MODELO-DATOS.md`](./docs/02-MODELO-DATOS.md) | ERD completo + schema Prisma comentado. |
| 03 | [`docs/03-API-ENDPOINTS.md`](./docs/03-API-ENDPOINTS.md) | Contrato REST completo de todos los módulos. |
| 04 | [`docs/04-NOTIFICACIONES.md`](./docs/04-NOTIFICACIONES.md) | Sistema de eventos, email + Socket.io. |

### Fases de implementación (ejecutar en orden)

| Fase | Archivo | Sprint | Foco |
|------|---------|--------|------|
| 0 | [`docs/05-FASE-0-SETUP.md`](./docs/05-FASE-0-SETUP.md) | — | Inicialización del repo, dependencias, configuración |
| 1 | [`docs/06-FASE-1-AUTH.md`](./docs/06-FASE-1-AUTH.md) | 1 | Autenticación JWT + roles |
| 2 | [`docs/07-FASE-2-USUARIOS.md`](./docs/07-FASE-2-USUARIOS.md) | 2 | Gestión de productores, proveedores, admins |
| 3 | [`docs/08-FASE-3-PRODUCTOS.md`](./docs/08-FASE-3-PRODUCTOS.md) | 3 | Catálogo de insumos |
| 4 | [`docs/09-FASE-4-CAMPANAS.md`](./docs/09-FASE-4-CAMPANAS.md) | 4-5 | Campañas + máquina de estados |
| 5 | [`docs/10-FASE-5-INTENCIONES.md`](./docs/10-FASE-5-INTENCIONES.md) | 6 | Carga de intenciones desde portal productor |
| 6 | [`docs/11-FASE-6-COTIZACIONES.md`](./docs/11-FASE-6-COTIZACIONES.md) | 7 | Portal proveedor + RFQ |
| 7 | [`docs/12-FASE-7-ADJUDICACION.md`](./docs/12-FASE-7-ADJUDICACION.md) | 8 | Comparador y elección de ganador |
| 8 | [`docs/13-FASE-8-DEPOSITOS-STOCK.md`](./docs/13-FASE-8-DEPOSITOS-STOCK.md) | 9 | Multi-depósito + libro de movimientos |
| 9 | [`docs/14-FASE-9-ENTREGAS.md`](./docs/14-FASE-9-ENTREGAS.md) | 10 | Logística mixta (retiro/entrega en campo) |
| 10 | [`docs/15-FASE-10-FACTURACION.md`](./docs/15-FASE-10-FACTURACION.md) | 11 | Comprobantes internos (AFIP en v2) |
| 11 | [`docs/16-FASE-11-DASHBOARD.md`](./docs/16-FASE-11-DASHBOARD.md) | 12 | KPIs e indicadores |
| 12 | [`docs/17-FASE-12-DEPLOY.md`](./docs/17-FASE-12-DEPLOY.md) | 13 | Deploy, monitoreo, capacitación |

### Documentos de soporte

| Archivo | Propósito |
|---------|-----------|
| [`AGENT-INSTRUCTIONS.md`](./AGENT-INSTRUCTIONS.md) | Reglas que el agente AI debe seguir al codear. |
| [`CONVENCIONES.md`](./CONVENCIONES.md) | Naming, estructura de carpetas, commits, branches. |

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Frontend | React + Vite + TailwindCSS | React 18+, Vite 5+ |
| Backend | Node.js + Express | Node 20 LTS, Express 4 |
| Base de datos | MySQL | 8.0+ |
| ORM | Prisma | 5+ |
| Validación | Zod | 3+ |
| Auth | jsonwebtoken + bcrypt | última estable |
| Notificaciones | Nodemailer + Socket.io | última estable |
| Estado frontend | Zustand + TanStack Query | última estable |
| Testing | Jest + Supertest (backend), Vitest (frontend) | última estable |

---

## Cómo ejecutar el proyecto (después del setup)

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

Variables de entorno requeridas: ver [`docs/05-FASE-0-SETUP.md`](./docs/05-FASE-0-SETUP.md).

---

## Roles del sistema

| Rol | Acceso | Origen |
|-----|--------|--------|
| `PRODUCTOR` | Portal productor (mobile-first) | Auto-registro con aprobación AUT |
| `PROVEEDOR` | Portal proveedor (cotización) | Alta por AUT o invitación |
| `ADMIN` | Panel completo de AUT | Alta manual |
| `OPERADOR` | Carga campañas sin adjudicar | Alta manual por ADMIN |
| `CONTADOR` | Solo lectura + facturación | Alta manual por ADMIN |
| `OPERADOR_DEPOSITO` | Solo movimientos de stock de su depósito | Alta manual por ADMIN |

---

## Estado del proyecto

| Fase | Estado |
|------|--------|
| 0 — Setup | Pendiente |
| 1 — Auth | Pendiente |
| 2 — Usuarios | Pendiente |
| 3 — Productos | Pendiente |
| 4 — Campañas | Pendiente |
| 5 — Intenciones | Pendiente |
| 6 — Cotizaciones | Pendiente |
| 7 — Adjudicación | Pendiente |
| 8 — Depósitos y Stock | Pendiente |
| 9 — Entregas | Pendiente |
| 10 — Facturación | Pendiente |
| 11 — Dashboard | Pendiente |
| 12 — Deploy | Pendiente |

---

## Contacto

**SENA Web Systems** — desarrollo y mantenimiento.
**AUT (Asociación Unión Tamberos)** — cliente y product owner.
