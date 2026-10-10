import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FollowsService } from './follows.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StoriesService } from '../stories/stories.service.js';

describe('FollowsService', () => {
  let service: FollowsService;
  let prisma: any;
  let storiesService: { assertStoryVisible: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      character: { findUnique: vi.fn() },
      follower: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'char-2' }]),
    };

    storiesService = {
      assertStoryVisible: vi.fn().mockResolvedValue({ id: 'story-1', characterId: 'char-owner', isOwner: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: storiesService },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);
  });

  it('exige un personaje propio antes de seguir', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(service.follow('user-1', 'LuzEnPausa')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.follower.create).not.toHaveBeenCalled();
  });

  it('responde 404 si el personaje objetivo no existe', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.follow('user-1', 'Nadie')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no permite seguirse a uno mismo', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.$queryRaw.mockResolvedValue([{ id: 'char-1' }]);

    await expect(service.follow('user-1', 'YoMismo')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.follower.create).not.toHaveBeenCalled();
  });

  it('seguir es idempotente', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.follower.findFirst.mockResolvedValue({ id: 'f-1' });

    const result = await service.follow('user-1', 'LuzEnPausa');

    expect(result).toEqual({ following: true });
    expect(prisma.follower.create).not.toHaveBeenCalled();
  });

  it('crea el seguimiento cuando no existía', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    const result = await service.follow('user-1', 'LuzEnPausa');

    expect(prisma.follower.create).toHaveBeenCalledWith({
      data: { followerId: 'char-1', followingCharacterId: 'char-2' },
    });
    expect(result).toEqual({ following: true });
  });

  it('dejar de seguir borra la relación', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    const result = await service.unfollow('user-1', 'LuzEnPausa');

    expect(prisma.follower.deleteMany).toHaveBeenCalledWith({
      where: { followerId: 'char-1', followingCharacterId: 'char-2' },
    });
    expect(result).toEqual({ following: false });
  });

  it('sin personaje, la lista de seguidos va vacía', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(service.listFollowing('user-1')).resolves.toEqual({ items: [] });
  });

  it('lista los personajes seguidos', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.follower.findMany.mockResolvedValue([
      { followingCharacter: { name: 'LuzEnPausa', tagline: null, avatarUrl: null } },
    ]);

    await expect(service.listFollowing('user-1')).resolves.toEqual({
      items: [{ name: 'LuzEnPausa', tagline: null, avatarUrl: null }],
    });
  });

  it('seguir un relato exige poder verlo y crea el vínculo', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    const result = await service.followStory('user-1', 'story-1');

    expect(prisma.follower.create).toHaveBeenCalledWith({
      data: { followerId: 'char-1', followingStoryId: 'story-1' },
    });
    expect(result).toEqual({ following: true });
  });

  it('no sigue un relato que no se puede ver', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    storiesService.assertStoryVisible.mockRejectedValue(new NotFoundException('no visible'));

    await expect(service.followStory('user-1', 'story-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.follower.create).not.toHaveBeenCalled();
  });

  it('dejar de seguir un relato borra el vínculo', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    const result = await service.unfollowStory('user-1', 'story-1');

    expect(prisma.follower.deleteMany).toHaveBeenCalledWith({
      where: { followerId: 'char-1', followingStoryId: 'story-1' },
    });
    expect(result).toEqual({ following: false });
  });

  it('"lo que sigo" junta personajes e historias', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.follower.findMany.mockImplementation((args: any) => {
      const select = args?.select ?? {};
      if ('followingCharacter' in select) {
        return Promise.resolve([
          { followingCharacter: { name: 'LuzEnPausa', tagline: null, avatarUrl: null } },
        ]);
      }
      return Promise.resolve([
        {
          followingStory: {
            id: 'story-1',
            title: 'Historia seguida',
            createdAt: new Date(),
            updatedAt: new Date(),
            character: { name: 'VolverAEmpezar', avatarUrl: null },
          },
        },
      ]);
    });

    const result = await service.whatIFollow('user-1');

    expect(result.characters).toHaveLength(1);
    expect(result.stories).toHaveLength(1);
    expect(result.stories[0].title).toBe('Historia seguida');
  });
});
