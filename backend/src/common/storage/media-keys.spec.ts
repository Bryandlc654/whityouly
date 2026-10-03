import { isOwnMediaUrl, isSafeMediaKey, keyFromPublicUrl } from './media-keys';

const BASE = 'https://cdn.whityouly.com';

describe('media-keys', () => {
  it('acepta claves con prefijo y segmentos seguros', () => {
    expect(isSafeMediaKey('avatars/char-1/abc.webp')).toBe(true);
  });

  it('rechaza segmentos con normales de Windows o nombres reservados', () => {
    expect(isSafeMediaKey('avatars/char-1/abc.')).toBe(false);
    expect(isSafeMediaKey('avatars/char-1/abc ')).toBe(false);
    expect(isSafeMediaKey('avatars/CON/abc.webp')).toBe(false);
    expect(isSafeMediaKey(`avatars/${'a'.repeat(97)}/abc.webp`)).toBe(false);
  });

  it('rechaza recorridos de directorio y rutas absolutas', () => {
    expect(isSafeMediaKey('../etc/passwd')).toBe(false);
    expect(isSafeMediaKey('avatars/../../etc/passwd')).toBe(false);
    expect(isSafeMediaKey('/avatars/char-1/abc.webp')).toBe(false);
    expect(isSafeMediaKey('avatars/./abc.webp')).toBe(false);
    expect(isSafeMediaKey('avatars\\char-1\\abc.webp')).toBe(false);
    expect(isSafeMediaKey('')).toBe(false);
  });

  it('extrae la clave solo de URLs propias', () => {
    expect(keyFromPublicUrl(`${BASE}/avatars/char-1/abc.webp`, BASE)).toBe(
      'avatars/char-1/abc.webp',
    );
    expect(keyFromPublicUrl('https://otro-sitio.com/avatars/char-1/abc.webp', BASE)).toBeNull();
    expect(keyFromPublicUrl(`${BASE}/../../secret`, BASE)).toBeNull();
    expect(keyFromPublicUrl('https://cdn.whityouly.com.evil.com/x.webp', BASE)).toBeNull();
  });

  it('valida la pertenencia al almacenamiento propio', () => {
    expect(isOwnMediaUrl(`${BASE}/avatars/char-1/abc.webp`, BASE)).toBe(true);
    expect(isOwnMediaUrl('https://evil.example/avatar.png', BASE)).toBe(false);
  });
});
