import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Character } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCharacterDto, PrivacySettingsDto, UpdateCharacterDto } from './dto/character.dto';
import { env } from '../../config/env';
import { isOwnMediaUrl } from '../../common/storage/media-keys';

// Vista del propietario: incluye sus ajustes de privacidad pero nunca `userId`.
const OWNER_CHARACTER_SELECT = {
  id: true,
  name: true,
  tagline: true,
  avatarUrl: true,
  bio: true,
  privacySettings: true,
  createdAt: true,
  updatedAt: true,
  interests: { orderBy: { interest: { name: 'asc' } }, select: { interest: { select: { name: true } } } },
} satisfies Prisma.CharacterSelect;

// Nombres reservados (comparados sin separadores ni mayúsculas) para evitar
// suplantación de la plataforma o del personal.
const RESERVED_NAMES = new Set([
  'admin',
  'administrador',
  'moderator',
  'moderador',
  'whityouly',
  'soporte',
  'support',
  'sistema',
  'system',
  'root',
  'oficial',
  'official',
  'staff',
  'equipo',
  'help',
  'ayuda',
]);

export interface ResolvedPrivacy {
  profileVisibility: 'PUBLIC' | 'PRIVATE';
  showAvatar: boolean;
  showBio: boolean;
}

const DEFAULT_PRIVACY: ResolvedPrivacy = {
  profileVisibility: 'PUBLIC',
  showAvatar: true,
  showBio: true,
};

const MAX_BIO_LENGTH = 500;
const MAX_TAGLINE_LENGTH = 120;

/**
 * Un solo criterio de normalización para escribir y para leer. Sin esto, un
 * seudónimo guardado como "Ana " sería irrecuperable: la búsqueda lo recortaría
 * y no encontraría nada.
 */
export function normalizeCharacterName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * Limpia la biografía antes de guardarla:
 * - elimina caracteres de control (salvo el salto de línea) y los invisibles o
 *   de dirección, que permiten ocultar texto, suplantar palabras o evadir
 *   filtros insertando ancho cero dentro de una palabra;
 * - unifica saltos de línea y limita las líneas en blanco consecutivas;
 * - recorta al límite máximo.
 * Nunca se interpreta como HTML: se escapa al renderizar.
 */
export function sanitizeBio(bio: string | null | undefined): string | null {
  if (bio === null || bio === undefined) {
    return null;
  }

  const cleaned = bio
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\p{Cc}\p{Cf}]/gu, (char) => (char === '\n' ? '\n' : ''))
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_BIO_LENGTH)
    .trim();

  return cleaned === '' ? null : cleaned;
}

/**
 * El lema comparte el saneado de la bio (mismos invisibles, mismo recorte), pero
 * se mantiene en una sola línea: se muestra bajo el nombre.
 */
export function sanitizeTagline(tagline: string | null | undefined): string | null {
  if (tagline === null || tagline === undefined) {
    return null;
  }

  const cleaned = tagline
    .normalize('NFKC')
    // Un salto de línea se convierte en espacio (el lema es una sola línea);
    // el resto de invisibles se borran, igual que en la biografía.
    // eslint-disable-next-line no-control-regex
    .replace(/[\p{Cc}\p{Cf}]/gu, (char) => (char === '\n' || char === '\r' ? ' ' : ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAGLINE_LENGTH)
    .trim();

  return cleaned === '' ? null : cleaned;
}

@Injectable()
export class CharactersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: CreateCharacterDto) {
    const name = normalizeCharacterName(data.name);
    const bio = sanitizeBio(data.bio);

    this.assertNameAllowed(name);
    this.assertAvatarBelongsToUs(data.avatarUrl);

