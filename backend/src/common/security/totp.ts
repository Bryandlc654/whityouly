import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { env } from '../../config/env';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Secreto TOTP de 160 bits, codificado en base32 (formato de los autenticadores). */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let secret = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    secret += BASE32[Number.parseInt(chunk, 2)];
  }
  return secret;
}

export function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = '';
  for (const char of clean) {
    const value = BASE32.indexOf(char);
    if (value === -1) {
      throw new Error('Secreto TOTP inválido');
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpCode(secret: string, timestamp = Date.now(), digits = 6): string {
  const counter = Math.floor(timestamp / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** Acepta el código actual y una ventana de ±30 s por desfase de reloj. */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }
  const expected = Buffer.from(normalized);
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = Buffer.from(totpCode(secret, Date.now() + offset * 30_000));
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return true;
    }
  }
  return false;
}

export function otpauthUrl(account: string, secret: string): string {
  const issuer = env.mfaIssuer;
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    let code = '';
    for (let i = 0; i < 8; i += 1) {
      code += RECOVERY_ALPHABET[randomBytes(1)[0] % RECOVERY_ALPHABET.length];
    }
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256')
    .update(code.replace(/[^A-Z0-9]/gi, '').toUpperCase())
    .digest('hex');
}

function encryptionKey(): Buffer {
  return createHash('sha256').update(env.mfaSecret).digest();
}

export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptMfaSecret(payload: string): string {
  const [ivRaw, tagRaw, dataRaw] = payload.split('.');
  if (!ivRaw || !tagRaw || !dataRaw) {
    throw new Error('Secreto MFA inválido');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
