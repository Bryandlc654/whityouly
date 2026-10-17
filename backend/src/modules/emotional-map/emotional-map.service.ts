import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../../common/quota/quota.service';
import { sanitizeContextNote } from './emotional-note';
import {
  CreateEmotionalLogDto,
  EmotionalSummaryQueryDto,
  ListEmotionalLogsQueryDto,
  UpdateEmotionalLogDto,
} from './dto/emotional-log.dto';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

// Techo de registros por cuenta. El diario es personal y crece sin límite
// natural; el tope evita que una cuenta acumule millones de filas.
const MAX_LOGS_PER_USER = 5000;

// Cuota de escritura por hora: registrar el estado es rápido y frecuente, así
// que el límite es alto y solo frena un uso automatizado.
const CREATES_PER_HOUR = 240;

// Una emoción se puede registrar hacia atrás (por ejemplo, recordar el día de
// ayer) pero no antes de un año ni en el futuro.
const MAX_BACKDATE_DAYS = 366;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

// La agregación del mapa se calcula en memoria sobre una ventana acotada.
const SUMMARY_MAX_ROWS = 5000;

const DAY_MS = 24 * 60 * 60_000;

const LOG_SELECT = {
  id: true,
  intensity: true,
  contextNote: true,
  loggedAt: true,
  createdAt: true,
  emotion: { select: { id: true, name: true, colorHex: true } },
} satisfies Prisma.EmotionalLogSelect;

type LogRow = Prisma.EmotionalLogGetPayload<{ select: typeof LOG_SELECT }>;

interface EmotionView {
  id: string;
  name: string;
  colorHex: string | null;
}

export interface EmotionalLogView {
  id: string;
  intensity: number;
  contextNote: string | null;
  loggedAt: Date;
  createdAt: Date;
  emotion: EmotionView;
}

export interface DayBucket {
  date: string;
  entries: number;
  averageIntensity: number | null;
  emotion: { name: string; colorHex: string | null } | null;
}

export interface EmotionBucket {
  name: string;
  colorHex: string | null;
  count: number;
  averageIntensity: number | null;
}

export interface EmotionalSummary {
  range: { days: number; from: Date; to: Date };
  totalEntries: number;
  averageIntensity: number | null;
  currentStreak: number;
  days: DayBucket[];
  emotions: EmotionBucket[];
}

/**
 * Mapa Emocional: el diario privado de estados de ánimo. Se guarda por usuario
 * (nadie más lo ve), con la emoción del catálogo, una intensidad del 1 al 10,
 * la fecha del registro y un texto libre de notas y contexto.
 */
