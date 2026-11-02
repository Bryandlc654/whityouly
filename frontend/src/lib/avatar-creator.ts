export const AVATAR_SKIN_TONES = [
  { id: 'porcelain', label: 'Porcelana', color: '#F8DCC8', shade: '#E8BFA5' },
  { id: 'warm', label: 'Cálido', color: '#F1C9A8', shade: '#DCA982' },
  { id: 'honey', label: 'Miel', color: '#E3AE82', shade: '#C98D62' },
  { id: 'caramel', label: 'Caramelo', color: '#C98A5E', shade: '#A96C43' },
  { id: 'chestnut', label: 'Castaño', color: '#A66A45', shade: '#854E2F' },
  { id: 'deep', label: 'Profundo', color: '#71452F', shade: '#55301F' },
] as const;

export const AVATAR_HAIR_STYLES = [
  { id: 'short', label: 'Corto' },
  { id: 'wavy', label: 'Ondulado' },
  { id: 'bun', label: 'Recogido' },
  { id: 'long', label: 'Largo' },
  { id: 'curly', label: 'Rizado' },
  { id: 'buzz', label: 'Rapado' },
] as const;

export const AVATAR_HAIR_COLORS = [
  { id: 'black', label: 'Negro', color: '#211D1B', shade: '#100E0D' },
  { id: 'brown', label: 'Castaño', color: '#5B3929', shade: '#3E2418' },
  { id: 'chestnut', label: 'Cobrizo', color: '#8B4B2C', shade: '#66331D' },
  { id: 'blonde', label: 'Rubio', color: '#D7AA61', shade: '#B8873F' },
  { id: 'auburn', label: 'Caoba', color: '#A63F32', shade: '#7E2A21' },
  { id: 'silver', label: 'Plateado', color: '#AEB7C4', shade: '#8993A3' },
] as const;

export const AVATAR_OUTFIT_STYLES = [
  { id: 'tee', label: 'Camiseta' },
  { id: 'hoodie', label: 'Sudadera' },
  { id: 'blouse', label: 'Blusa' },
  { id: 'sweater', label: 'Jersey' },
  { id: 'shirt', label: 'Camisa' },
] as const;

export const AVATAR_OUTFIT_COLORS = [
  { id: 'violet', label: 'Violeta', color: '#6C4DF6', shade: '#5034CE' },
  { id: 'teal', label: 'Turquesa', color: '#118A82', shade: '#0A6A64' },
  { id: 'rose', label: 'Rosa', color: '#D94F7C', shade: '#B53460' },
  { id: 'amber', label: 'Ámbar', color: '#C47A16', shade: '#9E5D0A' },
  { id: 'blue', label: 'Azul', color: '#2E6FD8', shade: '#1E55AE' },
  { id: 'graphite', label: 'Grafito', color: '#465268', shade: '#303B4E' },
] as const;

export const AVATAR_BACKGROUNDS = [
  { id: 'lavender', label: 'Lavanda', from: '#D9D0FF', to: '#9D8CFF', accent: '#FFFFFF' },
  { id: 'peach', label: 'Melocotón', from: '#FFE0CD', to: '#F2A98D', accent: '#FFFFFF' },
  { id: 'mint', label: 'Menta', from: '#D3F5E5', to: '#7ED7B3', accent: '#FFFFFF' },
  { id: 'sky', label: 'Cielo', from: '#D7ECFF', to: '#82BDF4', accent: '#FFFFFF' },
  { id: 'rose', label: 'Rosa', from: '#FFDDE8', to: '#F49AB8', accent: '#FFFFFF' },
  { id: 'sand', label: 'Arena', from: '#F6E9CF', to: '#DCC18E', accent: '#FFFFFF' },
] as const;

export const AVATAR_ACCESSORIES = [
  { id: 'none', label: 'Sin accesorio' },
  { id: 'glasses', label: 'Gafas' },
  { id: 'earrings', label: 'Pendientes' },
] as const;

export type AvatarSkinToneId = (typeof AVATAR_SKIN_TONES)[number]['id'];
export type AvatarHairStyleId = (typeof AVATAR_HAIR_STYLES)[number]['id'];
export type AvatarHairColorId = (typeof AVATAR_HAIR_COLORS)[number]['id'];
export type AvatarOutfitStyleId = (typeof AVATAR_OUTFIT_STYLES)[number]['id'];
export type AvatarOutfitColorId = (typeof AVATAR_OUTFIT_COLORS)[number]['id'];
export type AvatarBackgroundId = (typeof AVATAR_BACKGROUNDS)[number]['id'];
export type AvatarAccessoryId = (typeof AVATAR_ACCESSORIES)[number]['id'];

