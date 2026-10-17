import { API_URL } from './api';
import { authFetch } from './auth';

export type TreePathKey = 'SELF_KNOWLEDGE' | 'CARE_EXPRESSION' | 'ACCOMPANIMENT';

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

export interface TreeView {
  totalDrops: number;
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

function parseTree(value: unknown): TreeView | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  const stage = (record.stage ?? {}) as Record<string, unknown>;
  const today = (record.today ?? {}) as Record<string, unknown>;
  const parts = (record.parts ?? {}) as Record<string, unknown>;

  return {
    totalDrops: num(record.totalDrops),
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
  };
}

/**
 * El árbol es privado: el endpoint exige sesión y no devuelve datos de otras
 * cuentas. Un fallo de red o un contrato inesperado se reportan como error para
 * que la página no invente un crecimiento que no es real.
 */
export async function getTree(): Promise<TreeView> {
  let response: Response;
  try {
    response = await authFetch(`${API_URL}/tree`, {
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
          : 'No se pudo cargar tu árbol.',
    );
  }

  const parsed = parseTree(await response.json().catch(() => null));
  if (!parsed) {
    throw new Error('La respuesta de tu árbol no es válida.');
  }
  return parsed;
}
