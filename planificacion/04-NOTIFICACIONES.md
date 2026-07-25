# 04 — Sistema de Notificaciones

> Diseño del sistema de eventos, canales (email + Socket.io) y persistencia de notificaciones.

---

## Arquitectura general

```
   Service de negocio
   (ej: CampanaService.abrir())
              │
              ▼
       eventBus.emit('CAMPANA_ABIERTA', payload)
              │
              ├─────────────────┬─────────────────┬─────────────────┐
              ▼                 ▼                 ▼                 ▼
       Listener Email   Listener Socket    Listener BD       Listener Auditoría
              │                 │                 │                 │
              ▼                 ▼                 ▼                 ▼
        Nodemailer       Socket.io emit    Notificacion       AuditoriaLog
        envía email       a usuario           guardada           registrado
```

### Por qué esta arquitectura

1. **Desacoplamiento**: el `CampanaService` no sabe que existen notificaciones. Solo emite un evento.
2. **Extensibilidad**: agregar un canal nuevo (WhatsApp, SMS) en v2 es agregar un listener — no tocar la lógica de negocio.
3. **Testabilidad**: cada listener se testea aislado mockeando el bus.
4. **Persistencia**: cada notificación queda en BD aunque el email falle. El productor la ve en la campanita.

---

## Implementación del Event Bus

Archivo: `backend/src/services/event-bus.service.js`

```javascript
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * Bus de eventos central del sistema.
 * Se exporta una instancia única (singleton).
 * Los listeners se registran al iniciar la app (server.js).
 */
class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // suficiente para v1
  }

  /**
   * Wrapper que loguea cada emit para debugging.
   */
  emit(event, payload) {
    logger.info({ event, payload }, 'Event emitted');
    return super.emit(event, payload);
  }
}

export const eventBus = new AppEventBus();
```

---

## Catálogo de eventos del sistema

Estos son todos los eventos que se emiten en v1. **Cada evento tiene su payload tipado.**

| Evento | Cuándo se emite | Payload |
|--------|-----------------|---------|
| `CAMPANA_CREADA` | AUT crea una campaña (queda en BORRADOR) | `{ campanaId, creadoPorId }` |
| `CAMPANA_ABIERTA` | Transición BORRADOR → ABIERTA | `{ campanaId, productoId }` |
| `CAMPANA_PROXIMA_A_CERRAR` | 48 hs antes del cierre (cron job) | `{ campanaId }` |
| `CAMPANA_CERRADA` | Transición ABIERTA → EN_LICITACION | `{ campanaId }` |
| `CAMPANA_CANCELADA` | Transición a CANCELADA | `{ campanaId, motivo }` |
| `INTENCION_CARGADA` | Productor carga intención | `{ intencionId, campanaId, productorId, volumen }` |
| `RFQ_ABIERTO` | Campaña pasa a EN_LICITACION | `{ campanaId, volumenConsolidado }` |
| `COTIZACION_RECIBIDA` | Proveedor envía cotización | `{ cotizacionId, campanaId, proveedorId }` |
| `CAMPANA_ADJUDICADA` | AUT adjudica | `{ adjudicacionId, campanaId, cotizacionGanadoraId }` |
| `ORDEN_GENERADA` | Una orden derivada de adjudicación | `{ ordenId, productorId, campanaId }` |
| `COTIZACION_RECHAZADA` | Cotización no fue elegida | `{ cotizacionId, proveedorId }` |
| `ENTREGA_EN_TRANSITO` | Mercadería en camino | `{ entregaId, productorId }` |
| `ENTREGA_DISPONIBLE` | Lista para retiro en depósito | `{ entregaId, productorId, depositoId }` |
| `ENTREGA_CONFIRMADA` | Productor retiró o recibió | `{ entregaId, productorId }` |
| `FACTURA_EMITIDA` | Se emite factura | `{ facturaId, ordenId, productorId, total }` |
| `PAGO_RECORDATORIO` | Recordatorio de pago próximo | `{ ordenId, productorId, diasParaVencer }` |
| `PROVEEDOR_APROBADO` | Admin aprueba proveedor | `{ proveedorId }` |

---

## Listeners

Archivo: `backend/src/modules/notificaciones/notificaciones.listeners.js`

