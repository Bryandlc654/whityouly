import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATION_ENTITY,
  type NotificationEntityType,
  type NotificationType,
} from './notification-types';
import { ListNotificationsQueryDto } from './dto/notification.dto';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// Un relato popular puede notificar a miles de seguidores de una vez. El INSERT
// se trocea para no emitir una sola sentencia gigantesca: tamaño abajo = menos
// presión sobre el planificador de Postgres y fallos más baratos de reintentar.
const CREATE_BATCH_SIZE = 500;

export interface CreateNotificationInput {
  /** Destinatario. */
  userId: string;
  type: NotificationType;
  entityType: NotificationEntityType;
  entityId?: string | null;
  /** Personaje que provocó el aviso. Nulo en avisos de sistema. */
  actorCharacterId?: string | null;
  /**
   * Cuenta dueña del personaje actor. Si coincide con el destinatario, el aviso
   * se descarta: nadie debería recibir una notificación por algo que hizo él
   * mismo. Es opcional para no obligar a resolverlo en cada llamada.
   */
  actorUserId?: string | null;
}

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  status: true,
  entityType: true,
  entityId: true,
  actorCharacterId: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>;

export interface NotificationActor {
  name: string;
  avatarUrl: string | null;
}

export interface NotificationStory {
  id: string;
  title: string;
  author: { name: string; avatarUrl: string | null } | null;
}

export interface NotificationView {
  id: string;
  type: string;
  status: NotificationStatus;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
  actor: NotificationActor | null;
  story: NotificationStory | null;
}

/**
 * Bandeja de notificaciones. Los avisos se crean desde otros módulos (seguir,
 * comentar, acompañar, publicar una etapa) y aquí solo se persisten y se leen.
 * Crear un aviso nunca debe romper la acción que lo origina: si la inserción
 * falla, se registra el fallo y se continúa.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- Escritura ------------------------------------------------------------

  async create(input: CreateNotificationInput): Promise<void> {
    if (this.isSelfNotification(input)) {
      return;
    }

    try {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          actorCharacterId: input.actorCharacterId ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo crear la notificación ${input.type}: ${(error as Error).message}`,
      );
    }
  }

  /** Versión por lotes (una etapa nueva avisa a todos los seguidores). */
  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    const batch = inputs.filter((input) => !this.isSelfNotification(input));
    if (batch.length === 0) {
      return;
    }

    const rows = batch.map((input) => ({
      userId: input.userId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      actorCharacterId: input.actorCharacterId ?? null,
    }));

    for (let i = 0; i < rows.length; i += CREATE_BATCH_SIZE) {
      const slice = rows.slice(i, i + CREATE_BATCH_SIZE);
      try {
        await this.prisma.notification.createMany({ data: slice });
      } catch (error) {
        // Un lote roto no debe impedir que el resto de avisos lleguen.
        this.logger.warn(`No se pudieron crear notificaciones: ${(error as Error).message}`);
      }
    }
  }

  private isSelfNotification(input: CreateNotificationInput): boolean {
    return Boolean(input.actorUserId) && input.actorUserId === input.userId;
  }

  // --- Lectura --------------------------------------------------------------

  async list(userId: string, query: ListNotificationsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unreadOnly ? { status: NotificationStatus.UNREAD } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: NOTIFICATION_SELECT,
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    const [actors, stories, unreadCount] = await Promise.all([
      this.resolveActors(page),
      this.resolveStories(page),
      this.unreadCount(userId),
    ]);

    return {
      items: page.map((row) => this.toView(row, actors, stories)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, status: NotificationStatus.UNREAD },
    });
  }

  async markRead(userId: string, id: string): Promise<{ id: string; status: 'READ' }> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { status: NotificationStatus.READ },
    });

    // `updateMany` no distingue "no existe" de "ya estaba leída": para poder
    // responder 404 con propiedad se comprueba la existencia.
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('Esa notificación no existe.');
      }
    }

    return { id, status: 'READ' };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ },
    });

    return { updated: result.count };
  }

  // --- Apoyo ----------------------------------------------------------------

  private async resolveActors(rows: NotificationRow[]): Promise<Map<string, NotificationActor>> {
    const ids = [
      ...new Set(
        rows
          .map((row) => row.actorCharacterId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    if (ids.length === 0) {
      return new Map();
    }

    const characters = await this.prisma.character.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, avatarUrl: true },
    });

    return new Map(
      characters.map((character) => [
        character.id,
        { name: character.name, avatarUrl: character.avatarUrl },
      ]),
    );
  }

  private async resolveStories(rows: NotificationRow[]): Promise<Map<string, NotificationStory>> {
    const ids = [
      ...new Set(
        rows
          .filter((row) => row.entityType === NOTIFICATION_ENTITY.STORY && row.entityId)
          .map((row) => row.entityId as string),
      ),
    ];
    if (ids.length === 0) {
      return new Map();
    }

    const stories = await this.prisma.story.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        character: { select: { name: true, avatarUrl: true } },
      },
    });

    return new Map(
      stories.map((story) => [
        story.id,
        {
          id: story.id,
          title: story.title,
          author: story.character
            ? { name: story.character.name, avatarUrl: story.character.avatarUrl }
            : null,
        },
      ]),
    );
  }

  private toView(
    row: NotificationRow,
    actors: Map<string, NotificationActor>,
    stories: Map<string, NotificationStory>,
  ): NotificationView {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      entityType: row.entityType,
      entityId: row.entityId,
      createdAt: row.createdAt,
      actor: row.actorCharacterId ? (actors.get(row.actorCharacterId) ?? null) : null,
      story:
        row.entityType === NOTIFICATION_ENTITY.STORY && row.entityId
          ? (stories.get(row.entityId) ?? null)
          : null,
    };
  }
}
