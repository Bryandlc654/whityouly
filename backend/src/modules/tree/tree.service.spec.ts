import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, TreePath } from '@prisma/client';
import { TreeService } from './tree.service';
import { PrismaService } from '../../prisma/prisma.service';

function utcDay(offsetDays = 0): Date {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(base.getTime() + offsetDays * 24 * 60 * 60_000);
}

function conflictError() {
  return new Prisma.PrismaClientKnownRequestError('duplicado', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('TreeService', () => {
  let service: TreeService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      treeDrop: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      character: { findUnique: vi.fn().mockResolvedValue(null) },
      emotionalLog: { count: vi.fn().mockResolvedValue(0) },
      story: { count: vi.fn().mockResolvedValue(0) },
      storyUpdate: { count: vi.fn().mockResolvedValue(0) },
      companionship: { count: vi.fn().mockResolvedValue(0) },
      commentHelpful: { count: vi.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TreeService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TreeService>(TreeService);
  });

  describe('award', () => {
    it('crea la gota del día', async () => {
      prisma.treeDrop.create.mockResolvedValue({ id: 'd1' });

      const created = await service.award('u1', TreePath.SELF_KNOWLEDGE, 'emotional_log');

      expect(created).toBe(true);
      expect(prisma.treeDrop.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', path: TreePath.SELF_KNOWLEDGE, sourceType: 'emotional_log' }),
      });
    });

    it('no falla si la gota del día ya existía (una por camino al día)', async () => {
      prisma.treeDrop.create.mockRejectedValue(conflictError());

      await expect(service.award('u1', TreePath.SELF_KNOWLEDGE)).resolves.toBe(false);
    });

    it('no propaga otros errores de base de datos', async () => {
      prisma.treeDrop.create.mockRejectedValue(new Error('db caída'));

      await expect(service.award('u1', TreePath.ACCOMPANIMENT)).resolves.toBe(false);
    });
  });

  describe('getTree', () => {
    it('sin gotas: la etapa es semilla sin brotar', async () => {
      const tree = await service.getTree('u1');

      expect(tree.totalDrops).toBe(0);
      expect(tree.stage.reached).toBe(false);
      expect(tree.stage.label).toBe('Semilla');
      expect(tree.today.earned).toBe(0);
      expect(tree.today.complete).toBe(false);
    });

    it('calcula la etapa alcanzada y el progreso hacia la siguiente', async () => {
      prisma.treeDrop.findMany.mockResolvedValue([
        { path: TreePath.SELF_KNOWLEDGE, day: utcDay(0) },
        { path: TreePath.CARE_EXPRESSION, day: utcDay(0) },
        { path: TreePath.ACCOMPANIMENT, day: utcDay(0) },
        { path: TreePath.SELF_KNOWLEDGE, day: utcDay(-1) },
        { path: TreePath.SELF_KNOWLEDGE, day: utcDay(-2) },
      ]);

      const tree = await service.getTree('u1');

      expect(tree.totalDrops).toBe(5);
      expect(tree.stage.reached).toBe(true);
      expect(tree.stage.label).toBe('Brote');
      expect(tree.stage.nextLabel).toBe('Tallo');
      expect(tree.stage.nextDrops).toBe(15);
      expect(tree.stage.progress).toBe(0);
    });

    it('marca los tres caminos de hoy y el camino completo', async () => {
      prisma.treeDrop.findMany.mockResolvedValue([
        { path: TreePath.SELF_KNOWLEDGE, day: utcDay(0) },
        { path: TreePath.CARE_EXPRESSION, day: utcDay(0) },
        { path: TreePath.ACCOMPANIMENT, day: utcDay(0) },
      ]);

      const tree = await service.getTree('u1');

      expect(tree.today.earned).toBe(3);
      expect(tree.today.complete).toBe(true);
      expect(tree.today.paths.every((p) => p.earned)).toBe(true);
    });

    it('cuenta anillos por semanas distintas y frutos por días completos', async () => {
      // Dos días completos (2 frutos) en dos semanas distintas (2 anillos).
      prisma.treeDrop.findMany.mockResolvedValue([
        { path: TreePath.SELF_KNOWLEDGE, day: utcDay(0) },
        { path: TreePath.CARE_EXPRESSION, day: utcDay(0) },
        { path: TreePath.ACCOMPANIMENT, day: utcDay(0) },
        { path: TreePath.SELF_KNOWLEDGE, day: utcDay(-8) },
        { path: TreePath.CARE_EXPRESSION, day: utcDay(-8) },
        { path: TreePath.ACCOMPANIMENT, day: utcDay(-8) },
      ]);

      const tree = await service.getTree('u1');

      expect(tree.parts.rings).toBe(2);
      expect(tree.parts.fruits).toBe(2);
    });

    it('reúne las partes desde la actividad real del personaje', async () => {
      prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
      prisma.emotionalLog.count.mockResolvedValue(4);
      prisma.story.count.mockResolvedValue(2);
      prisma.storyUpdate.count.mockResolvedValue(3);
      prisma.companionship.count.mockResolvedValue(5);
      prisma.commentHelpful.count.mockResolvedValue(6);

      const tree = await service.getTree('u1');

      expect(tree.parts).toMatchObject({
        roots: 4,
        branches: 5,
        leaves: 5,
        flowers: 6,
      });
    });

    it('no consulta partes sociales si aún no hay personaje', async () => {
      prisma.character.findUnique.mockResolvedValue(null);
      prisma.emotionalLog.count.mockResolvedValue(2);

      const tree = await service.getTree('u1');

      expect(tree.parts.roots).toBe(2);
      expect(tree.parts.branches).toBe(0);
      expect(prisma.story.count).not.toHaveBeenCalled();
    });
  });
});