    const existingUserCharacter = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingUserCharacter) {
      throw new ConflictException('La cuenta ya tiene un personaje creado.');
    }

    await this.assertNameAvailable(name);

    // Los intereses se validan contra el catálogo antes de crear nada, para no
    // dejar un personaje a medio construir.
    const interestIds = await this.resolveInterestIds(data.interests);

    try {
      const character = await this.prisma.character.create({
        data: {
          name,
          bio,
          tagline: sanitizeTagline(data.tagline),
          avatarUrl: data.avatarUrl ?? null,
          privacySettings: this.resolvePrivacy(data.privacySettings) as unknown as Prisma.InputJsonValue,
          userId,
          interests: {
            create: interestIds.map((interestId) => ({ interestId })),
          },
        },
        select: OWNER_CHARACTER_SELECT,
      });

      await this.trackCharacterCreated(userId, character.id);
      return this.toOwnerView(character);
    } catch (error) {
      // Condición de carrera: dos creaciones simultáneas con el mismo nombre/usuario.
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('El nombre de personaje o la cuenta ya está en uso.');
      }
      throw error;
    }
  }

  async findByUserId(userId: string) {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: OWNER_CHARACTER_SELECT,
    });

    if (!character) {
      throw new NotFoundException('Todavía no has creado tu personaje.');
    }

    return this.toOwnerView(character);
  }

  async update(userId: string, data: UpdateCharacterDto) {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true, name: true, privacySettings: true },
    });

    if (!character) {
      throw new NotFoundException('Todavía no has creado tu personaje.');
    }

    const name = data.name === undefined ? undefined : normalizeCharacterName(data.name);
    const bio = data.bio === undefined ? undefined : sanitizeBio(data.bio);
    const tagline = data.tagline === undefined ? undefined : sanitizeTagline(data.tagline);

    if (name !== undefined && name !== character.name) {
      this.assertNameAllowed(name);
      await this.assertNameAvailable(name, character.id);
    }

    this.assertAvatarBelongsToUs(data.avatarUrl);

    // Se resuelven antes de abrir la transacción: si un interés no existe en el
    // catálogo, se rechaza la petición entera sin tocar los datos guardados.
    const interestIds =
      data.interests === undefined ? undefined : await this.resolveInterestIds(data.interests);

    const privacy = data.privacySettings
      ? this.resolvePrivacy({ ...this.resolvePrivacy(character.privacySettings), ...data.privacySettings })
      : undefined;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (interestIds) {
          // Reemplazo completo: la lista enviada es la lista final.
          await tx.characterInterest.deleteMany({ where: { characterId: character.id } });
          if (interestIds.length > 0) {
            await tx.characterInterest.createMany({
              data: interestIds.map((interestId) => ({ characterId: character.id, interestId })),
              skipDuplicates: true,
            });
          }
        }

        return tx.character.update({
          where: { id: character.id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(bio !== undefined ? { bio } : {}),
            ...(tagline !== undefined ? { tagline } : {}),
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
            ...(privacy ? { privacySettings: privacy as unknown as Prisma.InputJsonValue } : {}),
          },
          select: OWNER_CHARACTER_SELECT,
        });
      });

      return this.toOwnerView(updated);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('El nombre de personaje ya está en uso.');
      }
      throw error;
    }
  }

  /**
   * Perfil público de un personaje. Solo expone datos públicos y respeta los
   * ajustes de privacidad. Los perfiles privados no se distinguen de los
   * inexistentes (404) para no filtrar su existencia.
   */
  async getPublicProfile(name: string) {
    const normalized = normalizeCharacterName(name);

    if (!normalized || normalized.length > 30) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    // Dos consultas en vez de una: la primera es la única forma de resolver el
    // seudónimo con índice y la segunda es una búsqueda por clave primaria, la
    // más barata que hay. Juntos traen los intereses sin escribir el JOIN a mano.
    const match = await this.findByNameInsensitive(normalized);

    if (!match) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: match.id },
      select: {
        id: true,
        name: true,
        tagline: true,
        avatarUrl: true,
        bio: true,
        privacySettings: true,
        createdAt: true,
        interests: { select: { interest: { select: { name: true } } } },
      },
    });

    const privacy = this.resolvePrivacy(character?.privacySettings);

    if (!character || privacy.profileVisibility !== 'PUBLIC') {
      throw new NotFoundException('Personaje no encontrado.');
    }

    // El lema y los intereses son información del perfil: se ocultan juntos con
    // la biografía. Así no se puede desactivar `showBio` y dejar al descubierto
    // parte de lo que la persona escribió sobre sí misma.
    const [followers, following, companionshipsReceived, publishedCount, featuredStories, recentStories] =
      await Promise.all([
        this.prisma.follower.count({ where: { followingCharacterId: character.id } }),
        this.prisma.follower.count({ where: { followerId: character.id, followingCharacterId: { not: null } } }),
        this.prisma.companionship.count({ where: { targetCharacterId: character.id } }),
        this.prisma.story.count({ where: { characterId: character.id, status: 'PUBLISHED' } }),
        this.prisma.story.findMany({
          where: { characterId: character.id, status: 'PUBLISHED', visibility: 'PUBLIC', featuredAt: { not: null } },
          orderBy: { featuredAt: 'desc' },
          take: 6,
          select: PUBLIC_STORY_SELECT,
        }),
        this.prisma.story.findMany({
          where: { characterId: character.id, status: 'PUBLISHED', visibility: 'PUBLIC' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: PUBLIC_STORY_SELECT,
        }),
      ]);

    return {
      id: character.id,
      name: character.name,
      avatarUrl: privacy.showAvatar ? character.avatarUrl : null,
      tagline: privacy.showBio ? sanitizeTagline(character.tagline) : null,
      bio: privacy.showBio ? sanitizeBio(character.bio) : null,
      interests: privacy.showBio
        ? character.interests.map(({ interest }) => interest.name).sort((a, b) => a.localeCompare(b, 'es'))
        : [],
      createdAt: character.createdAt,
      stats: {
        followers,
        following,
        companionshipsReceived,
        stories: publishedCount,
      },
      featuredStories: featuredStories.map(toPublicStorySummary),
      recentStories: recentStories.map(toPublicStorySummary),
    };
  }

  /** Búsqueda por prefijo del seudónimo (usa el índice funcional `lower(name)`). */
  async search(rawQ: string, limit = 20): Promise<{ items: CharacterSearchResult[] }> {
    const q = normalizeCharacterName(rawQ);
    if (!q) {
      return { items: [] };
    }

    const take = Math.min(Math.max(limit, 1), 30);

    const ids = await this.prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
      SELECT "id", "name" FROM "characters"
      WHERE lower("name") LIKE lower(${q}) || '%'
        AND ("privacySettings" IS NULL OR "privacySettings"->>'profileVisibility' = 'PUBLIC')
      ORDER BY lower("name") ASC
      LIMIT ${take}
    `);

    if (ids.length === 0) {
      return { items: [] };
    }

    const [characters, storyCounts] = await Promise.all([
      this.prisma.character.findMany({
        where: { id: { in: ids.map((row) => row.id) } },
        select: {
          id: true,
          name: true,
          tagline: true,
          avatarUrl: true,
          bio: true,
          privacySettings: true,
          interests: { select: { interest: { select: { name: true } } } },
          _count: { select: { followers: true } },
        },
      }),
      this.prisma.$queryRaw<{ characterId: string; count: number }[]>(Prisma.sql`
        SELECT "characterId", COUNT(*)::int AS "count" FROM "stories"
        WHERE "characterId" IN (${Prisma.join(ids.map((row) => row.id))}) AND "status" = 'PUBLISHED'
        GROUP BY "characterId"
      `),
    ]);

    const storyCountMap = new Map(storyCounts.map((row) => [row.characterId, row.count]));
    const characterById = new Map(characters.map((c) => [c.id, c]));

    const items = ids
      .map((row) => characterById.get(row.id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((character) => {
        const privacy = this.resolvePrivacy(character.privacySettings);
        return {
          name: character.name,
          tagline: privacy.showBio ? sanitizeTagline(character.tagline) : null,
          avatarUrl: privacy.showAvatar ? character.avatarUrl : null,
          interests: character.interests.map(({ interest }) => interest.name),
          stories: storyCountMap.get(character.id) ?? 0,
          followers: character._count.followers,
        };
      });

    return { items };
  }

  async isNameAvailable(name: string): Promise<{ available: boolean; reason?: string }> {
    const normalized = normalizeCharacterName(name);

    if (!normalized) {
      return { available: false, reason: 'El nombre no puede estar vacío' };
    }

    if (this.isReservedName(normalized)) {
      return { available: false, reason: 'Ese nombre está reservado' };
    }

    const taken = await this.findByNameInsensitive(normalized);
    return taken ? { available: false, reason: 'Ese nombre ya está en uso' } : { available: true };
  }

  private toOwnerView(character: {
    id: string;
    name: string;
    tagline: string | null;
    avatarUrl: string | null;
    bio: string | null;
    privacySettings: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    interests?: { interest: { name: string } }[];
  }) {
    return {
      id: character.id,
      name: character.name,
      tagline: character.tagline,
      avatarUrl: character.avatarUrl,
      bio: character.bio,
      interests: (character.interests ?? []).map(({ interest }) => interest.name),
      privacySettings: this.resolvePrivacy(character.privacySettings),
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    };
  }

  /**
   * Traduce los nombres de interés a sus identificadores consultando el
   * catálogo. Un nombre fuera del catálogo se rechaza entero: el cliente no
   * puede crear etiquetas nuevas ni colgar identificadores inventados.
   */
  private async resolveInterestIds(names: string[] | undefined): Promise<string[]> {
    if (!names || names.length === 0) {
      return [];
    }

    const found = await this.prisma.interest.findMany({
      where: { name: { in: names, mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    if (found.length !== names.length) {
      const known = new Set(found.map((row) => row.name.toLowerCase()));
      const unknown = names.filter((name) => !known.has(name.toLowerCase()));
      throw new BadRequestException(
        `Interés no válido: ${unknown.join(', ')}. Elige entre los intereses disponibles.`,
      );
    }

    return found.map((row) => row.id);
  }

  private async assertNameAvailable(name: string, excludeCharacterId?: string) {
    const taken = await this.findByNameInsensitive(name);
    if (taken && taken.id !== excludeCharacterId) {
      throw new ConflictException('El nombre de personaje ya está en uso.');
    }
  }

  /**
   * Localiza el id de un seudónimo sin distinguir mayúsculas.
   *
   * `mode: 'insensitive'` no sirve aquí: Prisma lo compila como `name ILIKE $1` y
   * en Postgres `ILIKE` no tiene operador de índice, así que cada visita a un
   * perfil y cada comprobación de disponibilidad recorren la tabla entera. La
   * forma `lower(name) = lower(...)` sí la resuelve el índice funcional
   * `characters_name_lower_key` que ya existe en la base, y que es además lo que
   * garantiza que "Ana" y "ana" no puedan coexistir.
   *
   * El valor se envía como parámetro de Prisma, nunca concatenado en el texto.
   *
   * El nombre de la tabla va escrito a mano porque Prisma no lo expone: es el
   * `@@map("characters")` de `schema.prisma`, que hay que cambiar en los dos
   * sitios si alguna vez se renombra.
   */
  private findByNameInsensitive(name: string): Promise<{ id: string } | null> {
    return this.prisma
      .$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT "id" FROM "characters" WHERE lower("name") = lower(${name}) LIMIT 1`,
      )
      .then((rows) => rows[0] ?? null);
  }

  private assertNameAllowed(name: string) {
    if (!name) {
      throw new BadRequestException('El seudónimo no puede estar vacío.');
    }
    if (this.isReservedName(name)) {
      throw new ConflictException('Ese nombre está reservado.');
    }
  }

  /**
   * El avatar solo puede apuntar a nuestro almacenamiento. Cualquier URL
   * externa (tracking de viewers, contenido hostil, SSRF desde proxies de
   * imagen) se rechaza: el avatar se sube por `POST /characters/me/avatar`.
   */
  private assertAvatarBelongsToUs(avatarUrl: string | null | undefined) {
    if (!avatarUrl) {
      return;
    }
    if (!isOwnMediaUrl(avatarUrl, env.storage.publicBaseUrl)) {
      throw new BadRequestException(
        'La URL del avatar debe pertenecer al almacenamiento de la plataforma. Usa el endpoint de subida de avatar.',
      );
    }
  }

  private isReservedName(name: string): boolean {
    const canonical = name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (RESERVED_NAMES.has(canonical)) {
      return true;
    }
    // Evita suplantar la marca aunque se intercalen separadores o números.
    return canonical.includes('whityouly');
  }

  private resolvePrivacy(settings: unknown): ResolvedPrivacy {
    const source = (settings ?? {}) as Partial<PrivacySettingsDto>;

    return {
      profileVisibility: source.profileVisibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
      showAvatar: typeof source.showAvatar === 'boolean' ? source.showAvatar : DEFAULT_PRIVACY.showAvatar,
      showBio: typeof source.showBio === 'boolean' ? source.showBio : DEFAULT_PRIVACY.showBio,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }

  private async trackCharacterCreated(userId: string, characterId: string): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventType: 'character.created',
          userId,
          characterId,
          entityType: 'character',
          entityId: characterId,
        },
      });
    } catch {
      // La analítica nunca debe bloquear la creación del personaje.
    }
  }
}

