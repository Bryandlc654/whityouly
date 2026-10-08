import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FollowsService } from './follows.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('FollowsService', () => {
  let service: FollowsService;
  let prisma: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [FollowsService, { provide: PrismaService, useValue: prisma }],
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
});