export interface AvatarConfig {
  skin: AvatarSkinToneId;
  hair: AvatarHairStyleId;
  hairColor: AvatarHairColorId;
  outfit: AvatarOutfitStyleId;
  outfitColor: AvatarOutfitColorId;
  background: AvatarBackgroundId;
  accessory: AvatarAccessoryId;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skin: 'warm',
  hair: 'short',
  hairColor: 'brown',
  outfit: 'tee',
  outfitColor: 'violet',
  background: 'lavender',
  accessory: 'none',
};

const CONFIG_KEYS = [
  'skin',
  'hair',
  'hairColor',
  'outfit',
  'outfitColor',
  'background',
  'accessory',
] as const;

function pickOption<T extends readonly { id: string }[]>(
  options: T,
  value: unknown,
  fallback: T[number]['id'],
): T[number]['id'] {
  return options.some((option) => option.id === value)
    ? (value as T[number]['id'])
    : fallback;
}

export function normalizeAvatarConfig(value: unknown): AvatarConfig | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    skin: pickOption(AVATAR_SKIN_TONES, record.skin, DEFAULT_AVATAR_CONFIG.skin),
    hair: pickOption(AVATAR_HAIR_STYLES, record.hair, DEFAULT_AVATAR_CONFIG.hair),
    hairColor: pickOption(
      AVATAR_HAIR_COLORS,
      record.hairColor,
      DEFAULT_AVATAR_CONFIG.hairColor,
    ),
    outfit: pickOption(AVATAR_OUTFIT_STYLES, record.outfit, DEFAULT_AVATAR_CONFIG.outfit),
    outfitColor: pickOption(
      AVATAR_OUTFIT_COLORS,
      record.outfitColor,
      DEFAULT_AVATAR_CONFIG.outfitColor,
    ),
    background: pickOption(
      AVATAR_BACKGROUNDS,
      record.background,
      DEFAULT_AVATAR_CONFIG.background,
    ),
    accessory: pickOption(
      AVATAR_ACCESSORIES,
      record.accessory,
      DEFAULT_AVATAR_CONFIG.accessory,
    ),
  };
}

export function avatarConfigToUrl(config: AvatarConfig): string {
  const params = new URLSearchParams({
    skin: config.skin,
    hair: config.hair,
    hairColor: config.hairColor,
    outfit: config.outfit,
    outfitColor: config.outfitColor,
    background: config.background,
    accessory: config.accessory,
  });

  return `/avatars/custom?${params.toString()}`;
}

export function parseAvatarConfigFromUrl(value: unknown): AvatarConfig | null {
  if (typeof value !== 'string' || !value.startsWith('/avatars/custom?')) {
    return null;
  }

  try {
    const url = new URL(value, 'https://whityouly.local');
    if (url.pathname !== '/avatars/custom' || url.hash !== '') {
      return null;
    }

    const entries = Array.from(url.searchParams.entries());
    if (entries.length !== CONFIG_KEYS.length) {
      return null;
    }

    const config = normalizeAvatarConfig(Object.fromEntries(entries));
    return config && avatarConfigToUrl(config) === value ? config : null;
  } catch {
    return null;
  }
}

export function isAvatarCustomUrl(value: unknown): value is string {
  return parseAvatarConfigFromUrl(value) !== null;
}

export function randomAvatarConfig(): AvatarConfig {
  const pick = <T extends readonly unknown[]>(items: T): T[number] =>
    items[Math.floor(Math.random() * items.length)];

  return {
    skin: pick(AVATAR_SKIN_TONES).id,
    hair: pick(AVATAR_HAIR_STYLES).id,
    hairColor: pick(AVATAR_HAIR_COLORS).id,
    outfit: pick(AVATAR_OUTFIT_STYLES).id,
    outfitColor: pick(AVATAR_OUTFIT_COLORS).id,
    background: pick(AVATAR_BACKGROUNDS).id,
    accessory: pick(AVATAR_ACCESSORIES).id,
  };
}

export function optionById<T extends readonly { id: string }[]>(
  options: T,
  id: string,
): T[number] {
  return options.find((option) => option.id === id) ?? options[0];
}

