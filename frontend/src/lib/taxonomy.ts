import { API_URL } from './api';
import type { LoadResult } from './account';

export interface TaxonomyItem {
  id: string;
  name: string;
}

export interface TaxonomyEmotion {
  id: string;
  name: string;
  colorHex: string | null;
}

export interface TaxonomyCatalog {
  categories: TaxonomyItem[];
  emotions: TaxonomyEmotion[];
  tags: TaxonomyItem[];
}

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ITEMS = 200;

function parseItems(value: unknown, withColor = false): TaxonomyEmotion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id : null;
      const name = typeof record.name === 'string' ? record.name : null;
      if (!id || !name) return null;
      const parsed: TaxonomyEmotion = {
        id,
        name,
        colorHex: withColor && typeof record.colorHex === 'string' ? record.colorHex : null,
      };
      return parsed;
    })
    .filter((item): item is TaxonomyEmotion => item !== null)
    .slice(0, MAX_ITEMS);
}

/**
 * El catálogo es público y cambia muy rara vez. Se lee sin autenticación y se
 * valida la forma de la respuesta: un cuerpo inesperado no debe romper el
 * compositor.
 */
export async function fetchTaxonomy(): Promise<LoadResult<TaxonomyCatalog>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/taxonomy`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { status: 'error', message: 'No se pudo contactar con el servidor.' };
  }

  if (!response.ok) {
    return { status: 'error', message: 'No se pudo cargar el catálogo.' };
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  return {
    status: 'ok',
    data: {
      categories: parseItems(body?.categories),
      emotions: parseItems(body?.emotions, true),
      tags: parseItems(body?.tags),
    },
  };
}
