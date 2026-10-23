import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
      story: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      comment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      report: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      appeal: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      moderationAction: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
        updateMany: vi.fn(),
      },
      session: { updateMany: vi.fn() },
      creation: { findUnique: vi.fn(), findMany: vi.fn() },
      character: { findMany: vi.fn() },
    };

    prisma.$transaction = vi.fn((callback: (tx: unknown) => unknown) => callback(prisma));

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
      prisma.story.findUnique.mockResolvedValue({ status: 'HIDDEN' });
      prisma.story.update.mockResolvedValue({});
      prisma.appeal.update.mockResolvedValue({});
      prisma.comment.findUnique.mockResolvedValue(null);
      prisma.moderationAction.create.mockResolvedValue({ id: 'act-1' });

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

  describe('updateReport', () => {
    it('no permite resolver sin una decisión auditada', async () => {
      prisma.report.findUnique.mockResolvedValue({ id: 'r1', status: 'PENDING' });

      await expect(
        service.updateReport('admin-1', 'r1', { status: 'RESOLVED' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.report.update).not.toHaveBeenCalled();
    });

    it('limpia la fecha de resolución al volver a en revisión', async () => {
      prisma.report.findUnique.mockResolvedValue({ id: 'r1', status: 'RESOLVED' });
      prisma.report.update.mockResolvedValue({});

      await service.updateReport('admin-1', 'r1', { status: 'IN_REVIEW' });

      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({ status: 'IN_REVIEW', resolvedAt: null }),
      });
    });

    it('devuelve 404 si el reporte no existe', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(
        service.updateReport('admin-1', 'r1', { status: 'RESOLVED' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('decideReport', () => {
    it('oculta el relato y registra la decisión con actor y motivo', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        reportedType: 'STORY',
        reportedId: 's1',
        status: 'PENDING',
      });
      prisma.story.findUnique.mockResolvedValue({
        id: 's1',
        status: 'PUBLISHED',
        character: {
          userId: 'owner-1',
          user: { role: 'USER', status: 'ACTIVE' },
        },
      });
      prisma.story.updateMany.mockResolvedValue({ count: 1 });
      prisma.report.update.mockResolvedValue({});
      prisma.moderationAction.create.mockResolvedValue({ id: 'act-1' });

      const result = await service.decideReport('admin-1', 'r1', {
        action: 'HIDE',
        reason: 'El relato incumple las normas de la comunidad.',
      });

      expect(prisma.story.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'HIDDEN' }) }),
      );
      expect(prisma.moderationAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'HIDE',
            actorUserId: 'admin-1',
            targetId: 's1',
            reason: 'El relato incumple las normas de la comunidad.',
          }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'owner-1', type: NOTIFICATION_TYPES.MODERATION }),
      );
      expect(result).toEqual({
        id: 'act-1',
        reportId: 'r1',
        action: 'HIDE',
        reportStatus: 'RESOLVED',
      });
    });

    it('suspende la cuenta autora y revoca sus sesiones', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'owner-1', role: 'USER', status: 'ACTIVE' });
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        reportedType: 'STORY',
        reportedId: 's1',
        status: 'PENDING',
      });
      prisma.story.findUnique.mockResolvedValue({
        id: 's1',
        status: 'PUBLISHED',
        character: {
          userId: 'owner-1',
          user: { role: 'USER', status: 'ACTIVE' },
        },
      });
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.session.updateMany.mockResolvedValue({ count: 2 });
      prisma.report.update.mockResolvedValue({});
      prisma.moderationAction.create.mockResolvedValue({ id: 'act-2' });

      await service.decideReport('admin-1', 'r1', {
        action: 'SUSPEND',
        reason: 'La cuenta reincide en acoso.',
      });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'owner-1', status: 'ACTIVE' },
        data: { status: 'SUSPENDED' },
      });
      expect(prisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'owner-1', revokedAt: null } }),
      );
      expect(prisma.moderationAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SUSPEND',
            subjectUserId: 'owner-1',
          }),
        }),
      );
    });

    it('un MODERATOR no puede suspender a un ADMIN', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'mod-1', role: 'MODERATOR', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'admin-2', role: 'ADMIN', status: 'ACTIVE' });
      prisma.report.findUnique.mockResolvedValue({
        id: 'r2',
        reportedType: 'USER',
        reportedId: 'admin-2',
        status: 'PENDING',
      });

      await expect(
        service.decideReport('mod-1', 'r2', {
          action: 'SUSPEND',
          reason: 'Intento fuera de su jerarquía.',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('no decide sobre un reporte ya resuelto', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        reportedType: 'STORY',
        reportedId: 's1',
        status: 'RESOLVED',
      });

      await expect(
        service.decideReport('admin-1', 'r1', {
          action: 'DISMISS',
          reason: 'Ya estaba resuelto.',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.moderationAction.create).not.toHaveBeenCalled();
    });
  });

  describe('revertAction', () => {
    it('restaura el relato oculto y reabre el reporte', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      prisma.moderationAction.findUnique.mockResolvedValue({
        id: 'act-1',
        reportId: 'r1',
        actorUserId: 'admin-1',
        action: 'HIDE',
        targetType: 'STORY',
        targetId: 's1',
        subjectUserId: null,
        reason: 'Contenido oculto.',
        createdAt: new Date(),
        revertedAt: null,
        revertedByUserId: null,
        revertReason: null,
      });
      prisma.story.findUnique.mockResolvedValue({ status: 'HIDDEN' });
      prisma.story.update.mockResolvedValue({});
      prisma.report.updateMany.mockResolvedValue({ count: 1 });
      prisma.moderationAction.updateMany.mockResolvedValue({ count: 1 });
      prisma.moderationAction.findUniqueOrThrow.mockResolvedValue({
        id: 'act-1',
        reportId: 'r1',
        revertedAt: new Date(),
      });

      const result = await service.revertAction('admin-1', 'act-1', {
        reason: 'La revisión mostró que no incumplía las normas.',
      });

      expect(prisma.story.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }),
      );
      expect(prisma.report.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PENDING', resolvedAt: null } }),
      );
      expect(prisma.moderationAction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'act-1', revertedAt: null },
          data: expect.objectContaining({
            revertedByUserId: 'admin-1',
            revertReason: 'La revisión mostró que no incumplía las normas.',
          }),
        }),
      );
      expect(result.id).toBe('act-1');
    });

    it('no revierte dos veces la misma decisión', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      prisma.moderationAction.findUnique.mockResolvedValue({
        id: 'act-1',
        action: 'HIDE',
        revertedAt: new Date(),
      });

      await expect(
        service.revertAction('admin-1', 'act-1', { reason: 'Otra vez.' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listMyAppeals', () => {
    it('devuelve las apelaciones del usuario con resumen del objetivo', async () => {
      prisma.appeal.findMany.mockResolvedValue([
        {
          id: 'a1',
          targetType: 'STORY',
          targetId: 's1',
          reportId: 'r1',
          message: 'Mi relato no incumple las normas',
          status: 'PENDING',
          createdAt: new Date('2026-10-01T10:00:00Z'),
          resolvedAt: null,
          resolutionNote: null,
          appellantUserId: 'user-1',
        },
      ]);
      prisma.story.findMany.mockResolvedValue([
        { id: 's1', title: 'Relato', status: 'HIDDEN', character: { name: 'Autor' } },
      ]);
      prisma.character.findMany.mockResolvedValue([{ userId: 'user-1', name: 'Yo' }]);

      const result = await service.listMyAppeals('user-1', { limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'a1',
        targetType: 'STORY',
        status: 'PENDING',
        target: expect.objectContaining({ title: 'Relato' }),
      });
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('listAppeals', () => {
    it('devuelve las apelaciones con el nombre del apelante', async () => {
      prisma.appeal.findMany.mockResolvedValue([
        {
          id: 'a9',
          targetType: 'COMMENT',
          targetId: 'c1',
          reportId: null,
          message: 'Comentario mío, apelo la decisión',
          status: 'PENDING',
          createdAt: new Date('2026-10-02T10:00:00Z'),
          resolvedAt: null,
          resolutionNote: null,
          appellantUserId: 'user-5',
        },
      ]);
      prisma.comment.findMany.mockResolvedValue([
        {
          id: 'c1',
          content: 'Un comentario',
          status: 'HIDDEN',
          storyId: 's1',
          character: { name: 'Autor' },
        },
      ]);
      prisma.character.findMany.mockResolvedValue([{ userId: 'user-5', name: 'Apelante' }]);

      const result = await service.listAppeals({ limit: 10 });

      expect(result.items[0]).toMatchObject({
        id: 'a9',
        targetType: 'COMMENT',
        appellantCharacterName: 'Apelante',
        target: expect.objectContaining({ storyId: 's1' }),
      });
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