export type PublicCharacter = Pick<
  Character,
  'id' | 'name' | 'avatarUrl' | 'bio' | 'createdAt' | 'updatedAt'
>;

/** Resumen de un relato público para el perfil del personaje. */
export interface PublicStorySummary {
  id: string;
  title: string;
  category: string | null;
  opening: { content: string; mediaUrl: string | null; audioUrl: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterSearchResult {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
  interests: string[];
  stories: number;
  followers: number;
}

const PUBLIC_STORY_SELECT = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  categories: { select: { category: { select: { name: true } } } },
  updates: {
    orderBy: { stageOrder: 'asc' },
    take: 1,
    select: {
      content: true,
      mediaAsset: { select: { fileUrl: true } },
      audioAsset: { select: { fileUrl: true } },
    },
  },
} satisfies Prisma.StorySelect;

function toPublicStorySummary(story: {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  categories: { category: { name: string } }[];
  updates: {
    content: string;
    mediaAsset: { fileUrl: string } | null;
    audioAsset: { fileUrl: string } | null;
  }[];
}): PublicStorySummary {
  const category = story.categories[0]?.category.name ?? null;
  const opening = story.updates[0];

  return {
    id: story.id,
    title: story.title,
    category,
    opening: opening
      ? {
          content: opening.content,
          mediaUrl: opening.mediaAsset?.fileUrl ?? null,
          audioUrl: opening.audioAsset?.fileUrl ?? null,
        }
      : null,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
  };
}
