import type { IconName } from '@/components/wy/icons';

/**
 * Temas y emociones públicos de la entrega v58 (TOPICS y PUBLIC_EMOTIONS de
 * v38.js). Las categorías existen en el catálogo del backend (prisma/seed.js);
 * las categorías antiguas se conservan para los relatos que ya las usan.
 */
export const V58_TOPICS: { name: string; description: string; icon: IconName }[] = [
  { name: 'Mi día a día', description: 'Momentos, pensamientos y experiencias cotidianas', icon: 'sparkle' },
  { name: 'Pareja', description: 'Amor, convivencia, rupturas y reconciliaciones', icon: 'heart' },
  { name: 'Familia', description: 'Vínculos familiares, crianza y convivencia', icon: 'home' },
  { name: 'Amistad', description: 'Compañía, distanciamientos y reencuentros', icon: 'users' },
  { name: 'Trabajo y estudios', description: 'Experiencias, dificultades y logros', icon: 'book' },
  { name: 'Relación conmigo', description: 'Autoestima, identidad, límites y crecimiento', icon: 'user' },
  { name: 'Pérdidas y cambios', description: 'Despedidas, duelos y nuevas etapas', icon: 'sparkle' },
];

export const V58_TOPIC_NAMES = V58_TOPICS.map((topic) => topic.name);

export const V58_EMOTIONS = [
  'Alegría',
  'Tristeza',
  'Ansiedad',
  'Enojo',
  'Soledad',
  'Calma',
  'Esperanza',
  'Gratitud',
] as const;