```javascript
import { eventBus } from '../../services/event-bus.service.js';
import * as notificacionService from './notificaciones.service.js';
import * as productorService from '../productores/productores.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Registra todos los listeners de notificaciones.
 * Se llama una sola vez al iniciar la app.
 */
export function registrarListenersNotificaciones() {
  eventBus.on('CAMPANA_ABIERTA', onCampanaAbierta);
  eventBus.on('CAMPANA_PROXIMA_A_CERRAR', onCampanaProximaACerrar);
  eventBus.on('CAMPANA_ADJUDICADA', onCampanaAdjudicada);
  eventBus.on('ORDEN_GENERADA', onOrdenGenerada);
  eventBus.on('ENTREGA_DISPONIBLE', onEntregaDisponible);
  eventBus.on('FACTURA_EMITIDA', onFacturaEmitida);
  eventBus.on('COTIZACION_RECHAZADA', onCotizacionRechazada);
  // ... resto

  logger.info('Listeners de notificaciones registrados');
}

async function onCampanaAbierta({ campanaId, productoId }) {
  try {
    // Notificar a TODOS los productores activos sobre la nueva campaña
    const productores = await productorService.listarAprobados();

    for (const productor of productores) {
      await notificacionService.crearYEnviar({
        usuarioId: productor.usuarioId,
        tipo: 'CAMPANA_ABIERTA',
        titulo: 'Nueva campaña de compra abierta',
        mensaje: `Hay una nueva campaña disponible. Sumate antes del cierre.`,
        enlaceRelativo: `/campanas/${campanaId}`,
        metadatos: { campanaId, productoId }
      });
    }
  } catch (err) {
    logger.error({ err, event: 'CAMPANA_ABIERTA' }, 'Error procesando evento');
  }
}

async function onOrdenGenerada({ ordenId, productorId, campanaId }) {
  try {
    const productor = await productorService.obtenerPorId(productorId);

    await notificacionService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'ORDEN_GENERADA',
      titulo: 'Tu compra fue confirmada',
      mensaje: `Se generó tu orden de compra. Revisá el detalle para conocer el precio final y la modalidad de entrega.`,
      enlaceRelativo: `/ordenes/${ordenId}`,
      metadatos: { ordenId, campanaId }
    });
  } catch (err) {
    logger.error({ err, event: 'ORDEN_GENERADA' }, 'Error procesando evento');
  }
}

async function onEntregaDisponible({ entregaId, productorId, depositoId }) {
  try {
    const productor = await productorService.obtenerPorId(productorId);
    const deposito = await depositoService.obtenerPorId(depositoId);

    await notificacionService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'ENTREGA_DISPONIBLE',
      titulo: 'Tu mercadería está lista para retirar',
      mensaje: `Podés pasar a retirar por ${deposito.nombre}, ${deposito.direccion}. Horario: ${deposito.horarioAtencion}.`,
      enlaceRelativo: `/entregas/${entregaId}`,
      metadatos: { entregaId, depositoId }
    });
  } catch (err) {
    logger.error({ err, event: 'ENTREGA_DISPONIBLE' }, 'Error procesando evento');
  }
}

// ... resto de los handlers
```

### Por qué cada listener tiene try/catch

**Un error en un listener NO debe romper la transacción de negocio.** Si la BD ya guardó la adjudicación, y un email falla, el sistema sigue funcionando. El error queda logueado para revisión.

---

## Servicio de notificaciones

Archivo: `backend/src/modules/notificaciones/notificaciones.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { emailService } from '../../services/email.service.js';
import { socketService } from '../../services/socket.service.js';

/**
 * Crea una notificación y la envía por todos los canales habilitados.
 * Garantiza que la persistencia en BD es atómica con el envío.
 */
export async function crearYEnviar({
  usuarioId,
  tipo,
  titulo,
  mensaje,
  enlaceRelativo,
  metadatos
}) {
  // 1. Persistir en BD primero (fuente de verdad)
  const notificacion = await prisma.notificacion.create({
    data: {
      usuarioId,
      tipo,
      titulo,
      mensaje,
      enlaceRelativo,
      metadatos
    }
  });

  // 2. Enviar por canales (fire and forget, no bloqueante)
  // Si fallan, la notificación igual está en la campanita.
  enviarPorCanales(notificacion).catch(err => {
    logger.error({ err, notificacionId: notificacion.id }, 'Error enviando notificación');
  });

  return notificacion;
}

async function enviarPorCanales(notificacion) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: notificacion.usuarioId }
  });

  // Canal: Socket.io (in-app en tiempo real)
  socketService.emitirANotificacion(usuario.id, {
    id: notificacion.id,
    tipo: notificacion.tipo,
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
    enlace: notificacion.enlaceRelativo,
    createdAt: notificacion.createdAt
  });

  // Canal: Email
  if (usuario.email) {
    await emailService.enviarPlantilla({
      to: usuario.email,
      template: notificacion.tipo.toLowerCase(),
      variables: {
        nombre: usuario.nombre,
        titulo: notificacion.titulo,
        mensaje: notificacion.mensaje,
        enlace: `${process.env.FRONTEND_URL}${notificacion.enlaceRelativo}`,
        ...notificacion.metadatos
      }
    });
  }
}

export async function marcarComoLeida(notificacionId, usuarioId) {
  return prisma.notificacion.update({
    where: { id: notificacionId, usuarioId }, // valida ownership
    data: { leida: true, leidaAt: new Date() }
  });
}

export async function listarPorUsuario(usuarioId, { soloNoLeidas, limit = 20, page = 1 } = {}) {
  const where = { usuarioId };
  if (soloNoLeidas) where.leida = false;

  const [data, total] = await Promise.all([
    prisma.notificacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit
    }),
    prisma.notificacion.count({ where })
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function contarNoLeidas(usuarioId) {
  return prisma.notificacion.count({
    where: { usuarioId, leida: false }
  });
}
```

