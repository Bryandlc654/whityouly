import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmotionalMapService } from './emotional-map.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../../common/quota/quota.service';

describe('EmotionalMapService', () => {
  let service: EmotionalMapService;
  let prisma: any;
  let quota: { consume: ReturnType<typeof vi.fn> };

  const emotionRow = { id: 'emo-1', name: 'Esperanza', colorHex: '#37a978' };

  beforeEach(async () => {
    prisma = {
      emotion: { findFirst: vi.fn().mockResolvedValue(emotionRow) },
      emotionalLog: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ id: 'log-1', userId: 'user-1' }),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue({}),
      },
    };

    quota = { consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmotionalMapService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuotaService, useValue: quota },
      ],
    }).compile();

    service = module.get<EmotionalMapService>(EmotionalMapService);
  });

  it('registra una emoción del catálogo con notas saneadas', async () => {
    prisma.emotionalLog.create.mockResolvedValue({
      id: 'log-1',
      intensity: 7,
      contextNote: 'Me sentí escuchada.',
      loggedAt: new Date('2026-10-16T10:00:00.000Z'),
      createdAt: new Date('2026-10-16T10:00:00.000Z'),
      emotion: emotionRow,
    });

    const result = await service.create('user-1', {
      emotion: 'esperanza',
      intensity: 7,
      contextNote: '  Me sentí\u200b escuchada.  ',
    });

    expect(prisma.emotion.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'esperanza', mode: 'insensitive' } },
      select: { id: true, name: true, colorHex: true },
    });
    expect(prisma.emotionalLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          emotionId: 'emo-1',
          intensity: 7,
          contextNote: 'Me sentí escuchada.',
        }),
      }),
    );
    expect(result.emotion.name).toBe('Esperanza');
    expect(result.intensity).toBe(7);
  });

  it('rechaza una emoción que no está en el catálogo', async () => {
    prisma.emotion.findFirst.mockResolvedValue(null);

    await expect(
      service.create('user-1', { emotion: 'Euforia', intensity: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.emotionalLog.create).not.toHaveBeenCalled();
  });

  it('no permite registrar en el futuro', async () => {
    const future = new Date(Date.now() + 60 * 60_000).toISOString();

    await expect(
      service.create('user-1', { emotion: 'Esperanza', intensity: 5, loggedAt: future }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('frena al alcanzar el máximo de registros', async () => {
    prisma.emotionalLog.count.mockResolvedValue(5000);

    await expect(
      service.create('user-1', { emotion: 'Esperanza', intensity: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lista por cursor y devuelve la siguiente página', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: `log-${index}`,
      intensity: 5,
      contextNote: null,
      loggedAt: new Date(),
      createdAt: new Date(),
      emotion: emotionRow,
    }));
    prisma.emotionalLog.findMany.mockResolvedValue(rows);

    const result = await service.list('user-1', { limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('log-1');
    expect(prisma.emotionalLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }] }),
    );
  });

  it('agrega el mapa por día local, emoción dominante y racha', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));

    try {
      prisma.emotionalLog.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-10-16T09:00:00.000Z'), intensity: 8, emotion: emotionRow },
        { loggedAt: new Date('2026-10-16T20:00:00.000Z'), intensity: 6, emotion: emotionRow },
        {
          loggedAt: new Date('2026-10-15T10:00:00.000Z'),
          intensity: 4,
          emotion: { id: 'emo-2', name: 'Tristeza', colorHex: '#4b83e5' },
        },
      ]);

      const summary = await service.summary('user-1', { days: 3, tzOffsetMinutes: 0 });

      expect(summary.days).toHaveLength(3);
      expect(summary.days[2]).toEqual({
        date: '2026-10-16',
        entries: 2,
        averageIntensity: 7,
        emotion: { name: 'Esperanza', colorHex: '#37a978' },
      });
      expect(summary.days[1].emotion?.name).toBe('Tristeza');
      expect(summary.days[0].entries).toBe(0);
      expect(summary.totalEntries).toBe(3);
      expect(summary.averageIntensity).toBe(6);
      expect(summary.currentStreak).toBe(2);
      expect(summary.emotions[0]).toEqual({
        name: 'Esperanza',
        colorHex: '#37a978',
        count: 2,
        averageIntensity: 7,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('no deja editar un registro de otra persona', async () => {
    prisma.emotionalLog.findUnique.mockResolvedValue({ id: 'log-1', userId: 'otro' });

    await expect(service.update('user-1', 'log-1', { intensity: 3 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.emotionalLog.update).not.toHaveBeenCalled();
  });

  it('actualiza solo los campos enviados', async () => {
    prisma.emotionalLog.update.mockResolvedValue({
      id: 'log-1',
      intensity: 3,
      contextNote: null,
      loggedAt: new Date(),
      createdAt: new Date(),
      emotion: emotionRow,
    });

    await service.update('user-1', 'log-1', { intensity: 3, contextNote: '' });

    expect(prisma.emotionalLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: { intensity: 3, contextNote: null },
      select: expect.anything(),
    });
  });

  it('elimina un registro propio', async () => {
    const result = await service.remove('user-1', 'log-1');

    expect(prisma.emotionalLog.delete).toHaveBeenCalledWith({ where: { id: 'log-1' } });
    expect(result).toEqual({ id: 'log-1' });
  });
});
