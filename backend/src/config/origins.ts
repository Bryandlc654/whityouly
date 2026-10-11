import { env } from './env';

/**
 * Comprueba si un `Origin` está permitido por la lista `CORS_ORIGINS`.
 *
 * Cada entrada puede ser un origen exacto (`https://app.com`) o un patrón con
 * `*` (`https://whityouly-*.vercel.app`). El comodín hace falta porque cada
 * despliegue de vista previa de Vercel recibe un subdominio distinto
 * (`whityouly-<hash>-<proyecto>.vercel.app`), así que una lista fija deja fuera
 * a la mayoría de despliegues.
 *
 * El `*` se convierte en `.*` sobre un patrón ya escapado y anclado de principio
 * a fin, de modo que `https://*.vercel.app` no deja pasar
 * `https://evil.vercel.app.evil.com`.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  patterns: string[] = env.corsOrigins,
): boolean {
  // Sin `Origin` no hay navegador de por medio (curl, app nativa) ni una
  // petición cross-site que restringir: el navegador siempre lo envía cuando
  // la fuente importa.
  if (!origin) {
    return true;
  }

  const normalized = normalizeOrigin(origin);

  return patterns.some((pattern) => matchesOriginPattern(pattern, normalized));
}

function normalizeOrigin(value: string): string {
  return value.trim().toLowerCase().replace(/\/$/, '');
}

function matchesOriginPattern(pattern: string, origin: string): boolean {
  const normalizedPattern = normalizeOrigin(pattern);

  if (!normalizedPattern) {
    return false;
  }

  if (!normalizedPattern.includes('*')) {
    return normalizedPattern === origin;
  }

  const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);

  return regex.test(origin);
}
