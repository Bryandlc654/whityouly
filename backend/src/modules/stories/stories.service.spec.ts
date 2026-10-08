import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { StoriesService } from './stories.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotaService } from '../../common/quota/quota.service.js';

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'story-1',
    title: 'Hoy dejé de fingir',
    visibility: 'PUBLIC',
    status: 'DRAFT',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    character: { name: 'LuzEnPausa', avatarUrl: null },
    categories: [{ category: { name: 'Relaciones' } }],
    emotions: [{ emotion: { name: 'Esperanza', colorHex: '#37a978' } }],
    tags: [{ tag: { name: 'Autoestima' } }],
    updates: [
      {
        id: 'upd-1',
        content: 'No pasó nada extraordinario.',
        mediaAssetId: null,
        audioAssetId: null,
        stageOrder: 1,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        mediaAsset: null,
        audioAsset: null,
      },
    ],
    _count: { comments: 0, companionships: 0, followers: 0 },
    ...overrides,
  };
}

describe('StoriesService', () => {
  let service: StoriesService;
  let prisma: any;
  let quota: { consume: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      character: { findUnique: vi.fn() },
      story: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      storyUpdate: {
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _max: { stageOrder: 0 } }),
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        delete: vi.fn(),
        updateMany: vi.fn(),
      },
      storyCategory: { deleteMany: vi.fn(), createMany: vi.fn() },
      storyEmotion: { deleteMany: vi.fn(), createMany: vi.fn() },
      storyTag: { deleteMany: vi.fn(), createMany: vi.fn() },
      category: { findMany: vi.fn().mockResolvedValue([]) },
      emotion: { findMany: vi.fn().mockResolvedValue([]) },
      tag: { findMany: vi.fn().mockResolvedValue([]) },
      mediaAsset: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      analyticsEvent: { create: vi.fn().mockResolvedValue({}) },
      follower: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };

    (prisma as { $transaction?: unknown }).$transaction = vi.fn((callback: (tx: unknown) => unknown) =>
      callback(prisma),
    );

    quota = { consume: vi.fn().mockResolvedValue({ allowed: true, limit: 20, remaining: 19, retryAfterSeconds: 0 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuotaService, useValue: quota },
      ],
    }).compile();

    service = module.get<StoriesService>(StoriesService);
  });

  it('exige un personaje antes de publicar', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(
      service.create('user-1', { title: 'Título', content: 'Cuerpo' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.story.create).not.toHaveBeenCalled();
  });

  it('rechaza una categoría fuera del catálogo', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.category.findMany.mockResolvedValue([]); // "Fantasma" no existe

    await expect(
      service.create('user-1', {
        title: 'Título',
        content: 'Cuerpo',
        categories: ['Fantasma'],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.story.create).not.toHaveBeenCalled();
  });

  it('crea el relato como borrador con su primera etapa', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.story.create.mockResolvedValue(detailRow());

    const result = await service.create('user-1', {
      title: '  Hoy dejé de fingir  ',
      content: 'No pasó nada extraordinario.',
    } as any);

    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: 'char-1',
          title: 'Hoy dejé de fingir',
          status: 'DRAFT',
          updates: {
            create: {
              content: 'No pasó nada extraordinario.',
              mediaAssetId: null,
              audioAssetId: null,
              stageOrder: 1,
            },
          },
        }),
      }),
    );
    expect(result.status).toBe('DRAFT');
    expect(result.updates).toHaveLength(1);
    expect(result.author).toEqual({ name: 'LuzEnPausa', avatarUrl: null });
    expect(prisma.analyticsEvent.create).toHaveBeenCalled();
  });

  it('publica directamente si publish es true', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.story.create.mockResolvedValue(detailRow({ status: 'PUBLISHED' }));

    await service.create('user-1', { title: 'Título', content: 'Cuerpo', publish: true } as any);

    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }),
    );
  });

  it('corta si se supera la cuota de publicación', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    quota.consume.mockResolvedValue({ allowed: false, limit: 20, remaining: 0, retryAfterSeconds: 30 });

    await expect(
      service.create('user-1', { title: 'Título', content: 'Cuerpo' } as any),
    ).rejects.toBeInstanceOf(HttpException);
    expect(prisma.story.create).not.toHaveBeenCalled();
  });

  it('respeta el máximo de relatos por personaje', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.story.count.mockResolvedValue(500);

    await expect(
      service.create('user-1', { title: 'Título', content: 'Cuerpo' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('no permite adjuntar un archivo ajeno o ya en uso', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.mediaAsset.findFirst.mockResolvedValue(null);

    await expect(
      service.create('user-1', {
        title: 'Título',
        content: 'Cuerpo',
        mediaAssetId: '11111111-1111-4111-8111-111111111111',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.mediaAsset.findFirst.mockResolvedValue({ id: 'm1', entityType: 'STORY_MEDIA' });
    await expect(
      service.create('user-1', {
        title: 'Título',
        content: 'Cuerpo',
        mediaAssetId: '11111111-1111-4111-8111-111111111111',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('no deja editar un relato que no existe o no es tuyo', async () => {
    prisma.story.findFirst.mockResolvedValue(null);

    await expect(service.getOwnedDetail('user-1', 'story-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('publica un borrador y lo vuelve a borrador', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      characterId: 'char-1',
      status: 'DRAFT',
      visibility: 'PUBLIC',
    });
    prisma.story.findUnique.mockResolvedValue(detailRow({ status: 'PUBLISHED' }));

    const published = await service.publish('user-1', 'story-1');
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }),
    );
    expect(published.status).toBe('PUBLISHED');
  });

  it('no publica un relato que ya no es borrador', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      characterId: 'char-1',
      status: 'HIDDEN',
      visibility: 'PUBLIC',
    });

    await expect(service.publish('user-1', 'story-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('añade una etapa con el siguiente número de orden', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      characterId: 'char-1',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    });
    prisma.storyUpdate.aggregate.mockResolvedValue({ _max: { stageOrder: 3 } });
    prisma.storyUpdate.create.mockResolvedValue({
      id: 'upd-4',
      content: 'Cuarta etapa',
      mediaAssetId: null,
      stageOrder: 4,
      createdAt: new Date(),
      mediaAsset: null,
    });

    const stage = await service.addUpdate('user-1', 'story-1', { content: 'Cuarta etapa' } as any);

    expect(prisma.storyUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storyId: 'story-1', stageOrder: 4 }),
      }),
    );
    expect(stage.stageOrder).toBe(4);
  });

  it('impone un tope de etapas por relato', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      characterId: 'char-1',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    });
    prisma.storyUpdate.count.mockResolvedValue(100);

    await expect(
      service.addUpdate('user-1', 'story-1', { content: 'Otra' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.storyUpdate.create).not.toHaveBeenCalled();
  });

  it('da de baja el relato (baja lógica) y libera sus archivos', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      characterId: 'char-1',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    });
    prisma.storyUpdate.findMany.mockResolvedValue([{ mediaAssetId: 'm1' }]);

    const result = await service.remove('user-1', 'story-1');

    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DELETED' }) }),
    );
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { entityType: 'NONE', entityId: null } }),
    );
    expect(result).toEqual({ id: 'story-1' });
  });

  it('adjunta imagen y audio en la primera etapa', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.mediaAsset.findFirst.mockResolvedValue({ id: 'asset-1', entityType: 'NONE' });
    prisma.story.create.mockResolvedValue(detailRow());

    await service.create('user-1', {
      title: 'Título',
      content: 'Cuerpo',
      mediaAssetId: '11111111-1111-4111-8111-111111111111',
      audioAssetId: '22222222-2222-4222-8222-222222222222',
    } as any);

    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          updates: {
            create: expect.objectContaining({ mediaAssetId: 'asset-1', audioAssetId: 'asset-1' }),
          },
        }),
      }),
    );
    // Los dos adjuntos quedan marcados como en uso.
    expect(prisma.mediaAsset.update).toHaveBeenCalledTimes(2);
  });

  it('permite publicar solo con imagen (sin texto)', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.mediaAsset.findFirst.mockResolvedValue({ id: 'asset-1', entityType: 'NONE' });
    prisma.story.create.mockResolvedValue(detailRow({ updates: [{ id: 'upd-1', content: '', mediaAssetId: 'asset-1', audioAssetId: null, stageOrder: 1, createdAt: new Date(), mediaAsset: { fileUrl: 'http://x/i.webp' }, audioAsset: null }] }));

    const result = await service.create('user-1', {
      title: 'Imagen del atardecer',
      content: '',
      mediaAssetId: '11111111-1111-4111-8111-111111111111',
    } as any);

    expect(result.id).toBe('story-1');
    expect(result.updates[0].content).toBe('');
  });

  it('permite publicar solo con audio (sin texto ni imagen)', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.mediaAsset.findFirst.mockResolvedValue({ id: 'asset-2', entityType: 'NONE' });
    prisma.story.create.mockResolvedValue(detailRow({ updates: [{ id: 'upd-1', content: '', mediaAssetId: null, audioAssetId: 'asset-2', stageOrder: 1, createdAt: new Date(), mediaAsset: null, audioAsset: { fileUrl: 'http://x/a.mp3' } }] }));

    const result = await service.create('user-1', {
      title: 'Audio de la mañana',
      content: undefined,
      audioAssetId: '22222222-2222-4222-8222-222222222222',
    } as any);

    expect(result.id).toBe('story-1');
    expect(result.updates[0].audioUrl).toBe('http://x/a.mp3');
  });

  it('rechaza publicar sin texto, imagen ni audio', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    await expect(
      service.create('user-1', { title: 'Título', content: '' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.story.create).not.toHaveBeenCalled();
  });

  it('el propietario ve su propio borrador', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      characterId: 'char-1',
      character: { userId: 'user-1' },
    });
    prisma.story.findUnique.mockResolvedValue(detailRow());

    const result = await service.getViewable('user-1', 'story-1');
    expect(result.id).toBe('story-1');
  });

  it('un seguidor ve un relato para seguidores', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      status: 'PUBLISHED',
      visibility: 'FOLLOWERS',
      characterId: 'char-2',
      character: { userId: 'otra-persona' },
    });
    prisma.follower.count.mockResolvedValue(1);
    prisma.story.findUnique.mockResolvedValue(
      detailRow({ status: 'PUBLISHED', visibility: 'FOLLOWERS' }),
    );

    const result = await service.getViewable('user-1', 'story-1');
    expect(result.id).toBe('story-1');
  });

  it('un no seguidor no ve un relato para seguidores', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      status: 'PUBLISHED',
      visibility: 'FOLLOWERS',
      characterId: 'char-2',
      character: { userId: 'otra-persona' },
    });
    prisma.follower.count.mockResolvedValue(0);

    await expect(service.getViewable('user-1', 'story-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un relato privado no se ve desde fuera', async () => {
    prisma.story.findFirst.mockResolvedValue({
      id: 'story-1',
      status: 'PUBLISHED',
      visibility: 'PRIVATE',
      characterId: 'char-2',
      character: { userId: 'otra-persona' },
    });

    await expect(service.getViewable('user-1', 'story-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el feed de seguidos queda vacío si no hay personaje', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(service.listFollowing('user-1', {} as any)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('el feed de seguidos consulta solo a los personajes seguidos, sin duplicar', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.follower.findMany.mockResolvedValue([
      { followingCharacterId: 'char-2' },
      { followingCharacterId: 'char-2' },
    ]);
    prisma.story.findMany.mockResolvedValue([]);

    await service.listFollowing('user-1', {} as any);

    expect(prisma.story.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          characterId: { in: ['char-2'] },
          status: 'PUBLISHED',
          visibility: { in: ['PUBLIC', 'FOLLOWERS'] },
        }),
      }),
    );
  });

  it('devuelve las cuatro secciones del feed', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', interests: [] });
    prisma.story.findMany.mockResolvedValue([]);

    await expect(service.getFeed('user-1')).resolves.toEqual({
      recent: [],
      recommended: [],
      popular: [],
      following: [],
    });
  });

  it('las recomendadas priorizan los relatos afines a los intereses', async () => {
    const base = {
      title: 'T',
      visibility: 'PUBLIC',
      createdAt: new Date(),
      updatedAt: new Date(),
      characterId: 'char-a',
      character: { name: 'A', avatarUrl: null },
      categories: [],
      emotions: [],
      updates: [],
      _count: { updates: 1, comments: 0, companionships: 0 },
    };
    const match = { ...base, id: 'match', tags: [{ tag: { name: 'Esperanza' } }] };
    const other = { ...base, id: 'other', tags: [] };

    prisma.character.findUnique.mockResolvedValue({
      id: 'char-1',
      interests: [{ interest: { name: 'Esperanza' } }],
    });
    prisma.follower.findMany.mockResolvedValue([]);
    // recent, popular, piscina de candidatos y el resto.
    prisma.story.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([other, match])
      .mockResolvedValue([]);

    const feed = await service.getFeed('user-1');

    expect(feed.recommended).toHaveLength(2);
    expect(feed.recommended[0].id).toBe('match');
  });

  const taxoRow = (id: string, overrides: Record<string, unknown>) => ({
    id,
    title: 'T',
    visibility: 'PUBLIC',
    createdAt: new Date(),
    updatedAt: new Date(),
    characterId: 'char-a',
    character: { name: 'A', avatarUrl: null },
    categories: [],
    emotions: [],
    tags: [],
    updates: [],
    _count: { updates: 1, comments: 0, companionships: 0 },
    ...overrides,
  });

  it('las categorias que el autor ya usa influyen en la recomendacion', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', interests: [] });
    prisma.follower.findMany.mockResolvedValue([]);
    prisma.story.findMany
      .mockResolvedValueOnce([])                                    // recientes
      .mockResolvedValueOnce([])                                    // populares
      .mockResolvedValueOnce([                                       // piscina
        taxoRow('c1', { categories: [{ category: { name: 'Trabajo' } }] }),
        taxoRow('c2', { categories: [{ category: { name: 'Esperanza' } }] }),
      ])
      .mockResolvedValueOnce([{ categories: [{ category: { name: 'Esperanza' } }], emotions: [], tags: [] }]) // propios
      .mockResolvedValue([]);

    const feed = await service.getFeed('user-1');
    expect(feed.recommended[0].id).toBe('c2');
  });

  it('las emociones que el autor ya usa influyen en la recomendacion', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', interests: [] });
    prisma.follower.findMany.mockResolvedValue([]);
    prisma.story.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        taxoRow('e1', { emotions: [{ emotion: { name: 'Calma', colorHex: null } }] }),
        taxoRow('e2', { emotions: [{ emotion: { name: 'Tristeza', colorHex: null } }] }),
      ])
      .mockResolvedValueOnce([{ categories: [], emotions: [{ emotion: { name: 'Tristeza' } }], tags: [] }])
      .mockResolvedValue([]);

    const feed = await service.getFeed('user-1');
    expect(feed.recommended[0].id).toBe('e2');
  });

  it('las etiquetas que el autor ya usa influyen en la recomendacion', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', interests: [] });
    prisma.follower.findMany.mockResolvedValue([]);
    prisma.story.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        taxoRow('t1', { tags: [{ tag: { name: 'Trabajo' } }] }),
        taxoRow('t2', { tags: [{ tag: { name: 'Autoestima' } }] }),
      ])
      .mockResolvedValueOnce([{ categories: [], emotions: [], tags: [{ tag: { name: 'Autoestima' } }] }])
      .mockResolvedValue([]);

    const feed = await service.getFeed('user-1');
    expect(feed.recommended[0].id).toBe('t2');
  });
});
