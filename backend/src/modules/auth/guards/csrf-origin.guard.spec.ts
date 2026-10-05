import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CsrfOriginGuard } from './csrf-origin.guard';
import { env } from '../../../config/env';

function contextFor(origin?: string, host?: string): ExecutionContext {
  const request = { headers: { ...(origin ? { origin } : {}), ...(host ? { host } : {}) } };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CsrfOriginGuard', () => {
  const guard = new CsrfOriginGuard();
  const [allowedOrigin] = env.corsOrigins;

  it('deja pasar al frontend permitido', () => {
    expect(guard.canActivate(contextFor(allowedOrigin))).toBe(true);
  });

  it('rechaza un origen ajeno para que no pueda usar la cookie de refresco', () => {
    expect(() => guard.canActivate(contextFor('https://evil.example'))).toThrow(ForbiddenException);
  });

  it('no acepta Origins parecidos', () => {
    const lookalike = allowedOrigin.endsWith('/')
      ? allowedOrigin.slice(0, -1)
      : `${allowedOrigin}/otro`;

    expect(() => guard.canActivate(contextFor(lookalike))).toThrow(ForbiddenException);
  });

  it('permite peticiones sin Origin: no vienen de un navegador', () => {
    expect(guard.canActivate(contextFor())).toBe(true);
  });

  it('permite el mismo host de la API (Swagger en local, acceso directo)', () => {
    expect(guard.canActivate(contextFor('http://localhost:3000', 'localhost:3000'))).toBe(true);
  });

  it('sigue rechazando a un atacante cuyo host se parece al de la API', () => {
    expect(() =>
      guard.canActivate(contextFor('https://whityouly.onrender.com.evil.example', 'localhost:3000')),
    ).toThrow(ForbiddenException);
  });

  it('rechaza un Origin mal formado sin tumbar la ruta', () => {
    expect(() => guard.canActivate(contextFor('no-es-una-url', 'localhost:3000'))).toThrow(
      ForbiddenException,
    );
  });
});
