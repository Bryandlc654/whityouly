import { API_URL } from './api';
import { authFetch } from './auth';

export type TreePathKey = 'SELF_KNOWLEDGE' | 'CARE_EXPRESSION' | 'ACCOMPANIMENT';
export type TreeSpecies = 'bonsai' | 'jacaranda' | 'olive' | 'cherry';
export type TreePot = 'violet' | 'terracotta' | 'ivory';
export type TreeDecoration = 'none' | 'flower' | 'stones' | 'butterfly';

export interface TreePathStatus {
  key: TreePathKey;
  label: string;
  hint: string;
  earned: boolean;
}

export interface TreeStageView {
  key: string;
  label: string;
  drops: number;
  reached: boolean;
}

export interface TreeCycleView {
  completed: number;
  drops: number;
  number: number;
  goal: number;
}

export interface GardenTreeView {
  index: number;
  species: TreeSpecies;
  pot: TreePot;
  label: string;
}

export interface TreeGardenView {
  decoration: TreeDecoration;
  trees: GardenTreeView[];
  pages: number;
  spaceNumber: number;
  spaceFilled: number;
  spaceSize: number;
}

export interface TreeAchievementView {
  id: string;
  title: string;
  detail: string;
  value: number;
  goal: number;
  unit: string;
  unlocked: boolean;
}

export interface TreeUnlocksView {
  pots: TreePot[];
  species: TreeSpecies[];
  decorations: TreeDecoration[];
}

export interface TreeCustomizationView {
  species: TreeSpecies;
  pot: TreePot;
  decoration: TreeDecoration;
}

export interface TreeView {
  totalDrops: number;
  cycle: TreeCycleView;
  stage: {
    key: string;
    label: string;
    index: number;
    reached: boolean;
    nextLabel: string | null;
    nextDrops: number | null;
    progress: number;
  };
  today: {
    day: string;
    earned: number;
    max: number;
    complete: boolean;
    paths: TreePathStatus[];
  };
  parts: {
    roots: number;
    rings: number;
    branches: number;
    leaves: number;
    flowers: number;
    fruits: number;
  };
  history: { day: string; paths: TreePathKey[]; complete: boolean }[];
  stages: TreeStageView[];
  garden: TreeGardenView;
  achievements: TreeAchievementView[];
  unlocks: TreeUnlocksView;
  customization: TreeCustomizationView;
}

export interface TreeCustomizationInput {
  species?: TreeSpecies;
  pot?: TreePot;
  decoration?: TreeDecoration;
}

const REQUEST_TIMEOUT_MS = 15_000;

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parsePaths(value: unknown): TreePathKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is TreePathKey =>
      item === 'SELF_KNOWLEDGE' || item === 'CARE_EXPRESSION' || item === 'ACCOMPANIMENT',
  );
}

function asSpecies(value: unknown): TreeSpecies | null {
  return value === 'bonsai' || value === 'jacaranda' || value === 'olive' || value === 'cherry'
    ? value
    : null;
}

function asPot(value: unknown): TreePot | null {
  return value === 'violet' || value === 'terracotta' || value === 'ivory' ? value : null;
}

function asDecoration(value: unknown): TreeDecoration | null {
  return value === 'none' || value === 'flower' || value === 'stones' || value === 'butterfly'
    ? value
    : null;
}

