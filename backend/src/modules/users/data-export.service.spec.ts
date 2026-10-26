import { Test, TestingModule } from '@nestjs/testing';
import { DataExportService } from './data-export.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('DataExportService', () => {
  let service: DataExportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: vi.fn() },
      story: { findMany: vi.fn().mockResolvedValue([]) },
      comment: { findMany: vi.fn().mockResolvedValue([]) },
      follower: { findMany: vi.fn().mockResolvedValue([]) },
      bookmark: { findMany: vi.fn().mockResolvedValue([]) },
      emotionalLog: { findMany: vi.fn().mockResolvedValue([]) },
      treeDrop: { findMany: vi.fn().mockResolvedValue([]) },
      creation: { findMany: vi.fn().mockResolvedValue([]) },
      report: { findMany: vi.fn().mockResolvedValue([]) },
      appeal: { findMany: vi.fn().mockResolvedValue([]) },
      supportTicket: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { findMany: vi.fn().mockResolvedValue([]) },
      mediaAsset: { findMany: vi.fn().mockResolvedValue([]) },
      session: { findMany: vi.fn().mockResolvedValue([]) },
      commentDraft: { findMany: vi.fn().mockResolvedValue([]) },
      capsule: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DataExportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(DataExportService);
  });

  it('incluye los datos de la cuenta sin secretos de autenticación', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'persona@correo.com',
      isEmailVerified: true,
      role: 'USER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: 'no-debe-salir',
      preferences: null,
      oauthIdentities: [],
      deletionRequests: [],
      character: {
        id: 'c1',
        name: 'LuzEnPausa',
        tagline: null,
        avatarUrl: null,
        bio: null,
        privacySettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        interests: [],
      },
    });
    prisma.session.findMany.mockResolvedValue([
      {
        id: 's1',
        deviceInfo: 'Chrome',
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
        expiresAt: new Date(),
        revokedAt: null,
        refreshToken: 'no-debe-salir',
      },
    ]);

    const result = await service.exportAccount('u1');
    const serialized = JSON.stringify(result);

    expect(result.account.email).toBe('persona@correo.com');
    expect(serialized).not.toContain('no-debe-salir');
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('refreshToken');
    expect(result.profile?.name).toBe('LuzEnPausa');
  });

  it('falla si la cuenta no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.exportAccount('u1')).rejects.toBeTruthy();
  });
});
