import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, CommentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoriesService } from '../stories/stories.service';
import { sanitizeCommentContent } from './comment-sanitize';
import {
  CreateCommentDto,
  EditCommentDto,
  ListCommentsQueryDto,
  ReportCommentDto,
} from './dto/comment.dto';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const COMMENT_SELECT = {
  id: true,
  content: true,
  status: true,
  parentId: true,
  characterId: true,
  createdAt: true,
  updatedAt: true,
  character: { select: { name: true, avatarUrl: true } },
} satisfies Prisma.CommentSelect;

interface CommentRow {
  id: string;
  content: string;
  status: string;
  parentId: string | null;
  characterId: string;
  createdAt: Date;
  updatedAt: Date;
  character: { name: string; avatarUrl: string | null };
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storiesService: StoriesService,
  ) {}

  async create(userId: string, storyId: string, dto: CreateCommentDto) {
    // El comentario exige poder ver el relato (propietario, seguidor o público).
    await this.storiesService.assertStoryVisible(userId, storyId);
    const character = await this.requireCommenterCharacter(userId);

    const content = sanitizeCommentContent(dto.content);
    if (!content) {
      throw new BadRequestException('El comentario no puede estar vacío.');
    }

    let parentId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, storyId },
        select: { id: true, parentId: true, status: true },
      });
      // Se permite una sola profundidad de respuesta: solo se responde a
      // comentarios de primer nivel.
      if (!parent || parent.parentId !== null) {
        throw new BadRequestException('Solo se puede responder a un comentario de primer nivel.');
      }
      if (parent.status !== CommentStatus.ACTIVE) {
        throw new NotFoundException('El comentario al que respondes ya no está disponible.');
      }
      parentId = parent.id;
    }

    const comment = await this.prisma.comment.create({
      data: { storyId, characterId: character.id, parentId, content },
      select: COMMENT_SELECT,
    });

    await this.track('comment.created', { userId, storyId, commentId: comment.id });

    return this.toView(comment, character.id);
  }

  async list(userId: string, storyId: string, query: ListCommentsQueryDto) {
    await this.storiesService.assertStoryVisible(userId, storyId);

    const viewer = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    // Los comentarios moderados/ocultos no se devuelven; los borrados se
    // muestran como "comentario eliminado" para no romper la jerarquía.
    const rows = await this.prisma.comment.findMany({
      where: { storyId, status: { in: [CommentStatus.ACTIVE, CommentStatus.DELETED] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: COMMENT_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const commentCount = await this.prisma.comment.count({
      where: { storyId, status: CommentStatus.ACTIVE },
    });

    return {
      items: items.map((row) => this.toView(row, viewer?.id ?? null)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      commentCount,
    };
  }

  async edit(userId: string, commentId: string, dto: EditCommentDto) {
    const comment = await this.findCommentOrThrow(commentId);

    if (comment.authorUserId !== userId) {
      throw new ForbiddenException('No puedes editar un comentario que no es tuyo.');
    }
    if (comment.status !== CommentStatus.ACTIVE) {
      throw new BadRequestException('Este comentario ya no se puede editar.');
    }

    const content = sanitizeCommentContent(dto.content);
    if (!content) {
      throw new BadRequestException('El comentario no puede estar vacío.');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
      select: COMMENT_SELECT,
    });

    return this.toView(updated, updated.characterId);
  }

  async remove(userId: string, commentId: string) {
    const comment = await this.findCommentOrThrow(commentId);

    if (comment.authorUserId !== userId) {
      throw new ForbiddenException('No puedes eliminar un comentario que no es tuyo.');
    }

    if (comment.status !== CommentStatus.DELETED) {
      // Baja lógica: se borra el texto para no retener contenido eliminado y el
      // comentario se muestra como "eliminado" para conservar la jerarquía.
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { status: CommentStatus.DELETED, content: '' },
      });
      await this.track('comment.deleted', { userId, commentId });
    }

    return { id: commentId };
  }

  async report(userId: string, commentId: string, dto: ReportCommentDto) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, status: CommentStatus.ACTIVE },
      select: { id: true },
    });

    if (!comment) {
      throw new NotFoundException('Ese comentario no existe o ya no está disponible.');
    }

    const existing = await this.prisma.report.findFirst({
      where: { reporterUserId: userId, reportedType: 'COMMENT', reportedId: commentId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Ya reportaste este comentario.');
    }

    await this.prisma.report.create({
      data: {
        reporterUserId: userId,
        reportedType: 'COMMENT',
        reportedId: commentId,
        reason: dto.reason,
      },
    });

    return { reported: true };
  }

  private async requireCommenterCharacter(userId: string): Promise<{ id: string }> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      throw new ForbiddenException('Necesitas crear tu personaje para comentar.');
    }

    return character;
  }

  private async findCommentOrThrow(commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        status: true,
        characterId: true,
        character: { select: { userId: true } },
      },
    });

    if (!comment) {
      throw new NotFoundException('Ese comentario no existe.');
    }

    return { ...comment, authorUserId: comment.character.userId };
  }

  private toView(row: CommentRow, viewerCharacterId: string | null) {
    // Los comentarios no activos (borrados) se sirven sin contenido.
    const deleted = row.status !== CommentStatus.ACTIVE;

    return {
      id: row.id,
      content: deleted ? null : row.content,
      deleted,
      parentId: row.parentId,
      author: { name: row.character.name, avatarUrl: row.character.avatarUrl },
      isOwn: row.characterId === viewerCharacterId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async track(
    eventType: string,
    data: { userId: string; storyId?: string; commentId: string },
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventType,
          userId: data.userId,
          entityType: 'comment',
          entityId: data.commentId,
        },
      });
    } catch (error) {
      this.logger.warn(`No se pudo registrar ${eventType}: ${(error as Error).message}`);
    }
  }
}