function hairBack(style: AvatarHairStyleId, color: string, shade: string) {
  switch (style) {
    case 'wavy':
      return `<path d="M25 47c-4-20 8-30 23-30s27 10 23 30c-1 8 4 15 1 23-6-3-9-10-10-19-2 9-7 15-14 15s-12-6-14-15c-1 9-4 16-10 19-3-8 2-15 1-23z" fill="${shade}"/><path d="M28 45c-2-17 8-25 20-25s22 8 20 25c-3-10-10-15-20-15s-17 5-20 15z" fill="${color}"/>`;
    case 'bun':
      return `<circle cx="48" cy="18" r="9" fill="${shade}"/><circle cx="48" cy="17" r="7.5" fill="${color}"/><path d="M26 47c-2-18 9-28 22-28s24 10 22 28c-3-12-10-18-22-18s-19 6-22 18z" fill="${color}"/>`;
    case 'long':
      return `<path d="M23 45c-1-18 10-28 25-28s26 10 25 28l3 41c-8 5-17 7-28 7s-20-2-28-7z" fill="${shade}"/><path d="M28 44c0-16 8-24 20-24s20 8 20 24v38c-5 3-12 5-20 5s-15-2-20-5z" fill="${color}"/>`;
    case 'curly': {
      const curls = [
        [30, 26, 9],
        [42, 20, 10],
        [56, 20, 10],
        [67, 28, 9],
        [24, 39, 8],
        [72, 39, 8],
        [23, 51, 7],
        [73, 51, 7],
      ]
        .map(
          ([cx, cy, r]) =>
            `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade}"/>`,
        )
        .join('');

      return `${curls}<path d="M28 45c-1-16 8-24 20-24s21 8 20 24c-3-9-10-14-20-14s-17 5-20 14z" fill="${color}"/>`;
    }
    case 'buzz':
      return `<path d="M28 44c0-15 8-23 20-23s20 8 20 23c-4-8-10-12-20-12s-16 4-20 12z" fill="${shade}"/>`;
    case 'short':
    default:
      return `<path d="M26 46c-2-17 8-27 22-27s24 10 22 27c-3-11-10-17-22-17s-19 6-22 17z" fill="${shade}"/>`;
  }
}

function hairFront(style: AvatarHairStyleId, color: string) {
  switch (style) {
    case 'wavy':
      return `<path d="M27 42c1-14 9-21 21-21 9 0 16 3 20 10-5-2-10-3-15-1-5 3-8 8-9 14-4-4-10-5-17-2z" fill="${color}"/>`;
    case 'bun':
      return `<path d="M28 41c1-13 9-20 20-20 10 0 17 6 19 16-7-6-15-8-24-6-6 1-11 4-15 10z" fill="${color}"/>`;
    case 'long':
      return `<path d="M27 43c1-14 9-21 21-21 10 0 17 6 19 17-5-6-11-9-19-9-8 0-15 4-21 13z" fill="${color}"/><path d="M29 42c4-8 10-12 19-12 4 0 8 1 11 3-5 1-9 4-12 8-5-2-11-2-18 1z" fill="${color}"/>`;
    case 'curly':
      return `<path d="M29 40c-1-11 7-18 19-18 8 0 14 3 18 9-6-1-11 0-15 3-4 3-6 6-7 11-4-3-9-5-15-5z" fill="${color}"/>`;
    case 'buzz':
      return `<path d="M30 38c2-9 8-14 18-14s16 5 18 14c-5-4-11-6-18-6s-13 2-18 6z" fill="${color}"/>`;
    case 'short':
    default:
      return `<path d="M28 41c1-13 9-20 20-20s18 7 19 19c-5-7-11-10-19-10s-15 3-20 11z" fill="${color}"/>`;
  }
}

function outfitDetail(style: AvatarOutfitStyleId, color: string, shade: string) {
  switch (style) {
    case 'hoodie':
      return `<path d="M31 72c5 4 10 6 17 6s12-2 17-6l6 8c-6 5-14 8-23 8s-17-3-23-8z" fill="${shade}"/><path d="M42 73l-3 14M54 73l3 14" stroke="#F8F7FF" stroke-width="1.6" stroke-linecap="round" opacity=".8"/><circle cx="39" cy="88" r="1.4" fill="#F8F7FF" opacity=".8"/><circle cx="57" cy="88" r="1.4" fill="#F8F7FF" opacity=".8"/>`;
    case 'blouse':
      return `<path d="M38 72l10 9 10-9 3 4-13 11-13-11z" fill="#FFFFFF" opacity=".72"/><circle cx="48" cy="87" r="1.3" fill="${shade}" opacity=".65"/>`;
    case 'sweater':
      return `<path d="M36 72c4 5 8 7 12 7s8-2 12-7l3 5c-4 4-9 6-15 6s-11-2-15-6z" fill="${shade}"/><path d="M22 84h52M22 90h52" stroke="#FFFFFF" stroke-width="1.4" opacity=".16"/>`;
    case 'shirt':
      return `<path d="M39 71l9 7 9-7 4 4-13 10-13-10z" fill="#FFFFFF" opacity=".8"/><path d="M48 78v15" stroke="${shade}" stroke-width="1.4" opacity=".45"/><circle cx="48" cy="84" r="1.2" fill="#FFFFFF"/><circle cx="48" cy="89" r="1.2" fill="#FFFFFF"/>`;
    case 'tee':
    default:
      return `<path d="M38 71c3 4 6 6 10 6s7-2 10-6l4 4c-4 4-8 6-14 6s-10-2-14-6z" fill="${shade}" opacity=".62"/>`;
  }
}

