import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppealStatus,
  CommentStatus,
  ModerationActionKind,
  Prisma,
  ReportStatus,
  Role,
  Status,
  StoryStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_TYPES,
} from '../notifications/notification-types';
import {
  AppealTarget,
  CreateAppealDto,
  CreateModerationDecisionDto,
  ListAppealsQueryDto,
  ListModerationActionsQueryDto,
  ListReportsQueryDto,
  ModerateContentDto,
  ResolveAppealDto,
  RevertModerationActionDto,
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

// Una restauración por apelación no se "revierte": no tendría un inverso claro.
const REVERTABLE_ACTIONS: ModerationActionKind[] = [
  ModerationActionKind.DISMISS,
  ModerationActionKind.HIDE,
  ModerationActionKind.SUSPEND,
];

const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

/** Resumen del contenido reportado para dar contexto a quien modera. */
export interface TargetSummary {
  id: string;
  type: string;
  title: string | null;
  authorName: string | null;
  status: string | null;
  storyId: string | null;
  /** Extracto del contenido público reportado, nunca datos privados. */
  context: string | null;
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

export interface ModerationActionView {
  id: string;
  reportId: string | null;
  action: ModerationActionKind;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  createdAt: Date;
  revertedAt: Date | null;
  revertReason: string | null;
  actorCharacterName: string | null;
  revertedByCharacterName: string | null;
  target: TargetSummary | null;
  canRevert: boolean;
}

const MODERATION_ACTION_SELECT = {
  id: true,
  reportId: true,
  actorUserId: true,
  action: true,
  targetType: true,
  targetId: true,
  subjectUserId: true,
  reason: true,
  createdAt: true,
  revertedAt: true,
  revertedByUserId: true,
  revertReason: true,
} satisfies Prisma.ModerationActionSelect;

type ModerationActionRow = Prisma.ModerationActionGetPayload<{
  select: typeof MODERATION_ACTION_SELECT;
}>;

interface SubjectAccount {
  userId: string;
  role: Role;
  status: Status;
}

interface DecisionTarget extends SubjectAccount {
  targetStatus: string | null;
  storyId: string | null;
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

    // Resolver o descartar es una decisión: exige motivo y genera auditoría.
    // Este endpoint queda para marcar "en revisión" o reabrir un caso.
    if (dto.status === ReportStatus.RESOLVED || dto.status === ReportStatus.REJECTED) {
      throw new BadRequestException(
        'Para resolver o descartar un reporte usa una decisión de moderación con motivo.',
      );
    }

    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        resolvedAt: null,
      },
    });

    return { id: reportId, status: dto.status };
  }

  /**
   * Decisión principal del panel: descartar, ocultar contenido o suspender la
   * cuenta autora. Todo cambio queda en `moderation_actions` con motivo y actor.
   */
  async decideReport(
    actorUserId: string,
    reportId: string,
    dto: CreateModerationDecisionDto,
  ) {
    const actor = await this.loadActor(actorUserId);
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reportedType: true,
        reportedId: true,
        status: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Ese reporte no existe.');
    }

    if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.REJECTED) {
      throw new ConflictException(
        'Ese reporte ya fue resuelto. Reabre la revisión antes de decidir de nuevo.',
      );
    }

    const target =
      dto.action === 'DISMISS'
        ? null
        : await this.resolveDecisionTarget(report.reportedType, report.reportedId, dto.action);

    if (dto.action === 'SUSPEND' && target) {
      await this.assertCanModerateAccount(actor, {
        userId: target.userId,
        role: target.role,
        status: target.status,
        actorUserId,
      });
    }

    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.action === 'HIDE' && target) {
        if (report.reportedType === 'STORY') {
          const updated = await tx.story.updateMany({
            where: {
              id: report.reportedId,
              status: { notIn: [StoryStatus.DELETED, StoryStatus.WITHDRAWN] },
            },
            data: { status: StoryStatus.HIDDEN, updatedAt: now },
          });
          if (updated.count === 0) {
            throw new ConflictException('Ese relato ya no está disponible.');
          }
        } else {
          const updated = await tx.comment.updateMany({
            where: { id: report.reportedId, status: { not: CommentStatus.DELETED } },
            data: { status: CommentStatus.HIDDEN },
          });
          if (updated.count === 0) {
            throw new ConflictException('Ese comentario ya no está disponible.');
          }
        }
      }

      if (dto.action === 'SUSPEND' && target) {
        // Se vuelve a comprobar el último SUPERADMIN dentro de la transacción
        // para que dos suspensiones simultáneas no dejen la instancia sin nadie.
        if (target.role === 'SUPERADMIN') {
          const others = await tx.user.count({
            where: {
              role: 'SUPERADMIN',
              status: 'ACTIVE',
              NOT: { id: target.userId },
            },
          });
          if (others === 0) {
            throw new ConflictException(
              'No puedes dejar la instancia sin SUPERADMIN activo.',
            );
          }
        }

        const suspended = await tx.user.updateMany({
          where: { id: target.userId, status: 'ACTIVE' },
          data: { status: 'SUSPENDED' },
        });
        if (suspended.count === 0) {
          throw new ConflictException('La cuenta ya no está activa.');
        }

        await tx.session.updateMany({
          where: { userId: target.userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      // Bloqueo optimista: dos decisiones simultáneas no pueden resolver el
      // mismo reporte dos veces ni duplicar la auditoría.
      const resolved = await tx.report.updateMany({
        where: {
          id: report.id,
          status: { in: [ReportStatus.PENDING, ReportStatus.IN_REVIEW] },
        },
        data: {
          status: dto.action === 'DISMISS' ? ReportStatus.REJECTED : ReportStatus.RESOLVED,
          resolvedAt: now,
        },
      });
      if (resolved.count === 0) {
        throw new ConflictException(
          'Ese reporte ya fue resuelto por otra persona. Recarga la cola.',
        );
      }

      return tx.moderationAction.create({
        data: {
          reportId: report.id,
          actorUserId,
          action:
            dto.action === 'DISMISS'
              ? ModerationActionKind.DISMISS
              : dto.action === 'HIDE'
                ? ModerationActionKind.HIDE
                : ModerationActionKind.SUSPEND,
          targetType: report.reportedType,
          targetId: report.reportedId,
          subjectUserId: dto.action === 'SUSPEND' ? target?.userId ?? null : null,
          reason: dto.reason,
        },
        select: MODERATION_ACTION_SELECT,
      });
    });

    if (target && dto.action !== 'DISMISS') {
      await this.notifyModeration(target.userId, actorUserId, {
        storyId: target.storyId,
      });
    }

    return {
      id: created.id,
      reportId: report.id,
      action: dto.action,
      reportStatus:
        dto.action === 'DISMISS' ? ReportStatus.REJECTED : ReportStatus.RESOLVED,
    };
  }

  /** Historial de decisiones, paginado y con el resumen del objetivo. */
  async listActions(query: ListModerationActionsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.moderationAction.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.reportId ? { reportId: query.reportId } : {}),
        ...(query.status === 'ACTIVE'
          ? { revertedAt: null }
          : query.status === 'REVERTED'
            ? { revertedAt: { not: null } }
            : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: MODERATION_ACTION_SELECT,
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    const [targets, actors, reverters] = await Promise.all([
      this.describeTargets(
        page
          .filter((row) => row.targetType && row.targetId)
          .map((row) => ({ type: row.targetType!, id: row.targetId! })),
      ),
      this.reporterNames(page.map((row) => row.actorUserId)),
      this.reporterNames(
        page
          .map((row) => row.revertedByUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ]);

    return {
      items: page.map((row) => this.toActionView(row, targets, actors, reverters)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Revierte una decisión: reabre el reporte, restaura el contenido o reactiva
   * la cuenta. No se puede revertir dos veces ni revertir una restauración de
   * apelación.
   */
  async revertAction(
    actorUserId: string,
    actionId: string,
    dto: RevertModerationActionDto,
  ) {
    const actor = await this.loadActor(actorUserId);
    const action = await this.prisma.moderationAction.findUnique({
      where: { id: actionId },
      select: MODERATION_ACTION_SELECT,
    });

    if (!action) {
      throw new NotFoundException('Esa acción de moderación no existe.');
    }
    if (action.revertedAt) {
      throw new ConflictException('Esa decisión ya fue revertida.');
    }
    if (!REVERTABLE_ACTIONS.includes(action.action)) {
      throw new BadRequestException('Esa acción no se puede revertir.');
    }

    if (action.action === ModerationActionKind.SUSPEND) {
      if (!action.subjectUserId) {
        throw new ConflictException('La acción no tiene una cuenta asociada.');
      }
      const subject = await this.prisma.user.findUnique({
        where: { id: action.subjectUserId },
        select: { id: true, role: true, status: true },
      });
      if (!subject) {
        throw new NotFoundException('La cuenta suspendida ya no existe.');
      }
      await this.assertCanModerateAccount(actor, {
        userId: subject.id,
        role: subject.role,
        status: subject.status,
        actorUserId,
        allowSuspended: true,
      });
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      // No se revierte una medida antigua si hay otra más reciente y vigente
      // sobre el mismo objetivo: reactivaría contenido que sigue moderado.
      if (action.action !== ModerationActionKind.DISMISS) {
        const newer = await tx.moderationAction.findFirst({
          where: {
            id: { not: action.id },
            revertedAt: null,
            createdAt: { gt: action.createdAt },
            ...(action.action === ModerationActionKind.SUSPEND
              ? {
                  action: ModerationActionKind.SUSPEND,
                  subjectUserId: action.subjectUserId,
                }
              : {
                  action: ModerationActionKind.HIDE,
                  targetType: action.targetType,
                  targetId: action.targetId,
                }),
          },
          select: { id: true },
        });

        if (newer) {
          throw new ConflictException(
            'Hay una decisión más reciente y vigente sobre este objetivo. Revierte esa primero.',
          );
        }
      }

      if (action.action === ModerationActionKind.HIDE) {
        await this.restoreContent(tx, action.targetType, action.targetId);
      }

      if (action.action === ModerationActionKind.SUSPEND && action.subjectUserId) {
        await tx.user.updateMany({
          where: { id: action.subjectUserId, status: 'SUSPENDED' },
          data: { status: 'ACTIVE' },
        });
      }

      if (action.reportId) {
        const expected =
          action.action === ModerationActionKind.DISMISS
            ? ReportStatus.REJECTED
            : ReportStatus.RESOLVED;
        const reopened = await tx.report.updateMany({
          where: { id: action.reportId, status: expected },
          data: { status: ReportStatus.PENDING, resolvedAt: null },
        });
        if (reopened.count === 0) {
          throw new ConflictException(
            'El reporte cambió de estado desde esta decisión; revísalo antes de revertir.',
          );
        }
      }

      const reverted = await tx.moderationAction.updateMany({
        where: { id: action.id, revertedAt: null },
        data: {
          revertedAt: now,
          revertedByUserId: actorUserId,
          revertReason: dto.reason,
        },
      });
      if (reverted.count === 0) {
        throw new ConflictException('Esa decisión ya fue revertida.');
      }

      return tx.moderationAction.findUniqueOrThrow({
        where: { id: action.id },
        select: MODERATION_ACTION_SELECT,
      });
    });

    return {
      id: updated.id,
      revertedAt: updated.revertedAt,
      reportId: updated.reportId,
    };
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

    if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.REJECTED) {
      throw new ConflictException(
        'Ese reporte ya fue resuelto. Reabre la revisión antes de moderar de nuevo.',
      );
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

    // La ruta heredada también deja rastro: ninguna decisión puede quedar sin
    // actor, motivo y fecha en el historial.
    await this.prisma.moderationAction.create({
      data: {
        reportId: report.id,
        actorUserId: adminUserId,
        action: hide ? ModerationActionKind.HIDE : ModerationActionKind.RESTORE,
        targetType: report.reportedType,
        targetId: report.reportedId,
        reason: hide
          ? 'Contenido ocultado desde la consola de moderación.'
          : 'Contenido restaurado desde la consola de moderación.',
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

    await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'ACCEPTED') {
        await this.restoreContent(tx, appeal.targetType, appeal.targetId);
        await tx.moderationAction.create({
          data: {
            reportId: appeal.reportId,
            actorUserId: adminUserId,
            action: ModerationActionKind.RESTORE,
            targetType: appeal.targetType,
            targetId: appeal.targetId,
            reason:
              dto.resolutionNote?.trim() ||
              'Apelación aceptada: contenido restaurado.',
          },
        });
      }

      await tx.appeal.update({
        where: { id: appealId },
        data: {
          status: dto.status === 'ACCEPTED' ? AppealStatus.ACCEPTED : AppealStatus.REJECTED,
          resolvedByUserId: adminUserId,
          resolvedAt: new Date(),
          resolutionNote: dto.resolutionNote ?? null,
        },
      });
    });

    await this.notifyModeration(appeal.appellantUserId, adminUserId, {
      storyId: await this.storyIdOf(appeal.targetType, appeal.targetId),
    });

    return { id: appealId, status: dto.status };
  }

  // --- Apoyo ----------------------------------------------------------------

  private async loadActor(
    actorUserId: string,
  ): Promise<{ userId: string; role: Role; status: Status }> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, role: true, status: true },
    });

    if (!actor) {
      throw new NotFoundException('Esa cuenta de moderación no existe.');
    }
    if (actor.status !== 'ACTIVE') {
      throw new ForbiddenException('Tu cuenta no está activa.');
    }
    if (actor.role !== 'MODERATOR' && actor.role !== 'ADMIN' && actor.role !== 'SUPERADMIN') {
      throw new ForbiddenException('No tienes permisos de moderación.');
    }

    return { userId: actor.id, role: actor.role, status: actor.status };
  }

  /**
   * Jerarquía de moderación de cuentas: un MODERATOR solo actúa sobre cuentas
   * USER; un ADMIN también sobre MODERATOR; solo SUPERADMIN toca a otro
   * SUPERADMIN. Nunca sobre la propia cuenta.
   */
  private async assertCanModerateAccount(
    actor: { userId: string; role: Role },
    target: {
      userId: string;
      role: Role;
      status: Status;
      actorUserId: string;
      allowSuspended?: boolean;
    },
  ): Promise<void> {
    if (target.userId === target.actorUserId || target.userId === actor.userId) {
      throw new ForbiddenException('No puedes moderar tu propia cuenta.');
    }

    if (target.status === 'DELETED') {
      throw new ConflictException('La cuenta ya no existe.');
    }

    if (!target.allowSuspended && target.status !== 'ACTIVE') {
      throw new ConflictException('La cuenta ya no está activa.');
    }

    const allowed =
      actor.role === 'SUPERADMIN' ||
      (actor.role === 'ADMIN' && ROLE_RANK[target.role] <= ROLE_RANK.MODERATOR) ||
      (actor.role === 'MODERATOR' && target.role === 'USER');

    if (!allowed) {
      throw new ForbiddenException(
        'No tienes autoridad para moderar una cuenta con ese rol.',
      );
    }
  }

  /** Resuelve la cuenta autora y el estado del objetivo de una decisión. */
  private async resolveDecisionTarget(
    reportedType: string,
    reportedId: string,
    action: 'HIDE' | 'SUSPEND',
  ): Promise<DecisionTarget> {
    if (action === 'HIDE' && reportedType !== 'STORY' && reportedType !== 'COMMENT') {
      throw new BadRequestException('Solo se pueden ocultar relatos y comentarios.');
    }

    if (reportedType === 'STORY') {
      const story = await this.prisma.story.findUnique({
        where: { id: reportedId },
        select: {
          id: true,
          status: true,
          character: {
            select: {
              userId: true,
              user: { select: { role: true, status: true } },
            },
          },
        },
      });
      if (!story) {
        throw new NotFoundException('Ese relato no existe.');
      }
      return {
        userId: story.character.userId,
        role: story.character.user.role,
        status: story.character.user.status,
        targetStatus: story.status,
        storyId: story.id,
      };
    }

    if (reportedType === 'COMMENT') {
      const comment = await this.prisma.comment.findUnique({
        where: { id: reportedId },
        select: {
          id: true,
          status: true,
          storyId: true,
          character: {
            select: {
              userId: true,
              user: { select: { role: true, status: true } },
            },
          },
        },
      });
      if (!comment) {
        throw new NotFoundException('Ese comentario no existe.');
      }
      return {
        userId: comment.character.userId,
        role: comment.character.user.role,
        status: comment.character.user.status,
        targetStatus: comment.status,
        storyId: comment.storyId,
      };
    }

    if (reportedType === 'CHARACTER') {
      const character = await this.prisma.character.findUnique({
        where: { id: reportedId },
        select: {
          userId: true,
          user: { select: { role: true, status: true } },
        },
      });
      if (!character) {
        throw new NotFoundException('Ese personaje no existe.');
      }
      return {
        userId: character.userId,
        role: character.user.role,
        status: character.user.status,
        targetStatus: null,
        storyId: null,
      };
    }

    if (reportedType === 'USER') {
      const user = await this.prisma.user.findUnique({
        where: { id: reportedId },
        select: { id: true, role: true, status: true },
      });
      if (!user) {
        throw new NotFoundException('Esa cuenta no existe.');
      }
      return {
        userId: user.id,
        role: user.role,
        status: user.status,
        targetStatus: null,
        storyId: null,
      };
    }

    if (reportedType === 'CREATION') {
      const creation = await this.prisma.creation.findUnique({
        where: { id: reportedId },
        select: {
          userId: true,
          user: { select: { role: true, status: true } },
        },
      });
      if (!creation) {
        throw new NotFoundException('Esa creación no existe.');
      }
      return {
        userId: creation.userId,
        role: creation.user.role,
        status: creation.user.status,
        targetStatus: null,
        storyId: null,
      };
    }

    throw new BadRequestException('Ese tipo de contenido no se puede moderar.');
  }

  private async restoreContent(
    tx: Prisma.TransactionClient,
    targetType: string | null,
    targetId: string | null,
  ): Promise<void> {
    if (!targetType || !targetId) {
      throw new ConflictException('La acción no tiene un objetivo que restaurar.');
    }

    if (targetType === 'STORY') {
      const story = await tx.story.findUnique({
        where: { id: targetId },
        select: { status: true },
      });
      if (!story) {
        throw new NotFoundException('Ese relato ya no existe.');
      }
      if (
        story.status === StoryStatus.DELETED ||
        story.status === StoryStatus.WITHDRAWN ||
        story.status === StoryStatus.DRAFT
      ) {
        throw new ConflictException(
          'El relato fue retirado o eliminado: no se puede volver a publicar desde moderación.',
        );
      }
      if (story.status !== StoryStatus.PUBLISHED) {
        await tx.story.update({
          where: { id: targetId },
          data: { status: StoryStatus.PUBLISHED, updatedAt: new Date() },
        });
      }
      return;
    }

    if (targetType === 'COMMENT') {
      const comment = await tx.comment.findUnique({
        where: { id: targetId },
        select: { status: true },
      });
      if (!comment) {
        throw new NotFoundException('Ese comentario ya no existe.');
      }
      if (comment.status === CommentStatus.DELETED) {
        throw new ConflictException('Ese comentario ya no está disponible.');
      }
      if (comment.status !== CommentStatus.ACTIVE) {
        await tx.comment.update({
          where: { id: targetId },
          data: { status: CommentStatus.ACTIVE },
        });
      }
      return;
    }

    throw new BadRequestException('Ese tipo de contenido no se puede restaurar.');
  }

  private toActionView(
    row: ModerationActionRow,
    targets: Map<string, TargetSummary>,
    actors: Map<string, string>,
    reverters: Map<string, string>,
  ): ModerationActionView {
    return {
      id: row.id,
      reportId: row.reportId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      createdAt: row.createdAt,
      revertedAt: row.revertedAt,
      revertReason: row.revertReason,
      actorCharacterName: actors.get(row.actorUserId) ?? null,
      revertedByCharacterName: row.revertedByUserId
        ? reverters.get(row.revertedByUserId) ?? null
        : null,
      target:
        row.targetType && row.targetId
          ? targets.get(`${row.targetType}:${row.targetId}`) ?? null
          : null,
      canRevert: !row.revertedAt && REVERTABLE_ACTIONS.includes(row.action),
    };
  }

  private async moderateStory(adminUserId: string, storyId: string, hide: boolean): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, status: true, character: { select: { userId: true } } },
    });
    if (!story) {
      throw new NotFoundException('Ese relato no existe.');
    }
    if (story.status === StoryStatus.DELETED || story.status === StoryStatus.WITHDRAWN) {
      throw new ConflictException('Ese relato ya no está disponible.');
    }

    if (
      !hide &&
      story.status !== StoryStatus.HIDDEN &&
      story.status !== StoryStatus.MODERATED &&
      story.status !== StoryStatus.REPORTED
    ) {
      throw new ConflictException('Ese relato no está oculto por moderación.');
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

    if (!hide && comment.status !== CommentStatus.HIDDEN && comment.status !== CommentStatus.MODERATED) {
      throw new ConflictException('Ese comentario no está oculto por moderación.');
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
    const idsOf = (type: string) => [
      ...new Set(refs.filter((ref) => ref.type === type).map((ref) => ref.id)),
    ];

    const storyIds = idsOf('STORY');
    const commentIds = idsOf('COMMENT');
    const characterIds = idsOf('CHARACTER');
    const userIds = idsOf('USER');
    const creationIds = idsOf('CREATION');

    const [stories, comments, characters, users, creations] = await Promise.all([
      storyIds.length > 0
        ? this.prisma.story.findMany({
            where: { id: { in: storyIds } },
            select: {
              id: true,
              title: true,
              status: true,
              character: { select: { name: true } },
              updates: {
                orderBy: { stageOrder: 'asc' },
                take: 1,
                select: { content: true },
              },
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
      characterIds.length > 0
        ? this.prisma.character.findMany({
            where: { id: { in: characterIds } },
            select: {
              id: true,
              name: true,
              user: { select: { status: true } },
            },
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              status: true,
              // Nunca se envía el correo al panel: solo el seudónimo público.
              character: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      creationIds.length > 0
        ? this.prisma.creation.findMany({
            where: { id: { in: creationIds } },
            select: {
              id: true,
              title: true,
              content: true,
              user: { select: { character: { select: { name: true } } } },
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
        context: this.snippet(story.updates?.[0]?.content ?? ''),
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
        context: this.snippet(comment.content),
      });
    }
    for (const character of characters) {
      map.set(`CHARACTER:${character.id}`, {
        id: character.id,
        type: 'CHARACTER',
        title: character.name,
        authorName: character.name,
        status: character.user.status,
        storyId: null,
        context: null,
      });
    }
    for (const user of users) {
      map.set(`USER:${user.id}`, {
        id: user.id,
        type: 'USER',
        title: user.character?.name ? `Cuenta de ${user.character.name}` : 'Cuenta sin personaje',
        authorName: user.character?.name ?? null,
        status: user.status,
        storyId: null,
        context: null,
      });
    }
    for (const creation of creations) {
      map.set(`CREATION:${creation.id}`, {
        id: creation.id,
        type: 'CREATION',
        title: creation.title,
        authorName: creation.user.character?.name ?? null,
        status: null,
        storyId: null,
        context: this.snippet(creation.content),
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