@Injectable()
export class EmotionalMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
  ) {}

  async create(userId: string, dto: CreateEmotionalLogDto): Promise<EmotionalLogView> {
    const emotion = await this.resolveEmotion(dto.emotion);
    const loggedAt = this.parseLoggedAt(dto.loggedAt);
    const contextNote = dto.contextNote ? sanitizeContextNote(dto.contextNote) : '';

    const total = await this.prisma.emotionalLog.count({ where: { userId } });
    if (total >= MAX_LOGS_PER_USER) {
      throw new ConflictException(
        `Has alcanzado el máximo de ${MAX_LOGS_PER_USER} registros. Elimina alguno para guardar otro.`,
      );
    }

    await this.consumeQuota(`emotional-log:${userId}`, CREATES_PER_HOUR, 'registros por hora');

    const row = await this.prisma.emotionalLog.create({
      data: {
        userId,
        emotionId: emotion.id,
        intensity: dto.intensity,
        contextNote: contextNote || null,
        loggedAt,
      },
      select: LOG_SELECT,
    });

    return this.toView(row);
  }

  async list(userId: string, query: ListEmotionalLogsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const loggedAt = this.rangeFilter(query.from, query.to);

    const rows = await this.prisma.emotionalLog.findMany({
      where: { userId, ...(loggedAt ? { loggedAt } : {}) },
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: LOG_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((row) => this.toView(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Serie agregada para la pantalla del mapa: un punto por día local (con la
   * emoción dominante), el reparto de emociones del periodo y la racha actual.
   */
  async summary(userId: string, query: EmotionalSummaryQueryDto): Promise<EmotionalSummary> {
    const days = Math.min(Math.max(query.days ?? 90, 1), 366);
    const tz = query.tzOffsetMinutes ?? 0;
    const now = new Date();

    // Primera medianoche local de la ventana, expresada como instante UTC.
    const localToday = new Date(now.getTime() - tz * 60_000);
    localToday.setUTCHours(0, 0, 0, 0);
    const from = new Date(localToday.getTime() - (days - 1) * DAY_MS + tz * 60_000);

    const rows = await this.prisma.emotionalLog.findMany({
      where: { userId, loggedAt: { gte: from } },
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
      take: SUMMARY_MAX_ROWS,
      select: {
        loggedAt: true,
        intensity: true,
        emotion: { select: { name: true, colorHex: true } },
      },
    });

    const dayKey = (value: Date) => new Date(value.getTime() - tz * 60_000).toISOString().slice(0, 10);

    interface DayAccumulator {
      sum: number;
      count: number;
      emotions: Map<string, { count: number; colorHex: string | null }>;
    }

    const byDay = new Map<string, DayAccumulator>();
    const byEmotion = new Map<string, { count: number; sum: number; colorHex: string | null }>();
    let totalSum = 0;

    for (const row of rows) {
      const key = dayKey(row.loggedAt);

      const day = byDay.get(key) ?? { sum: 0, count: 0, emotions: new Map() };
      day.sum += row.intensity;
      day.count += 1;
      const dayEmotion = day.emotions.get(row.emotion.name) ?? {
        count: 0,
        colorHex: row.emotion.colorHex,
      };
      dayEmotion.count += 1;
      dayEmotion.colorHex = dayEmotion.colorHex ?? row.emotion.colorHex;
      day.emotions.set(row.emotion.name, dayEmotion);
      byDay.set(key, day);

      const emotion = byEmotion.get(row.emotion.name) ?? {
        count: 0,
        sum: 0,
        colorHex: row.emotion.colorHex,
      };
      emotion.count += 1;
      emotion.sum += row.intensity;
      emotion.colorHex = emotion.colorHex ?? row.emotion.colorHex;
      byEmotion.set(row.emotion.name, emotion);

      totalSum += row.intensity;
    }

    const buckets: DayBucket[] = [];
    const todayKey = dayKey(now);
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(localToday.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
      const accumulator = byDay.get(date);

      let dominant: { name: string; colorHex: string | null } | null = null;
      if (accumulator && accumulator.emotions.size > 0) {
        const [name, data] = [...accumulator.emotions.entries()].sort(
          (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]),
        )[0];
        dominant = { name, colorHex: data.colorHex };
      }

      buckets.push({
        date,
        entries: accumulator?.count ?? 0,
        averageIntensity: accumulator ? this.round(accumulator.sum / accumulator.count) : null,
        emotion: dominant,
      });
    }

    return {
      range: { days, from, to: now },
      totalEntries: rows.length,
      averageIntensity: rows.length > 0 ? this.round(totalSum / rows.length) : null,
      currentStreak: this.currentStreak(byDay, todayKey),
      days: buckets,
      emotions: [...byEmotion.entries()]
        .map(([name, data]) => ({
          name,
          colorHex: data.colorHex,
          count: data.count,
          averageIntensity: this.round(data.sum / data.count),
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  }

  async update(userId: string, id: string, dto: UpdateEmotionalLogDto): Promise<EmotionalLogView> {
    await this.findOwned(userId, id);

    const data: Prisma.EmotionalLogUpdateInput = {};

    if (dto.emotion !== undefined) {
      const emotion = await this.resolveEmotion(dto.emotion);
      data.emotion = { connect: { id: emotion.id } };
    }
    if (dto.intensity !== undefined) {
      data.intensity = dto.intensity;
    }
    if (dto.loggedAt !== undefined) {
      data.loggedAt = this.parseLoggedAt(dto.loggedAt);
    }
    if (dto.contextNote !== undefined) {
      const note = sanitizeContextNote(dto.contextNote);
      data.contextNote = note || null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay cambios que guardar.');
    }

    const row = await this.prisma.emotionalLog.update({
      where: { id },
      data,
      select: LOG_SELECT,
    });

    return this.toView(row);
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.findOwned(userId, id);
    await this.prisma.emotionalLog.delete({ where: { id } });
    return { id };
  }

  /**
   * La emoción se elige del catálogo por nombre (lo que la persona ve en la
   * lista). El servidor no confía en identificadores sueltos: los resuelve.
   */
  private async resolveEmotion(name: string): Promise<EmotionView> {
    const emotion = await this.prisma.emotion.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true, colorHex: true },
    });

    if (!emotion) {
      throw new BadRequestException(
        `La emoción «${name}» no está en el catálogo. Elige entre las opciones disponibles.`,
      );
    }

    return emotion;
  }

  private async findOwned(userId: string, id: string): Promise<{ id: string }> {
    const row = await this.prisma.emotionalLog.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    // Un registro de otra persona se trata como inexistente: no se filtra si
    // existe, para no revelar que hay algo ahí.
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Registro no encontrado.');
    }

    return { id: row.id };
  }

  private parseLoggedAt(value?: string): Date {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha no es válida.');
    }

    const now = Date.now();
    if (date.getTime() > now + FUTURE_TOLERANCE_MS) {
      throw new BadRequestException('No puedes registrar una emoción en el futuro.');
    }
    if (date.getTime() < now - MAX_BACKDATE_DAYS * DAY_MS) {
      throw new BadRequestException(
        `No puedes registrar emociones de hace más de ${MAX_BACKDATE_DAYS} días.`,
      );
    }

    return date;
  }

  private rangeFilter(from?: string, to?: string): Prisma.DateTimeFilter | null {
    if (!from && !to) {
      return null;
    }

    const filter: Prisma.DateTimeFilter = {};

    if (from) {
      const parsed = new Date(from);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('La fecha «desde» no es válida.');
      }
      filter.gte = parsed;
    }
    if (to) {
      const parsed = new Date(to);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('La fecha «hasta» no es válida.');
      }
      filter.lte = parsed;
    }

    if (filter.gte && filter.lte && filter.gte > filter.lte) {
      throw new BadRequestException('El rango de fechas está invertido.');
    }

    return filter;
  }

  /** Días consecutivos con registro, contando desde hoy (o desde ayer si hoy aún no hay). */
  private currentStreak(
    byDay: Map<string, { count: number }>,
    todayKey: string,
  ): number {
    let cursor = new Date(`${todayKey}T00:00:00.000Z`);
    if (!byDay.has(todayKey)) {
      cursor = new Date(cursor.getTime() - DAY_MS);
    }

    let streak = 0;
    while (byDay.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }

    return streak;
  }

  private round(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private toView(row: LogRow): EmotionalLogView {
    return {
      id: row.id,
      intensity: row.intensity,
      contextNote: row.contextNote,
      loggedAt: row.loggedAt,
      createdAt: row.createdAt,
      emotion: {
        id: row.emotion.id,
        name: row.emotion.name,
        colorHex: row.emotion.colorHex,
      },
    };
  }

  private async consumeQuota(key: string, limit: number, action: string): Promise<void> {
    const result = await this.quota.consume(key, limit, 60 * 60_000);

    if (!result.allowed) {
      throw new HttpException(
        `Has alcanzado el límite de ${limit} ${action}. Inténtalo en ${result.retryAfterSeconds} s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
