export const VISUAL_CARD_THEMES = [
  { id: 'lavender', label: 'Lavanda', description: 'Suave y nocturno' },
  { id: 'sunset', label: 'Atardecer', description: 'Cálido y luminoso' },
  { id: 'forest', label: 'Bosque', description: 'Verde y sereno' },
  { id: 'ocean', label: 'Océano', description: 'Azul y profundo' },
  { id: 'rose', label: 'Rosa', description: 'Cercano y delicado' },
  { id: 'paper', label: 'Papel', description: 'Claro y editorial' },
  // Estilos de tarjeta de la entrega v58 (SHARE_CARD_TEMPLATES).
  { id: 'violet', label: 'Violeta', description: 'Morado de la marca' },
  { id: 'hope', label: 'Esperanza', description: 'Verde profundo' },
  { id: 'calm', label: 'Calma', description: 'Azul verdoso' },
  { id: 'dawn', label: 'Amanecer', description: 'Melocotón y rosa' },
  { id: 'night', label: 'Noche', description: 'Azul noche' },
  { id: 'minimal', label: 'Minimal', description: 'Blanco y lavanda' },
] as const;

export type VisualCardPreset = (typeof VISUAL_CARD_THEMES)[number]['id'];

/**
 * Valor guardado en `visualCardTheme`. Es un tema predefinido o un degradado
 * propio, con un patrón opcional:
 *   `violet` · `violet~hearts` · `custom-ff8a5c-7b4dff` · `custom-ff8a5c-7b4dff~dots`
 * El backend valida el mismo formato (VISUAL_CARD_THEME_PATTERN).
 */
export type VisualCardTheme = string;

export const VISUAL_CARD_PATTERNS = [
  { id: 'none', label: 'Sin patrón' },
  { id: 'dots', label: 'Puntos' },
  { id: 'waves', label: 'Ondas' },
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'lines', label: 'Líneas' },
  { id: 'hearts', label: 'Corazones' },
  { id: 'sparkles', label: 'Destellos' },
] as const;

export type VisualCardPattern = (typeof VISUAL_CARD_PATTERNS)[number]['id'];

export const VISUAL_CARD_THEME_IDS = VISUAL_CARD_THEMES.map((theme) => theme.id);

const PRESET_IDS = VISUAL_CARD_THEMES.map((theme) => theme.id).join('|');
const PATTERN_IDS = VISUAL_CARD_PATTERNS.filter((item) => item.id !== 'none').map((item) => item.id).join('|');
const THEME_RE = new RegExp(`^(${PRESET_IDS}|custom-[0-9a-f]{6}-[0-9a-f]{6})(?:~(${PATTERN_IDS}))?$`);

/** Colores de cada tema predefinido (los mismos que withyouly.css y SHARE_CARD_TEMPLATES de v58). */
const PRESET_COLORS: Record<VisualCardPreset, { from: string; to: string; ink: string }> = {
  lavender: { from: '#4c2a9e', to: '#9b6dff', ink: '#ffffff' },
  sunset: { from: '#a53b4d', to: '#f29a62', ink: '#ffffff' },
  forest: { from: '#124c3e', to: '#55a882', ink: '#ffffff' },
  ocean: { from: '#163c71', to: '#3c8fbd', ink: '#ffffff' },
  rose: { from: '#7e2a58', to: '#e884aa', ink: '#ffffff' },
  paper: { from: '#fffaf0', to: '#e6d7c3', ink: '#2b2342' },
  violet: { from: '#6246f5', to: '#7942cc', ink: '#ffffff' },
  hope: { from: '#23704f', to: '#2d7d56', ink: '#ffffff' },
  calm: { from: '#146b78', to: '#187a7b', ink: '#ffffff' },
  dawn: { from: '#fff0de', to: '#efb2c4', ink: '#38283f' },
  night: { from: '#171f46', to: '#4d3d87', ink: '#ffffff' },
  minimal: { from: '#ffffff', to: '#f3f0ff', ink: '#292432' },
};

export interface VisualCardStyle {
  /** Tema predefinido, o `null` si es un degradado propio. */
  preset: VisualCardPreset | null;
  from: string;
  to: string;
  /** Color del texto, legible sobre el degradado. */
  ink: string;
  /** Fondo suave para etiquetas y círculos decorativos. */
  soft: string;
  pattern: VisualCardPattern;
}