function parseTree(value: unknown): TreeView | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  const stage = (record.stage ?? {}) as Record<string, unknown>;
  const today = (record.today ?? {}) as Record<string, unknown>;
  const parts = (record.parts ?? {}) as Record<string, unknown>;
  const cycle = (record.cycle ?? {}) as Record<string, unknown>;
  const garden = (record.garden ?? {}) as Record<string, unknown>;
  const customization = (record.customization ?? {}) as Record<string, unknown>;
  const unlocks = (record.unlocks ?? {}) as Record<string, unknown>;

  return {
    totalDrops: num(record.totalDrops),
    cycle: {
      completed: num(cycle.completed),
      drops: num(cycle.drops),
      number: num(cycle.number, 1),
      goal: num(cycle.goal, 300),
    },
    stage: {
      key: str(stage.key, 'seed'),
      label: str(stage.label, 'Semilla'),
      index: num(stage.index, 0),
      reached: stage.reached === true,
      nextLabel: typeof stage.nextLabel === 'string' ? stage.nextLabel : null,
      nextDrops: typeof stage.nextDrops === 'number' ? stage.nextDrops : null,
      progress: Math.min(1, Math.max(0, num(stage.progress))),
    },
    today: {
      day: str(today.day),
      earned: num(today.earned),
      max: num(today.max, 3),
      complete: today.complete === true,
      paths: Array.isArray(today.paths)
        ? today.paths.flatMap((item) => {
            const p = (item ?? {}) as Record<string, unknown>;
            const key = p.key;
            if (key !== 'SELF_KNOWLEDGE' && key !== 'CARE_EXPRESSION' && key !== 'ACCOMPANIMENT') {
              return [];
            }
            return [{ key, label: str(p.label), hint: str(p.hint), earned: p.earned === true }];
          })
        : [],
    },
    parts: {
      roots: num(parts.roots),
      rings: num(parts.rings),
      branches: num(parts.branches),
      leaves: num(parts.leaves),
      flowers: num(parts.flowers),
      fruits: num(parts.fruits),
    },
    history: Array.isArray(record.history)
      ? record.history.flatMap((item) => {
          const h = (item ?? {}) as Record<string, unknown>;
          if (typeof h.day !== 'string') return [];
          return [{ day: h.day, paths: parsePaths(h.paths), complete: h.complete === true }];
        })
      : [],
    stages: Array.isArray(record.stages)
      ? record.stages.flatMap((item) => {
          const s = (item ?? {}) as Record<string, unknown>;
          if (typeof s.key !== 'string' || typeof s.label !== 'string') return [];
          return [{ key: s.key, label: s.label, drops: num(s.drops), reached: s.reached === true }];
        })
      : [],
    garden: {
      decoration: asDecoration(garden.decoration) ?? 'none',
      trees: Array.isArray(garden.trees)
        ? garden.trees.flatMap((item) => {
            const tree = (item ?? {}) as Record<string, unknown>;
            const species = asSpecies(tree.species);
            const pot = asPot(tree.pot);
            if (!species || !pot) return [];
            return [
              {
                index: num(tree.index),
                species,
                pot,
                label: str(tree.label, `Árbol ${num(tree.index) + 1}`),
              },
            ];
          })
        : [],
      pages: Math.max(1, num(garden.pages, 1)),
      spaceNumber: Math.max(1, num(garden.spaceNumber, 1)),
      spaceFilled: num(garden.spaceFilled),
      spaceSize: Math.max(1, num(garden.spaceSize, 3)),
    },
    achievements: Array.isArray(record.achievements)
      ? record.achievements.flatMap((item) => {
          const award = (item ?? {}) as Record<string, unknown>;
          const id = str(award.id);
          const title = str(award.title);
          if (!id || !title) return [];
          return [
            {
              id,
              title,
              detail: str(award.detail),
              value: num(award.value),
              goal: Math.max(1, num(award.goal, 1)),
              unit: str(award.unit, 'gotas'),
              unlocked: award.unlocked === true,
            },
          ];
        })
      : [],
    unlocks: {
      pots: Array.isArray(unlocks.pots)
        ? unlocks.pots.flatMap((item) => {
            const pot = asPot(item);
            return pot ? [pot] : [];
          })
        : ['violet'],
      species: Array.isArray(unlocks.species)
        ? unlocks.species.flatMap((item) => {
            const species = asSpecies(item);
            return species ? [species] : [];
          })
        : ['bonsai'],
      decorations: Array.isArray(unlocks.decorations)
        ? unlocks.decorations.flatMap((item) => {
            const decoration = asDecoration(item);
            return decoration ? [decoration] : [];
          })
        : ['none'],
    },
    customization: {
      species: asSpecies(customization.species) ?? 'bonsai',
      pot: asPot(customization.pot) ?? 'violet',
      decoration: asDecoration(customization.decoration) ?? 'none',
    },
  };
}

async function requestTree(path: string, init: RequestInit, fallback: string): Promise<TreeView> {
  let response: Response;
  try {
    response = await authFetch(`${API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error('No se pudo contactar con el servidor.');
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      /* sin cuerpo */
    }
    const message = (body as { message?: unknown } | null)?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(' ')
        : typeof message === 'string' && message.trim()
          ? message
          : fallback,
    );
  }

  const parsed = parseTree(await response.json().catch(() => null));
  if (!parsed) {
    throw new Error('La respuesta de tu árbol no es válida.');
  }
  return parsed;
}

export function getTree(): Promise<TreeView> {
  return requestTree('/tree', { method: 'GET' }, 'No se pudo cargar tu árbol.');
}

export function updateTreeCustomization(input: TreeCustomizationInput): Promise<TreeView> {
  return requestTree(
    '/tree/customization',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo guardar la personalización.',
  );
}
