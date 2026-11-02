import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TreePath } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeService } from '../tree/tree.service';
import {
  CreateDiaryNoteDto,
  DiaryEntryType,
  DiaryQueryDto,
  UpdateDiaryNoteDto,
} from './dto/diary.dto';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;
const MAX_NOTES_PER_USER = 5000;

const NOTE_SELECT = {
  id: true,
  title: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.DiaryNoteSelect;

const EMOTIONAL_SELECT = {
  id: true,
  intensity: true,
  contextNote: true,
  loggedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  emotion: { select: { name: true, colorHex: true } },
} satisfies Prisma.EmotionalLogSelect;

type NoteRow = Prisma.DiaryNoteGetPayload<{ select: typeof NOTE_SELECT }>;
type EmotionalRow = Prisma.EmotionalLogGetPayload<{ select: typeof EMOTIONAL_SELECT }>;

export interface DiaryEntryView {
  kind: 'NOTE' | 'EMOTIONAL';
  id: string;
  title: string | null;
  content: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  emotion: { name: string; colorHex: string | null } | null;
  intensity: number | null;
}

@Injectable()
export class DiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tree: TreeService,
  ) {}

  async list(userId: string, query: DiaryQueryDto) {
    const take = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const type = query.type ?? DiaryEntryType.ALL;
    const trash = query.trash === true;
    const search = query.q?.trim() || '';
    const range = this.rangeFilter(query.from, query.to);
    const cursor = this.cursor(query.before, query.beforeId);

    const noteWhere: Prisma.DiaryNoteWhereInput = {
      userId,
      ...(trash ? { deletedAt: { not: null } } : { deletedAt: null }),
      ...(range ? { createdAt: range } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { content: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(cursor ? { AND: [this.noteCursorWhere(cursor, trash)] } : {}),
    };

    const emotionalWhere: Prisma.EmotionalLogWhereInput = {
      userId,
      ...(trash ? { deletedAt: { not: null } } : { deletedAt: null }),
      ...(range ? { loggedAt: range } : {}),
      ...(search
        ? {
            OR: [
              { contextNote: { contains: search, mode: 'insensitive' } },
              { emotion: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(cursor ? { AND: [this.emotionalCursorWhere(cursor, trash)] } : {}),
    };

    const [notes, emotional, noteTrashCount, emotionalTrashCount] = await Promise.all([
      type === DiaryEntryType.EMOTIONAL
        ? Promise.resolve([] as NoteRow[])
        : this.prisma.diaryNote.findMany({
            where: noteWhere,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: take + 1,
            select: NOTE_SELECT,
          }),
      type === DiaryEntryType.NOTE
        ? Promise.resolve([] as EmotionalRow[])
        : this.prisma.emotionalLog.findMany({
            where: emotionalWhere,
            orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
            take: take + 1,
            select: EMOTIONAL_SELECT,
          }),
      this.prisma.diaryNote.count({ where: { userId, deletedAt: { not: null } } }),
      this.prisma.emotionalLog.count({ where: { userId, deletedAt: { not: null } } }),
    ]);

    const entries = [
      ...notes.map((row) => this.noteView(row)),
      ...emotional.map((row) => this.emotionalView(row)),
    ].sort((a, b) => {
      const aDate = trash ? (a.deletedAt ?? a.occurredAt) : a.occurredAt;
      const bDate = trash ? (b.deletedAt ?? b.occurredAt) : b.occurredAt;
      const byDate = bDate.getTime() - aDate.getTime();
      if (byDate !== 0) return byDate;
      return b.id > a.id ? 1 : b.id < a.id ? -1 : 0;
    });

    const items = entries.slice(0, take);
    const last = items[items.length - 1];
    const hasMore = entries.length > take;
    const lastDate = last ? (trash ? (last.deletedAt ?? last.occurredAt) : last.occurredAt) : null;

    return {
      items,
      trashCount: noteTrashCount + emotionalTrashCount,
      nextCursor: hasMore && last && lastDate ? { at: lastDate.toISOString(), id: last.id } : null,
    };
  }
  async createNote(userId: string, dto: CreateDiaryNoteDto): Promise<DiaryEntryView> {
    const total = await this.prisma.diaryNote.count({ where: { userId, deletedAt: null } });
    if (total >= MAX_NOTES_PER_USER) {
      throw new ConflictException(
        `Has alcanzado el maximo de ${MAX_NOTES_PER_USER} notas. Elimina alguna para guardar otra.`,
      );
    }

    const row = await this.prisma.diaryNote.create({
      data: {
        userId,
        title: this.title(dto.title),
        content: this.content(dto.content),
      },
      select: NOTE_SELECT,
    });

    await this.tree.award(userId, TreePath.CARE_EXPRESSION, 'diary_note');
    return this.noteView(row);
  }

  /**
   * Una reflexion de Cuidarme se guarda tambien como nota del diario. No
   * concede otra gota: la actividad ya la concedio. `sourceId` evita duplicados
   * si la persona guarda o edita la reflexion mas de una vez.
   */
  async upsertCareNote(userId: string, activityId: string, title: string, content: string): Promise<void> {
    const sourceId = `care:${activityId}`;
    const noteTitle = this.title(title);
    const noteContent = this.content(content);

    const existing = await this.prisma.diaryNote.findFirst({
      where: { userId, sourceId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.diaryNote.update({
        where: { id: existing.id },
        data: { title: noteTitle, content: noteContent, deletedAt: null },
      });
      return;
    }

    await this.prisma.diaryNote.create({
      data: { userId, sourceId, title: noteTitle, content: noteContent },
    });
  }
  async updateNote(userId: string, id: string, dto: UpdateDiaryNoteDto): Promise<DiaryEntryView> {
    await this.requireActiveNote(userId, id);

    if (dto.title === undefined && dto.content === undefined) {
      throw new BadRequestException('No hay cambios que guardar.');
    }

    const row = await this.prisma.diaryNote.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: this.title(dto.title) } : {}),
        ...(dto.content !== undefined ? { content: this.content(dto.content) } : {}),
      },
      select: NOTE_SELECT,
    });

    return this.noteView(row);
  }

  async removeNote(userId: string, id: string): Promise<{ id: string }> {
    const result = await this.prisma.diaryNote.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Esa nota no existe.');
    return { id };
  }

  async restoreNote(userId: string, id: string): Promise<DiaryEntryView> {
    const result = await this.prisma.diaryNote.updateMany({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (result.count === 0) throw new NotFoundException('Esa nota no esta en la papelera.');

    const row = await this.prisma.diaryNote.findUnique({ where: { id }, select: NOTE_SELECT });
    if (!row) throw new NotFoundException('Esa nota no existe.');
    return this.noteView(row);
  }

  private async requireActiveNote(userId: string, id: string) {
    const row = await this.prisma.diaryNote.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Esa nota no existe.');
    return row;
  }

  private title(value?: string): string | null {
    if (value === undefined) return null;
    const title = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
    return title || null;
  }

  private content(value: string): string {
    const content = value
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
    if (!content) throw new BadRequestException('Escribe algo antes de guardar tu nota.');
    return content;
  }

  private cursor(before?: string, beforeId?: string): { at: Date; id: string } | null {
    if (!before && !beforeId) return null;
    if (!before || !beforeId) {
      throw new BadRequestException('El cursor de paginacion esta incompleto.');
    }
    const at = new Date(before);
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('El cursor de fecha no es valido.');
    }
    return { at, id: beforeId };
  }

  private noteCursorWhere(
    cursor: { at: Date; id: string },
    trash: boolean,
  ): Prisma.DiaryNoteWhereInput {
    if (trash) {
      return {
        OR: [
          { deletedAt: { lt: cursor.at } },
          { AND: [{ deletedAt: cursor.at }, { id: { lt: cursor.id } }] },
        ],
      };
    }
    return {
      OR: [
        { createdAt: { lt: cursor.at } },
        { AND: [{ createdAt: cursor.at }, { id: { lt: cursor.id } }] },
      ],
    };
  }

  private emotionalCursorWhere(
    cursor: { at: Date; id: string },
    trash: boolean,
  ): Prisma.EmotionalLogWhereInput {
    if (trash) {
      return {
        OR: [
          { deletedAt: { lt: cursor.at } },
          { AND: [{ deletedAt: cursor.at }, { id: { lt: cursor.id } }] },
        ],
      };
    }
    return {
      OR: [
        { loggedAt: { lt: cursor.at } },
        { AND: [{ loggedAt: cursor.at }, { id: { lt: cursor.id } }] },
      ],
    };
  }
  private rangeFilter(from?: string, to?: string): Prisma.DateTimeFilter | null {
    if (!from && !to) return null;

    const filter: Prisma.DateTimeFilter = {};
    if (from) filter.gte = this.parseDate(from, false);
    if (to) filter.lte = this.parseDate(to, true);

    if (filter.gte && filter.lte && filter.gte > filter.lte) {
      throw new BadRequestException('El rango de fechas esta invertido.');
    }
    return filter;
  }

  private parseDate(value: string, endOfDay: boolean): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha no es valida.');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    }
    return date;
  }

  private noteView(row: NoteRow): DiaryEntryView {
    return {
      kind: 'NOTE',
      id: row.id,
      title: row.title,
      content: row.content,
      occurredAt: row.createdAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      emotion: null,
      intensity: null,
    };
  }

  private emotionalView(row: EmotionalRow): DiaryEntryView {
    return {
      kind: 'EMOTIONAL',
      id: row.id,
      title: null,
      content: row.contextNote,
      occurredAt: row.loggedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      emotion: { name: row.emotion.name, colorHex: row.emotion.colorHex },
      intensity: row.intensity,
    };
  }
}
