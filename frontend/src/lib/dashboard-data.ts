/**
 * Contenido de ejemplo del feed.
 *
 * El backend todavía no expone un módulo de historias (solo auth, characters y
 * users), así que estos datos son de relleno. Cuando exista el endpoint del feed
 * basta con sustituir este archivo por el `fetch` correspondiente: los tipos ya
 * reflejan lo que la interfaz necesita.
 */

export interface StoryReaction {
  emoji: string;
  label: string;
  count: number;
  tone: 'primary' | 'secondary' | 'tertiary';
}

export interface Story {
  id: string;
  character: string;
  handle: string;
  mood: string;
  moodTone: 'secondary' | 'tertiary';
  timeAgo: string;
  paragraphs: string[];
  tags: { label: string; tone: 'primary' | 'secondary' | 'tertiary' | 'neutral' }[];
  reactions: StoryReaction[];
  replies: number;
  repliesLabel: string;
}

export interface SuggestedCharacter {
  id: string;
  name: string;
  handle: string;
  bio: string;
  bioTone: 'primary' | 'secondary' | 'tertiary';
  avatarTone: 'primary-fixed' | 'secondary-fixed' | 'tertiary-fixed';
  following: boolean;
}

export const FEED_STORIES: Story[] = [
  {
    id: 'luna-sin-nombre',
    character: 'LunaSinNombre',
    handle: '@luna_sin_nombre',
    mood: 'Buscando calma',
    moodTone: 'secondary',
    timeAgo: 'Hace 2 horas',
    paragraphs: [
      'Hoy finalmente me atreví a poner un límite claro en el trabajo después de meses sintiendo que me apagaba lentamente. No fue un acto ruidoso ni dramático: solo dije que no podía asumir otro proyecto que me obligara a renunciar a mis horas de sueño.',
      'Mis manos temblaban mientras enviaba ese correo, pero al cruzar la puerta de mi casa esta noche sentí un silencio totalmente nuevo, cálido y reparador. Si estás leyendo esto y te cuesta decir basta, date el permiso de descansar. Tu paz no se negocia con nadie.',
    ],
    tags: [
      { label: '#Autocuidado', tone: 'primary' },
      { label: '#LímitesSanos', tone: 'secondary' },
      { label: '#Esperanza', tone: 'tertiary' },
    ],
    reactions: [
      { emoji: '🤍', label: 'Te acompaño', count: 42, tone: 'primary' },
      { emoji: '🫂', label: 'Abrazo suave', count: 28, tone: 'secondary' },
      { emoji: '✨', label: 'Me inspira', count: 19, tone: 'tertiary' },
    ],
    replies: 12,
    repliesLabel: '12 palabras de aliento',
  },
  {
    id: 'brisa-anonima',
    character: 'BrisaAnónima',
    handle: '@brisa_anonima',
    mood: 'Sanando en duelo',
    moodTone: 'tertiary',
    timeAgo: 'Hace 4 horas',
    paragraphs: [
      'Ayer abrí una caja vieja que tenía olvidada en el fondo del ropero. Apareció una carta escrita a mano de hace seis años. Pensé que me rompería a llorar de inmediato, pero en su lugar solo apareció una sonrisa tibia y nostálgica.',
      'Me di cuenta de que el tiempo no borra las ausencias, pero sí pule y suaviza los bordes afilados del dolor. Hoy me siento profundamente agradecida de haber amado con tanta verdad.',
    ],
    tags: [
      { label: '#DueloAmable', tone: 'secondary' },
      { label: '#Gratitud', tone: 'primary' },
      { label: '#Memoria', tone: 'neutral' },
    ],
    reactions: [
      { emoji: '🌿', label: 'Siento tu sentir', count: 35, tone: 'secondary' },
      { emoji: '🕊️', label: 'Paz a tu corazón', count: 21, tone: 'primary' },
      { emoji: '🕯️', label: 'Luz', count: 14, tone: 'tertiary' },
    ],
    replies: 8,
    repliesLabel: '8 reflexiones',
  },
];

export const SUGGESTED_CHARACTERS: SuggestedCharacter[] = [
  {
    id: 'luna-sin-nombre',
    name: 'LunaSinNombre',
    handle: '@luna_sin_nombre',
    bio: 'Escribe sobre límites y descanso',
    bioTone: 'secondary',
    avatarTone: 'secondary-fixed',
    following: true,
  },
  {
    id: 'brisa-anonima',
    name: 'BrisaAnónima',
    handle: '@brisa_anonima',
    bio: 'Poesía de sanación y duelo',
    bioTone: 'tertiary',
    avatarTone: 'tertiary-fixed',
    following: false,
  },
  {
    id: 'nube-violeta',
    name: 'NubeVioleta',
    handle: '@nube_violeta',
    bio: 'Maternidad y desahogo lento',
    bioTone: 'primary',
    avatarTone: 'primary-fixed',
    following: false,
  },
];

export const MOODS = [
  { id: 'paz', emoji: '🌿', label: 'En paz', hover: 'hover:bg-secondary-container/40' },
  { id: 'nostalgia', emoji: '🌧️', label: 'Nostalgia', hover: 'hover:bg-surface-container-high' },
  { id: 'esperanza', emoji: '✨', label: 'Esperanza', hover: 'hover:bg-tertiary-fixed/60' },
  { id: 'fragilidad', emoji: '🍂', label: 'Fragilidad', hover: 'hover:bg-error-container/50' },
  {
    id: 'gratitud',
    emoji: '🤍',
    label: 'Gratitud',
    hover: 'hover:bg-secondary-fixed/50',
    wide: true,
  },
] as const;

export const NAV_MAIN = [
  { label: 'Inicio (Feed)', icon: 'home', active: true },
  { label: 'Siguiendo', icon: 'diversity_1' },
  { label: 'Guardados con cariño', icon: 'bookmark_heart' },
  { label: 'Mi Mapa Emocional', icon: 'insights', locked: true },
  { label: 'Círculos de Apoyo', icon: 'groups_2' },
  { label: 'Estudio Creativo', icon: 'auto_awesome' },
] as const;

export const EMOTIONAL_TONES = [
  { label: 'Gratitud', dot: 'bg-secondary' },
  { label: 'Desahogo', dot: 'bg-primary' },
  { label: 'Esperanza', dot: 'bg-tertiary' },
  { label: 'Duelo & Nostalgia', dot: 'bg-outline' },
] as const;

export const FEED_FILTERS = ['Para ti', 'Destacadas', 'Recientes', 'Mundo'] as const;

export const ONLINE_COUNT = 84;
export const QUESTION_RESPONSES = 87;
