import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_ENTITY, NOTIFICATION_TYPES } from '../notifications/notification-types';

describe('ModerationService', () => {
  let service: ModerationService;
  let prisma: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      story: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
      comment: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
      report: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      appeal: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      character: { findMany: vi.fn() },
    };

    notifications = { create: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  describe('createAppeal', () => {
    it('solo permite apelar contenido propio oculto', async () => {
      prisma.story.findUnique.mockResolvedValue({
        status: 'HIDDEN',
        character: { userId: 'user-1' },
      });
      prisma.appeal.findFirst.mockResolvedValue(null);
      prisma.report.findFirst.mockResolvedValue({ id: 'r1' });
      prisma.appeal.create.mockResolvedValue({
        id: 'a1',
        targetType: 'STORY',
        targetId: 's1',
        reportId: 'r1',
        message: 'mensaje apelación',
        status: 'PENDING',
        createdAt: new Date(),
        resolvedAt: null,
        resolutionNote: null,
      });

      const result = await service.createAppeal('user-1', {
        targetType: 'STORY',
        targetId: 's1',
        message: 'mensaje apelación suficiente',
      });

      expect(prisma.appeal.create).toHaveBeenCalled();
      expect(result.id).toBe('a1');
      expect(result.status).toBe('PENDING');
    });

    it('rechaza la apelación si el contenido no está oculto', async () => {
      prisma.story.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        character: { userId: 'user-1' },
      });

      await expect(
        service.createAppeal('user-1', {
          targetType: 'STORY',
          targetId: 's1',
          message: 'mensaje apelación suficiente',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza la apelación si ya existe una pendiente', async () => {
      prisma.story.findUnique.mockResolvedValue({
        status: 'MODERATED',
        character: { userId: 'user-1' },
      });
      prisma.appeal.findFirst.mockResolvedValue({ id: 'a0' });

      await expect(
        service.createAppeal('user-1', {
          targetType: 'STORY',
          targetId: 's1',
          message: 'mensaje apelación suficiente',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('devuelve 404 si el contenido no es del usuario', async () => {
      prisma.story.findUnique.mockResolvedValue({
        status: 'HIDDEN',
        character: { userId: 'user-2' },
      });

      await expect(
        service.createAppeal('user-1', {
          targetType: 'STORY',
          targetId: 's1',
          message: 'mensaje apelación suficiente',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('moderateContent', () => {
    it('oculta el relato, actualiza el reporte y notifica al autor', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        reportedType: 'STORY',
        reportedId: 's1',
        status: 'PENDING',
      });
      prisma.story.findUnique.mockResolvedValue({
        id: 's1',
        status: 'PUBLISHED',
        character: { userId: 'owner-1' },
      });
      prisma.report.update.mockResolvedValue({});
      prisma.story.update.mockResolvedValue({});

      const result = await service.moderateContent('admin-1', 'r1', { action: 'HIDE' });

      expect(prisma.story.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'HIDDEN' }) }),
      );
      expect(prisma.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'RESOLVED' }) }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NOTIFICATION_TYPES.MODERATION,
          entityType: NOTIFICATION_ENTITY.STORY,
          entityId: 's1',
          userId: 'owner-1',
          actorUserId: 'admin-1',
        }),
      );
      expect(result).toEqual({ id: 'r1', action: 'HIDE' });
    });

    it('restaura el comentario y descarta el reporte', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'r2',
        reportedType: 'COMMENT',
        reportedId: 'c1',
        status: 'PENDING',
      });
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'HIDDEN',
        storyId: 's2',
        character: { userId: 'owner-2' },
      });
      prisma.report.update.mockResolvedValue({});
      prisma.comment.update.mockResolvedValue({});

      const result = await service.moderateContent('admin-1', 'r2', { action: 'RESTORE' });

      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }),
      );
      expect(prisma.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }),
      );
      expect(notifications.create).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'r2', action: 'RESTORE' });
    });

    it('devuelve 400 si intenta moderar un tipo no soportado', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'r3',
        reportedType: 'USER',
        reportedId: 'u1',
      });

      await expect(
        service.moderateContent('admin-1', 'r3', { action: 'HIDE' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resolveAppeal', () => {
    it('acepta la apelación: restaura el relato, resuelve la apelación y notifica', async () => {
      prisma.appeal.findUnique.mockResolvedValue({
        id: 'a1',
        status: 'PENDING',
        targetType: 'STORY',
        targetId: 's1',
        appellantUserId: 'user-1',
        reportId: 'r1',
      });
      prisma.story.update.mockResolvedValue({});
      prisma.appeal.update.mockResolvedValue({});
      prisma.comment.findUnique.mockResolvedValue(null);

      const result = await service.resolveAppeal('admin-1', 'a1', { status: 'ACCEPTED' });

      expect(prisma.story.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }),
      );
      expect(prisma.appeal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACCEPTED', resolvedByUserId: 'admin-1' }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NOTIFICATION_TYPES.MODERATION,
          entityType: NOTIFICATION_ENTITY.STORY,
          entityId: 's1',
          userId: 'user-1',
        }),
      );
      expect(result).toEqual({ id: 'a1', status: 'ACCEPTED' });
    });

    it('rechaza la apelación sin modificar el contenido', async () => {
      prisma.appeal.findUnique.mockResolvedValue({
        id: 'a2',
        status: 'PENDING',
        targetType: 'COMMENT',
        targetId: 'c1',
        appellantUserId: 'user-2',
        reportId: 'r2',
      });
      prisma.appeal.update.mockResolvedValue({});
      prisma.comment.findUnique.mockResolvedValue({ storyId: 's1' });

      const result = await service.resolveAppeal('admin-1', 'a2', { status: 'REJECTED' });

      expect(prisma.comment.update).not.toHaveBeenCalled();
      expect(prisma.appeal.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: NOTIFICATION_ENTITY.STORY,
          entityId: 's1',
          userId: 'user-2',
        }),
      );
      expect(result).toEqual({ id: 'a2', status: 'REJECTED' });
    });

    it('no resuelve una apelación ya resuelta', async () => {
      prisma.appeal.findUnique.mockResolvedValue({ id: 'a3', status: 'REJECTED' });

      await expect(
        service.resolveAppeal('admin-1', 'a3', { status: 'ACCEPTED' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listReports', () => {
    it('devuelve reportes con resumen del objetivo y nombre del reportante', async () => {
      prisma.report.findMany.mockResolvedValue([
        {
          id: 'r1',
          reportedType: 'STORY',
          reportedId: 's1',
          reason: 'OFFENSIVE',
          status: 'PENDING',
          createdAt: new Date(),
          resolvedAt: null,
          reporterUserId: 'rep-1',
        },
      ]);
      prisma.report.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          reportedType: 'STORY',
          reportedId: 's1',
          reason: 'OFFENSIVE',
          status: 'PENDING',
          createdAt: new Date(),
          resolvedAt: null,
          reporterUserId: 'rep-1',
        },
      ]);
      prisma.story.findMany.mockResolvedValue([
        { id: 's1', title: 'Título', status: 'REPORTED', character: { name: 'Autor' } },
      ]);
      prisma.character.findMany.mockResolvedValue([{ userId: 'rep-1', name: 'Rep' }]);

      const result = await service.listReports({ limit: 10 });

      expect(result.items[0].target?.title).toBe('Título');
      expect(result.items[0].reporterCharacterName).toBe('Rep');
      expect(result.nextCursor).toBeNull();
    });
  });
});
