import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthorPreferenceKindValue } from './dto/content-preferences.dto';

/**
 * Preferencias sobre autores (silenciar, bloquear, ver menos).
 *
 * Además del nombre visible se guarda el `characterId` del autor. Así el
 * bloqueo sobrevive a un cambio de seudónimo y puede aplicarse en consultas
 * por clave, sin depender de una comparación de texto.
 */
@Injectable()
export class ContentPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.authorPreference.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, authorName: true, kind: true, characterId: true, createdAt: true },
    });
  }

  async create(userId: string, authorName: string, kind: AuthorPreferenceKindValue) {
    // Puede no existir (por ejemplo, una preferencia heredada de un personaje
    // eliminado): en ese caso se conserva solo el nombre.
    const character = await this.prisma.character.findFirst({
      where: { name: { equals: authorName, mode: 'insensitive' } },
      select: { id: true },
    });
    const characterId = character?.id ?? null;

    return this.prisma.authorPreference.upsert({
      where: { userId_authorName_kind: { userId, authorName, kind } },
      update: { characterId },
      create: { userId, authorName, kind, characterId },
      select: { id: true, authorName: true, kind: true, characterId: true, createdAt: true },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.authorPreference.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.authorPreference.delete({ where: { id } });
    }
    return { id, removed: Boolean(existing) };
  }

  /** Nombres que no deben aparecer en el feed (MUTE, BLOCK y LESS). */
  async hiddenAuthorNames(userId: string): Promise<string[]> {
    const rows = await this.prisma.authorPreference.findMany({
      where: { userId, kind: { in: ['MUTE', 'BLOCK', 'LESS'] } },
      select: { authorName: true },
    });
    return [...new Set(rows.map((row) => row.authorName))];
  }

  /**
   * Personajes ocultos en el feed. Incluye MUTE/LESS porque el producto los
   * trata como "ver menos", y BLOCK porque no debe recomendarse ni listarse.
   */
  async hiddenCharacterIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.authorPreference.findMany({
      where: {
        userId,
        kind: { in: ['MUTE', 'BLOCK', 'LESS'] },
        characterId: { not: null },
      },
      select: { characterId: true },
    });
    return [...new Set(rows.map((row) => row.characterId).filter((id): id is string => Boolean(id)))];
  }

  /** Personajes bloqueados de forma explícita por el usuario. */
  async blockedCharacterIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.authorPreference.findMany({
      where: { userId, kind: 'BLOCK', characterId: { not: null } },
      select: { characterId: true },
    });
    return [...new Set(rows.map((row) => row.characterId).filter((id): id is string => Boolean(id)))];
  }

  /** Personajes que bloquearon al usuario (para no mostrarles su contenido). */
  async blockedByCharacterIds(userId: string): Promise<string[]> {
    const viewer = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!viewer) {
      return [];
    }

    const rows = await this.prisma.authorPreference.findMany({
      where: { kind: 'BLOCK', characterId: viewer.id, userId: { not: userId } },
      select: { user: { select: { character: { select: { id: true } } } } },
    });

    return [
      ...new Set(
        rows
          .map((row) => row.user.character?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  /** Bloqueo en cualquier dirección, para listas y contadores. */
  async blockedEitherWayCharacterIds(userId: string): Promise<string[]> {
    const [blocked, blockedBy] = await Promise.all([
      this.blockedCharacterIds(userId),
      this.blockedByCharacterIds(userId),
    ]);
    return [...new Set([...blocked, ...blockedBy])];
  }

  /** ¿El usuario bloqueó a este personaje? */
  async hasBlocked(userId: string, characterId: string): Promise<boolean> {
    const row = await this.prisma.authorPreference.findFirst({
      where: { userId, kind: 'BLOCK', characterId },
      select: { id: true },
    });
    return Boolean(row);
  }

  /**
   * Comprueba el bloqueo en cualquiera de las dos direcciones. Si cualquiera de
   * los dos bloqueó al otro, no debe haber interacción ni contenido visible.
   * Devuelve `false` si faltan ids (por ejemplo, una cuenta sin personaje).
   */
  async blockedRelation(
    userId: string,
    characterId: string | null | undefined,
    otherUserId: string,
    otherCharacterId: string | null | undefined,
  ): Promise<boolean> {
    if (!characterId || !otherCharacterId) {
      return false;
    }

    const row = await this.prisma.authorPreference.findFirst({
      where: {
        kind: 'BLOCK',
        OR: [
          { userId, characterId: otherCharacterId },
          { userId: otherUserId, characterId },
        ],
      },
      select: { id: true },
    });

    return Boolean(row);
  }
}
