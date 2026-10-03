import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { AccountService } from './account.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';
import { SessionsService } from '../auth/sessions.service';
import { PasswordBreachService } from '../auth/password-breach.service';

describe('AccountService', () => {
  let service: AccountService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    userPreference: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    character: { count: ReturnType<typeof vi.fn> };
    mediaAsset: { count: ReturnType<typeof vi.fn> };
  };
  let usersService: { updatePassword: ReturnType<typeof vi.fn> };
  let sessions: {
    revokeAllForUser: ReturnType<typeof vi.fn>;
    listActiveForUser: ReturnType<typeof vi.fn>;
  };
  let breach: { isBreached: ReturnType<typeof vi.fn> };
  let jwt: { signAsync: ReturnType<typeof vi.fn>; decode: ReturnType<typeof vi.fn>; verifyAsync: ReturnType<typeof vi.fn> };
  let mailer: { sendMail: ReturnType<typeof vi.fn> };

  // bcrypt real: las comparaciones son el corazón de estos flujos.
  let currentHash: string;

  beforeEach(async () => {
    currentHash = await bcrypt.hash('Actual1234', 4);

    prisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      userPreference: { findUnique: vi.fn(), upsert: vi.fn() },
      character: { count: vi.fn().mockResolvedValue(1) },
      mediaAsset: { count: vi.fn().mockResolvedValue(4) },
    };
    usersService = { updatePassword: vi.fn().mockResolvedValue({}) };
    sessions = {
      revokeAllForUser: vi.fn().mockResolvedValue(3),
      listActiveForUser: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
    };
    breach = { isBreached: vi.fn().mockResolvedValue(false) };
    jwt = {
      signAsync: vi.fn().mockResolvedValue('token-firmado'),
      decode: vi.fn(),
      verifyAsync: vi.fn().mockResolvedValue({}),
    };
    mailer = { sendMail: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: SessionsService, useValue: sessions },
        { provide: PasswordBreachService, useValue: breach },
        { provide: JwtService, useValue: jwt },
        { provide: MailerService, useValue: mailer },
      ],
    }).compile();

    service = module.get(AccountService);
  });

  describe('getAccount', () => {
    it('devuelve los valores por defecto cuando no hay preferencias guardadas', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        isEmailVerified: true,
        role: 'USER',
        status: 'ACTIVE',
        createdAt: new Date(),
      });
      prisma.userPreference.findUnique.mockResolvedValue(null);

      const result = await service.getAccount('u-1');

      expect(result.preferences).toEqual({
        emailNotifications: true,
        pushNotifications: true,
        theme: 'light',
        language: 'es',
      });
      expect(result.usage).toEqual({ characters: 1, media: 4 });
      expect(result.activeSessions).toBe(2);
    });

    it('falla si la cuenta no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getAccount('fantasma')).rejects.toThrow('Cuenta no encontrada');
    });
  });

  describe('updatePreferences', () => {
    it('solo guarda los campos enviados', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });
      prisma.userPreference.upsert.mockResolvedValue({
        emailNotifications: false,
        pushNotifications: true,
        theme: 'dark',
        language: 'es',
      });

      await service.updatePreferences('u-1', { theme: 'dark', emailNotifications: false });

      expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
        where: { userId: 'u-1' },
        create: { userId: 'u-1', theme: 'dark', emailNotifications: false },
        update: { theme: 'dark', emailNotifications: false },
        select: {
          emailNotifications: true,
          pushNotifications: true,
          theme: true,
          language: true,
        },
      });
    });

    it('no manda campos undefined: los borraría en la base', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });
      prisma.userPreference.upsert.mockResolvedValue({});

      await service.updatePreferences('u-1', { theme: 'system' });

      const call = prisma.userPreference.upsert.mock.calls[0][0];
      expect(Object.keys(call.update)).toEqual(['theme']);
      expect('pushNotifications' in call.update).toBe(false);
    });
  });

  describe('changePassword', () => {
    const dto = { currentPassword: 'Actual1234', newPassword: 'Nueva12345' };

    it('cambia la contraseña y cierra todas las sesiones', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        passwordHash: currentHash,
      });

      const result = await service.changePassword('u-1', dto);

      expect(usersService.updatePassword).toHaveBeenCalledWith('u-1', 'Nueva12345');
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-1');
      expect(result.revokedSessions).toBe(3);
    });

    it('rechaza una contraseña actual incorrecta sin tocar nada', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        passwordHash: currentHash,
      });

      await expect(
        service.changePassword('u-1', { ...dto, currentPassword: 'Incorrecta1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('rechaza repetir la misma contraseña', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        passwordHash: currentHash,
      });

      await expect(
        service.changePassword('u-1', { currentPassword: 'Actual1234', newPassword: 'Actual1234' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('rechaza contraseñas filtradas antes de escribir', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        passwordHash: currentHash,
      });
      breach.isBreached.mockResolvedValue(true);

      await expect(service.changePassword('u-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(usersService.updatePassword).not.toHaveBeenCalled();
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('avisa por correo del cambio', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        passwordHash: currentHash,
      });

      await service.changePassword('u-1', dto);

      expect(mailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@correo.com' }),
      );
    });
  });

  describe('requestEmailChange', () => {
    const dto = { newEmail: 'Nuevo@Correo.com', currentPassword: 'Actual1234' };

    it('manda el enlace al correo nuevo y avisa al antiguo', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'u-1',
          email: 'viejo@correo.com',
          passwordHash: currentHash,
        })
        // segunda llamada: comprobar que el correo nuevo está libre
        .mockResolvedValueOnce(null);

      const result = await service.requestEmailChange('u-1', dto);

      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u-1', email: 'nuevo@correo.com', type: 'email-change' }),
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      const destinations = mailer.sendMail.mock.calls.map((call) => call[0].to);
      expect(destinations).toEqual(['nuevo@correo.com', 'viejo@correo.com']);
      expect(result.message).toContain('nuevo@correo.com');
    });

    it('no aplica el cambio: solo envía el enlace', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'u-1',
          email: 'viejo@correo.com',
          passwordHash: currentHash,
        })
        .mockResolvedValueOnce(null);

      await service.requestEmailChange('u-1', dto);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rechaza si el correo nuevo ya está en uso', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'u-1',
          email: 'viejo@correo.com',
          passwordHash: currentHash,
        })
        .mockResolvedValueOnce({ id: 'u-99' });

      await expect(service.requestEmailChange('u-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('rechaza el mismo correo actual', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'viejo@correo.com',
        passwordHash: currentHash,
      });

      await expect(
        service.requestEmailChange('u-1', { ...dto, newEmail: 'Viejo@Correo.com' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('exige la contraseña actual', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'viejo@correo.com',
        passwordHash: currentHash,
      });

      await expect(
        service.requestEmailChange('u-1', { ...dto, currentPassword: 'Mal1234' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('confirmEmailChange', () => {
    it('aplica el cambio, verifica el correo y cierra sesiones', async () => {
      jwt.decode.mockReturnValue({
        sub: 'u-1',
        email: 'nuevo@correo.com',
        from: 'viejo@correo.com',
        type: 'email-change',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'viejo@correo.com',
        passwordHash: currentHash,
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({
        id: 'u-1',
        email: 'nuevo@correo.com',
        isEmailVerified: true,
      });

      const result = await service.confirmEmailChange({ token: 'tok' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { email: 'nuevo@correo.com', isEmailVerified: true },
        select: { id: true, email: true, isEmailVerified: true },
      });
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-1');
      expect(result.email).toBe('nuevo@correo.com');
    });

    it('no deja reutilizar el enlace: el correo ya no es el de partida', async () => {
      jwt.decode.mockReturnValue({
        sub: 'u-1',
        email: 'nuevo@correo.com',
        from: 'viejo@correo.com',
        type: 'email-change',
      });
      // Segundo uso: la base ya tiene el correo nuevo.
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'nuevo@correo.com',
        passwordHash: currentHash,
      });

      await expect(service.confirmEmailChange({ token: 'tok' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rechaza un token de otro propósito (por ejemplo, restablecer contraseña)', async () => {
      jwt.decode.mockReturnValue({ sub: 'u-1', email: 'x@correo.com', type: 'password-reset' });

      await expect(service.confirmEmailChange({ token: 'tok' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
    });

    it('rechaza si la firma no valida', async () => {
      jwt.decode.mockReturnValue({
        sub: 'u-1',
        email: 'nuevo@correo.com',
        from: 'viejo@correo.com',
        type: 'email-change',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'viejo@correo.com',
        passwordHash: currentHash,
      });
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.confirmEmailChange({ token: 'tok' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('no aplica el cambio si el correo se ocupó mientras tanto', async () => {
      jwt.decode.mockReturnValue({
        sub: 'u-1',
        email: 'nuevo@correo.com',
        from: 'viejo@correo.com',
        type: 'email-change',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'viejo@correo.com',
        passwordHash: currentHash,
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'u-42' });

      await expect(service.confirmEmailChange({ token: 'tok' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    const dto = { currentPassword: 'Actual1234', confirmation: 'eliminar' };

    it('marca DELETED y cierra sesiones sin borrar datos', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        passwordHash: currentHash,
        role: 'USER',
      });

      const result = await service.deleteAccount('u-1', dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { status: 'DELETED' },
      });
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-1');
      expect(result.message).toContain('baja');
    });

    it('exige la palabra de confirmación', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        passwordHash: currentHash,
        role: 'USER',
      });

      await expect(
        service.deleteAccount('u-1', { ...dto, confirmation: 'vale' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('exige la contraseña actual', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'a@correo.com',
        passwordHash: currentHash,
        role: 'USER',
      });

      await expect(
        service.deleteAccount('u-1', { ...dto, currentPassword: 'Mal1234' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('impide que se baje el último SUPERADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'sa-1',
        email: 'sa@correo.com',
        passwordHash: currentHash,
        role: 'SUPERADMIN',
      });
      prisma.user.count = vi.fn().mockResolvedValue(0);

      await expect(service.deleteAccount('sa-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
