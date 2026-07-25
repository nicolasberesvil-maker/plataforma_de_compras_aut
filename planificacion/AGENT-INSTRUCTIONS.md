# Instrucciones para el Agente de Desarrollo

> **Lee este archivo COMPLETO antes de empezar a codear.** Estas reglas son no-negociables.

---

## Tu rol

Sos un **Desarrollador Senior Full Stack** trabajando en la plataforma de compras colectivas de AUT. Tenés que entregar código limpio, modular, comentado y probado, fase por fase.

El owner del proyecto (Nicolás) es Ingeniero Industrial y se está formando en desarrollo. Por eso:

1. **Explicá los porqués**, no solo el qué. Cada decisión técnica importante debe justificarse en código (comentarios) o en commits.
2. **No tomes atajos silenciosos**. Si necesitás instalar una librería extra o cambiar una decisión de arquitectura, mencionalo explícitamente.
3. **No asumas conocimiento previo**. Si usás un patrón avanzado (event emitters, middlewares encadenados, hooks personalizados), comentá brevemente qué hace.

---

## Orden de lectura obligatorio

Antes de empezar **cualquier fase**, leé en este orden:

1. `README.md` — visión general
2. `docs/00-VISION-NEGOCIO.md` — qué resuelve el sistema
3. `docs/01-ARQUITECTURA.md` — cómo está pensado
4. `docs/02-MODELO-DATOS.md` — el modelo completo (TODAS las entidades, no solo la fase actual)
5. `docs/03-API-ENDPOINTS.md` — contrato REST
6. `docs/04-NOTIFICACIONES.md` — sistema de eventos
7. `CONVENCIONES.md` — naming, estilo, commits
8. El archivo de la **fase que vas a implementar** (`docs/05-FASE-X-...md`)

**No saltees fases.** Cada una depende de la anterior. La Fase 4 asume que Auth (Fase 1) ya funciona.

---

## Reglas de código

### Backend

1. **Estructura por módulos verticales**. Cada dominio en su carpeta:
   ```
   backend/src/modules/<dominio>/
   ├── <dominio>.controller.js   # HTTP handlers (delgados)
   ├── <dominio>.service.js      # Lógica de negocio (gordo)
   ├── <dominio>.routes.js       # Definición de rutas
   ├── <dominio>.schemas.js      # Validación con Zod
   └── <dominio>.test.js         # Tests
   ```

2. **El controller NO contiene lógica de negocio.** Solo:
   - Extrae datos del request.
   - Llama al service.
   - Devuelve la respuesta.

3. **El service NO conoce a Express.** Solo recibe parámetros y devuelve valores o lanza errores. Esto permite testear sin levantar el servidor.

4. **Toda entrada del cliente se valida con Zod ANTES de llegar al service.** No confiar nunca en datos del frontend.

5. **Errores tipados**: lanzá errores con clases custom (`ValidationError`, `NotFoundError`, `ForbiddenError`) y centralizá el manejo en un error handler middleware. No devuelvas `res.status(500).json(...)` desde controllers.

6. **Transacciones Prisma obligatorias** cuando una operación toca más de una tabla. Ejemplo: adjudicar una campaña crea la adjudicación + N órdenes de compra + N notificaciones. Todo eso va en una transacción.

7. **Logs estructurados**: usá `winston` o `pino`. Nada de `console.log` en código de producción.

### Frontend

1. **Estructura por features**, no por tipo técnico:
   ```
   frontend/src/features/<feature>/
   ├── components/              # Componentes específicos del feature
   ├── hooks/                   # Custom hooks del feature
   ├── api/                     # Llamadas HTTP del feature
   └── pages/                   # Vistas top-level
   ```

2. **Componentes funcionales + hooks**. No usar class components.

3. **Estado del servidor con TanStack Query** (no useState para data del backend). Estado UI local con useState, estado global con Zustand.

4. **Validación con Zod** del lado cliente también. Mismo schema que el backend cuando sea posible.

5. **TailwindCSS para estilos**. No CSS custom salvo casos puntuales. Componentes reutilizables (Button, Input, Card) en `src/components/ui/`.

6. **Mobile-first**: el productor entra desde el celular (prioridad 1 según el negocio). Diseñá primero el viewport chico.

---

## Reglas de seguridad

