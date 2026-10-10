# Whityouly

Plataforma social con identidades seudónimas (personajes), historias, acompañamiento emocional y creaciones. Este documento describe **el estado real del proyecto**: qué está construido, qué está en producción y qué falta.

> Actualizado el **4 de octubre de 2026**. Rama `main`, commit `dbb96e8`.

---

## Índice

1. [Estado en una frase](#estado-en-una-frase)
2. [Qué funciona hoy](#qué-funciona-hoy)
3. [Qué no existe todavía](#qué-no-existe-todavía)
4. [Stack tecnológico](#stack-tecnológico)
5. [Estructura del repositorio](#estructura-del-repositorio)
6. [Puesta en marcha](#puesta-en-marcha)
7. [Variables de entorno](#variables-de-entorno)
8. [API](#api)
9. [Modelo de datos y migraciones](#modelo-de-datos-y-migraciones)
10. [Seguridad](#seguridad)
11. [Despliegue](#despliegue)
12. [Deuda técnica y pendientes](#deuda-técnica-y-pendientes)
13. [Comandos habituales](#comandos-habituales)
14. [Documentos relacionados](#documentos-relacionados)

---

## Estado en una frase

Backend y frontend están desplegados y operativos en producción con identidad, personajes, archivos y moderación de usuarios funcionando; **el núcleo social del producto (historias, comunidad, notificaciones) todavía no existe en el backend**.

- API: `https://whityouly.onrender.com`
- Web: `https://whityouly.vercel.app`
- Base de datos: PostgreSQL en Neon
- Pruebas: 163 tests en 17 archivos, todos en verde

---

## Qué funciona hoy

| Área | Estado | Qué incluye |
|---|---|---|
| Autenticación | Completo | Registro, verificación por correo, login, logout, refresh con rotación, sesiones por dispositivo, recuperación y cambio de contraseña |
| Configuración de cuenta | Completo | Preferencias, cambio de contraseña con confirmación, cambio de correo en dos pasos, baja de cuenta |
| Sesiones | Completo | Listado, revocación individual, cierre de todas, cierre de las de otros dispositivos, límite de 10 activas, purga automática |
| Roles | Completo | `USER` → `MODERATOR` → `ADMIN` → `SUPERADMIN`, jerárquicos y con salvaguardas |
| Moderación de usuarios | Completo | Cambiar rol, suspender y reactivar. Sin moderación de contenido todavía |
| Personajes | Completo | Crear, editar perfil, comprobar disponibilidad, perfil público por nombre |
| Avatar | Completo | Subida, re-codificación a WebP, cuotas, borrado y limpieza de huérfanos |
| Intereses | Completo | Catálogo público y asignación a personajes |
| Archivos | Completo | Biblioteca personal con cuotas, paginación por cursor y borrado protegido |
| Frontend | Parcial | Login, registro, verificación, reset, cuenta, perfil público y Feed. El Feed usa **datos de ejemplo** |
| Historias, comunidad e interacciones | Completo | El README quedó desactualizado; ver git log y el módulo `stories` |
| Notificaciones, analítica, IA, música | **No empezado** | Carpetas vacías |

### Descubrimiento y notificaciones

Desde el 10 de octubre de 2026 el backend incluye además:

| Módulo | Estado | Qué incluye |
|---|---|---|
| Notificaciones | Completo | Bandeja paginada por cursor, contador de no leídas, marcar leída individual o todas. Se emiten avisos de seguidor nuevo, comentario, respuesta a comentario, acompañamiento y etapa nueva en un relato seguido |
| Descubrimiento | Completo | Contenido destacado curado por administración (`featured_stories`), tendencias por interacción reciente y personajes recomendados por afinidad de intereses |
| Curación (`/admin/featured`) | Completo | `ADMIN`/`SUPERADMIN` pueden destacar, reordenar, añadir nota o caducidad y retirar relatos de la portada |

### Rutas del frontend

`/login` · `/register` · `/verify-email` · `/forgot-password` · `/reset-password` · `/cuenta` · `/confirm-email` · `/feed` · `/personaje/[name]`

> `/feed` consume `src/lib/feed-data.ts`, que es contenido de relleno. Cuando exista el endpoint del feed, basta con sustituir ese archivo por el `fetch` correspondiente: los tipos ya reflejan lo que la interfaz necesita.

---

## Qué no existe todavía

Estas carpetas existen en `backend/src/modules/` pero **están vacías**. Son el siguiente trabajo:

| Módulo | Alcance previsto |
|---|---|
| `stories` | Historias, etapas (`story_updates`), estados y visibilidad |
| `community` | Feed y descubrimiento de contenido |
| `interactions` | Comentarios anidados, acompañamiento, reacciones |
| `taxonomy` | Categorías, emociones y etiquetas |
| `moderation` | Reportes y moderation de contenido |
| — | Seguimientos, guardados, notificaciones, analítica, mapa emocional, creaciones de IA y música |

El orden sugerido está en [`roadmap_backend.md`](roadmap_backend.md).

---

## Stack tecnológico

**Backend** — NestJS 12, Prisma 5.22, PostgreSQL (Neon), Redis (opcional), Passport + JWT, bcrypt, `sharp` para imágenes, S3/R2 para medios, Nodemailer, `class-validator`, `helmet`, `@nestjs/throttler`, oxlint, Vitest.

**Frontend** — Next.js 14 (App Router), React 18, TypeScript, CSS Modules.

**Despliegue** — Render (backend) + Vercel (frontend) + Neon (base de datos).

---

## Estructura del repositorio

```
whityouly/
├── backend/                  API NestJS
│   ├── prisma/
│   │   ├── schema.prisma     29 modelos
│   │   └── migrations/       historial versionado en Git
│   ├── src/
│   │   ├── common/           storage, quota, redis, throttler, cooldown, media, filtros
│   │   ├── config/env.ts     configuración validada con avisos de arranque
│   │   ├── modules/          auth, users, characters, files, interests (+ carpetas vacías)
│   │   ├── prisma/           PrismaService
│   │   ├── app.module.ts
│   │   └── main.ts           bootstrap: helmet, CORS, cookies, Swagger, avisos
│   ├── test/                 E2E
│   ├── .env.example         referencia completa de variables
│   └── security_test.js      script manual de pruebas de seguridad
├── frontend/                 Next.js
│   ├── src/app/              rutas
│   ├── src/components/       account/, feed/
│   └── src/lib/              api, auth, account, avatar, characters, files, feed-data
├── modelo_base_datos.md      modelo de datos original
└── roadmap_backend.md        hoja de ruta por fases
```

---

## Puesta en marcha

### Requisitos

Node.js 20+ y un PostgreSQL accesible (Neon sirve). Redis es opcional: sin él, los contadores de seguridad viven en memoria del proceso.

### Backend

```bash
cd backend
npm install
cp .env.example .env        # y rellena DATABASE_URL, JWT_SECRET, etc.
npx prisma migrate deploy   # aplica el esquema
npm run start:dev
```

El API queda en `http://localhost:3000`. Swagger en `http://localhost:3000/api/docs` **solo en desarrollo**.

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3001
```

El frontend espera la API en `NEXT_PUBLIC_API_URL`.

---

## Variables de entorno

`backend/.env.example` es la referencia completa, comentada. Lo esencial:

### Base de datos

| Variable | Notas |
|---|---|
| `DATABASE_URL` | **Crítico en producción.** Con el pooler de Neon añade `pgbouncer=true&connection_limit=3`: sin ellos, Prisma prepara sentencias que PgBouncer no admite y el pool crece con los núcleos hasta agotar las ranuras de Neon |

### Autenticación

| Variable | Por defecto | Notas |
|---|---|---|
| `JWT_SECRET` | — | **Obligatorio.** Aleatorio y largo |
| `JWT_REFRESH_SECRET` | derivado | Opcional pero recomendado: separa el secreto de refresco |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Duración del access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Duración de la sesión |
| `JWT_EMAIL_VERIFICATION_EXPIRES_IN` | `24h` | |
| `JWT_PASSWORD_RESET_EXPIRES_IN` | `15m` | |
| `JWT_EMAIL_CHANGE_EXPIRES_IN` | `1h` | |

### Cookies y dominios

| Variable | Desarrollo | Producción |
|---|---|---|
| `COOKIE_SECURE` | `false` | `true` |
| `COOKIE_SAMESITE` | `lax` | `none` |
| `COOKIE_DOMAIN` | vacío | vacío |
| `FRONTEND_URL` | `http://localhost:3001` | `https://whityouly.vercel.app` |
| `CORS_ORIGINS` | `http://localhost:3001` | `https://whityouly.vercel.app` |

> En producción los valores por defecto del código ya son `Secure=true` y `SameSite=None`. **Si defines `COOKIE_SAMESITE` explícitamente a `lax`, rompes el refresh** y toda petición autenticada responderá `401` en cuanto caduque el access token. El arranque avisa si la configuración no cuadra.

### Sesiones, bloqueo y correo

| Variable | Por defecto |
|---|---|
| `REDIS_URL` | vacío (memoria) |
| `LOGIN_MAX_ATTEMPTS` | `5` |
| `LOGIN_LOCK_DURATION_MS` | `900000` (15 min) |
| `PASSWORD_RESET_COOLDOWN_MS` | `60000` |
| `EMAIL_RESEND_COOLDOWN_MS` | `60000` |
| `MAX_SESSIONS_PER_USER` | `10` |
| `SESSION_CLEANUP_INTERVAL_MS` | `3600000` (1 h) |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` | SMTP; vacío = correo en consola |

### Medios

| Variable | Por defecto | Notas |
|---|---|---|
| `STORAGE_DRIVER` | `local` | `s3` para R2, S3, MinIO o Backblaze |
| `MEDIA_LOCAL_DIR` | `./uploads/media` | **Efímero en Render**: los archivos se pierden en cada despliegue |
| `PUBLIC_MEDIA_BASE_URL` | `http://localhost:3000/media` | En producción, el dominio público del bucket o CDN |
| `AVATAR_MAX_BYTES` | `2097152` (2 MB) | |
| `AVATAR_OUTPUT_SIZE` | `512` | Lado del WebP generado |
| `AVATAR_QUALITY` | `82` | |
| `AVATAR_UPLOADS_PER_HOUR` | `5` | |
| `MEDIA_CLEANUP_INTERVAL_MS` | `3600000` | Frecuencia del barrido de huérfanos |
| `MEDIA_ORPHAN_TTL_MS` | `86400000` (24 h) | Antigüedad mínima para considerar huérfano |
| `FILES_MAX_BYTES` | `8388608` (8 MB) | |
| `FILES_MAX_DIMENSION` | `2048` | No se amplía una imagen pequeña |
| `FILES_UPLOADS_PER_HOUR` | `30` | |
| `FILES_MAX_TOTAL_BYTES` | `104857600` (100 MB) | Cupo total por usuario |

Con `STORAGE_DRIVER=s3` son obligatorias `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` y `PUBLIC_MEDIA_BASE_URL`.

---

## API

Todas las rutas cuelgan de la raíz del backend. `JWT` indica que exigen access token.

### Salud

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/` | — | Comprobación de vida |

### Autenticación — `/auth`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/auth/register` | — | Crear cuenta (envía verificación por correo) |
| `POST` | `/auth/verify-email` | — | Confirmar el correo |
| `POST` | `/auth/resend-verification` | — | Reenviar el correo, con enfriamiento |
| `POST` | `/auth/login` | — | Devuelve access token y cookie de refresco |
| `POST` | `/auth/refresh` | Cookie | Rota el refresh token |
| `POST` | `/auth/logout` | Cookie | Revoca la sesión actual |
| `POST` | `/auth/logout-all` | JWT | Revoca todas las sesiones |
| `GET` | `/auth/sessions` | JWT | Sesiones activas con dispositivo e IP |
| `DELETE` | `/auth/sessions/:id` | JWT | Cierra una sesión propia |
| `POST` | `/auth/sessions/revoke-others` | JWT | Cierra las de otros dispositivos |
| `POST` | `/auth/forgot-password` | — | Enlace de recuperación, respuesta genérica |
| `POST` | `/auth/reset-password` | — | Cambia la contraseña y cierra todas las sesiones |

`refresh` y `logout` solo leen la cookie y rechazan orígenes ajenos (`CsrfOriginGuard`). No aceptan el token en el cuerpo.

### Cuenta — `/users`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/users/me` | JWT | Perfil, estadísticas y preferencias |
| `PATCH` | `/users/me/preferences` | JWT | Preferencias |
| `POST` | `/users/me/password` | JWT | Cambio de contraseña con confirmación |
| `POST` | `/users/me/email` | JWT | Inicia el cambio de correo |
| `POST` | `/users/me/email/confirm` | — | Confirma el cambio con el token del correo |
| `DELETE` | `/users/me` | JWT | Baja de cuenta |

### Personajes — `/characters`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/characters` | JWT | Crear personaje |
| `GET` | `/characters/me` | JWT | Personaje propio |
| `PATCH` | `/characters/me` | JWT | Editar perfil |
| `GET` | `/characters/availability` | JWT | Comprobar disponibilidad de nombre |
| `POST` | `/characters/me/avatar` | JWT | Subir avatar (WebP) |
| `DELETE` | `/characters/me/avatar` | JWT | Quitar avatar |
| `GET` | `/characters/:name` | — | Perfil público |

### Intereses — `/interests`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/interests` | — | Catálogo de intereses |

### Archivos — `/files`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/files` | JWT | Subir imagen (cuota por hora y total) |
| `GET` | `/files` | JWT | Listar biblioteca, paginado por cursor |
| `DELETE` | `/files/:id` | JWT | Borrar, si no está en uso |

### Notificaciones — `/notifications`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/notifications` | JWT | Bandeja, paginada por cursor, con `unreadCount` |
| `GET` | `/notifications/unread-count` | JWT | Número de no leídas |
| `POST` | `/notifications/read-all` | JWT | Marcar todas como leídas |
| `POST` | `/notifications/:id/read` | JWT | Marcar una como leída |

Se crean solas al seguir, comentar, responder, acompañar o publicar una etapa en un relato seguido. Nunca avisan a uno mismo.

### Descubrimiento — `/discover`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/discover/featured` | — | Contenido destacado (curado por administración; si no hay, cae a los relatos destacados por sus autores) |
| `GET` | `/discover/trends` | — | Relatos en tendencia por interacción reciente |
| `GET` | `/discover/characters` | JWT | Personajes recomendados según intereses y seguidos |

### Curación — `/admin/featured`

Reservada a `ADMIN`/`SUPERADMIN`. `feature` es un PUT idempotente: omite campos = conserva, `note: ''` la vacía.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/featured` | Lista la curación actual |
| `PUT` | `/admin/featured/:storyId` | Destacar un relato (crea o actualiza; solo publicados) |
| `DELETE` | `/admin/featured/:storyId` | Quitar de la portada |

### Administración

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/admin/users` | `ADMIN`, `SUPERADMIN` | Listado paginado |
| `PATCH` | `/admin/users/:id/role` | `SUPERADMIN` | Cambiar rol |
| `PATCH` | `/admin/users/:id/status` | `ADMIN`, `SUPERADMIN` | Suspender o reactivar |
| `GET` | `/admin/files` | `ADMIN`, `SUPERADMIN` | Listado de archivos |
| `DELETE` | `/admin/files/:id` | `ADMIN`, `SUPERADMIN` | Borrar un archivo |

**Salvaguardas de roles:** nadie cambia su propio rol, el último `SUPERADMIN` activo no puede degradarse ni suspenderse, y toda ruta administrativa comprueba el rol y el estado contra la base de datos en cada petición, no solo en el token.

---

## Modelo de datos y migraciones

29 modelos en `backend/prisma/schema.prisma`. El diseño original está en [`modelo_base_datos.md`](modelo_base_datos.md).

Enums principales: `Role` (USER, MODERATOR, ADMIN, SUPERADMIN), `Status` (ACTIVE, SUSPENDED, DELETED), `Visibility` (PUBLIC, FOLLOWERS, PRIVATE), `StoryStatus`, `CommentStatus`, `ReportStatus`, `EntityType`.

### Migraciones

El historial está versionado en Git:

| Migración | Contenido |
|---|---|---|
| `20261003205500_init_baseline` | Esquema completo, generado del estado real de la base |
| `20261004120000_indices_de_consulta` | Seis índices para las tareas periódicas y las claves foráneas |
| `20261008120000_stories_indices` | Índices de relatos (feed, propietario, destacados) |
| `20261008130000_story_audio_and_follows` | Audio por etapa y índices de seguimiento |
| `20261008140000_interactions_indices` | Unicidad de interacciones y guardados |
| `20261008150000_featured_stories` | Destacado del relato en el perfil público |
| `20261010120000_notifications_and_featured` | `featured_stories` (portada curada), actor y contadores de notificaciones |
| `20261010150000_discovery_escalabilidad` | Índices de comentarios (listado y ventana de tendencias) y de `stories.featuredAt` |

```bash
npx prisma migrate deploy    # aplicar
npx prisma migrate status    # comprobar
```

Reglas:

- **El baseline no se edita.** Cualquier cambio de esquema va en una carpeta nueva con timestamp posterior, y se aplica con `migrate deploy`.
- Las migraciones deben ejecutarse con la URL **directa** de Neon (sin `-pooler`), porque PgBouncer no soporta los bloqueos que usa Prisma Migrate.

### Índices que sostienen el tráfico

Las tareas automáticas filtran por columnas que no tenían índice, así que recorrían la tabla entera:

| Índice | Consulta que sirve |
|---|---|
| `sessions(expiresAt)` | Purga horaria de sesiones caducadas |
| `media_assets(entityType, createdAt)` | Barrido de avatares huérfanos |
| `characters(avatarUrl)` | Comprobación de avatares referenciados |
| `story_updates`, `creations`, `music_tracks(mediaAssetId)` | Conteo de referencias al borrar un archivo |

No se indexó `stories`, `comments` ni `followers`: todavía no hay consultas que los usen y solo añadirían coste de escritura.

---

## Seguridad

### Sesión y tokens

- Access token (**15 min**) en memoria en el frontend, enviado como `Authorization: Bearer`.
- Refresh token (**7 días**) en cookie `httpOnly`, con `Secure` y `path=/auth`.
- **El refresh token se guarda hasheado (SHA-256) en la base.** Una filtración de la tabla no entrega tokens usables.
- **Rotación con detección de robo**: si se presenta un token ya rotado, se revocan *todas* las sesiones del usuario y queda registrado en la auditoría.
- El refresh comprueba que la cuenta siga `ACTIVE`, de modo que una suspensión surte efecto inmediato.
- Un access token ya emitido sigue siendo válido hasta 15 minutos aunque se cierren las sesiones: es el precio de no consultar la base en cada petición, y está acotado por la duración del token.

### Contraseñas y enumeración de cuentas

- bcrypt con coste 12 y actualización transparente si la política sube.
- El login compara siempre contra un hash señuelo: el tiempo de respuesta no revela si un correo existe, y el mensaje de error es idéntico en ambos casos.
- Comprobación contra filtraciones conocidas (Have I Been Pwned), desactivable con `PASSWORD_BREACH_CHECK_ENABLED=false`.
- Bloqueo por cuenta además del límite por IP, para frenar ataques distribuidos.
- Los tokens de verificación, recuperación y cambio de correo son de un solo uso: su firma ata al hash de contraseña y al estado del correo, así que quedan invalidados al utilizarlos.

### Otras defensas

- `helmet`, CORS con lista blanca y `trust proxy` para que el rate limiting vea la IP real.
- `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`: los campos no esperados en el cuerpo se rechazan.
- `CsrfOriginGuard` en las rutas que se autentican con la cookie.
- Rate limiting por ruta, con límite global de 100 por minuto.
- Avisos de auditoría en login, cierre de sesión, robo de token, cambios de contraseña y moderación.
- Los archivos se sirven con `nosniff` y una CSP que impide que un archivo subido se ejecute como HTML.

---

## Despliegue

### Backend en Render

| Paso | Valor |
|---|---|
| Build | `npm ci && npm run build` |
| Pre-deploy / release | `npx prisma migrate deploy && npx prisma generate` |
| Start | `npm run start:prod` |
| `NODE_ENV` | `production` |

El comando `prebuild` ya ejecuta `prisma generate`, así que un build limpio genera el cliente.

### Frontend en Vercel

Proyecto Next.js con `NEXT_PUBLIC_API_URL` apuntando a la API. `/dashboard` redirige de forma permanente a `/feed`.

### Antes de publicar

- [ ] `JWT_SECRET` aleatorio y largo
- [ ] `COOKIE_SAMESITE` **no** definido como `lax` (o puesto a `none`)
- [ ] `CORS_ORIGINS` y `FRONTEND_URL` con el dominio real
- [ ] `DATABASE_URL` con `pgbouncer=true&connection_limit=3`
- [ ] `REDIS_URL` definida (si no, los bloqueos se reinician en cada despliegue)
- [ ] `STORAGE_DRIVER=s3` con `PUBLIC_MEDIA_BASE_URL` apuntando al CDN
- [ ] `MAIL_HOST` y credenciales SMTP reales

El arranque comprueba las cuatro primeras y **avisa por log sin impedir el despliegue**.

---

## Deuda técnica y pendientes

Ordenados por lo que más afecta a la experiencia.

1. **Almacenamiento en local en producción.** `STORAGE_DRIVER=local` significa que los avatares y archivos viven en el disco del contenedor y **se pierden en cada despliegue**. Hay que crear un bucket en R2 y configurar las variables. Hasta entonces, el arranque lo avisa.
2. **`REDIS_URL` sin definir.** El bloqueo de intentos fallidos, los enfriamientos de correo y las cuotas por hora se guardan en memoria del proceso: se reinician en cada despliegue y no se comparten si se añade una segunda instancia.
3. **`DATABASE_URL` sin `pgbouncer` ni `connection_limit`.** Causa probable de caídas de conexión cuando sube el tráfico. El valor correcto está documentado en `.env.example`.
4. **Migraciones a través del pooler.** No hay migraciones pendientes, pero el comando de release usa la misma URL que la aplicación. Lo correcto es añadir `DIRECT_DATABASE_URL` al esquema (`directUrl`) para que las migraciones usen la conexión directa.
5. **El Feed consume datos de ejemplo.** La interfaz está lista; falta el módulo de historias en el backend.
6. **Documentación desactualizada.** `backend/README.md` es el texto de ejemplo de NestJS y no describe nada de este proyecto.

### Decisiones pendientes de confirmar

- El mensaje del commit `6dbcbb6` contiene un carácter sobrante (`旧`). Corregirlo exige reescribir la historia con `force-push`.
- ¿Debe `Swagger` poder activarse en producción con una bandera? Ahora solo se monta fuera de producción.

---

## Comandos habituales

### Backend

```bash
npm run start:dev        # desarrollo con recarga
npm run build            # compilar
npm run start:prod       # ejecutar lo compilado
npm test                 # 163 tests
npm run test:e2e         # E2E
npm run test:cov         # cobertura
npm run lint             # oxlint
npm run format           # prettier

npx prisma migrate deploy
npx prisma studio
```

### Frontend

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

---

## Documentos relacionados

| Documento | Contenido |
|---|---|
| [`modelo_base_datos.md`](modelo_base_datos.md) | Diseño original de la base de datos |
| [`roadmap_backend.md`](roadmap_backend.md) | Hoja de ruta por fases, del MVP a la expansión |
| [`backend/.env.example`](backend/.env.example) | Todas las variables, comentadas |
