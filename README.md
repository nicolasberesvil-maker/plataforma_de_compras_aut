# Plataforma de Compras Colectivas — AUT

> **Cliente:** Asociación Unión Tamberos (AUT) — Cooperativa de productores agropecuarios.
> **Objetivo:** Pasar del modelo de compra atomizada al modelo de compra mayorista agrupada vía licitación inversa.

## ¿Qué hace esta plataforma?

Agrupa la demanda individual de productores socios, lanza un pedido consolidado a múltiples proveedores en formato RFQ, adjudica al mejor postor y traslada el ahorro mayorista íntegro a cada productor.

## Documentación

La especificación completa (visión de negocio, arquitectura, modelo de datos, endpoints, fases) vive en [`planificacion/`](./planificacion/README.md). Leer en orden antes de tocar código.

## Cómo ejecutar el proyecto

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

Variables de entorno: ver `.env.example` en `backend/` y `frontend/`.

## Estado del proyecto

| Fase | Estado |
|------|--------|
| 0 — Setup | En progreso |
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