/** Luminancia relativa (WCAG) de un color #rrggbb. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texto oscuro sobre degradados claros y blanco sobre los oscuros. */
export function readableInk(from: string, to: string): string {
  return (luminance(from) + luminance(to)) / 2 > 0.42 ? '#2a2238' : '#ffffff';
}

function softFor(ink: string): string {
  return ink === '#ffffff' ? 'rgba(255,255,255,.17)' : 'rgba(42,34,56,.10)';
}

export function parseVisualCardTheme(value: unknown): VisualCardTheme | null {
  return typeof value === 'string' && THEME_RE.test(value) ? value : null;
}

/** Interpreta el valor guardado. Devuelve `null` si no es una tarjeta visual válida. */
export function decodeVisualCard(value: string | null | undefined): VisualCardStyle | null {
  if (!value) return null;
  const match = THEME_RE.exec(value);
  if (!match) return null;
  const pattern = (match[2] ?? 'none') as VisualCardPattern;
  if (match[1].startsWith('custom-')) {
    const [, from, to] = match[1].split('-');
    const ink = readableInk(`#${from}`, `#${to}`);
    return { preset: null, from: `#${from}`, to: `#${to}`, ink, soft: softFor(ink), pattern };
  }
  const preset = match[1] as VisualCardPreset;
  const colors = PRESET_COLORS[preset];
  return { preset, ...colors, soft: softFor(colors.ink), pattern };
}

/** Construye el valor a guardar a partir de lo elegido en el compositor. */
export function encodeVisualCard(input: {
  preset: VisualCardPreset | null;
  from?: string;
  to?: string;
  pattern: VisualCardPattern;
}): VisualCardTheme {
  const base =
    input.preset ??
    `custom-${(input.from ?? '#6246f5').replace('#', '').toLowerCase()}-${(input.to ?? '#7942cc').replace('#', '').toLowerCase()}`;
  return input.pattern === 'none' ? base : `${base}~${input.pattern}`;
}

export function presetColors(preset: VisualCardPreset) {
  return PRESET_COLORS[preset];
}

export function visualCardThemeLabel(value: string | null | undefined): string | null {
  const style = decodeVisualCard(value);
  if (!style) return null;
  return style.preset ? (VISUAL_CARD_THEMES.find((theme) => theme.id === style.preset)?.label ?? null) : 'Personalizado';
}

/** Forma SVG de cada patrón en una celda de `size` px (trazo o relleno de `ink`). */
function patternCell(pattern: VisualCardPattern, ink: string): { size: number; svg: string } | null {
  const c = encodeURIComponent(ink);
  switch (pattern) {
    case 'dots':
      return { size: 36, svg: `<circle cx='9' cy='9' r='2.6' fill='${c}'/><circle cx='27' cy='27' r='2.6' fill='${c}'/>` };
    case 'waves':
      return {
        size: 60,
        svg: `<path d='M0 15 Q15 5 30 15 T60 15 M0 45 Q15 35 30 45 T60 45' fill='none' stroke='${c}' stroke-width='2'/>`,
      };
    case 'grid':
      return { size: 40, svg: `<path d='M40 0V40M0 40H40' fill='none' stroke='${c}' stroke-width='1.4'/>` };
    case 'lines':
      return { size: 24, svg: `<path d='M-6 30L30 -6M-6 6L6 -6M18 30L30 18' stroke='${c}' stroke-width='2'/>` };
    case 'hearts':
      return {
        size: 56,
        svg: `<path d='M14 22c-6-4-8-7-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-2 6-8 10z' fill='${c}'/><path d='M42 50c-6-4-8-7-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-2 6-8 10z' fill='${c}'/>`,
      };
    case 'sparkles':
      return {
        size: 56,
        svg: `<path d='M14 6Q14 14 22 14Q14 14 14 22Q14 14 6 14Q14 14 14 6z' fill='${c}'/><path d='M42 34Q42 42 50 42Q42 42 42 50Q42 42 34 42Q42 42 42 34z' fill='${c}'/>`,
      };
    default:
      return null;
  }
}

/** Imagen CSS (`url(data:...)`) del patrón, suave y en el color del texto. */
export function patternImage(pattern: VisualCardPattern, ink: string): string | undefined {
  const cell = patternCell(pattern, ink);
  if (!cell) return undefined;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${cell.size}' height='${cell.size}' opacity='0.13'>${cell.svg}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}")`;
}