---

## Servicio de email

Archivo: `backend/src/services/email.service.js`

```javascript
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { renderizarPlantilla } from './email-templates.js';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  }

  async enviarPlantilla({ to, template, variables }) {
    const { subject, html, text } = await renderizarPlantilla(template, variables);

    try {
      const info = await this.transporter.sendMail({
        from: `"AUT Compras" <${env.SMTP_FROM}>`,
        to,
        subject,
        text,
        html
      });

      logger.info({ messageId: info.messageId, to, template }, 'Email enviado');
      return info;
    } catch (err) {
      logger.error({ err, to, template }, 'Error enviando email');
      throw err;
    }
  }
}

export const emailService = new EmailService();
```

### Plantillas de email

Archivo: `backend/src/services/email-templates/`

Estructura sugerida:

```
email-templates/
├── base.html                    # Layout base con header/footer de AUT
├── campana_abierta.html
├── campana_proxima_a_cerrar.html
├── orden_generada.html
├── entrega_disponible.html
├── factura_emitida.html
└── ...
```

Cada plantilla usa una librería simple de templating (Handlebars o el propio nodemailer template). En v1 usamos `mjml` para que los emails se vean bien en móviles (que es donde los va a leer el productor).

---

## Servicio de Socket.io

Archivo: `backend/src/services/socket.service.js`

```javascript
import { Server } from 'socket.io';
import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { logger } from '../utils/logger.js';

class SocketService {
  constructor() {
    this.io = null;
    // Mapa usuarioId → array de socket IDs (un usuario puede tener múltiples conexiones)
    this.conexionesPorUsuario = new Map();
  }

  /**
   * Inicializa Socket.io con el servidor HTTP.
   * Se llama desde server.js DESPUÉS de levantar Express.
   */
  iniciar(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
      }
    });

    // Middleware de autenticación: el token viene en handshake.auth
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Sin token'));

        const payload = verifyAccessToken(token);
        socket.usuarioId = payload.usuarioId;
        next();
      } catch (err) {
        next(new Error('Token inválido'));
      }
    });

    this.io.on('connection', (socket) => {
      const usuarioId = socket.usuarioId;
      logger.info({ usuarioId, socketId: socket.id }, 'Cliente conectado');

      // Registrar conexión
      if (!this.conexionesPorUsuario.has(usuarioId)) {
        this.conexionesPorUsuario.set(usuarioId, new Set());
      }
      this.conexionesPorUsuario.get(usuarioId).add(socket.id);

      // Eventos del cliente
      socket.on('subscribe:campana', ({ campanaId }) => {
        socket.join(`campana:${campanaId}`);
      });

      socket.on('unsubscribe:campana', ({ campanaId }) => {
        socket.leave(`campana:${campanaId}`);
      });

      socket.on('disconnect', () => {
        const conexiones = this.conexionesPorUsuario.get(usuarioId);
        if (conexiones) {
          conexiones.delete(socket.id);
          if (conexiones.size === 0) {
            this.conexionesPorUsuario.delete(usuarioId);
          }
        }
      });
    });

    logger.info('Socket.io iniciado');
  }

  /**
   * Emite un evento a todos los sockets de un usuario específico.
   */
  emitirANotificacion(usuarioId, notificacion) {
    const conexiones = this.conexionesPorUsuario.get(usuarioId);
    if (!conexiones || conexiones.size === 0) return; // Usuario offline

    for (const socketId of conexiones) {
      this.io.to(socketId).emit('notificacion:nueva', notificacion);
    }
  }

  /**
   * Emite un evento a todos los suscriptos a una campaña (para actualizar volumen).
   */
  emitirAlaCampana(campanaId, evento, payload) {
    this.io.to(`campana:${campanaId}`).emit(evento, payload);
  }
}

export const socketService = new SocketService();
```

