import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('normaliza el email y almacena la contraseña hasheada', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'user-1', ...data }),
    );

    await service.createUser({ email: '  User@Example.COM ', passwordHash: 'Secret123' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });

    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.email).toBe('user@example.com');
    expect(createArgs.data.passwordHash).not.toBe('Secret123');
    expect(createArgs.data.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('lanza ConflictException si el correo ya está registrado', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.createUser({ email: 'a@b.com', passwordHash: 'Secret123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
