import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CareActivityStatus, Prisma, TreePath } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DiaryService } from '../diary/diary.service';
import { TreeService } from '../tree/tree.service';
import { CreateCareActivityDto, UpdateCareActivityDto } from './dto/care-activity.dto';

const MAX_METADATA_LENGTH = 8000;

const CARE_NOTE_TITLES: Record<string, string> = {
  BREATHING: 'Calma tu mente',
  UNRAVEL: 'Desenreda lo que sientes',
  SMALL_STEP: 'Un paso posible',
  VENT: 'Desahogo privado',
  COMPANY: 'Compañía',
  DISTRACT: 'Cambiar de foco',
};

@Injectable()
export class CareActivitiesService {
  private readonly logger = new Logger(CareActivitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tree: TreeService,
    private readonly diary: DiaryService,
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.careActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return { items: rows.map((row) => this.toView(row)) };
  }

  async create(userId: string, dto: CreateCareActivityDto) {
    const status = dto.status ?? CareActivityStatus.COMPLETED;
    const completedAt = status === CareActivityStatus.COMPLETED ? new Date() : null;

    const row = await this.prisma.careActivity.create({
      data: {
        userId,
        activity: dto.activity,
        status,
        reflection: dto.reflection ? dto.reflection : null,
        outcome: dto.outcome ? dto.outcome : null,
        metadata: this.metadata(dto.metadata),
        completedAt,
      },
    });

    const treeDropAwarded =
      status === CareActivityStatus.COMPLETED
        ? await this.tree.award(userId, TreePath.CARE_EXPRESSION, 'care_activity')
        : false;

    await this.saveDiaryNote(userId, row.id, row.activity, row.reflection);
    return this.toView(row, treeDropAwarded);
  }

  async update(userId: string, activityId: string, dto: UpdateCareActivityDto) {
    const current = await this.requireOwned(userId, activityId);

    if (current.status === CareActivityStatus.COMPLETED && dto.status === CareActivityStatus.PLANNED) {
      throw new BadRequestException('Una actividad completada no puede volver a quedar pendiente.');
    }

    const becomingComplete =
      current.status !== CareActivityStatus.COMPLETED && dto.status === CareActivityStatus.COMPLETED;

    const row = await this.prisma.careActivity.update({
      where: { id: activityId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.reflection !== undefined ? { reflection: dto.reflection } : {}),
        ...(dto.outcome !== undefined ? { outcome: dto.outcome } : {}),
        ...(dto.metadata !== undefined ? { metadata: this.metadata(dto.metadata) } : {}),
        ...(becomingComplete ? { completedAt: new Date() } : {}),
      },
    });

    const treeDropAwarded = becomingComplete
      ? await this.tree.award(userId, TreePath.CARE_EXPRESSION, 'care_activity')
      : false;

    await this.saveDiaryNote(userId, row.id, row.activity, row.reflection);
    return this.toView(row, treeDropAwarded);
  }

  private async saveDiaryNote(
    userId: string,
    activityId: string,
    activity: string,
    reflection: string | null,
  ): Promise<void> {
    if (!reflection?.trim()) return;
    try {
      await this.diary.upsertCareNote(
        userId,
        activityId,
        CARE_NOTE_TITLES[activity] ?? 'Reflexion de Cuidarme',
        reflection,
      );
    } catch (error) {
      this.logger.warn(`No se pudo guardar la reflexion en el diario: ${(error as Error).message}`);
    }
  }
  private async requireOwned(userId: string, activityId: string) {
    const row = await this.prisma.careActivity.findFirst({
      where: { id: activityId, userId },
      select: { id: true, status: true },
    });
    if (!row) throw new NotFoundException('Esa actividad no existe.');
    return row;
  }

  private metadata(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_METADATA_LENGTH) {
      throw new BadRequestException('El contexto de la actividad es demasiado largo.');
    }
    return value as Prisma.InputJsonValue;
  }

  private toView(
    row: {
      id: string;
      activity: string;
      status: CareActivityStatus;
      reflection: string | null;
      outcome: string | null;
      metadata: Prisma.JsonValue | null;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    treeDropAwarded?: boolean,
  ) {
    return {
      id: row.id,
      activity: row.activity,
      status: row.status,
      reflection: row.reflection,
      outcome: row.outcome,
      metadata: row.metadata,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(treeDropAwarded === undefined ? {} : { treeDropAwarded }),
    };
  }
}
