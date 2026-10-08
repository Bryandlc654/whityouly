import 'dotenv/config';
import type { StringValue } from 'ms';

const duration = (value: string | undefined, fallback: StringValue): StringValue =>
  (value ?? fallback) as StringValue;

function required(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Falta la variable de entorno obligatoria "${name}". Revisa tu archivo .env (ver .env.example).`,
    );
  }
  return value;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseList(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const jwtSecret = required('JWT_SECRET');

const storageDriver = (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3';

if (storageDriver === 's3') {
  required('S3_BUCKET');
  required('S3_ACCESS_KEY_ID');
  required('S3_SECRET_ACCESS_KEY');
  required('PUBLIC_MEDIA_BASE_URL');
}

const publicMediaBaseUrl = (
  process.env.PUBLIC_MEDIA_BASE_URL ??
  'http://localhost:3000/media'
).replace(/\/$/, '');

/**
 * Diagnóstico del pool de conexiones, que es lo que hace que un backend se quede
 * sin conexiones antes de que las consultas sean lentas. Con el endpoint
 * agrupado de Neon (host "-pooler"), Prisma necesita `pgbouncer=true` para no
 * usar sentencias preparadas y `connection_limit` acotado: cada conexión abierta
 * consume una ranura de Neon y, sin tope, el propio tráfico puede agotarlas.
 */
const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseParams = databaseUrl.includes('?') ? databaseUrl.slice(databaseUrl.indexOf('?') + 1) : '';
const usesNeonPooler = /-pooler\./.test(databaseUrl) || /pooler=true/.test(databaseParams);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseNumber(process.env.PORT, 3000),
  trustProxy: parseNumber(process.env.TRUST_PROXY, 1),
  jwtSecret,
  // Secreto independiente para refresh tokens. Si no se define (o queda vacío en
  // el .env), se deriva del principal.
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET?.trim() || `${jwtSecret}:refresh`,
  jwtAccessExpiresIn: duration(process.env.JWT_ACCESS_EXPIRES_IN, '15m'),
  jwtRefreshExpiresIn: duration(process.env.JWT_REFRESH_EXPIRES_IN, '7d'),
  jwtEmailVerificationExpiresIn: duration(process.env.JWT_EMAIL_VERIFICATION_EXPIRES_IN, '24h'),
  // El cambio de correo tiene una ventana corta: el enlace solo sirve para
  // confirmar que la persona controla la dirección nueva.
  jwtEmailChangeExpiresIn: duration(process.env.JWT_EMAIL_CHANGE_EXPIRES_IN, '1h'),
  jwtPasswordResetExpiresIn: duration(process.env.JWT_PASSWORD_RESET_EXPIRES_IN, '15m'),
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
  corsOrigins: parseList(process.env.CORS_ORIGINS, 'http://localhost:3001'),
  redisUrl: process.env.REDIS_URL ?? '',
  passwordBreachCheckEnabled: process.env.PASSWORD_BREACH_CHECK_ENABLED !== 'false',
  loginMaxAttempts: parseNumber(process.env.LOGIN_MAX_ATTEMPTS, 5),
  loginLockDurationMs: parseNumber(process.env.LOGIN_LOCK_DURATION_MS, 15 * 60_000),
  passwordResetCooldownMs: parseNumber(process.env.PASSWORD_RESET_COOLDOWN_MS, 60_000),
  emailResendCooldownMs: parseNumber(process.env.EMAIL_RESEND_COOLDOWN_MS, 60_000),
  maxSessionsPerUser: parseNumber(process.env.MAX_SESSIONS_PER_USER, 10),
  sessionCleanupIntervalMs: parseNumber(process.env.SESSION_CLEANUP_INTERVAL_MS, 60 * 60_000),
  cookie: {
    // En producción por defecto Secure=true (requerido si SameSite=None).
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    // El frontend y la API se despliegan en dominios distintos (Vercel y
    // Render), de modo que la cookie de refresco solo vuelve si es
    // SameSite=None. Con 'lax' el navegador no la envía en las peticiones
    // cross-site, el refresh falla y toda llamada autenticada responde 401 en
    // cuanto caduca el access token.
    sameSite: (process.env.COOKIE_SAMESITE ??
      (process.env.NODE_ENV === 'production' ? 'none' : 'lax')) as 'lax' | 'strict' | 'none',
    domain: process.env.COOKIE_DOMAIN ?? '',
  },
  mail: {
    host: process.env.MAIL_HOST ?? '',
    port: parseNumber(process.env.MAIL_PORT, 587),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER ?? '',
    pass: process.env.MAIL_PASS ?? '',
    from: process.env.MAIL_FROM ?? '"No Reply Whityouly" <noreply@whityouly.com>',
  },
  database: {
    usesPooler: usesNeonPooler,
    pgbouncer: /pgbouncer=true/.test(databaseParams),
    connectionLimit: /connection_limit=(\d+)/.exec(databaseParams)?.[1] ?? null,
  },
  storage: {
    driver: storageDriver,
    localDir: process.env.MEDIA_LOCAL_DIR ?? './uploads/media',
    // Base pública de los archivos. En local la sirve la propia API.
    publicBaseUrl: publicMediaBaseUrl,
    // Un bucle local solo vale en desarrollo: en producción produce URLs rotas
    // y, además, `keyFromPublicUrl` deja de reconocerlas para poder borrarlas.
    publicBaseUrlIsLoopback: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(
      publicMediaBaseUrl,
    ),
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'auto',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    },
  },
  avatar: {
    // Tope de bytes del archivo subido (2 MB por defecto).
    maxBytes: parseNumber(process.env.AVATAR_MAX_BYTES, 2 * 1024 * 1024),
    // Tope de píxeles totales: protege frente a imágenes bomba descompresional.
    maxPixels: parseNumber(process.env.AVATAR_MAX_PIXELS, 40_000_000),
    outputSize: parseNumber(process.env.AVATAR_OUTPUT_SIZE, 512),
    quality: parseNumber(process.env.AVATAR_QUALITY, 82),
    uploadsPerHour: parseNumber(process.env.AVATAR_UPLOADS_PER_HOUR, 5),
    mediaCleanupIntervalMs: parseNumber(process.env.MEDIA_CLEANUP_INTERVAL_MS, 60 * 60_000),
    // Antigüedad mínima de un avatar huérfano antes de purgarlo.
    orphanTtlMs: parseNumber(process.env.MEDIA_ORPHAN_TTL_MS, 24 * 60 * 60_000),
  },
  files: {
    maxBytes: parseNumber(process.env.FILES_MAX_BYTES, 8 * 1024 * 1024),
    maxPixels: parseNumber(process.env.FILES_MAX_PIXELS, 40_000_000),
    // Lado mayor de la imagen guardada. No se amplía una imagen pequeña.
    maxDimension: parseNumber(process.env.FILES_MAX_DIMENSION, 2048),
    quality: parseNumber(process.env.FILES_QUALITY, 82),
    uploadsPerHour: parseNumber(process.env.FILES_UPLOADS_PER_HOUR, 30),
    // Cupo total por usuario. Es lo que evita que la biblioteca crezca sin fin.
    maxTotalBytes: parseNumber(process.env.FILES_MAX_TOTAL_BYTES, 100 * 1024 * 1024),
  },
  audio: {
    // Tope por archivo de audio (10 MB por defecto). No se re-codifica (haría
    // falta ffmpeg), así que el tope de bytes es la única contención real.
    maxBytes: parseNumber(process.env.AUDIO_MAX_BYTES, 10 * 1024 * 1024),
    uploadsPerHour: parseNumber(process.env.AUDIO_UPLOADS_PER_HOUR, 20),
  },
  stories: {
    // Tope de relatos vivos (no borrados) por personaje. Evita que una sola
    // cuenta llene la tabla y degrada el coste de las consultas de "mis relatos".
    maxPerCharacter: parseNumber(process.env.STORY_MAX_PER_CHARACTER, 500),
    // Tope de etapas por relato. La evolución es una lista ordenada que se lee
    // entera en el detalle, así que sin tope una sola historia encarecería la
    // lectura para todo el mundo.
    maxUpdatesPerStory: parseNumber(process.env.STORY_MAX_UPDATES, 100),
    // Cadencia de escritura por usuario y hora. Escribir es barato, pero publicar
    // en bucle es la vía habitual de spam.
    createsPerHour: parseNumber(process.env.STORY_CREATES_PER_HOUR, 20),
    updatesPerHour: parseNumber(process.env.STORY_UPDATES_PER_HOUR, 120),
    // Máximo de modificaciones de metadatos (título, visibilidad, taxonomía).
    editsPerHour: parseNumber(process.env.STORY_EDITS_PER_HOUR, 60),
  },
};
