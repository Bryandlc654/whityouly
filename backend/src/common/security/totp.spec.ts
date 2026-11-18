import { describe, expect, it } from 'vitest';
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  totpCode,
  verifyTotp,
} from './totp';

describe('TOTP', () => {
  it('genera códigos de 6 dígitos que se validan con el mismo secreto', () => {
    const secret = generateTotpSecret();
    const code = totpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('cifra y descifra el secreto', () => {
    const secret = generateTotpSecret();
    const encrypted = encryptMfaSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
  });

  it('genera códigos de recuperación únicos y hashes estables', () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code))).toBe(true);
    expect(hashRecoveryCode(codes[0].toLowerCase())).toBe(hashRecoveryCode(codes[0]));
  });
});
