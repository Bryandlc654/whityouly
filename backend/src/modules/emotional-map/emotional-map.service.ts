import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TreePath } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../../common/quota/quota.service';
import { TreeService } from '../tree/tree.service';
import { sanitizeContextNote } from './emotional-note';
import { globalDayRange } from './global-day';
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

// Patrones recurrentes: día de la semana (lunes primero) y franja del día de
// seis horas. El frontend traduce estas claves a etiquetas legibles.
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAYPART_KEYS = ['madrugada', 'manana', 'tarde', 'noche'];

// Cambio de intensidad media, en puntos, a partir del cual la tendencia deja de
// considerarse estable.
const TREND_THRESHOLD = 0.3;

const LOG_SELECT = {
  id: true,
  intensity: true,
  contextNote: true,
  loggedAt: true,
  createdAt: true,
  emotion: { select: { id: true, name: true, colorHex: true } },
} satisfies Prisma.EmotionalLogSelect;

type LogRow = Prisma.EmotionalLogGetPayload<{ select: typeof LOG_SELECT }>;

type SummaryRow = {
  loggedAt: Date;
  intensity: number;
  emotion: { name: string; colorHex: string | null };
};

interface MomentAccumulator {
  sum: number;
  count: number;
  emotions: Map<string, { count: number; colorHex: string | null }>;
}

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

/**
 * Patrón recurrente: cómo se repiten los registros en una dimensión concreta
 * (día de la semana o franja del día), con la emoción que más aparece.
 */
export interface MomentBucket {
  key: string;
  entries: number;
  averageIntensity: number | null;
  topEmotion: { name: string; colorHex: string | null } | null;
}

/** Celda del cruce día de la semana × franja del día para el mapa de momentos. */
export interface MomentCell {
  weekday: string;
  daypart: string;
  entries: number;
  averageIntensity: number | null;
  topEmotion: { name: string; colorHex: string | null } | null;
}

/**
 * Comparación del periodo elegido con el inmediatamente anterior, del mismo
 * tamaño. La intensidad no es buena ni mala en sí misma: solo indica si la
 * energía emocional sube, baja o se mantiene.
 */
export interface EmotionalTrend {
  previousAverageIntensity: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'stable';
  previousEntries: number;
  previousTopEmotion: { name: string; colorHex: string | null } | null;
  topEmotionChanged: boolean;
}

export interface EmotionalSummary {
  range: { days: number; from: Date; to: Date };
  totalEntries: number;
  averageIntensity: number | null;
  currentStreak: number;
  days: DayBucket[];
  emotions: EmotionBucket[];
  weekdays: MomentBucket[];
  dayparts: MomentBucket[];
  heatmap: MomentCell[];
  trend: EmotionalTrend;
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
    private readonly tree: TreeService,
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

    // Camino de autoconocimiento: registrar cómo te sientes da una gota al día.
    await this.tree.award(userId, TreePath.SELF_KNOWLEDGE, 'emotional_log');

