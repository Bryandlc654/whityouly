import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from './sessions.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: {
    session: {
      findMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      session: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  it('revoca las sesiones más antiguas por encima del límite', async () => {
    prisma.session.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);
    prisma.session.updateMany.mockResolvedValue({ count: 1 });

    const revoked = await service.enforceLimit('user-1', 2);

    expect(revoked).toBe(1);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['s3'] } },
      data: expect.any(Object),
    });
  });

  it('no revoca nada si no se supera el límite', async () => {
    prisma.session.findMany.mockResolvedValue([{ id: 's1' }]);

    const revoked = await service.enforceLimit('user-1', 5);

    expect(revoked).toBe(0);
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it('elimina las sesiones cuya vida útil expiró', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 4 });

    const deleted = await service.deleteExpired();

    expect(deleted).toBe(4);
    expect(prisma.session.deleteMany).toHaveBeenCalled();
  });

  it('solo revoca sesiones que pertenecen al usuario', async () => {
    prisma.session.updateMany.mockResolvedValue({ count: 1 });

    const revoked = await service.revokeIfOwned('session-1', 'user-1');

    expect(revoked).toBe(true);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1', revokedAt: null },
      data: expect.any(Object),
    });
  });

  it('revoca todas las sesiones excepto la indicada', async () => {
    prisma.session.updateMany.mockResolvedValue({ count: 2 });

    const revoked = await service.revokeAllForUserExcept('user-1', 'current');

    expect(revoked).toBe(2);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null, NOT: { id: 'current' } },
      data: expect.any(Object),
    });
  });
});
