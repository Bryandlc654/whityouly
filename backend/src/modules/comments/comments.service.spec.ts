import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StoriesService } from '../stories/stories.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    content: 'Qué bonito relato.',
    status: 'ACTIVE',
    parentId: null,
    characterId: 'char-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    character: { name: 'LuzEnPausa', avatarUrl: null },
    ...overrides,
  };
}

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: any;
  let storiesService: { assertStoryVisible: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      character: { findUnique: vi.fn() },
      comment: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue(commentRow()),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      report: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      analyticsEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    storiesService = {
      assertStoryVisible: vi.fn().mockResolvedValue({ id: 'story-1', characterId: 'char-owner', ownerUserId: 'user-owner', isOwner: false }),
    };

    const notifications = {
      create: vi.fn().mockResolvedValue(undefined),
      createMany: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: storiesService },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('exige un personaje para comentar', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(service.create('user-1', 'story-1', { content: 'Hola' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('no permite comentar un relato que no se puede ver', async () => {
    storiesService.assertStoryVisible.mockRejectedValue(new NotFoundException('no visible'));
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    await expect(service.create('user-1', 'story-1', { content: 'Hola' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('crea un comentario de primer nivel', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    const result = await service.create('user-1', 'story-1', { content: 'Qué bonito relato.' });

    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storyId: 'story-1', characterId: 'char-1', parentId: null }),
      }),
    );
    expect(result.author.name).toBe('LuzEnPausa');
    expect(result.isOwn).toBe(true);
  });

  it('responde solo a comentarios de primer nivel', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.comment.findFirst.mockResolvedValue({
      id: 'c0',
      parentId: null,
      status: 'ACTIVE',
      character: { userId: 'user-owner' },
    });

    await service.create('user-1', 'story-1', { content: 'Respuesta', parentId: 'c0' });
    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentId: 'c0' }) }),
    );

    prisma.comment.findFirst.mockResolvedValue({ id: 'c1', parentId: 'c0', status: 'ACTIVE' });
    await expect(
      service.create('user-1', 'story-1', { content: 'Otra', parentId: 'c1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no permite responder a un comentario eliminado', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.comment.findFirst.mockResolvedValue({ id: 'c0', parentId: null, status: 'DELETED' });

    await expect(
      service.create('user-1', 'story-1', { content: 'Respuesta', parentId: 'c0' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista comentarios con su conteo', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.comment.findMany.mockResolvedValue([commentRow()]);
    prisma.comment.count.mockResolvedValue(1);

    const result = await service.list('user-1', 'story-1', {});

    expect(result.items).toHaveLength(1);
    expect(result.commentCount).toBe(1);
    expect(result.items[0].isOwn).toBe(true);
  });

  it('deja editar el comentario propio', async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
      characterId: 'char-1',
      character: { userId: 'user-1' },
    });
    prisma.comment.update.mockResolvedValue(commentRow({ content: 'Nueva versión' }));

    const result = await service.edit('user-1', 'c1', { content: 'Nueva versión' });

    expect(result.content).toBe('Nueva versión');
  });

  it('impide editar un comentario ajeno', async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
      characterId: 'char-2',
      character: { userId: 'otra-persona' },
    });

    await expect(service.edit('user-1', 'c1', { content: 'Hola' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('impide editar un comentario eliminado', async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'DELETED',
      characterId: 'char-1',
      character: { userId: 'user-1' },
    });

    await expect(service.edit('user-1', 'c1', { content: 'Hola' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('elimina el comentario propio (baja lógica y borra el texto)', async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
      characterId: 'char-1',
      character: { userId: 'user-1' },
    });

    const result = await service.remove('user-1', 'c1');

    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'DELETED', content: '' },
    });
    expect(result).toEqual({ id: 'c1' });
  });

  it('reporta un comentario', async () => {
    prisma.comment.findFirst.mockResolvedValue({ id: 'c1' });

    const result = await service.report('user-1', 'c1', { reason: 'OFFENSIVE' });

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reporterUserId: 'user-1',
          reportedType: 'COMMENT',
          reportedId: 'c1',
          reason: 'OFFENSIVE',
        }),
      }),
    );
    expect(result).toEqual({ reported: true });
  });

  it('no permite reportar dos veces el mismo comentario', async () => {
    prisma.comment.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.report.findFirst.mockResolvedValue({ id: 'r1' });

    await expect(service.report('user-1', 'c1', { reason: 'SPAM' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});