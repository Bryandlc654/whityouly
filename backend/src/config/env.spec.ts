/**
 * La cookie de refresco decide si el usuario puede seguir usando la aplicacion
 * cuando caduca el access token. Con el frontend en otro dominio, un SameSite
 * Lax hace que el navegador no devuelva la cookie: el refresh responde 401 y
 * toda peticion autenticada falla con "Unauthorized" sin explicacion. Estos
 * valores por defecto evitan que el despliegue production nazca asi.
 */
async function loadEnvWith(NODE_ENV: string | undefined, COOKIE_SAMESITE?: string) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    COOKIE_SAMESITE: process.env.COOKIE_SAMESITE,
  };

  if (NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = NODE_ENV;
  }

  if (COOKIE_SAMESITE === undefined) {
    delete process.env.COOKIE_SAMESITE;
  } else {
    process.env.COOKIE_SAMESITE = COOKIE_SAMESITE;
  }

  vi.resetModules();
  const { env } = await import('./env');

  process.env.NODE_ENV = previous.NODE_ENV;
  process.env.COOKIE_SAMESITE = previous.COOKIE_SAMESITE;
  if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;

  return env;
}

describe('configuración de la cookie de refresco', () => {
  it('en producción usa SameSite=None y Secure para que la cookie viaje entre dominios', async () => {
    const env = await loadEnvWith('production');

    expect(env.cookie.sameSite).toBe('none');
    expect(env.cookie.secure).toBe(true);
  });

  it('respeta un COOKIE_SAMESITE explícito', async () => {
    const env = await loadEnvWith('production', 'lax');

    expect(env.cookie.sameSite).toBe('lax');
  });

  it('en desarrollo mantiene Lax y sin Secure para trabajar sobre http', async () => {
    const env = await loadEnvWith('development');

    expect(env.cookie.sameSite).toBe('lax');
    expect(env.cookie.secure).toBe(false);
  });
});

describe('diagnóstico del pool de conexiones', () => {
  const previous = process.env.DATABASE_URL;

  afterEach(() => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    vi.resetModules();
  });

  async function loadWith(url: string) {
    process.env.DATABASE_URL = url;
    vi.resetModules();
    const { env } = await import('./env');
    return env;
  }

  it('detecta el pooler de Neon y la ausencia de pgbouncer y connection_limit', async () => {
    const env = await loadWith(
      'postgresql://u:p@ep-xyz-pooler.us-east-2.aws.neon.tech/db?sslmode=require',
    );

    expect(env.database.usesPooler).toBe(true);
    expect(env.database.pgbouncer).toBe(false);
    expect(env.database.connectionLimit).toBeNull();
  });

  it('reconoce una configuración agrupada correcta', async () => {
    const env = await loadWith(
      'postgresql://u:p@ep-xyz-pooler.us-east-2.aws.neon.tech/db?pgbouncer=true&connection_limit=5',
    );

    expect(env.database.usesPooler).toBe(true);
    expect(env.database.pgbouncer).toBe(true);
    expect(env.database.connectionLimit).toBe('5');
  });

  it('no marca el pooler cuando la conexión es directa', async () => {
    const env = await loadWith('postgresql://u:p@ep-xyz.us-east-2.aws.neon.tech/db?sslmode=require');

    expect(env.database.usesPooler).toBe(false);
  });
});