    return this.toView(row);
  }

  /**
   * Si la persona ya registró su estado en el día global en curso. El "día" es
   * el mismo para toda la comunidad (ver `global-day.ts`), así que el
   * recordatorio del feed se oculta hasta el siguiente día, para todo el mundo a
   * la vez.
   */
  async todayStatus(
    userId: string,
  ): Promise<{ registered: boolean; day: string; resetsAt: string }> {
    const { start, end, day } = globalDayRange();
    const count = await this.prisma.emotionalLog.count({
      where: { userId, loggedAt: { gte: start, lt: end } },
    });
    return { registered: count > 0, day, resetsAt: end.toISOString() };
  }

  async list(userId: string, query: ListEmotionalLogsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const loggedAt = this.rangeFilter(query.from, query.to);
    const cursor = await this.resolveCursor(userId, query.cursor);

    const rows = await this.prisma.emotionalLog.findMany({
      where: { userId, ...(loggedAt ? { loggedAt } : {}) },
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
   * emoción dominante), el reparto de emociones del periodo, los patrones
   * recurrentes (día de la semana y franja) y la evolución frente al periodo
   * anterior. Todo se calcula en memoria sobre una ventana acotada.
   */
  async summary(userId: string, query: EmotionalSummaryQueryDto): Promise<EmotionalSummary> {
    const days = Math.min(Math.max(query.days ?? 90, 1), 366);
    const tz = query.tzOffsetMinutes ?? 0;
    const now = new Date();

    // Primera medianoche local de la ventana, expresada como instante UTC.
    const localToday = new Date(now.getTime() - tz * 60_000);
    localToday.setUTCHours(0, 0, 0, 0);
    const from = new Date(localToday.getTime() - (days - 1) * DAY_MS + tz * 60_000);
    // Ventana anterior, del mismo tamaño, para medir la evolución.
    const previousFrom = new Date(from.getTime() - days * DAY_MS);

    const rows = await this.prisma.emotionalLog.findMany({
      where: { userId, loggedAt: { gte: previousFrom } },
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
      take: SUMMARY_MAX_ROWS,
      select: {
        loggedAt: true,
        intensity: true,
        emotion: { select: { name: true, colorHex: true } },
      },
    });

    const currentRows = rows.filter((row) => row.loggedAt >= from);
    const previousRows = rows.filter((row) => row.loggedAt < from);

    // La fecha y la hora locales se obtienen restando el desfase del huso.
    const localOf = (value: Date) => new Date(value.getTime() - tz * 60_000);
    const dayKey = (value: Date) => localOf(value).toISOString().slice(0, 10);

    interface DayAccumulator {
      sum: number;
      count: number;
      emotions: Map<string, { count: number; colorHex: string | null }>;
    }

    const byDay = new Map<string, DayAccumulator>();
    const byEmotion = new Map<string, { count: number; sum: number; colorHex: string | null }>();
    const byWeekday = new Map<string, MomentAccumulator>();
    const byDaypart = new Map<string, MomentAccumulator>();
    const byCell = new Map<string, MomentAccumulator>();
    let totalSum = 0;

    for (const row of currentRows) {
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

      const shifted = localOf(row.loggedAt);
      const weekday = WEEKDAY_KEYS[(shifted.getUTCDay() + 6) % 7];
      const daypart = DAYPART_KEYS[Math.floor(shifted.getUTCHours() / 6)];
      this.bumpMoment(byWeekday, weekday, row);
      this.bumpMoment(byDaypart, daypart, row);
      this.bumpMoment(byCell, `${weekday}|${daypart}`, row);

      totalSum += row.intensity;
    }

    const buckets: DayBucket[] = [];
    const todayKey = dayKey(now);
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(localToday.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
      const accumulator = byDay.get(date);

      buckets.push({
        date,
        entries: accumulator?.count ?? 0,
        averageIntensity: accumulator ? this.round(accumulator.sum / accumulator.count) : null,
        emotion: accumulator ? this.topEmotionOf(accumulator.emotions) : null,
      });
    }

    const emotions = [...byEmotion.entries()]
      .map(([name, data]) => ({
        name,
        colorHex: data.colorHex,
        count: data.count,
        averageIntensity: this.round(data.sum / data.count),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      range: { days, from, to: now },
      totalEntries: currentRows.length,
      averageIntensity:
        currentRows.length > 0 ? this.round(totalSum / currentRows.length) : null,
      currentStreak: this.currentStreak(byDay, todayKey),
      days: buckets,
      emotions,
      weekdays: this.toMomentBuckets(WEEKDAY_KEYS, byWeekday),
      dayparts: this.toMomentBuckets(DAYPART_KEYS, byDaypart),
      heatmap: this.toHeatmap(byCell),
      trend: this.buildTrend(currentRows, previousRows, emotions[0] ?? null),
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

  /**
   * Un cursor que ya no existe (el registro se borró entre páginas) dejaría la
   * consulta en una página vacía. Se comprueba primero y, si falta, se ignora
   * para volver al principio en lugar de cortar la paginación.
   */
  private async resolveCursor(userId: string, cursor?: string): Promise<string | undefined> {
    if (!cursor) {
      return undefined;
    }

    const anchor = await this.prisma.emotionalLog.findFirst({
      where: { id: cursor, userId },
      select: { id: true },
    });

    return anchor ? anchor.id : undefined;
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

  private bumpMoment(
    map: Map<string, MomentAccumulator>,
    key: string,
    row: SummaryRow,
  ): void {
    const acc = map.get(key) ?? { sum: 0, count: 0, emotions: new Map() };
    acc.sum += row.intensity;
    acc.count += 1;
    const current = acc.emotions.get(row.emotion.name) ?? {
      count: 0,
      colorHex: row.emotion.colorHex,
    };
    current.count += 1;
    current.colorHex = current.colorHex ?? row.emotion.colorHex;
    acc.emotions.set(row.emotion.name, current);
    map.set(key, acc);
  }

  /** Emoción que más aparece, con desempate alfabético estable. */
  private topEmotionOf(
    emotions: Map<string, { count: number; colorHex: string | null }>,
  ): { name: string; colorHex: string | null } | null {
    if (emotions.size === 0) {
      return null;
    }
    const [name, data] = [...emotions.entries()].sort(
      (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]),
    )[0];
    return { name, colorHex: data.colorHex };
  }

  private toMomentBuckets(
    keys: string[],
    map: Map<string, MomentAccumulator>,
  ): MomentBucket[] {
    return keys.map((key) => {
      const acc = map.get(key);
      if (!acc || acc.count === 0) {
        return { key, entries: 0, averageIntensity: null, topEmotion: null };
      }
      return {
        key,
        entries: acc.count,
        averageIntensity: this.round(acc.sum / acc.count),
        topEmotion: this.topEmotionOf(acc.emotions),
      };
    });
  }

  private toHeatmap(map: Map<string, MomentAccumulator>): MomentCell[] {
    const cells: MomentCell[] = [];
    for (const weekday of WEEKDAY_KEYS) {
      for (const daypart of DAYPART_KEYS) {
        const acc = map.get(`${weekday}|${daypart}`);
        cells.push({
          weekday,
          daypart,
          entries: acc?.count ?? 0,
          averageIntensity: acc ? this.round(acc.sum / acc.count) : null,
          topEmotion: acc ? this.topEmotionOf(acc.emotions) : null,
        });
      }
    }
    return cells;
  }

  private topEmotionFromRows(rows: SummaryRow[]): { name: string; colorHex: string | null } | null {
    if (rows.length === 0) {
      return null;
    }
    const counts = new Map<string, { count: number; colorHex: string | null }>();
    for (const row of rows) {
      const entry = counts.get(row.emotion.name) ?? { count: 0, colorHex: row.emotion.colorHex };
      entry.count += 1;
      entry.colorHex = entry.colorHex ?? row.emotion.colorHex;
      counts.set(row.emotion.name, entry);
    }
    return this.topEmotionOf(counts);
  }

  private buildTrend(
    currentRows: SummaryRow[],
    previousRows: SummaryRow[],
    currentTop: { name: string; colorHex: string | null } | null,
  ): EmotionalTrend {
    const averageOf = (rows: SummaryRow[]): number | null => {
      if (rows.length === 0) {
        return null;
      }
      return this.round(rows.reduce((sum, row) => sum + row.intensity, 0) / rows.length);
    };

    const currentAverage = averageOf(currentRows);
    const previousAverage = averageOf(previousRows);
    const previousTopEmotion = this.topEmotionFromRows(previousRows);

    let delta: number | null = null;
    let direction: EmotionalTrend['direction'] = 'stable';
    if (currentAverage !== null && previousAverage !== null) {
      delta = this.round(currentAverage - previousAverage);
      direction = Math.abs(delta) < TREND_THRESHOLD ? 'stable' : delta > 0 ? 'up' : 'down';
    }

    return {
      previousAverageIntensity: previousAverage,
      delta,
      direction,
      previousEntries: previousRows.length,
      previousTopEmotion,
      topEmotionChanged:
        currentTop !== null && previousTopEmotion !== null && currentTop.name !== previousTopEmotion.name,
    };
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
