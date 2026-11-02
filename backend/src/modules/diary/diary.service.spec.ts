import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeService } from '../tree/tree.service';

describe('DiaryService', () => {
  let service: DiaryService;
  let prisma: any;
  let tree: { award: ReturnType<typeof vi.fn> };

  const noteRow = {
    id: 'note-1',
    title: 'Una idea',
    content: 'Contenido privado',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    deletedAt: null,
  };

  const emotionalRow = {
    id: 'log-1',
    intensity: 7,
    contextNote: 'Me senti escuchada',
    loggedAt: new Date('2026-11-01T12:00:00.000Z'),
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
    updatedAt: new Date('2026-11-01T12:00:00.000Z'),
    deletedAt: null,
    emotion: { name: 'Calma', colorHex: '#37a978' },
  };

  beforeEach(async () => {
    prisma = {
      diaryNote: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: 'note-1' }),
        findUnique: vi.fn().mockResolvedValue(noteRow),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      emotionalLog: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    tree = { award: vi.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiaryService,
        { provide: PrismaService, useValue: prisma },
        { provide: TreeService, useValue: tree },
      ],
    }).compile();

    service = module.get<DiaryService>(DiaryService);
  });

  it('combina notas y emociones ordenadas por fecha', async () => {
    prisma.diaryNote.findMany.mockResolvedValue([noteRow]);
    prisma.emotionalLog.findMany.mockResolvedValue([emotionalRow]);
    prisma.diaryNote.count.mockResolvedValue(2);
    prisma.emotionalLog.count.mockResolvedValue(1);

    const result = await service.list('user-1', {});

    expect(result.items.map((item) => item.kind)).toEqual(['EMOTIONAL', 'NOTE']);
    expect(result.items[0].content).toBe('Me senti escuchada');
    expect(result.trashCount).toBe(3);
    expect(result.nextCursor).toBeNull();
    expect(prisma.diaryNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', deletedAt: null }),
      }),
    );
  });

  it('devuelve un cursor para cargar la siguiente pagina', async () => {
    const older = {
      ...noteRow,
      id: 'note-0',
      title: 'Anterior',
      createdAt: new Date('2026-11-01T09:00:00.000Z'),
      updatedAt: new Date('2026-11-01T09:00:00.000Z'),
    };
    prisma.diaryNote.findMany.mockResolvedValue([noteRow, older]);

    const result = await service.list('user-1', { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('note-1');
    expect(result.nextCursor).toEqual({ at: noteRow.createdAt.toISOString(), id: noteRow.id });
  });
  it('crea una nota libre y concede la gota de cuidado', async () => {
    prisma.diaryNote.create.mockResolvedValue(noteRow);

    const result = await service.createNote('user-1', {
      title: '  Una idea  ',
      content: '  Contenido privado  ',
    });

    expect(prisma.diaryNote.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', title: 'Una idea', content: 'Contenido privado' },
      select: expect.anything(),
    });
    expect(tree.award).toHaveBeenCalledWith('user-1', 'CARE_EXPRESSION', 'diary_note');
    expect(result.kind).toBe('NOTE');
    expect(result.title).toBe('Una idea');
  });

  it('vincula una reflexion de Cuidarme con una nota sin duplicarla', async () => {
    await service.upsertCareNote('user-1', 'activity-1', 'Desahogo privado', 'Necesitaba soltarlo.');

    expect(prisma.diaryNote.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', sourceId: 'care:activity-1' },
      select: { id: true },
    });
    expect(prisma.diaryNote.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: {
        title: 'Desahogo privado',
        content: 'Necesitaba soltarlo.',
        deletedAt: null,
      },
    });
  });
  it('rechaza una nota sin contenido visible', async () => {
    await expect(service.createNote('user-1', { content: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.diaryNote.create).not.toHaveBeenCalled();
  });

  it('mueve una nota propia a la papelera', async () => {
    const result = await service.removeNote('user-1', 'note-1');

    expect(prisma.diaryNote.updateMany).toHaveBeenCalledWith({
      where: { id: 'note-1', userId: 'user-1', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(result).toEqual({ id: 'note-1' });
  });

  it('restaura una nota desde la papelera sin volver a premiar', async () => {
    const result = await service.restoreNote('user-1', 'note-1');

    expect(prisma.diaryNote.updateMany).toHaveBeenCalledWith({
      where: { id: 'note-1', userId: 'user-1', deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    expect(tree.award).not.toHaveBeenCalled();
    expect(result.kind).toBe('NOTE');
  });
});
