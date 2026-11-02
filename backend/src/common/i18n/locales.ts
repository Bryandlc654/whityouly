/** Idiomas de interfaz y lectura que la API acepta hoy. */
export const LANGUAGES = ['es', 'en', 'pt', 'fr'] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
};

/** Códigos ISO 3166-1 alfa-2 usados por el selector de país. */
export const COUNTRY_CODES = [
  'AR',
  'BO',
  'BR',
  'CA',
  'CL',
  'CO',
  'CR',
  'DE',
  'EC',
  'ES',
  'FR',
  'GB',
  'GT',
  'IT',
  'JP',
  'KR',
  'MX',
  'PE',
  'PY',
  'US',
  'UY',
  'VE',
] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  AR: 'Argentina',
  BO: 'Bolivia',
  BR: 'Brasil',
  CA: 'Canadá',
  CL: 'Chile',
  CO: 'Colombia',
  CR: 'Costa Rica',
  DE: 'Alemania',
  EC: 'Ecuador',
  ES: 'España',
  FR: 'Francia',
  GB: 'Reino Unido',
  GT: 'Guatemala',
  IT: 'Italia',
  JP: 'Japón',
  KR: 'Corea del Sur',
  MX: 'México',
  PE: 'Perú',
  PY: 'Paraguay',
  US: 'Estados Unidos',
  UY: 'Uruguay',
  VE: 'Venezuela',
};

export function isLanguage(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && (COUNTRY_CODES as readonly string[]).includes(value);
}
