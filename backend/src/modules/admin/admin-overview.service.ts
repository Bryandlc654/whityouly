import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ROLE_KEYS = ['USER', 'MODERATOR', 'ADMIN', 'SUPERADMIN'] as const;

export interface AdminOverview {
  users: {
    total: number;
    active: number;
    suspended: number;
    verified: number;
    byRole: Record<(typeof ROLE_KEYS)[number], number>;
    newLast7Days: number;
  };
  content: {
    stories: number;
    publishedStories: number;
    comments: number;
    characters: number;
    media: { count: number; bytes: number };
  };
  moderation: {
    reportsPending: number;
    reportsInReview: number;
    appealsPending: number;
    actionsLast7Days: number;
  };
  support: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  recent: {
    users: Array<{
      id: string;
      email: string;
      role: string;
      status: string;
      createdAt: Date;
    }>;
    actions: Array<{
      id: string;
      action: string;
      targetType: string | null;
      reason: string;
      createdAt: Date;
      actorEmail: string | null;
      subjectEmail: string | null;
    }>;
  };
}

/**
 * Métricas de la instancia para la portada del panel. Son recuentos directos y
 * acotados: no recorren tablas completas ni exponen datos personales más allá
 * del correo de quien actúa en la auditoría.
 */
@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AdminOverview> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      verifiedUsers,
      newUsers,
      userRole,
      moderatorRole,
      adminRole,
      superadminRole,
      totalStories,
      publishedStories,
      totalComments,
      totalCharacters,
      media,
      reportsPending,
      reportsInReview,
      appealsPending,
      actionsLast7Days,
      supportOpen,
      supportInProgress,
      supportResolved,
      supportClosed,
      recentUsers,
      recentActions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { isEmailVerified: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.user.count({ where: { role: 'MODERATOR' } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { role: 'SUPERADMIN' } }),
      this.prisma.story.count(),
      this.prisma.story.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.comment.count(),
      this.prisma.character.count(),
      this.prisma.mediaAsset.aggregate({ _count: { _all: true }, _sum: { sizeBytes: true } }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.appeal.count({ where: { status: 'PENDING' } }),
      this.prisma.moderationAction.count({ where: { createdAt: { gte: since } } }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
      this.prisma.user.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: { id: true, email: true, role: true, status: true, createdAt: true },
      }),
      this.prisma.moderationAction.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 6,
        select: {
          id: true,
          action: true,
          targetType: true,
          reason: true,
          createdAt: true,
          actor: { select: { email: true } },
          subject: { select: { email: true } },
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        verified: verifiedUsers,
        byRole: {
          USER: userRole,
          MODERATOR: moderatorRole,
          ADMIN: adminRole,
          SUPERADMIN: superadminRole,
        },
        newLast7Days: newUsers,
      },
      content: {
        stories: totalStories,
        publishedStories,
        comments: totalComments,
        characters: totalCharacters,
        media: {
          count: media._count._all,
          bytes: Number(media._sum.sizeBytes ?? 0n),
        },
      },
      moderation: {
        reportsPending,
        reportsInReview,
        appealsPending,
        actionsLast7Days,
      },
      support: {
        open: supportOpen,
        inProgress: supportInProgress,
        resolved: supportResolved,
        closed: supportClosed,
      },
      recent: {
        users: recentUsers,
        actions: recentActions.map((row) => ({
          id: row.id,
          action: row.action,
          targetType: row.targetType,
          reason: row.reason,
          createdAt: row.createdAt,
          actorEmail: row.actor?.email ?? null,
          subjectEmail: row.subject?.email ?? null,
        })),
      },
    };
  }
}
