import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeletionPurgeService } from './account-deletion-purge.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MEDIA_STORAGE } from '../../common/storage/media-storage.js';

describe('AccountDeletionPurgeService', () => {
  let service: AccountDeletionPurgeService;
  let prisma: any;
  let storage: { deleteIfOwned: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const deleteMany = () => vi.fn().mockResolvedValue({ count: 0 });
    prisma = {
      accountDeletionRequest: {
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      mediaAsset: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: deleteMany(),
      },
      character: { findUnique: vi.fn(), deleteMany: deleteMany() },
      story: { findMany: vi.fn().mockResolvedValue([]) },
      bookmark: { deleteMany: deleteMany() },
      emotionalLog: { deleteMany: deleteMany() },
      treeDrop: { deleteMany: deleteMany() },
      creation: { deleteMany: deleteMany() },
      supportTicket: { deleteMany: deleteMany() },
      notification: { deleteMany: deleteMany() },
      appeal: { deleteMany: deleteMany() },
      report: { deleteMany: deleteMany() },
      oAuthIdentity: { deleteMany: deleteMany() },
      userPreference: { deleteMany: deleteMany() },
      session: { deleteMany: deleteMany() },
      commentDraft: { deleteMany: deleteMany() },
      user: { update: vi.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = vi.fn((callback: (tx: unknown) => unknown) => callback(prisma));

    storage = { deleteIfOwned: vi.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionPurgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: MEDIA_STORAGE, useValue: storage },
      ],
    }).compile();

    service = module.get(AccountDeletionPurgeService);
  });

  it('purga contenido, anonimiza la cuenta y borra objetos', async () => {
    prisma.accountDeletionRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'u-1',
      eligibleAt: new Date(Date.now() - 1_000),
      cancelledAt: null,
      completedAt: null,
      user: { id: 'u-1' },
    });
    prisma.mediaAsset.findMany.mockResolvedValue([
      { key: 'media/u-1/a.webp', fileUrl: 'https://cdn.test/media/u-1/a.webp' },
    ]);
    prisma.character.findUnique.mockResolvedValue({ id: 'c-1' });
    prisma.story.findMany.mockResolvedValue([{ id: 's-1' }]);

    const result = await service.purgeOne('req-1');

    expect(result).toBe(true);
    expect(prisma.character.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } });
    expect(prisma.mediaAsset.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({
          status: 'DELETED',
          passwordHash: null,
          email: expect.stringContaining('deleted+'),
        }),
      }),
    );
    expect(prisma.accountDeletionRequest.updateMany).toHaveBeenCalled();
    expect(storage.deleteIfOwned).toHaveBeenCalledWith('media/u-1/a.webp');
  });

  it('no purga una solicitud cancelada', async () => {
    prisma.accountDeletionRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'u-1',
      eligibleAt: new Date(Date.now() - 1_000),
      cancelledAt: new Date(),
      completedAt: null,
      user: { id: 'u-1' },
    });

    await expect(service.purgeOne('req-1')).resolves.toBe(false);
    expect(prisma.character.deleteMany).not.toHaveBeenCalled();
  });
});
