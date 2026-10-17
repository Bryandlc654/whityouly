import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppealStatus, CommentStatus, ReportStatus, StoryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_TYPES,
} from '../notifications/notification-types';
import {
  AppealTarget,
  CreateAppealDto,
  ListAppealsQueryDto,
  ListReportsQueryDto,
  ModerateContentDto,
  ResolveAppealDto,
  UpdateReportDto,
} from './dto/moderation.dto';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

// Estados en los que un contenido está oculto y, por tanto, se puede apelar. Un
// relato `REPORTED` cuenta como moderado a estos efectos: ya no es visible para
// la comunidad aunque la revisión siga abierta.
const APPEALABLE_STORY_STATUSES: StoryStatus[] = [
  StoryStatus.HIDDEN,
  StoryStatus.MODERATED,
  StoryStatus.REPORTED,
];
const APPEALABLE_COMMENT_STATUSES: CommentStatus[] = [CommentStatus.HIDDEN, CommentStatus.MODERATED];

/** Resumen del contenido reportado para dar contexto a quien modera. */
export interface TargetSummary {
  id: string;
  type: string;
  title: string | null;
  authorName: string | null;
  status: string | null;
  storyId: string | null;
}

export interface ReportView {
  id: string;
  reportedType: string;
  reportedId: string;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  reporterCharacterName: string | null;
  target: TargetSummary | null;
}

export interface AppealView {
  id: string;
  targetType: string;
  targetId: string;
  reportId: string | null;
  message: string;
  status: AppealStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  appellantCharacterName: string | null;
  target: TargetSummary | null;
}

