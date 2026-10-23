import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      report: { findMany: vi.fn().mockResolvedValue([]) },
      moderationAction: { findMany: vi.fn().mockResolvedValue([]) },
      story: { findMany: vi.fn().mockResolvedValue([]) },
      comment: { findMany: vi.fn().mockResolvedValue([]) },
      character: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      creation: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('lista solo los reportes de la persona autenticada', async () => {
    prisma.report.findMany.mockResolvedValue([
      {
        id: 'r1',
        reportedType: 'STORY',
        reportedId: 's1',
        reason: 'Contenido ofensivo',
        status: 'PENDING',
        createdAt: new Date('2026-10-20T10:00:00Z'),
        resolvedAt: null,
      },
    ]);

    await service.listMine('user-1', {});

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reporterUserId: 'user-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('traduce la decisión a una resolución pública sin motivos internos', async () => {
    prisma.report.findMany.mockResolvedValue([
      {
        id: 'r1',
        reportedType: 'STORY',
        reportedId: 's1',
        reason: 'Contenido ofensivo',
        status: 'RESOLVED',
        createdAt: new Date('2026-10-20T10:00:00Z'),
        resolvedAt: new Date('2026-10-21T10:00:00Z'),
      },
    ]);
    prisma.moderationAction.findMany.mockResolvedValue([
      { reportId: 'r1', action: 'HIDE' },
    ]);
    prisma.story.findMany.mockResolvedValue([
      {
        id: 's1',
        title: 'Un relato',
        status: 'HIDDEN',
        character: { name: 'LuzEnPausa' },
      },
    ]);

    const result = await service.listMine('user-1', {});

    expect(result.items[0].resolution).toBe(
      'El contenido reportado fue ocultado por moderación.',
    );
    expect(result.items[0].action).toBe('HIDE');
    expect(result.items[0].target?.authorName).toBe('LuzEnPausa');
    // El contenido oculto no vuelve a exponer su título.
    expect(result.items[0].target?.title).toBeNull();
  });

  it('no inventa una resolución mientras el reporte sigue pendiente', async () => {
    prisma.report.findMany.mockResolvedValue([
      {
        id: 'r1',
        reportedType: 'COMMENT',
        reportedId: 'c1',
        reason: 'Acoso',
        status: 'PENDING',
        createdAt: new Date(),
        resolvedAt: null,
      },
    ]);
    prisma.comment.findMany.mockResolvedValue([
      { id: 'c1', status: 'ACTIVE', character: { name: 'VolverAEmpezar' } },
    ]);

    const result = await service.listMine('user-1', {});

    expect(result.items[0].resolution).toBeNull();
    expect(result.items[0].target?.title).toBeNull();
  });

  it('pagina por cursor y devuelve el siguiente id', async () => {
    prisma.report.findMany.mockResolvedValue([
      {
        id: 'r1',
        reportedType: 'STORY',
        reportedId: 's1',
        reason: 'Spam',
        status: 'PENDING',
        createdAt: new Date(),
        resolvedAt: null,
      },
      {
        id: 'r2',
        reportedType: 'STORY',
        reportedId: 's2',
        reason: 'Spam',
        status: 'PENDING',
        createdAt: new Date(),
        resolvedAt: null,
      },
    ]);

    const result = await service.listMine('user-1', { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe('r1');
  });

  it('no consulta acciones si la página está vacía', async () => {
    const result = await service.listMine('user-1', {});

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(prisma.moderationAction.findMany).not.toHaveBeenCalled();
  });
});
