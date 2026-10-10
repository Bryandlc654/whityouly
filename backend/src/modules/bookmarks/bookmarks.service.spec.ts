import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StoriesService } from '../stories/stories.service.js';

describe('BookmarksService', () => {
  let service: BookmarksService;
  let prisma: any;
  let storiesService: { assertStoryVisible: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1' }) },
      bookmark: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      story: { findMany: vi.fn().mockResolvedValue([]) },
    };

    storiesService = {
      assertStoryVisible: vi.fn().mockResolvedValue({ id: 'story-1', characterId: 'char-owner', isOwner: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarksService,
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: storiesService },
      ],
    }).compile();

    service = module.get<BookmarksService>(BookmarksService);
  });

  it('guarda un relato si se puede ver', async () => {
    const result = await service.saveStory('user-1', 'story-1');

    expect(prisma.bookmark.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', targetType: 'STORY', targetId: 'story-1' },
    });
    expect(result).toEqual({ saved: true });
  });

  it('guarda dos veces es idempotente', async () => {
    prisma.bookmark.findFirst.mockResolvedValue({ id: 'b1' });

    await service.saveStory('user-1', 'story-1');
    expect(prisma.bookmark.create).not.toHaveBeenCalled();
  });

  it('exige poder ver el relato para guardarlo', async () => {
    storiesService.assertStoryVisible.mockRejectedValue(new NotFoundException('no visible'));

    await expect(service.saveStory('user-1', 'story-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('quita el relato de los guardados', async () => {
    const result = await service.unsaveStory('user-1', 'story-1');

    expect(prisma.bookmark.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', targetType: 'STORY', targetId: 'story-1' },
    });
    expect(result).toEqual({ saved: false });
  });

  it('lista guardados enlazando el relato', async () => {
    prisma.bookmark.findMany.mockResolvedValue([
      { id: 'b1', targetId: 'story-1', createdAt: new Date() },
    ]);
    prisma.story.findMany.mockResolvedValue([
      {
        id: 'story-1',
        title: 'Historia guardada',
        visibility: 'PUBLIC',
        character: { name: 'LuzEnPausa', avatarUrl: null },
        updates: [
          {
            id: 'up-1',
            content: 'Cuerpo',
            mediaAsset: { fileUrl: 'http://x/i.webp' },
            audioAsset: null,
          },
        ],
      },
    ]);

    const result = await service.listSaved('user-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Historia guardada');
    expect(result.items[0].opening?.mediaUrl).toBe('http://x/i.webp');
  });
});