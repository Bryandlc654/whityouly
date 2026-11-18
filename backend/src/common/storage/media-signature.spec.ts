import { describe, expect, it } from 'vitest';
import { env } from '../../config/env';
import { signMediaKey, signedMediaUrl, verifyMediaSignature } from './media-signature';

describe('firmas de medios', () => {
  it('acepta una firma vigente', () => {
    const query = signMediaKey('media/user/file.webp');
    const params = new URLSearchParams(query);
    expect(
      verifyMediaSignature('media/user/file.webp', params.get('exp'), params.get('sig')),
    ).toBe(true);
  });

  it('rechaza una firma manipulada o de otra clave', () => {
    const query = signMediaKey('media/user/file.webp');
    const params = new URLSearchParams(query);
    expect(
      verifyMediaSignature('media/user/otro.webp', params.get('exp'), params.get('sig')),
    ).toBe(false);
  });

  it('rechaza una firma caducada', () => {
    const query = signMediaKey('media/user/file.webp', -1_000);
    const params = new URLSearchParams(query);
    expect(
      verifyMediaSignature('media/user/file.webp', params.get('exp'), params.get('sig')),
    ).toBe(false);
  });

  it('firma solo las URLs propias', () => {
    const base = env.storage.publicBaseUrl;
    const own = `${base}/media/user/file.webp`;
    const external = 'https://example.com/file.webp';
    expect(signedMediaUrl(own)).toContain('sig=');
    expect(signedMediaUrl(external)).toBe(external);
  });
});