function accessory(accessoryId: AvatarAccessoryId) {
  if (accessoryId === 'glasses') {
    return `<g fill="none" stroke="#26313D" stroke-width="2" stroke-linecap="round"><rect x="34" y="42.5" width="12" height="9" rx="4"/><rect x="50" y="42.5" width="12" height="9" rx="4"/><path d="M46 46h4M34 46h-5M62 46h5"/></g><path d="M35 43.5h3M51 43.5h3" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`;
  }

  if (accessoryId === 'earrings') {
    return `<circle cx="27" cy="55" r="2.5" fill="#F5C451"/><circle cx="69" cy="55" r="2.5" fill="#F5C451"/><circle cx="26.2" cy="54.2" r=".8" fill="#FFF2BD"/>`;
  }

  return '';
}

export function renderAvatarSvg(input: unknown): string {
  const config = normalizeAvatarConfig(input) ?? DEFAULT_AVATAR_CONFIG;
  const skin = optionById(AVATAR_SKIN_TONES, config.skin);
  const hairColor = optionById(AVATAR_HAIR_COLORS, config.hairColor);
  const outfitColor = optionById(AVATAR_OUTFIT_COLORS, config.outfitColor);
  const background = optionById(AVATAR_BACKGROUNDS, config.background);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Avatar creado">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse"><stop stop-color="${background.from}"/><stop offset="1" stop-color="${background.to}"/></linearGradient>
<linearGradient id="shirt" x1="20" y1="70" x2="76" y2="96" gradientUnits="userSpaceOnUse"><stop stop-color="${outfitColor.color}"/><stop offset="1" stop-color="${outfitColor.shade}"/></linearGradient>
</defs>
<rect width="96" height="96" rx="48" fill="url(#bg)"/>
<circle cx="20" cy="22" r="13" fill="${background.accent}" opacity=".18"/>
<circle cx="78" cy="72" r="19" fill="${background.accent}" opacity=".12"/>
<path d="M12 96c2-18 14-27 36-27s34 9 36 27z" fill="url(#shirt)"/>
${hairBack(config.hair, hairColor.color, hairColor.shade)}
<rect x="42" y="58" width="12" height="14" rx="5" fill="${skin.shade}"/>
<ellipse cx="28" cy="48" rx="4.5" ry="6" fill="${skin.color}"/>
<ellipse cx="68" cy="48" rx="4.5" ry="6" fill="${skin.color}"/>
<ellipse cx="48" cy="45" rx="19" ry="22" fill="${skin.color}"/>
<circle cx="40" cy="46" r="3.2" fill="#FFFFFF"/>
<circle cx="56" cy="46" r="3.2" fill="#FFFFFF"/>
<circle cx="40.6" cy="46.3" r="1.6" fill="#2B2523"/>
<circle cx="55.4" cy="46.3" r="1.6" fill="#2B2523"/>
<circle cx="41.1" cy="45.7" r=".55" fill="#FFFFFF"/>
<circle cx="54.9" cy="45.7" r=".55" fill="#FFFFFF"/>
<path d="M36 40.5c2-1.5 5-1.4 7 0M53 40.5c2-1.5 5-1.4 7 0" stroke="${hairColor.shade}" stroke-width="1.6" stroke-linecap="round" fill="none"/>
<path d="M48 47.5v5" stroke="${skin.shade}" stroke-width="1.3" stroke-linecap="round"/>
<path d="M43.5 56c2.7 2.6 6.3 2.6 9 0" stroke="#8E4B4B" stroke-width="1.8" stroke-linecap="round" fill="none"/>
<ellipse cx="34" cy="52" rx="3.2" ry="1.8" fill="#E98B8B" opacity=".28"/>
<ellipse cx="62" cy="52" rx="3.2" ry="1.8" fill="#E98B8B" opacity=".28"/>
${outfitDetail(config.outfit, outfitColor.color, outfitColor.shade)}
${hairFront(config.hair, hairColor.color)}
${accessory(config.accessory)}
</svg>`;
}
