import { TreePath } from '@prisma/client';

/** Etapas del árbol, de semilla a fruto. Cada etapa exige un total de gotas. */
export const TREE_STAGES = [
  { key: 'seed', label: 'Semilla', drops: 1 },
  { key: 'sprout', label: 'Brote', drops: 5 },
  { key: 'stem', label: 'Tallo', drops: 15 },
  { key: 'trunk', label: 'Tronco', drops: 35 },
  { key: 'branches', label: 'Ramas', drops: 70 },
  { key: 'leaves', label: 'Hojas', drops: 120 },
  { key: 'flowers', label: 'Flores', drops: 200 },
  { key: 'fruits', label: 'Frutos', drops: 300 },
] as const;

export type TreeStageKey = (typeof TREE_STAGES)[number]['key'];

/** Los tres caminos para conseguir una gota al día (una por camino como máximo). */
export const TREE_PATHS: {
  key: TreePath;
  label: string;
  hint: string;
}[] = [
  { key: TreePath.SELF_KNOWLEDGE, label: 'Autoconocimiento', hint: 'Registrar cómo te sientes' },
  { key: TreePath.CARE_EXPRESSION, label: 'Cuidado o expresión', hint: 'Dinámica, diario, relato o cápsula' },
  { key: TreePath.ACCOMPANIMENT, label: 'Acompañamiento', hint: 'Una interacción respetuosa' },
];

export const TREE_MAX_DROPS_PER_DAY = TREE_PATHS.length;

/** Días de actividad que se devuelven como historial reciente. */
export const TREE_HISTORY_DAYS = 14;

/** Cada ciclo completo suma un arbol al jardin. */
export const TREE_CYCLE_SIZE = 300;

export const TREE_SPECIES = ['bonsai', 'jacaranda', 'olive', 'cherry'] as const;
export type TreeSpecies = (typeof TREE_SPECIES)[number];

export const TREE_POTS = ['violet', 'terracotta', 'ivory'] as const;
export type TreePot = (typeof TREE_POTS)[number];

export const TREE_DECORATIONS = ['none', 'flower', 'stones', 'butterfly'] as const;
export type TreeDecoration = (typeof TREE_DECORATIONS)[number];

export const TREE_SPECIES_LABELS: Record<TreeSpecies, string> = {
  bonsai: 'Bonsái',
  jacaranda: 'Jacaranda',
  olive: 'Olivo',
  cherry: 'Cerezo',
};

export const TREE_POT_LABELS: Record<TreePot, string> = {
  violet: 'Morada',
  terracotta: 'Terracota',
  ivory: 'Marfil',
};

export const TREE_DECORATION_LABELS: Record<TreeDecoration, string> = {
  none: 'Sin adorno',
  flower: 'Flores',
  stones: 'Piedras de río',
  butterfly: 'Mariposas',
};