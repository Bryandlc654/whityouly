import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SupportService, sanitizeSupportBody } from './support.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    category: 'OTHER',
    body: 'Necesito ayuda con mi cuenta.',
    status: 'OPEN',
    resolutionNote: null,
    createdAt: new Date('2026-10-20T10:00:00Z'),
    updatedAt: new Date('2026-10-20T10:00:00Z'),
    resolvedAt: null,
    ...overrides,
  };
}

describe('SupportService', () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      supportTicket: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SupportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SupportService>(SupportService);
  });

  it('sanea el texto antes de guardarlo', async () => {
    prisma.supportTicket.create.mockImplementation((args: any) =>
      Promise.resolve(ticketRow({ body: args.data.body })),
    );

    const result = await service.create('user-1', {
      category: 'ACCOUNT',
      body: 'Hola\u0000, necesito   ayuda.\n\n\n\nNo puedo entrar.',
    });

    expect(result.body).toBe('Hola, necesito ayuda.\n\nNo puedo entrar.');
    expect(prisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', category: 'ACCOUNT' }),
      }),
    );
  });

  it('rechaza una solicitud que queda vacía tras sanear', async () => {
    await expect(
      service.create('user-1', { category: 'OTHER', body: '   \u0000\u0000   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it('limita la cantidad de solicitudes abiertas', async () => {
    prisma.supportTicket.count.mockResolvedValue(10);

    await expect(
      service.create('user-1', {
        category: 'OTHER',
        body: 'Necesito ayuda con un problema.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it('lista solo las solicitudes propias y filtra por estado', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([ticketRow()]);

    const result = await service.listMine('user-1', { status: 'OPEN' });

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', status: 'OPEN' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('pagina por cursor', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([
      ticketRow({ id: 't1' }),
      ticketRow({ id: 't2' }),
    ]);

    const result = await service.listMine('user-1', { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe('t1');
  });

  it('no revela solicitudes ajenas', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null);

    await expect(service.getMine('user-1', 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', userId: 'user-1' } }),
    );
  });

  it('sanitiza caracteres invisibles y conserva saltos de línea', () => {
    expect(sanitizeSupportBody('Hola\u200B\n\nMundo')).toBe('Hola\n\nMundo');
  });
});
