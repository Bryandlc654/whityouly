import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AdminAuditInput {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Registro central de acciones administrativas que no pasan por el flujo de
 * moderación: cambios de rol/estado, catálogo, destacados, archivos y soporte.
 * Un fallo al escribir la auditoría no revierte la acción, pero queda en el log
 * del proceso para poder detectarlo.
 */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AdminAuditInput): Promise<void> {
    try {
      const metadata = input.metadata
        ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
        : undefined;

      await this.prisma.adminAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          metadata,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`No se pudo registrar la auditoría ${input.action}: ${(error as Error).message}`);
    }
  }

  async list(limit = 50, cursor?: string) {
    const parsed = Number(limit);
    const take = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 50, 1), 100);
    const rows = await this.prisma.adminAuditLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        actor: { select: { email: true } },
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((row) => ({
        ...row,
        actorEmail: row.actor.email,
        actor: undefined,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}
