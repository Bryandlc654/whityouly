import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Exportación de datos de la propia cuenta. Incluye metadatos y contenido
 * escrito por la persona, pero nunca secretos de autenticación ni objetos
 * binarios. Los medios se referencian por URL para que la persona sepa qué
 * archivos le pertenecen.
 */
@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        preferences: true,
        oauthIdentities: { select: { provider: true, createdAt: true } },
        deletionRequests: {
          orderBy: { requestedAt: 'desc' },
          select: {
            requestedAt: true,
            eligibleAt: true,
            cancelledAt: true,
            completedAt: true,
          },
        },
        character: {
          select: {
            id: true,
            name: true,
            tagline: true,
            avatarUrl: true,
            bio: true,
            privacySettings: true,
            createdAt: true,
            updatedAt: true,
            interests: { select: { interest: { select: { name: true } } } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Cuenta no encontrada.');
    }

    const characterId = user.character?.id ?? null;

    const [
      stories,
      comments,
      follows,
      saved,
      emotionalLogs,
      treeDrops,
      creations,
      reports,
      appeals,
      supportTickets,
      notifications,
      mediaAssets,
      sessions,
      commentDrafts,
      capsules,
    ] = await Promise.all([
      characterId
        ? this.prisma.story.findMany({
            where: { characterId },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              title: true,
              visibility: true,
              status: true,
              featuredAt: true,
              withdrawnAt: true,
              createdAt: true,
              updatedAt: true,
              categories: { select: { category: { select: { name: true } } } },
              emotions: {
                select: { emotion: { select: { name: true, colorHex: true } } },
              },
              tags: { select: { tag: { select: { name: true } } } },
              updates: {
                orderBy: { stageOrder: 'asc' },
                select: {
                  content: true,
                  stageOrder: true,
                  createdAt: true,
                  mediaAsset: { select: { fileUrl: true } },
                  audioAsset: { select: { fileUrl: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      characterId
        ? this.prisma.comment.findMany({
            where: { characterId },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              storyId: true,
              parentId: true,
              content: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      characterId
        ? this.prisma.follower.findMany({
            where: { followerId: characterId },
            orderBy: { createdAt: 'asc' },
            select: {
              createdAt: true,
              followingCharacter: { select: { name: true } },
              followingStory: { select: { id: true, title: true } },
            },
          })
        : Promise.resolve([]),
      this.prisma.bookmark.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { targetType: true, targetId: true, createdAt: true },
      }),
      this.prisma.emotionalLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'asc' },
        select: {
          intensity: true,
          contextNote: true,
          loggedAt: true,
          createdAt: true,
          emotion: { select: { name: true, colorHex: true } },
        },
      }),
      this.prisma.treeDrop.findMany({
        where: { userId },
        orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
        select: { path: true, day: true, createdAt: true },
      }),
      this.prisma.creation.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          type: true,
          title: true,
          content: true,
          visibility: true,
          aiMetadata: true,
          createdAt: true,
          updatedAt: true,
          mediaAsset: { select: { fileUrl: true } },
        },
      }),
      this.prisma.report.findMany({
        where: { reporterUserId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          reportedType: true,
          reportedId: true,
          reason: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
        },
      }),
      this.prisma.appeal.findMany({
        where: { appellantUserId: userId },
        orderBy: { createdAt: 'asc' },
        select: {
          targetType: true,
          targetId: true,
          reportId: true,
          message: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          resolutionNote: true,
        },
      }),
      this.prisma.supportTicket.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          category: true,
          body: true,
          status: true,
          resolutionNote: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
        },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          type: true,
          entityType: true,
          entityId: true,
          count: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.mediaAsset.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          fileUrl: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          width: true,
          height: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
      this.prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        // Nunca se incluye el refresh token, solo metadatos de dispositivo.
        select: {
          id: true,
          deviceInfo: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
      this.prisma.commentDraft.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { storyId: true, content: true, updatedAt: true },
      }),
      this.prisma.capsule.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { content: true, mood: true, openAt: true, createdAt: true, updatedAt: true },
      }),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        preferences: user.preferences,
        oauthIdentities: user.oauthIdentities,
        deletionRequests: user.deletionRequests,
      },
      profile: user.character
        ? {
            id: user.character.id,
            name: user.character.name,
            tagline: user.character.tagline,
            avatarUrl: user.character.avatarUrl,
            bio: user.character.bio,
            privacySettings: user.character.privacySettings,
            interests: user.character.interests.map(({ interest }) => interest.name),
            createdAt: user.character.createdAt,
            updatedAt: user.character.updatedAt,
          }
        : null,
      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        visibility: story.visibility,
        status: story.status,
        featuredAt: story.featuredAt,
        withdrawnAt: story.withdrawnAt,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
        categories: story.categories.map(({ category }) => category.name),
        emotions: story.emotions.map(({ emotion }) => emotion),
        tags: story.tags.map(({ tag }) => tag.name),
        updates: story.updates.map((stage) => ({
          content: stage.content,
          stageOrder: stage.stageOrder,
          createdAt: stage.createdAt,
          mediaUrl: stage.mediaAsset?.fileUrl ?? null,
          audioUrl: stage.audioAsset?.fileUrl ?? null,
        })),
      })),
      comments,
      following: follows.map((row) => ({
        createdAt: row.createdAt,
        character: row.followingCharacter?.name ?? null,
        story: row.followingStory,
      })),
      saved,
      emotionalLogs,
      treeDrops,
      creations: creations.map((creation) => ({
        ...creation,
        mediaUrl: creation.mediaAsset?.fileUrl ?? null,
        mediaAsset: undefined,
      })),
      reports,
      appeals,
      supportTickets,
      notifications,
      commentDrafts,
      capsules,
      mediaFiles: mediaAssets.map((asset) => ({
        ...asset,
        // BigInt no se puede serializar directamente en JSON.
        sizeBytes: asset.sizeBytes === null ? null : asset.sizeBytes.toString(),
      })),
      // Se mapea explícitamente: aunque el repositorio devolviera de más, el
      // refresh token nunca forma parte de la exportación.
      sessions: sessions.map((session) => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
      })),
    };
  }
}
