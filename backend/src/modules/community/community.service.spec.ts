import { Test, TestingModule } from '@nestjs/testing';
import { CommunityService } from './community.service';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60_000;

describe('CommunityService', () => {
  let service: CommunityService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { emotionalLog: { findMany: vi.fn().mockResolvedValue([]) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CommunityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
  });

  const row = (userId: string, name: string, intensity: number, loggedAt: Date) => ({
    userId,
    intensity,
    loggedAt,
    emotion: { name, colorHex: '#123456' },
  });

  it('oculta todos los agregados cuando hay menos personas que el mínimo', async () => {
    const now = new Date();
    prisma.emotionalLog.findMany.mockResolvedValue([
      row('u1', 'Calma', 6, now),
      row('u2', 'Calma', 6, now),
      row('u3', 'Calma', 6, now),
    ]);

    const result = await service.pulse({ days: 7, tzOffsetMinutes: 0 });

    expect(result.privacy.suppressed).toBe(true);
    expect(result.privacy.participants).toBe(3);
    expect(result.emotions).toEqual([]);
    expect(result.days).toEqual([]);
    expect(result.totalEntries).toBe(0);
    expect(result.privacy.note).toContain('5');
  });

  it('agrega por emoción y omite las que no alcanzan el mínimo de personas', async () => {
    const now = new Date();
    prisma.emotionalLog.findMany.mockResolvedValue([
      row('u1', 'Calma', 6, now),
      row('u2', 'Calma', 6, now),
      row('u3', 'Calma', 6, now),
      row('u4', 'Calma', 6, now),
      row('u5', 'Calma', 6, now),
      row('u1', 'Ansiedad', 5, new Date(now.getTime() - 2 * DAY_MS)),
      row('u2', 'Ansiedad', 5, new Date(now.getTime() - 2 * DAY_MS)),
      row('u3', 'Ansiedad', 5, new Date(now.getTime() - 2 * DAY_MS)),
    ]);

    const result = await service.pulse({ days: 7, tzOffsetMinutes: 0 });

    expect(result.privacy.suppressed).toBe(false);
    expect(result.privacy.participants).toBe(5);
    // 'Ansiedad' solo lo registraron 3 personas: se omite entero.
    expect(result.emotions).toHaveLength(1);
    expect(result.emotions[0]).toMatchObject({ name: 'Calma', count: 5, participants: 5 });
    expect(result.dominantEmotion).toEqual({ name: 'Calma', colorHex: '#123456' });
    // Solo se cuentan los registros publicables.
    expect(result.totalEntries).toBe(5);
    // Promedio sobre todas las filas de la ventana (5*6 + 3*5) / 8.
    expect(result.averageIntensity).toBe(5.63);
  });

  it('suprime los días que no alcanzan el mínimo de personas', async () => {
    const now = new Date();
    prisma.emotionalLog.findMany.mockResolvedValue([
      row('u1', 'Calma', 6, now),
      row('u2', 'Calma', 6, now),
      row('u3', 'Calma', 6, now),
      row('u4', 'Calma', 6, now),
      row('u5', 'Calma', 6, now),
      row('u1', 'Tristeza', 3, new Date(now.getTime() - 3 * DAY_MS)),
      row('u2', 'Tristeza', 3, new Date(now.getTime() - 3 * DAY_MS)),
    ]);

    const result = await service.pulse({ days: 7, tzOffsetMinutes: 0 });

    const today = new Date(now.getTime()).toISOString().slice(0, 10);
    const oldDay = new Date(now.getTime() - 3 * DAY_MS).toISOString().slice(0, 10);
    const todayBucket = result.days.find((day) => day.date === today);
    const oldBucket = result.days.find((day) => day.date === oldDay);

    expect(todayBucket?.suppressed).toBe(false);
    expect(todayBucket?.entries).toBe(5);
    expect(oldBucket?.suppressed).toBe(true);
    expect(oldBucket?.entries).toBe(0);
    expect(oldBucket?.emotion).toBeNull();
  });
});
