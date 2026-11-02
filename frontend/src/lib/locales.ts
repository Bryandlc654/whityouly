export const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
] as const;

export const COUNTRIES = [
  { code: 'PE', label: 'Perú' },
  { code: 'MX', label: 'México' },
  { code: 'ES', label: 'España' },
  { code: 'AR', label: 'Argentina' },
  { code: 'BO', label: 'Bolivia' },
  { code: 'BR', label: 'Brasil' },
  { code: 'CA', label: 'Canadá' },
  { code: 'CL', label: 'Chile' },
  { code: 'CO', label: 'Colombia' },
  { code: 'CR', label: 'Costa Rica' },
  { code: 'DE', label: 'Alemania' },
  { code: 'EC', label: 'Ecuador' },
  { code: 'FR', label: 'Francia' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'GT', label: 'Guatemala' },
  { code: 'IT', label: 'Italia' },
  { code: 'JP', label: 'Japón' },
  { code: 'KR', label: 'Corea del Sur' },
  { code: 'PY', label: 'Paraguay' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'UY', label: 'Uruguay' },
  { code: 'VE', label: 'Venezuela' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export type CountryCode = (typeof COUNTRIES)[number]['code'];

export function languageLabel(code: string | null | undefined): string {
  return LANGUAGES.find((item) => item.code === code)?.label ?? code ?? 'Idioma';
}

export function countryLabel(code: string | null | undefined): string {
  return COUNTRIES.find((item) => item.code === code)?.label ?? code ?? '';
}
