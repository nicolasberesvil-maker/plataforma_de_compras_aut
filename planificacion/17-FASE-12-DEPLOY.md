# Fase 12 — Deploy a Producción y Capacitación

> **Sprint:** 13 (1 semana)
> **Objetivo:** Llevar el sistema a producción de forma segura, con monitoreo, backups y capacitación a AUT antes del piloto de siembra maíz 2026.

---

## Resultado esperado

- Backend deployado en Railway/Render con dominio propio.
- Frontend deployado en Vercel con dominio de AUT.
- MySQL en Railway/PlanetScale con backups automáticos.
- SMTP real (Resend) configurado y probado.
- HTTPS habilitado en todos los endpoints.
- Monitoreo básico de errores activo.
- Manuales de uso entregados a AUT.
- Sistema probado end-to-end con datos reales.

---

## Prerrequisitos

- Fase 11 completa.
- AUT confirmó los datos pendientes (depósitos reales, alícuotas IIBB, CUIT exacto, etc).

---

## Tareas

### 1. Preparar variables de entorno de producción

#### Backend `.env.production`

```env
NODE_ENV=production
PORT=4000

# Base de datos (Railway provee la URL automáticamente)
DATABASE_URL="mysql://usuario:password@host.railway.app:3306/plataformadecompras"

# Secrets fuertes (generar con: openssl rand -base64 48)
JWT_ACCESS_SECRET=<generar-secret-de-48-bytes>
JWT_REFRESH_SECRET=<otro-secret-distinto-de-48-bytes>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# URL del frontend de producción
FRONTEND_URL=https://compras.aut.com.ar

# SMTP (Resend en el plan free)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<api-key-resend>
SMTP_FROM=no-reply@aut.com.ar
SMTP_SECURE=false

# Storage de PDFs (en producción puede ir a S3, en v1 a disco local del contenedor)
PDF_STORAGE_DIR=/app/storage/facturas

# Monitoreo (Logtail u opción gratuita)
LOGTAIL_TOKEN=<token>
```

#### Frontend `.env.production`

```env
VITE_BACKEND_URL=https://api.compras.aut.com.ar
```

**Regla de oro:** los secrets NUNCA se commitean. Se configuran en el dashboard de Railway/Vercel.

### 2. Deploy del backend

#### Opción A: Railway

1. Crear proyecto en Railway.
2. Conectar el repo de GitHub.
3. Configurar el root directory: `backend/`.
4. Agregar MySQL como add-on (Railway lo provisiona y setea `DATABASE_URL`).
5. Cargar las demás variables de entorno desde el dashboard.
6. Configurar build/start commands:
   ```
   Build: npx prisma generate && npm install
   Start: npx prisma migrate deploy && node src/server.js
   ```
7. Configurar dominio: `api.compras.aut.com.ar`.

#### Opción B: Render

Similar, con su propio dashboard. Render tiene plan free que se duerme tras 15 min de inactividad — no recomendado para AUT por la latencia inicial.

### 3. Deploy del frontend

#### Vercel

1. Importar el repo desde GitHub.
2. Configurar root directory: `frontend/`.
3. Framework preset: Vite.
4. Variables: `VITE_BACKEND_URL`.
5. Dominio: `compras.aut.com.ar`.

### 4. Configurar SMTP real

