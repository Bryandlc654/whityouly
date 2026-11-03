export const VISUAL_CARD_THEMES = [
  { id: 'lavender', label: 'Lavanda', description: 'Suave y nocturno' },
  { id: 'sunset', label: 'Atardecer', description: 'Cálido y luminoso' },
  { id: 'forest', label: 'Bosque', description: 'Verde y sereno' },
  { id: 'ocean', label: 'Océano', description: 'Azul y profundo' },
  { id: 'rose', label: 'Rosa', description: 'Cercano y delicado' },
  { id: 'paper', label: 'Papel', description: 'Claro y editorial' },
] as const;

export type VisualCardTheme = (typeof VISUAL_CARD_THEMES)[number]['id'];

export const VISUAL_CARD_THEME_IDS = VISUAL_CARD_THEMES.map((theme) => theme.id);

export function parseVisualCardTheme(value: unknown): VisualCardTheme | null {
  return typeof value === 'string' &&
    VISUAL_CARD_THEMES.some((theme) => theme.id === value)
    ? (value as VisualCardTheme)
    : null;
}

export function visualCardThemeLabel(value: string | null | undefined): string | null {
  return VISUAL_CARD_THEMES.find((theme) => theme.id === value)?.label ?? null;
}
