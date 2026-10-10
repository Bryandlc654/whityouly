import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NOTIFICATION_TYPES } from './notification-types.js';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    type: NOTIFICATION_TYPES.FOLLOW,
    status: 'UNREAD',
    entityType: 'CHARACTER',
    entityId: 'char-2',
    actorCharacterId: 'char-1',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      character: { findMany: vi.fn().mockResolvedValue([]) },
      story: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('persiste una notificación', async () => {
    await service.create({
      userId: 'user-2',
      type: NOTIFICATION_TYPES.FOLLOW,
      entityType: 'CHARACTER',
      entityId: 'char-2',
      actorCharacterId: 'char-1',
      actorUserId: 'user-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-2',
        type: NOTIFICATION_TYPES.FOLLOW,
        entityType: 'CHARACTER',
        entityId: 'char-2',
        actorCharacterId: 'char-1',
      },
    });
  });

  it('descarta las notificaciones a uno mismo', async () => {
    await service.create({
      userId: 'user-1',
      type: NOTIFICATION_TYPES.COMMENT,
      entityType: 'STORY',
      entityId: 'story-1',
      actorCharacterId: 'char-1',
      actorUserId: 'user-1',
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('nunca rompe la acción que origina la notificación si la base falla', async () => {
    prisma.notification.create.mockRejectedValue(new Error('conexión caída'));

    await expect(
      service.create({
        userId: 'user-2',
        type: NOTIFICATION_TYPES.SYSTEM,
        entityType: 'SYSTEM',
      }),
    ).resolves.toBeUndefined();
  });

  it('lista notificaciones resolviendo actores, relatos y el contador de no leídas', async () => {
    prisma.notification.findMany.mockResolvedValue([row()]);
    prisma.character.findMany.mockResolvedValue([
      { id: 'char-1', name: 'LuzEnPausa', avatarUrl: null },
    ]);
    prisma.notification.count.mockResolvedValue(3);

    const result = await service.list('user-2', {});

    expect(result.items).toHaveLength(1);
    expect(result.items[0].actor).toEqual({ name: 'LuzEnPausa', avatarUrl: null });
    expect(result.unreadCount).toBe(3);
    expect(result.nextCursor).toBeNull();
  });

  it('resuelve el relato asociado a la notificación', async () => {
    prisma.notification.findMany.mockResolvedValue([
      row({ type: NOTIFICATION_TYPES.COMPANIONSHIP, entityType: 'STORY', entityId: 'story-1' }),
    ]);
    prisma.story.findMany.mockResolvedValue([
      { id: 'story-1', title: 'Hoy dejé de fingir', character: { name: 'LuzEnPausa', avatarUrl: null } },
    ]);

    const result = await service.list('user-2', {});

    expect(result.items[0].story).toEqual({
      id: 'story-1',
      title: 'Hoy dejé de fingir',
      author: { name: 'LuzEnPausa', avatarUrl: null },
    });
  });

  it('responde 404 al marcar como leída una notificación ajena o inexistente', async () => {
    await expect(service.markRead('user-2', 'n1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marca como leída una notificación propia que sigue sin marcar', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.markRead('user-2', 'n1')).resolves.toEqual({
      id: 'n1',
      status: 'READ',
    });
  });

  it('marca todas como leídas y devuelve cuántas cambió', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 5 });

    await expect(service.markAllRead('user-2')).resolves.toEqual({ updated: 5 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-2', status: 'UNREAD' },
      data: { status: 'READ' },
    });
  });
});