Crear cuenta en [Resend](https://resend.com) (3000 emails gratis/mes en el free tier, suficiente para v1).

- Verificar dominio `aut.com.ar` (registros DNS SPF, DKIM).
- Generar API key.
- Configurar como `SMTP_PASS` en Railway.
- Probar enviando un email de prueba.

**Alternativa free:** SendGrid (100 emails/día) o Brevo (300 emails/día).

### 5. Habilitar HTTPS

- Railway y Vercel proveen HTTPS automático con Let's Encrypt.
- Verificar redirección HTTP → HTTPS.
- Configurar headers de seguridad con Helmet (ya está en Fase 0):
  - HSTS habilitado.
  - X-Frame-Options: DENY.
  - X-Content-Type-Options: nosniff.

### 6. Configurar monitoreo

Opciones gratuitas suficientes para v1:

- **Logtail** (Better Stack): logs centralizados con búsqueda full-text.
- **UptimeRobot**: pings cada 5 min al endpoint `/health`. Avisa por email si está caído.
- **Sentry**: errores no controlados con stack trace, plan free 5K eventos/mes.

Integrar Sentry en backend:

```bash
npm install @sentry/node
```

```javascript
// src/server.js
import * as Sentry from '@sentry/node';

if (env.NODE_ENV === 'production' && env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, tracesSampleRate: 0.1 });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());
}
```

### 7. Backups de base de datos

- Railway hace snapshots diarios automáticos en planes pagos.
- **En el plan free**, configurar un cron job que exporta dump diario:

```bash
# crontab del servidor o GitHub Actions
0 3 * * * mysqldump $DATABASE_URL | gzip > /backups/backup-$(date +\%Y\%m\%d).sql.gz
```

Y guardar en S3, Google Drive o similar.

**Mínimo aceptable:** retener 7 backups diarios + 4 semanales + 12 mensuales.

### 8. Capacitación a AUT

Generar 3 manuales en PDF:

#### Manual del Productor (8-10 páginas, mucha imagen)

1. Cómo registrarse y esperar aprobación.
2. Cómo loguearse desde el celular.
3. Cómo cargar una intención de compra (paso a paso con capturas).
4. Cómo editar o cancelar una intención.
5. Cómo ver tus órdenes y entregas.
6. Cómo retirar la mercadería.
7. Cómo descargar las facturas.
8. Preguntas frecuentes.

#### Manual del Proveedor (5-7 páginas)

1. Recibir invitación de AUT.
2. Loguearse y cambiar password temporal.
3. Ver campañas en licitación.
4. Cargar una cotización.
5. Editar cotización mientras esté abierta.
6. Recibir notificación si gana o no la licitación.

#### Manual del Operador AUT (15-20 páginas)

1. Cómo aprobar productores.
2. Cómo dar de alta proveedores.
3. Cómo gestionar el catálogo de productos.
4. Cómo crear y abrir una campaña.
5. Cómo cerrar intenciones manualmente.
6. Cómo usar el comparador de cotizaciones y adjudicar.
7. Cómo gestionar depósitos y stock.
8. Cómo registrar entregas.
9. Cómo emitir facturas.
10. Cómo interpretar el dashboard.
11. Cómo exportar reportes para BIT.
12. Troubleshooting básico.

### 9. Capacitación presencial

- Sesión de 2 horas con el equipo operativo de AUT (recomendado en sus oficinas).
- Demo end-to-end con un caso simulado.
- Crear 3-5 productores y proveedores de prueba que después se pueden borrar.
- Documentar dudas y feedback para una v1.1.

### 10. Checklist pre-piloto siembra maíz 2026

Verificar antes de lanzar:

- [ ] Datos fiscales reales de AUT cargados (CUIT, dirección, punto de venta).
- [ ] Alícuota IIBB Santa Fe confirmada con contador.
- [ ] Lista real de depósitos cargada (Franck, Progreso, Colonia Nueva, etc.).
- [ ] Operadores de depósito tienen sus cuentas creadas y password cambiada.
- [ ] Proveedores de confianza dados de alta y notificados.
- [ ] Productores socios cargados (importar padrón existente o auto-registro masivo).
- [ ] Catálogo de productos completo con alícuotas IVA correctas.
- [ ] Templates de email probados y aprobados estéticamente por AUT.
- [ ] Manuales entregados.
- [ ] Capacitación realizada.
- [ ] Canal de soporte definido (WhatsApp, email, número directo).
- [ ] Plan de comunicación a productores sobre el lanzamiento (cartelería, redes, email).

### 11. Soporte post-lanzamiento

Definir explícitamente con AUT:

- **Horarios de soporte**: ej. lunes a viernes 9-18 hs.
- **Canal**: ej. WhatsApp dedicado o email `soporte@aut.com.ar`.
- **SLA de respuesta**:
  - Bug crítico (sistema caído): 1 hora.
  - Bug funcional (un endpoint roto): 4 horas.
  - Consulta o feature request: 48 horas.
- **Mantenimiento programado**: avisar con 48 hs.
- **Costos de mantenimiento mensual** (a definir con SENA Web Systems).

### 12. Importar datos preexistentes

AUT tiene padrón de productores en Excel y base interna. Crear un script de importación:

```javascript
// backend/scripts/importar-productores.js
import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function importar(rutaExcel) {
  const workbook = xlsx.readFile(rutaExcel);
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  for (const fila of data) {
    // Password temporal: últimos 4 dígitos del CUIT + año
    const passwordTemp = `aut${fila.CUIT.slice(-4)}2026`;
    const passwordHash = await bcrypt.hash(passwordTemp, 12);

    await prisma.usuario.upsert({
      where: { email: fila.Email },
      update: {},
      create: {
        email: fila.Email,
        passwordHash,
        rol: 'PRODUCTOR',
        activo: true,
        nombre: fila.Nombre,
        apellido: fila.Apellido,
        telefono: fila.Telefono,
        productor: {
          create: {
            razonSocial: fila.RazonSocial,
            cuit: fila.CUIT,
            condicionFiscal: fila.CondicionFiscal,
            domicilioFiscal: fila.Domicilio,
            localidad: fila.Localidad,
            aprobado: true,
            aprobadoAt: new Date()
          }
        }
      }
    });

    console.log(`✓ Importado: ${fila.RazonSocial}`);
  }
}

importar(process.argv[2]).finally(() => prisma.$disconnect());
```

Ejecutar: `node scripts/importar-productores.js padron-aut.xlsx`.

**Importante**: enviar email masivo a productores con sus credenciales temporales y link al sistema.

### 13. Plan de rollback

Si después del despliegue hay un bug crítico:

1. Vercel: rollback a deploy anterior con un click.
2. Railway: redeploy de la build anterior.
3. Base de datos: restaurar último backup pre-deploy.
4. Comunicación inmediata a usuarios afectados.

### 14. Tag final v1.0.0

```bash
git tag -a v1.0.0 -m "Release inicial - piloto siembra maíz 2026"
git push --tags
```

---

## Checklist de cierre

- [ ] Backend en producción con dominio HTTPS.
- [ ] Frontend en producción con dominio HTTPS.
- [ ] MySQL en producción con backups configurados.
- [ ] SMTP real probado end-to-end (registro + login + notif de prueba).
- [ ] Monitoreo activo (logs + uptime + errores).
- [ ] Manuales generados y entregados a AUT.
- [ ] Capacitación presencial realizada.
- [ ] Padrón de productores importado.
- [ ] Proveedores de confianza dados de alta.
- [ ] Checklist pre-piloto completo.
- [ ] Canal de soporte operativo.
- [ ] Tag `v1.0.0` aplicado.

---

## Roadmap post-v1

Para tener presente, no para implementar ahora:

### v1.1 — Mejoras del piloto (1-2 meses después del lanzamiento)
- Ajustes basados en feedback real de productores y operadores.
- Mejoras de UX en puntos de fricción detectados.
- Reportes adicionales que pida AUT.

### v1.5 — Migración a TypeScript
- Migrar progresivamente backend y frontend.
- Empezar por entidades del dominio (Campana, OrdenCompra, etc.).

### v2.0 — AFIP y facturación electrónica
- Integración WSAA + WSFEv1.
- Generación de CAE automática.
- Validación contra padrón AFIP en alta de productores.

### v2.x — Funcionalidades adicionales
- Compra de servicios (no solo insumos).
- Marketplace de venta de granos.
- App móvil nativa (React Native).
- Integración con maquinaria / IoT.
- Multi-tenant para otras cooperativas.

---

## Fin de la documentación

El sistema está listo para entrar al piloto de siembra maíz 2026.

**Recordá:** el éxito no se mide en líneas de código ni features entregadas. Se mide en **pesos ahorrados a los productores socios de AUT**. Toda decisión técnica posterior debe servir a ese objetivo.

— SENA Web Systems
