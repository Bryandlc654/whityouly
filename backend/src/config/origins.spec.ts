import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './origins';

describe('isAllowedOrigin', () => {
  const patterns = ['https://whityouly.vercel.app', 'https://whityouly-*.vercel.app'];

  it('deja pasar peticiones sin Origin (no vienen de un navegador)', () => {
    expect(isAllowedOrigin(undefined, patterns)).toBe(true);
  });

  it('acepta un origen exacto', () => {
    expect(isAllowedOrigin('https://whityouly.vercel.app', patterns)).toBe(true);
  });

  it('acepta los subdominios de despliegue de Vercel mediante el comodín', () => {
    expect(
      isAllowedOrigin('https://whityouly-ak8wqqj19-bryandlc654s-projects.vercel.app', patterns),
    ).toBe(true);
  });

  it('no deja pasar un host que solo se parece por detrás', () => {
    expect(isAllowedOrigin('https://evil.vercel.app.evil.com', patterns)).toBe(false);
  });

  it('no deja pasar un dominio ajeno', () => {
    expect(isAllowedOrigin('https://evil.example', patterns)).toBe(false);
  });

  it('ignora la barra final y las mayúsculas', () => {
    expect(isAllowedOrigin('https://Whityouly.vercel.app/', patterns)).toBe(true);
  });
});
