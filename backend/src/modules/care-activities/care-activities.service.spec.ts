import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CareActivityStatus, CareActivityType } from '@prisma/client';
import { CareActivitiesService } from './care-activities.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DiaryService } from '../diary/diary.service';
import { TreeService } from '../tree/tree.service';

describe('CareActivitiesService', () => {
  let service: CareActivitiesService;
  let prisma: any;
  let tree: { award: ReturnType<typeof vi.fn> };
  let diary: { upsertCareNote: ReturnType<typeof vi.fn> };

  const baseRow = {
    id: 'activity-1',
    userId: 'user-1',
    activity: CareActivityType.BREATHING,
    status: CareActivityStatus.COMPLETED,
    reflection: null,
    outcome: null,
    metadata: null,
    completedAt: new Date('2026-11-01T12:00:00.000Z'),
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
    updatedAt: new Date('2026-11-01T12:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      careActivity: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
    };
    tree = { award: vi.fn().mockResolvedValue(true) };
    diary = { upsertCareNote: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareActivitiesService,
        { provide: PrismaService, useValue: prisma },
        { provide: TreeService, useValue: tree },
        { provide: DiaryService, useValue: diary },
      ],
    }).compile();

    service = module.get<CareActivitiesService>(CareActivitiesService);
  });

  it('registra una actividad completada y concede una gota de cuidado', async () => {
    prisma.careActivity.create.mockResolvedValue(baseRow);

    const result = await service.create('user-1', { activity: CareActivityType.BREATHING });

    expect(prisma.careActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          activity: CareActivityType.BREATHING,
          status: CareActivityStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(tree.award).toHaveBeenCalledWith('user-1', 'CARE_EXPRESSION', 'care_activity');
    expect(result.treeDropAwarded).toBe(true);
  });

  it('guarda la reflexion como nota del diario privado', async () => {
    prisma.careActivity.create.mockResolvedValue({
      ...baseRow,
      activity: CareActivityType.VENT,
      reflection: 'Necesitaba soltarlo.',
    });

    await service.create('user-1', {
      activity: CareActivityType.VENT,
      reflection: 'Necesitaba soltarlo.',
    });

    expect(diary.upsertCareNote).toHaveBeenCalledWith(
      'user-1',
      'activity-1',
      'Desahogo privado',
      'Necesitaba soltarlo.',
    );
  });
  it('guarda un paso pendiente sin conceder la gota todavía', async () => {
    prisma.careActivity.create.mockResolvedValue({
      ...baseRow,
      status: CareActivityStatus.PLANNED,
      completedAt: null,
    });

    const result = await service.create('user-1', {
      activity: CareActivityType.SMALL_STEP,
      status: CareActivityStatus.PLANNED,
      metadata: { action: 'Beber agua' },
    });

    expect(tree.award).not.toHaveBeenCalled();
    expect(result.treeDropAwarded).toBe(false);
    expect(result.status).toBe(CareActivityStatus.PLANNED);
  });

  it('concede la gota cuando un paso pendiente se completa', async () => {
    prisma.careActivity.findFirst.mockResolvedValue({
      id: 'activity-1',
      status: CareActivityStatus.PLANNED,
    });
    prisma.careActivity.update.mockResolvedValue(baseRow);

    const result = await service.update('user-1', 'activity-1', {
      status: CareActivityStatus.COMPLETED,
    });

    expect(tree.award).toHaveBeenCalledWith('user-1', 'CARE_EXPRESSION', 'care_activity');
    expect(result.treeDropAwarded).toBe(true);
    expect(result.status).toBe(CareActivityStatus.COMPLETED);
  });

  it('no permite volver a pendiente una actividad completada', async () => {
    prisma.careActivity.findFirst.mockResolvedValue({
      id: 'activity-1',
      status: CareActivityStatus.COMPLETED,
    });

    await expect(
      service.update('user-1', 'activity-1', { status: CareActivityStatus.PLANNED }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.careActivity.update).not.toHaveBeenCalled();
  });

  it('rechaza un contexto privado demasiado grande', async () => {
    await expect(
      service.create('user-1', {
        activity: CareActivityType.VENT,
        metadata: { text: 'x'.repeat(9000) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.careActivity.create).not.toHaveBeenCalled();
  });
});