---

## Cron jobs relacionados con notificaciones

Archivo: `backend/src/jobs/notificaciones.job.js`

```javascript
import cron from 'node-cron';
import { eventBus } from '../services/event-bus.service.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Diario a las 9:00 — notifica a productores que NO cargaron intención
 * en campañas que cierran en menos de 48 hs.
 */
export function iniciarJobRecordatorioCierre() {
  cron.schedule('0 9 * * *', async () => {
    logger.info('Ejecutando job: recordatorio cierre campañas');

    const en48Horas = new Date();
    en48Horas.setHours(en48Horas.getHours() + 48);
    const en24Horas = new Date();
    en24Horas.setHours(en24Horas.getHours() + 24);

    const campanas = await prisma.campana.findMany({
      where: {
        estado: 'ABIERTA',
        fechaCierre: { gt: en24Horas, lt: en48Horas }
      }
    });

    for (const campana of campanas) {
      eventBus.emit('CAMPANA_PROXIMA_A_CERRAR', { campanaId: campana.id });
    }
  });
}

/**
 * Cada hora — cierra automáticamente campañas que pasaron la fecha de cierre.
 */
export function iniciarJobCierreAutomatico() {
  cron.schedule('0 * * * *', async () => {
    logger.info('Ejecutando job: cierre automático campañas');

    const ahora = new Date();
    const campanas = await prisma.campana.findMany({
      where: {
        estado: 'ABIERTA',
        fechaCierre: { lt: ahora }
      }
    });

    for (const campana of campanas) {
      // Usa el service para respetar la máquina de estados
      try {
        await campanaService.cerrarIntenciones(campana.id, { motivo: 'Cierre automático por vencimiento' });
      } catch (err) {
        logger.error({ err, campanaId: campana.id }, 'Error en cierre automático');
      }
    }
  });
}
```

---

## Frontend: consumir notificaciones

Hook custom: `frontend/src/hooks/useSocket.js`

```javascript
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export function useSocket() {
  const socketRef = useRef(null);
  const accessToken = useAuthStore(s => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    socketRef.current = io(import.meta.env.VITE_BACKEND_URL, {
      auth: { token: accessToken }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [accessToken]);

  return socketRef.current;
}
```

Componente de campanita: `frontend/src/features/notificaciones/components/Campanita.jsx`

```jsx
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../../hooks/useSocket';
import { apiClient } from '../../../api/client';

export function Campanita() {
  const socket = useSocket();
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ['notificaciones', 'count'],
    queryFn: () => apiClient.get('/notificaciones/no-leidas/count').then(r => r.data.count),
    refetchInterval: 60_000 // fallback de polling cada minuto
  });

  useEffect(() => {
    if (!socket) return;

    function handleNuevaNotificacion(notif) {
      // Invalida queries para que se refresquen contador y listado
      queryClient.invalidateQueries(['notificaciones']);

      // Muestra toast
      toast.info(notif.titulo);
    }

    socket.on('notificacion:nueva', handleNuevaNotificacion);
    return () => socket.off('notificacion:nueva', handleNuevaNotificacion);
  }, [socket, queryClient]);

  return (
    <button className="relative">
      <BellIcon />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
```

---

## Reglas de oro del sistema de notificaciones

1. **La BD es la fuente de verdad.** Email y socket son canales de envío; si fallan, la notificación SIGUE existiendo en la campanita.
2. **Listeners no bloquean transacciones.** Cada listener tiene try/catch propio.
3. **Idempotencia**: si por alguna razón un evento se emite dos veces, no debe generar dos notificaciones (validar con metadatos).
4. **Rate limit en emails**: no enviar más de 1 email del mismo tipo al mismo usuario en 5 minutos (evita spam si hay bugs).
5. **Plantillas mantenidas en archivos**, no hardcoded en código.
6. **Idioma único**: todas las notificaciones en español argentino.
7. **Tono operativo**: mensajes claros, sin tecnicismos. El productor lee desde el celular en el campo.