/**
 * Moderación: revisión de reportes y apelaciones. Los reportes los escribe la
 * comunidad; una vez que administración oculta el contenido, su autor puede
 * apelar y administración resuelve. Todo el flujo de revisión vive aquí; las
 * rutas de revisión exigen rol de administración (RolesGuard).
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Apelaciones (autor) --------------------------------------------------

  /**
   * Crea la apelación del autor de un contenido oculto. Solo puede apelar quien
   * es dueño del contenido y solo si de verdad está oculto; una apelación
   * pendiente por el mismo contenido bloquea otra (no se apila la revisión).
   */
  async createAppeal(userId: string, dto: CreateAppealDto): Promise<AppealView> {
    const target = await this.resolveOwnedTarget(userId, dto.targetType, dto.targetId);

    const appealable =
      dto.targetType === 'STORY'
        ? APPEALABLE_STORY_STATUSES.includes(target.status as StoryStatus)
        : APPEALABLE_COMMENT_STATUSES.includes(target.status as CommentStatus);

    if (!appealable) {
      throw new BadRequestException('Ese contenido no está oculto: no hay nada que apelar.');
    }

    const pending = await this.prisma.appeal.findFirst({
      where: {
        appellantUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: AppealStatus.PENDING,
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException('Ya tienes una apelación pendiente para este contenido.');
    }

    // Se enlaza el último reporte recibido sobre el objetivo para dar contexto a
    // la revisión; puede no existir si la moderación se hizo por otra vía.
    const report = await this.prisma.report.findFirst({
      where: { reportedType: dto.targetType, reportedId: dto.targetId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const appeal = await this.prisma.appeal.create({
      data: {
        appellantUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reportId: report?.id ?? null,
        message: dto.message,
      },
    });

    return this.toAppealView(appeal, null);
  }

  async listMyAppeals(userId: string, query: ListAppealsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.appeal.findMany({
      where: { appellantUserId: userId, ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const targets = await this.describeTargets(page.map((row) => ({ type: row.targetType, id: row.targetId })));

    return {
      items: page.map((row) =>
        this.toAppealView(row, targets.get(`${row.targetType}:${row.targetId}`) ?? null),
      ),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  // --- Revisión de reportes (administración) --------------------------------

  async listReports(query: ListReportsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.report.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { reportedType: query.type } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    const [targets, reporters] = await Promise.all([
      this.describeTargets(page.map((row) => ({ type: row.reportedType, id: row.reportedId }))),
      this.reporterNames(page.map((row) => row.reporterUserId)),
    ]);

    return {
      items: page.map(
        (row): ReportView => ({
          id: row.id,
          reportedType: row.reportedType,
          reportedId: row.reportedId,
          reason: row.reason,
          status: row.status,
          createdAt: row.createdAt,
          resolvedAt: row.resolvedAt,
          reporterCharacterName: reporters.get(row.reporterUserId) ?? null,
          target: targets.get(`${row.reportedType}:${row.reportedId}`) ?? null,
        }),
      ),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async updateReport(_adminUserId: string, reportId: string, dto: UpdateReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, status: true },
    });
    if (!report) {
      throw new NotFoundException('Ese reporte no existe.');
    }

    const terminal = dto.status === ReportStatus.RESOLVED || dto.status === ReportStatus.REJECTED;

    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        resolvedAt: terminal ? new Date() : null,
      },
    });

    return { id: reportId, status: dto.status };
  }

  /**
   * Oculta o restaura el contenido reportado. Ocultar lo deja fuera de la vista
   * pública (y avisa a su autor, que podrá apelar); restaurar lo devuelve al
   * estado visible. La decisión es de administración, nunca automática por un
   * reporte.
   */
  async moderateContent(adminUserId: string, reportId: string, dto: ModerateContentDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, reportedType: true, reportedId: true, status: true },
    });
    if (!report) {
      throw new NotFoundException('Ese reporte no existe.');
    }

    const hide = dto.action === 'HIDE';

    if (report.reportedType === 'STORY') {
      await this.moderateStory(adminUserId, report.reportedId, hide);
    } else if (report.reportedType === 'COMMENT') {
      await this.moderateComment(adminUserId, report.reportedId, hide);
    } else {
      throw new BadRequestException(
        'Por ahora solo se pueden moderar relatos y comentarios.',
      );
    }

    // Al ocultar, el reporte queda resuelto; al restaurar, se descarta.
    await this.prisma.report.update({
      where: { id: report.id },
      data: {
        status: hide ? ReportStatus.RESOLVED : ReportStatus.REJECTED,
        resolvedAt: new Date(),
      },
    });

    return { id: report.id, action: dto.action };
  }

  // --- Revisión de apelaciones (administración) -----------------------------

  async listAppeals(query: ListAppealsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.appeal.findMany({
      where: (query.status ? { status: query.status } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    const [targets, appellants] = await Promise.all([
      this.describeTargets(page.map((row) => ({ type: row.targetType, id: row.targetId }))),
      this.reporterNames(page.map((row) => row.appellantUserId)),
    ]);

    return {
      items: page.map((row) => ({
        id: row.id,
        targetType: row.targetType,
        targetId: row.targetId,
        reportId: row.reportId,
        message: row.message,
        status: row.status,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
        resolutionNote: row.resolutionNote,
        appellantCharacterName: appellants.get(row.appellantUserId) ?? null,
        target: targets.get(`${row.targetType}:${row.targetId}`) ?? null,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Resuelve una apelación. Aceptar restaura el contenido y avisa a quien
   * apeló; rechazar solo cierra la apelación. Una apelación ya resuelta no se
   * vuelve a resolver.
   */
  async resolveAppeal(adminUserId: string, appealId: string, dto: ResolveAppealDto) {
    const appeal = await this.prisma.appeal.findUnique({ where: { id: appealId } });
    if (!appeal) {
      throw new NotFoundException('Esa apelación no existe.');
    }
    if (appeal.status !== AppealStatus.PENDING) {
      throw new ConflictException('Esa apelación ya fue resuelta.');
    }

    if (dto.status === 'ACCEPTED') {
      await this.restoreTarget(appeal.targetType, appeal.targetId);
    }

    await this.prisma.appeal.update({
      where: { id: appealId },
      data: {
        status: dto.status === 'ACCEPTED' ? AppealStatus.ACCEPTED : AppealStatus.REJECTED,
        resolvedByUserId: adminUserId,
        resolvedAt: new Date(),
        resolutionNote: dto.resolutionNote ?? null,
      },
    });

    await this.notifyModeration(appeal.appellantUserId, adminUserId, {
      storyId: await this.storyIdOf(appeal.targetType, appeal.targetId),
    });

    return { id: appealId, status: dto.status };
  }

  // --- Apoyo ----------------------------------------------------------------

  private async moderateStory(adminUserId: string, storyId: string, hide: boolean): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, status: true, character: { select: { userId: true } } },
    });
    if (!story) {
      throw new NotFoundException('Ese relato no existe.');
    }
    if (story.status === StoryStatus.DELETED) {
      throw new ConflictException('Ese relato ya no está disponible.');
    }

    await this.prisma.story.update({
      where: { id: storyId },
      data: { status: hide ? StoryStatus.HIDDEN : StoryStatus.PUBLISHED, updatedAt: new Date() },
    });

    if (hide) {
      await this.notifyModeration(story.character.userId, adminUserId, { storyId });
    }
  }

  private async moderateComment(adminUserId: string, commentId: string, hide: boolean): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, status: true, storyId: true, character: { select: { userId: true } } },
    });
    if (!comment) {
      throw new NotFoundException('Ese comentario no existe.');
    }
    if (comment.status === CommentStatus.DELETED) {
      throw new ConflictException('Ese comentario ya no está disponible.');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { status: hide ? CommentStatus.HIDDEN : CommentStatus.ACTIVE },
    });

    if (hide) {
      await this.notifyModeration(comment.character.userId, adminUserId, {
        storyId: comment.storyId,
      });
    }
  }

  private async restoreTarget(targetType: string, targetId: string): Promise<void> {
    if (targetType === 'STORY') {
      await this.prisma.story.update({
        where: { id: targetId },
        data: { status: StoryStatus.PUBLISHED, updatedAt: new Date() },
      });
      return;
    }
    if (targetType === 'COMMENT') {
      await this.prisma.comment.update({
        where: { id: targetId },
        data: { status: CommentStatus.ACTIVE },
      });
    }
  }

  /** Relato asociado al objetivo, para anclar la notificación de moderación. */
  private async storyIdOf(targetType: string, targetId: string): Promise<string | null> {
    if (targetType === 'STORY') {
      return targetId;
    }
    if (targetType === 'COMMENT') {
      const comment = await this.prisma.comment.findUnique({
        where: { id: targetId },
        select: { storyId: true },
      });
      return comment?.storyId ?? null;
    }
    return null;
  }

  /**
   * Aviso de moderación. Nunca rompe el flujo de revisión: si la notificación
   * falla, se registra y se continúa (igual que el resto de avisos).
   */
  private async notifyModeration(
    userId: string,
    adminUserId: string,
    data: { storyId: string | null },
  ): Promise<void> {
    try {
      await this.notifications.create({
        userId,
        actorUserId: adminUserId,
        actorCharacterId: null,
        type: NOTIFICATION_TYPES.MODERATION,
        entityType: NOTIFICATION_ENTITY.STORY,
        entityId: data.storyId,
      });
    } catch (error) {
      this.logger.warn(`No se pudo avisar de la moderación: ${(error as Error).message}`);
    }
  }

  private async resolveOwnedTarget(
    userId: string,
    targetType: AppealTarget,
    targetId: string,
  ): Promise<{ status: string }> {
    if (targetType === 'STORY') {
      const story = await this.prisma.story.findUnique({
        where: { id: targetId },
        select: { status: true, character: { select: { userId: true } } },
      });
      // Un contenido ajeno se trata como inexistente para no revelar que existe.
      if (!story || story.character.userId !== userId) {
        throw new NotFoundException('Ese relato no existe.');
      }
      return { status: story.status };
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: targetId },
      select: { status: true, character: { select: { userId: true } } },
    });
    if (!comment || comment.character.userId !== userId) {
      throw new NotFoundException('Ese comentario no existe.');
    }
    return { status: comment.status };
  }

  /** Nombres de personaje (seudónimos) de un conjunto de usuarios. */
  private async reporterNames(userIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) {
      return new Map();
    }
    const characters = await this.prisma.character.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, name: true },
    });
    return new Map(characters.map((character) => [character.userId, character.name]));
  }

  /**
   * Resume el contenido apuntado por cada reporte/apelación (una sola consulta
   * por tipo). Los tipos que todavía no se pueden moderar no aportan resumen.
   */
  private async describeTargets(
    refs: { type: string; id: string }[],
  ): Promise<Map<string, TargetSummary>> {
    const storyIds = [
      ...new Set(refs.filter((ref) => ref.type === 'STORY').map((ref) => ref.id)),
    ];
    const commentIds = [
      ...new Set(refs.filter((ref) => ref.type === 'COMMENT').map((ref) => ref.id)),
    ];

    const [stories, comments] = await Promise.all([
      storyIds.length > 0
        ? this.prisma.story.findMany({
            where: { id: { in: storyIds } },
            select: {
              id: true,
              title: true,
              status: true,
              character: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      commentIds.length > 0
        ? this.prisma.comment.findMany({
            where: { id: { in: commentIds } },
            select: {
              id: true,
              content: true,
              status: true,
              storyId: true,
              character: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const map = new Map<string, TargetSummary>();
    for (const story of stories) {
      map.set(`STORY:${story.id}`, {
        id: story.id,
        type: 'STORY',
        title: story.title,
        authorName: story.character?.name ?? null,
        status: story.status,
        storyId: story.id,
      });
    }
    for (const comment of comments) {
      map.set(`COMMENT:${comment.id}`, {
        id: comment.id,
        type: 'COMMENT',
        title: this.snippet(comment.content),
        authorName: comment.character?.name ?? null,
        status: comment.status,
        storyId: comment.storyId,
      });
    }
    return map;
  }

  private snippet(content: string): string | null {
    const trimmed = content.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.length > 140 ? `${trimmed.slice(0, 139)}…` : trimmed;
  }

  private toAppealView(
    appeal: {
      id: string;
      targetType: string;
      targetId: string;
      reportId: string | null;
      message: string;
      status: AppealStatus;
      createdAt: Date;
      resolvedAt: Date | null;
      resolutionNote: string | null;
    },
    target: TargetSummary | null,
  ): AppealView {
    return {
      id: appeal.id,
      targetType: appeal.targetType,
      targetId: appeal.targetId,
      reportId: appeal.reportId,
      message: appeal.message,
      status: appeal.status,
      createdAt: appeal.createdAt,
      resolvedAt: appeal.resolvedAt,
      resolutionNote: appeal.resolutionNote,
      appellantCharacterName: null,
      target,
    };
  }
}