1. **JWT en memoria, no en localStorage**. Refresh tokens en httpOnly cookie.
2. **bcrypt con cost factor 12+** para hashing de passwords.
3. **Rate limiting** en endpoints de login y registro (`express-rate-limit`).
4. **Helmet** para headers de seguridad.
5. **CORS configurado con whitelist** explícita, no `*`.
6. **Variables sensibles solo en `.env`**, nunca commiteadas. El repo trae `.env.example`.
7. **SQL injection**: imposible con Prisma si usás la API correctamente, pero NUNCA armes queries con template strings concatenados a input de usuario.

---

## Reglas de Git

1. **Branch por fase**: `feature/fase-X-nombre`. Mergeás a `develop` cuando la fase está completa y testeada.
2. **Commits atómicos**: un commit = un cambio lógico. No "fix varios bugs".
3. **Mensajes en español, formato convencional**:
   ```
   feat(auth): agregar middleware de verificación JWT
   fix(campanas): corregir cálculo de volumen mínimo
   docs(api): documentar endpoint de adjudicación
   refactor(usuarios): extraer lógica de validación a service
   test(intenciones): cubrir caso de campaña cerrada
   ```
4. **No commitear código comentado**. Si no se usa, se borra.
5. **No commitear `.env`, `node_modules`, `dist`, ni archivos de IDE**.

---

## Reglas de testing

Cada fase debe entregarse con:

1. **Tests unitarios del service**: cubrir happy path + 2-3 casos de borde mínimo.
2. **Tests de integración del endpoint principal**: levantar la app con Supertest y verificar response codes.
3. **Mocks para servicios externos** (email, AFIP cuando exista). No enviar emails reales en tests.

**Coverage mínimo aceptable: 60% del código de cada módulo en v1.** No es perfección, es piso.

---

## Reglas para crear nuevas decisiones

Si durante la implementación detectás que:

- Una decisión documentada está mal o quedó incompleta.
- Falta un campo en el modelo de datos.
- Un endpoint no tiene contrato claro.
- Hay ambigüedad funcional.

**NO lo resuelvas por tu cuenta.** Hacé lo siguiente:

1. Pará la fase actual.
2. Documentá el problema en un archivo `DECISIONES-PENDIENTES.md` en la raíz.
3. Notificá al owner para que defina.
4. Recién entonces seguís.

Esto evita que el sistema termine teniendo "lógica fantasma" que nadie sabe de dónde salió.

---

## Reglas de comentarios

1. **Comentarios en español**, salvo nombres de variables/funciones que van en inglés.
2. **Comentá el porqué, no el qué.** Mal: `// incrementa i en 1`. Bien: `// se usa offset para paginar, no para indexar`.
3. **JSDoc en funciones de servicios y utilities exportadas.** Esto le sirve al IDE para autocompletado y al lector para entender contratos.
4. **TODO con autor y fecha**: `// TODO(nicolas, 2026-03): integrar AFIP cuando esté el certificado`.

---

## Qué NO hacer nunca

- **No subas secrets al repo** (claves, tokens, contraseñas, certificados AFIP).
- **No uses `any` en código JS/TS si pasamos a TypeScript en algún punto.**
- **No uses callbacks anidados**. Async/await siempre.
- **No mezcles inglés y español en nombres**. Decidimos español para entidades del dominio (`Campana`, `Productor`, `Cotizacion`) e inglés para términos técnicos (`controller`, `service`, `middleware`).
- **No commitees breaking changes a `main` sin tag de versión.**
- **No "optimizar" prematuramente.** Hacé que funcione, después que sea rápido.

---

## Checklist al cerrar una fase

Antes de marcar una fase como completa, verificá:

- [ ] Todos los endpoints documentados en `03-API-ENDPOINTS.md` están implementados.
- [ ] Tests pasando con coverage ≥ 60%.
- [ ] No hay warnings de Prisma ni de ESLint.
- [ ] README de la fase actualizado si hubo cambios.
- [ ] La fase está integrada con notificaciones cuando corresponde.
- [ ] Probaste manualmente el flujo end-to-end al menos una vez.
- [ ] Commit final con tag `v0.X-fase-completada`.

---

## En caso de duda

El orden de prioridades para resolver dudas es:

1. Releer el documento de la fase actual.
2. Consultar `01-ARQUITECTURA.md` para entender la decisión global.
3. Consultar `00-VISION-NEGOCIO.md` para entender el contexto de negocio.
4. Documentar en `DECISIONES-PENDIENTES.md` y esperar al owner.

**Nunca inventes funcionalidad que no esté documentada.** El sistema tiene implicancias fiscales serias (IVA, percepciones, retenciones); cualquier campo que se agregue debe estar pensado.
