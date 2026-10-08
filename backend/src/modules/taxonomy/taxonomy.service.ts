import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeCatalogName } from './dto/taxonomy.dto';

export interface CategoryItem {
  id: string;
  name: string;
}
export interface EmotionItem {
  id: string;
  name: string;
  colorHex: string | null;
}
export interface TagItem {
  id: string;
  name: string;
}

export interface TaxonomyCatalog {
  categories: CategoryItem[];
  emotions: EmotionItem[];
  tags: TagItem[];
}

/**
 * El catálogo es pequeño, cerrado y cambia muy rara vez. Se cachea en memoria
 * unos minutos para que el selector del compositor no consulte la base en cada
 * apertura. Las escrituras de administración invalidan la caché.
 */
const CACHE_TTL_MS = 5 * 60_000;

interface CachedCatalog {
  catalog: TaxonomyCatalog;
  expiresAt: number;
}

@Injectable()
export class TaxonomyService {
  private cache: CachedCatalog | null = null;
  private inFlight: Promise<TaxonomyCatalog> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(): Promise<TaxonomyCatalog> {
    const cached = this.cache;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.catalog;
    }

    // Se comparte la consulta entre llamadas simultáneas: si llegan veinte
    // peticiones con la caché vacía, solo salen tres a la base.
    this.inFlight ??= Promise.all([
      this.prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      this.prisma.emotion.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, colorHex: true },
      }),
      this.prisma.tag.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ])
      .then(([categories, emotions, tags]) => ({ categories, emotions, tags }))
      .finally(() => {
        this.inFlight = null;
      });

    const catalog = await this.inFlight;
    this.cache = { catalog, expiresAt: Date.now() + CACHE_TTL_MS };
    return catalog;
  }

  // --- Categorías -----------------------------------------------------------

  async createCategory(name: string): Promise<CategoryItem> {
    const normalized = normalizeCatalogName(name);
    await this.assertNameFree('category', normalized);

    try {
      return await this.prisma.category.create({
        data: { name: normalized },
        select: { id: true, name: true },
      });
    } catch (error) {
      this.rethrowDuplicated(error);
    } finally {
      this.invalidate();
    }
  }

  async renameCategory(id: string, name: string): Promise<CategoryItem> {
    const normalized = normalizeCatalogName(name);
    await this.assertCategoryExists(id);
    await this.assertNameFree('category', normalized, id);

    try {
      return await this.prisma.category.update({
        where: { id },
        data: { name: normalized },
        select: { id: true, name: true },
      });
    } catch (error) {
      this.rethrowDuplicated(error);
    } finally {
      this.invalidate();
    }
  }

  async deleteCategory(id: string): Promise<{ id: string }> {
    await this.assertCategoryExists(id);
    // La baja elimina en cascada las asociaciones con relatos (la categoría deja
    // de estar disponible, no se reasigna). Es una acción de administración.
    await this.prisma.category.delete({ where: { id } });
    this.invalidate();
    return { id };
  }

  // --- Emociones ------------------------------------------------------------

  async createEmotion(name: string, colorHex?: string): Promise<EmotionItem> {
    const normalized = normalizeCatalogName(name);
    await this.assertNameFree('emotion', normalized);

    try {
      return await this.prisma.emotion.create({
        data: { name: normalized, colorHex: colorHex ?? null },
        select: { id: true, name: true, colorHex: true },
      });
    } catch (error) {
      this.rethrowDuplicated(error);
    } finally {
      this.invalidate();
    }
  }

  async updateEmotion(
    id: string,
    data: { name?: string; colorHex?: string },
  ): Promise<EmotionItem> {
    await this.assertEmotionExists(id);

    if (data.name !== undefined) {
      const normalized = normalizeCatalogName(data.name);
      await this.assertNameFree('emotion', normalized, id);
      data = { ...data, name: normalized };
    }

    try {
      return await this.prisma.emotion.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.colorHex !== undefined ? { colorHex: data.colorHex } : {}),
        },
        select: { id: true, name: true, colorHex: true },
      });
    } catch (error) {
      this.rethrowDuplicated(error);
    } finally {
      this.invalidate();
    }
  }

  async deleteEmotion(id: string): Promise<{ id: string }> {
    await this.assertEmotionExists(id);
    await this.prisma.emotion.delete({ where: { id } });
    this.invalidate();
    return { id };
  }

  // --- Etiquetas ------------------------------------------------------------

  async createTag(name: string): Promise<TagItem> {
    const normalized = normalizeCatalogName(name);
    await this.assertNameFree('tag', normalized);

    try {
      return await this.prisma.tag.create({
        data: { name: normalized },
        select: { id: true, name: true },
      });
    } catch (error) {
      this.rethrowDuplicated(error);
    } finally {
      this.invalidate();
    }
  }

  async renameTag(id: string, name: string): Promise<TagItem> {
    const normalized = normalizeCatalogName(name);
    await this.assertTagExists(id);
    await this.assertNameFree('tag', normalized, id);

    try {
      return await this.prisma.tag.update({
        where: { id },
        data: { name: normalized },
        select: { id: true, name: true },
      });
    } catch (error) {
      this.rethrowDuplicated(error);
    } finally {
      this.invalidate();
    }
  }

  async deleteTag(id: string): Promise<{ id: string }> {
    await this.assertTagExists(id);
    await this.prisma.tag.delete({ where: { id } });
    this.invalidate();
    return { id };
  }

  // --- Apoyo ----------------------------------------------------------------

  /**
   * Comprueba la unicidad sin distinguir mayúsculas. La base solo garantiza la
   * unicidad exacta, así que sin esta comprobación "Ansiedad" y "ansiedad"
   * podrían coexistir y el filtro del compositor mostraría dos entradas iguales.
   */
  private async assertNameFree(
    model: 'category' | 'emotion' | 'tag',
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await (
      this.prisma[model] as unknown as {
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
      }
    ).findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Ya existe una entrada con ese nombre.');
    }
  }

  private async assertCategoryExists(id: string): Promise<void> {
    const exists = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('La categoría no existe.');
    }
  }

  private async assertEmotionExists(id: string): Promise<void> {
    const exists = await this.prisma.emotion.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('La emoción no existe.');
    }
  }

  private async assertTagExists(id: string): Promise<void> {
    const exists = await this.prisma.tag.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('La etiqueta no existe.');
    }
  }

  private rethrowDuplicated(error: unknown): never {
    // P2002 = violación de unicidad. Cubre la carrera entre la comprobación y
    // el `create`/`update`.
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictException('Ya existe una entrada con ese nombre.');
    }
    throw error;
  }

  private invalidate(): void {
    this.cache = null;
  }
}
