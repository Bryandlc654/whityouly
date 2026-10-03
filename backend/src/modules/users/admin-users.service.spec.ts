import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionsService } from '../auth/sessions.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let sessions: { revokeAllForUser: ReturnType<typeof vi.fn> };

  const superadmin = { id: 'sa-1', role: 'SUPERADMIN', status: 'ACTIVE' };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
    };
    sessions = { revokeAllForUser: vi.fn().mockResolvedValue(2) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionsService, useValue: sessions },
      ],
    }).compile();

    service = module.get(AdminUsersService);
  });

  describe('updateRole', () => {
    it('promueve a MODERATOR y cierra sus sesiones', async () => {
      prisma.user.findUnique
        // actor
        .mockResolvedValueOnce({ role: 'SUPERADMIN' })
        // objetivo
        .mockResolvedValueOnce({ id: 'u-2', role: 'USER', status: 'ACTIVE' });
      prisma.user.update.mockResolvedValue({
        id: 'u-2',
        email: 'b@correo.com',
        isEmailVerified: true,
        role: 'MODERATOR',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { characters: 1, mediaAssets: 2, sessions: 0 },
      });

      const result = await service.updateRole('sa-1', 'u-2', 'MODERATOR');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u-2' }, data: { role: 'MODERATOR' } }),
      );
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-2');
      expect(result.role).toBe('MODERATOR');
      expect(result.counts?.media).toBe(2);
    });

    it('impide cambiarse el propio rol', async () => {
      await expect(service.updateRole('sa-1', 'sa-1', 'USER')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('impide degradar al último SUPERADMIN activo', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'SUPERADMIN' })
        .mockResolvedValueOnce({ id: 'sa-2', role: 'SUPERADMIN', status: 'ACTIVE' });
      prisma.user.count.mockResolvedValue(0);

      await expect(service.updateRole('sa-1', 'sa-2', 'ADMIN')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('permite degradar a un SUPERADMIN si queda otro activo', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'SUPERADMIN' })
        .mockResolvedValueOnce({ id: 'sa-2', role: 'SUPERADMIN', status: 'ACTIVE' });
      prisma.user.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue({
        id: 'sa-2',
        email: 'sa2@correo.com',
        isEmailVerified: true,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { characters: 0, mediaAssets: 0, sessions: 1 },
      });

      await service.updateRole('sa-1', 'sa-2', 'ADMIN');

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('permite degradar a un SUPERADMIN ya suspendido (no es el último activo)', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'SUPERADMIN' })
        .mockResolvedValueOnce({ id: 'sa-2', role: 'SUPERADMIN', status: 'SUSPENDED' });

      prisma.user.update.mockResolvedValue({
        id: 'sa-2',
        email: 'sa2@correo.com',
        isEmailVerified: true,
        role: 'USER',
        status: 'SUSPENDED',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { characters: 0, mediaAssets: 0, sessions: 0 },
      });

      await service.updateRole('sa-1', 'sa-2', 'USER');

      expect(prisma.user.count).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('no escribe nada si el rol ya es ese', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'SUPERADMIN' })
        .mockResolvedValueOnce({ id: 'u-3', role: 'MODERATOR', status: 'ACTIVE' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'u-3',
        email: 'c@correo.com',
        isEmailVerified: true,
        role: 'MODERATOR',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { characters: 0, mediaAssets: 0, sessions: 0 },
      });

      const result = await service.updateRole('sa-1', 'u-3', 'MODERATOR');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.role).toBe('MODERATOR');
    });

    it('falla si el objetivo no existe', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'SUPERADMIN' })
        .mockResolvedValueOnce(null);

      await expect(service.updateRole('sa-1', 'fantasma', 'USER')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('suspende a un usuario normal y revoca sus sesiones', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'ADMIN' })
        .mockResolvedValueOnce({ id: 'u-4', role: 'USER', status: 'ACTIVE' });
      prisma.user.update.mockResolvedValue({
        id: 'u-4',
        email: 'd@correo.com',
        isEmailVerified: true,
        role: 'USER',
        status: 'SUSPENDED',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { characters: 0, mediaAssets: 1, sessions: 3 },
      });

      const result = await service.updateStatus('admin-1', 'u-4', 'SUSPENDED');

      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-4');
      expect(result.status).toBe('SUSPENDED');
    });

    it('reactiva sin tocar sesiones', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'ADMIN' })
        .mockResolvedValueOnce({ id: 'u-5', role: 'USER', status: 'SUSPENDED' });
      prisma.user.update.mockResolvedValue({
        id: 'u-5',
        email: 'e@correo.com',
        isEmailVerified: true,
        role: 'USER',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { characters: 0, mediaAssets: 0, sessions: 0 },
      });

      await service.updateStatus('admin-1', 'u-5', 'ACTIVE');

      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('impide que un ADMIN toque a otro ADMIN', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'ADMIN' })
        .mockResolvedValueOnce({ id: 'admin-2', role: 'ADMIN', status: 'ACTIVE' });

      await expect(
        service.updateStatus('admin-1', 'admin-2', 'SUSPENDED'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('permite que un SUPERADMIN suspenda a un ADMIN', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'SUPERADMIN' })
        .mockResolvedValueOnce({ id: 'admin-2', role: 'ADMIN', status: 'ACTIVE' });
      prisma.user.update.mockResolvedValue({
        id: 'admin-2',
        email: 'admin2@correo.com',
        isEmailVerified: true,
        role: 'ADMIN',
        status: 'SUSPENDED',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { characters: 0, mediaAssets: 0, sessions: 1 },
      });

      await service.updateStatus('sa-1', 'admin-2', 'SUSPENDED');

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('impide suspender al último SUPERADMIN activo', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: 'SUPERADMIN' })
        .mockResolvedValueOnce({ id: 'sa-2', role: 'SUPERADMIN', status: 'ACTIVE' });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.updateStatus('sa-1', 'sa-2', 'SUSPENDED'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('impide cambiarse el propio estado', async () => {
      await expect(service.updateStatus('sa-1', 'sa-1', 'SUSPENDED')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('list', () => {
    it('devuelve una página más un cursor, y no una más de la pedida', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'a', email: 'a@correo.com', role: 'USER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), isEmailVerified: true, _count: {} },
        { id: 'b', email: 'b@correo.com', role: 'USER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), isEmailVerified: true, _count: {} },
        { id: 'c', email: 'c@correo.com', role: 'USER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), isEmailVerified: true, _count: {} },
      ]);

      const result = await service.list({ limit: 2 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('b');
    });

    it('no devuelve cursor cuando la página está completa', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'a', email: 'a@correo.com', role: 'USER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), isEmailVerified: true, _count: {} },
      ]);

      const result = await service.list({ limit: 5 });

      expect(result.nextCursor).toBeNull();
    });

    it('busca por correo sin distinguir mayúsculas', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.list({ search: ' Ana ' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: { contains: 'Ana', mode: 'insensitive' } },
        }),
      );
    });
  });

  it('el actor y el objetivo no pueden ser la misma cuenta', async () => {
    await expect(service.updateStatus('sa-1', 'sa-1', 'ACTIVE')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.updateRole('sa-1', 'sa-1', 'ADMIN')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(superadmin.role).toBe('SUPERADMIN');
  });
});
