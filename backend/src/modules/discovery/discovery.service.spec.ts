import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscoveryService } from './discovery.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StoriesService } from '../stories/stories.service.js';

function featuredRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    storyId: 'story-1',
    position: 0,
    note: 'Lectura destacada',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    expiresAt: null,
    ...overrides,
  };
}

function storyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'story-1',
    title: 'Hoy dejé de fingir',
    author: { name: 'LuzEnPausa', avatarUrl: null },
    categories: [],
    emotions: [],
    tags: [],
    opening: null,
    stageCount: 1,
    supportCount: 2,
    commentCount: 1,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let prisma: any;
  let storiesService: { listPublicByIds: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      featuredStory: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(featuredRow()),
        update: vi.fn().mockResolvedValue(featuredRow({ note: 'Actualizada' })),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      story: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      companionship: { groupBy: vi.fn().mockResolvedValue([]) },
      comment: { groupBy: vi.fn().mockResolvedValue([]) },
      character: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      follower: { findMany: vi.fn().mockResolvedValue([]) },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    storiesService = { listPublicByIds: vi.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: storiesService },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);
  });

  describe('listFeatured', () => {
    it('devuelve la curación vigente con su nota', async () => {
      prisma.featuredStory.findMany.mockResolvedValue([featuredRow()]);
      storiesService.listPublicByIds.mockResolvedValue([storyRow()]);

      const result = await service.listFeatured(5);

      expect(result.curated).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].note).toBe('Lectura destacada');
    });

    it('cae a los relatos destacados por sus autores cuando no hay curación', async () => {
      prisma.story.findMany.mockResolvedValue([{ id: 'story-9' }]);
      storiesService.listPublicByIds.mockImplementation((ids: string[]) =>
        Promise.resolve(ids.map((id) => storyRow({ id }))),
      );

      const result = await service.listFeatured(5);

      expect(result.curated).toBe(false);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('story-9');
      expect(result.items[0].note).toBeNull();
    });
  });

  describe('listTrending', () => {
    it('ranquea por interacción reciente (acompañamiento pesa más)', async () => {
      prisma.companionship.groupBy.mockResolvedValue([
        { targetStoryId: 'story-a', _count: { _all: 3 } },
      ]);
      prisma.comment.groupBy.mockResolvedValue([
        { storyId: 'story-b', _count: { _all: 4 } },
      ]);
      storiesService.listPublicByIds.mockImplementation((ids: string[]) =>
        Promise.resolve(ids.map((id) => storyRow({ id }))),
      );

      const result = await service.listTrending(10);

      expect(result.items[0].id).toBe('story-a');
      expect(result.items[0].trendScore).toBe(6);
      expect(result.items[1].id).toBe('story-b');
      expect(result.items[1].trendScore).toBe(4);
    });

    it('devuelve la lista vacía si no hay interacción en la ventana', async () => {
      const result = await service.listTrending(10);

      expect(result).toEqual({ items: [] });
    });
  });

  describe('listRecommendedCharacters', () => {
    it('excluye al propio personaje y a quienes ya se siguen', async () => {
      prisma.character.findUnique.mockResolvedValue({
        id: 'char-me',
        interests: [{ interestId: 'i1' }],
      });
      prisma.follower.findMany.mockResolvedValue([
        { followingCharacterId: 'char-followed' },
      ]);
      // La piscina por afinidad se resuelve con SQL (candidatos) y luego se
      // cuentan los relatos publicados de los candidatos.
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: 'char-followed' }, { id: 'char-match' }])
        .mockResolvedValueOnce([{ characterId: 'char-match', count: 2 }]);
      prisma.character.findMany.mockResolvedValue([
        {
          id: 'char-followed',
          name: 'YaSeguido',
          tagline: null,
          avatarUrl: null,
          createdAt: new Date(),
          privacySettings: null,
          interests: [],
          _count: { followers: 50 },
        },
        {
          id: 'char-match',
          name: 'Afín',
          tagline: 'Escribo',
          avatarUrl: null,
          createdAt: new Date(),
          privacySettings: null,
          interests: [{ interestId: 'i1', interest: { name: 'Escritura' } }],
          _count: { followers: 5 },
        },
      ]);

      const result = await service.listRecommendedCharacters('user-1', 10);

      expect(result.items.map((item) => item.name)).toEqual(['Afín']);
      expect(result.items[0].sharedInterests).toBe(1);
      expect(result.items[0].stories).toBe(2);
    });

    it('sin intereses apuesta por la lista popular de personajes', async () => {
      prisma.character.findUnique.mockResolvedValue({
        id: 'char-me',
        interests: [],
      });
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: 'char-popular' }])
        .mockResolvedValueOnce([{ characterId: 'char-popular', count: 4 }]);
      prisma.character.findMany.mockResolvedValue([
        {
          id: 'char-popular',
          name: 'Popu',
          tagline: null,
          avatarUrl: null,
          createdAt: new Date(),
          privacySettings: null,
          interests: [],
          _count: { followers: 40 },
        },
      ]);

      const result = await service.listRecommendedCharacters('user-1', 10);

      expect(result.items.map((item) => item.name)).toEqual(['Popu']);
      expect(result.items[0].sharedInterests).toBe(0);
    });

    it('sin candidatos devuelve la lista vacía', async () => {
      const result = await service.listRecommendedCharacters('user-1', 10);

      expect(result).toEqual({ items: [] });
    });
  });

  describe('curación (administración)', () => {
    it('no destaca un relato que no existe', async () => {
      prisma.story.findUnique.mockResolvedValue(null);

      await expect(service.feature('story-x', { position: 0 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('solo destaca relatos publicados', async () => {
      prisma.story.findUnique.mockResolvedValue({ id: 'story-1', status: 'DRAFT' });

      await expect(service.feature('story-1', { position: 0 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('crea el destacado cuando no existe todavía', async () => {
      prisma.story.findUnique.mockResolvedValue({ id: 'story-1', status: 'PUBLISHED' });

      const result = await service.feature('story-1', { position: 2, note: 'Lectura' });

      expect(prisma.featuredStory.create).toHaveBeenCalledWith({
        data: { storyId: 'story-1', position: 2, note: 'Lectura', expiresAt: null },
      });
      expect(result.id).toBe('f1');
    });

    it('actualiza y conserva los campos no enviados al refinar', async () => {
      prisma.story.findUnique.mockResolvedValue({ id: 'story-1', status: 'PUBLISHED' });
      prisma.featuredStory.findUnique.mockResolvedValue({ id: 'f1' });

      const result = await service.feature('story-1', { note: 'Actualizada' });

      expect(prisma.featuredStory.update).toHaveBeenCalledWith({
        where: { storyId: 'story-1' },
        data: {
          note: 'Actualizada',
        },
      });
      expect(result.note).toBe('Actualizada');
    });

    it('una nota vacía la quita y quitar el destacado lo elimina', async () => {
      prisma.story.findUnique.mockResolvedValue({ id: 'story-1', status: 'PUBLISHED' });
      prisma.featuredStory.findUnique.mockResolvedValue({ id: 'f1' });

      await service.feature('story-1', { note: '   ' });

      expect(prisma.featuredStory.update).toHaveBeenCalledWith({
        where: { storyId: 'story-1' },
        data: { note: null },
      });

      prisma.featuredStory.findUnique.mockResolvedValue({ id: 'f1' });
      await expect(service.unfeature('story-1')).resolves.toEqual({ storyId: 'story-1' });
      expect(prisma.featuredStory.deleteMany).toHaveBeenCalledWith({ where: { storyId: 'story-1' } });
    });
  });
});