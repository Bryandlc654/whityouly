import { Injectable } from '@nestjs/common';
import { ModerationActionKind, ReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListMyReportsQueryDto } from './dto/reports.dto';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface ReportTargetSummary {
  type: string;
  title: string | null;
  authorName: string | null;
  status: string | null;
}

export interface MyReportView {
  id: string;
  reportedType: string;
  reportedId: string;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  /** Texto público de la resolución, sin motivos internos de moderación. */
  resolution: string | null;
  action: ModerationActionKind | null;
  target: ReportTargetSummary | null;
}

/**
 * Seguimiento de los reportes que escribió una persona. Nunca expone motivos
 * internos de moderación ni el contenido de publicaciones retiradas; solo el
 * estado del caso, el motivo que la propia persona escribió y un resumen
 * público de la decisión.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, query: ListMyReportsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.report.findMany({
      where: {
        reporterUserId: userId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        reportedType: true,
        reportedId: true,
        reason: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    const [targets, actions] = await Promise.all([
      this.describeTargets(
        page.map((row) => ({ type: row.reportedType, id: row.reportedId })),
      ),
      this.latestActions(page.map((row) => row.id)),
    ]);

    return {
      items: page.map((row): MyReportView => {
        const action = actions.get(row.id) ?? null;
        return {
          id: row.id,
          reportedType: row.reportedType,
          reportedId: row.reportedId,
          reason: row.reason,
          status: row.status,
          createdAt: row.createdAt,
          resolvedAt: row.resolvedAt,
          resolution: this.resolutionFor(row.status, action),
          action,
          target: targets.get(`${row.reportedType}:${row.reportedId}`) ?? null,
        };
      }),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Última acción vigente por reporte. Las revertidas no se muestran: el
   * reporte vuelve a estar pendiente y su resolución ya no aplica.
   */
  private async latestActions(reportIds: string[]): Promise<Map<string, ModerationActionKind>> {
    if (reportIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.moderationAction.findMany({
      where: { reportId: { in: reportIds }, revertedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { reportId: true, action: true },
    });

    const map = new Map<string, ModerationActionKind>();
    for (const row of rows) {
      if (row.reportId && !map.has(row.reportId)) {
        map.set(row.reportId, row.action);
      }
    }
    return map;
  }

  private resolutionFor(
    status: ReportStatus,
    action: ModerationActionKind | null,
  ): string | null {
    if (status === ReportStatus.PENDING || status === ReportStatus.IN_REVIEW) {
      return null;
    }

    if (action === ModerationActionKind.HIDE) {
      return 'El contenido reportado fue ocultado por moderación.';
    }
    if (action === ModerationActionKind.SUSPEND) {
      return 'Se suspendió la cuenta del perfil reportado.';
    }
    if (action === ModerationActionKind.RESTORE) {
      return 'El contenido fue restaurado tras una apelación.';
    }
    if (action === ModerationActionKind.DISMISS) {
      return 'Se revisó y no se aplicó ninguna medida.';
    }

    return status === ReportStatus.RESOLVED
      ? 'Revisado por moderación.'
      : 'Se revisó y no se aplicó ninguna medida.';
  }

  /**
   * Resumen mínimo del objetivo. El título solo se expone si el contenido sigue
   * publicado: un relato oculto, retirado o eliminado no vuelve a mostrarse por
   * la pantalla de seguimiento.
   */
  private async describeTargets(
    refs: { type: string; id: string }[],
  ): Promise<Map<string, ReportTargetSummary>> {
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
            },
          })
        : Promise.resolve([]),
      commentIds.length > 0
        ? this.prisma.comment.findMany({
            where: { id: { in: commentIds } },
            select: {
              id: true,
              status: true,
              character: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      characterIds.length > 0
        ? this.prisma.character.findMany({
            where: { id: { in: characterIds } },
            select: { id: true, name: true, user: { select: { status: true } } },
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              status: true,
              // El seudónimo público es suficiente; el correo nunca sale de aquí.
              character: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      creationIds.length > 0
        ? this.prisma.creation.findMany({
            where: { id: { in: creationIds } },
            select: { id: true, title: true, visibility: true },
          })
        : Promise.resolve([]),
    ]);

    const map = new Map<string, ReportTargetSummary>();
    for (const story of stories) {
      map.set(`STORY:${story.id}`, {
        type: 'STORY',
        title: story.status === 'PUBLISHED' ? story.title : null,
        authorName: story.character?.name ?? null,
        status: story.status,
      });
    }
    for (const comment of comments) {
      map.set(`COMMENT:${comment.id}`, {
        type: 'COMMENT',
        title: null,
        authorName: comment.character?.name ?? null,
        status: comment.status,
      });
    }
    for (const character of characters) {
      map.set(`CHARACTER:${character.id}`, {
        type: 'CHARACTER',
        title: character.name,
        authorName: character.name,
        status: character.user.status,
      });
    }
    for (const user of users) {
      map.set(`USER:${user.id}`, {
        type: 'USER',
        title: null,
        authorName: user.character?.name ?? null,
        status: user.status,
      });
    }
    for (const creation of creations) {
      map.set(`CREATION:${creation.id}`, {
        type: 'CREATION',
        title: creation.visibility === 'PUBLIC' ? creation.title : null,
        authorName: null,
        status: null,
      });
    }
    return map;
  }
}
