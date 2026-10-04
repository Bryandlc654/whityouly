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
