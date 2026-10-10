import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanionshipsService } from './companionships.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StoriesService } from '../stories/stories.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

describe('CompanionshipsService', () => {
  let service: CompanionshipsService;
  let prisma: any;
  let storiesService: { assertStoryVisible: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      character: { findUnique: vi.fn() },
      companionship: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(3),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'char-2', userId: 'user-2' }]),
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
        CompanionshipsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: storiesService },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<CompanionshipsService>(CompanionshipsService);
  });

  it('exige un personaje para acompañar', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(service.supportStory('user-1', 'story-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companionship.create).not.toHaveBeenCalled();
  });

  it('no acompaña un relato que no se puede ver', async () => {
    storiesService.assertStoryVisible.mockRejectedValue(new NotFoundException('no visible'));
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    await expect(service.supportStory('user-1', 'story-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('acompaña un relato y devuelve el total', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    const result = await service.supportStory('user-1', 'story-1');

    expect(prisma.companionship.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ characterId: 'char-1', targetStoryId: 'story-1' }) }),
    );
    expect(result).toEqual({ supporting: true, count: 3 });
  });

  it('acompañar dos veces es idempotente', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.companionship.findFirst.mockResolvedValue({ id: 'cp-1' });

    await service.supportStory('user-1', 'story-1');

    expect(prisma.companionship.create).not.toHaveBeenCalled();
  });

  it('retira el acompañamiento de un relato', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    const result = await service.unsupportStory('user-1', 'story-1');

    expect(prisma.companionship.deleteMany).toHaveBeenCalledWith({
      where: { characterId: 'char-1', targetStoryId: 'story-1' },
    });
    expect(result).toEqual({ supporting: false, count: 3 });
  });

  it('no permite acompañarse a uno mismo', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });
    prisma.$queryRaw.mockResolvedValue([{ id: 'char-1' }]);

    await expect(service.supportCharacter('user-1', 'YoMismo')).rejects.toBeInstanceOf(BadRequestException);
  });
});