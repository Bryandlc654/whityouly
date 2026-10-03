export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function extractErrorMessage(payload: unknown, fallback: string): string {
  const message = (payload as { message?: unknown } | null)?.message;

  if (Array.isArray(message)) {
    return message.join(' ');
  }

  if (typeof message === 'string' && message.trim() !== '') {
    return message;
  }

  return fallback;
}
