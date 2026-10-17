import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunityPulseQueryDto } from './dto/community.dto';

const DAY_MS = 24 * 60 * 60_000;

// K-anonimato: un agregado solo se publica si lo forman al menos tantas personas
// distintas. Por debajo de ese umbral el grupo se oculta entero (no se devuelve
// el conteo), para que nadie pueda deducir el estado emocional de una persona.
const MIN_USERS = 5;

// Techo de filas que se materializan para agregar. El pulso es una vista de
// conjunto: con esta cota se acota la memoria y el tiempo de cálculo.
const ROW_CAP = 50_000;

// Las mismas claves que usa el mapa emocional: el frontend las traduce a
// etiquetas legibles.
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAYPART_KEYS = ['madrugada', 'manana', 'tarde', 'noche'];

const PRIVACY_NOTE =
  'Los datos de la comunidad se muestran siempre agregados y anónimos. Solo se publican los grupos formados por al menos %d personas distintas, para que nadie pueda identificarse.';

export interface CommunityEmotionBucket {
  name: string;
  colorHex: string | null;
  count: number;
  /** Proporción sobre el total de registros publicados (0 a 1). */
  share: number;
  /** Personas distintas que registraron esta emoción. */
  participants: number;
}

export interface CommunityDayBucket {
  date: string;
  entries: number;
  averageIntensity: number | null;
  emotion: { name: string; colorHex: string | null } | null;
  /** Verdadero cuando el día no alcanza el mínimo de personas y se oculta. */
  suppressed: boolean;
}

export interface CommunityMomentBucket {
  key: string;
  entries: number;
  averageIntensity: number | null;
  topEmotion: { name: string; colorHex: string | null } | null;
  /** Verdadero cuando la franja no alcanza el mínimo de personas y se oculta. */
  suppressed: boolean;
}

export interface CommunityPulse {
  range: { days: number; from: Date; to: Date };
  privacy: { minUsers: number; participants: number; suppressed: boolean; note: string };
  totalEntries: number;
  averageIntensity: number | null;
  dominantEmotion: { name: string; colorHex: string | null } | null;
  emotions: CommunityEmotionBucket[];
  days: CommunityDayBucket[];
  weekdays: CommunityMomentBucket[];
  dayparts: CommunityMomentBucket[];
}

interface BucketAccumulator {
  sum: number;
  count: number;
  users: Set<string>;
  emotions: Map<string, { count: number; users: Set<string>; colorHex: string | null }>;
}

interface EmotionAccumulator {
  count: number;
  sum: number;
  users: Set<string>;
  colorHex: string | null;
}

type PulseRow = {
  userId: string;
  intensity: number;
  loggedAt: Date;
  emotion: { name: string; colorHex: string | null };
};

/**
 * Pulso Comunitario: el estado emocional del conjunto, nunca el de una persona.
 * Se agregan los registros privados del diario de forma anónima y solo se
 * publican los grupos con suficientes personas distintas (k-anonimato). No se
 * expone ningún identificador ni el contenido de las notas.
 */
@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async pulse(query: CommunityPulseQueryDto): Promise<CommunityPulse> {
    const days = Math.min(Math.max(query.days ?? 7, 1), 90);
    const tz = query.tzOffsetMinutes ?? 0;
    const now = new Date();

    // Primera medianoche local de la ventana, expresada como instante UTC.
    const localToday = new Date(now.getTime() - tz * 60_000);
    localToday.setUTCHours(0, 0, 0, 0);
    const from = new Date(localToday.getTime() - (days - 1) * DAY_MS + tz * 60_000);

    const rows = await this.prisma.emotionalLog.findMany({
      where: { loggedAt: { gte: from } },
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
      take: ROW_CAP,
      select: {
        userId: true,
        intensity: true,
        loggedAt: true,
        emotion: { select: { name: true, colorHex: true } },
      },
    });

    const localOf = (value: Date) => new Date(value.getTime() - tz * 60_000);
    const dayKey = (value: Date) => localOf(value).toISOString().slice(0, 10);

    const participants = new Set<string>();
    const byEmotion = new Map<string, EmotionAccumulator>();
    const byDay = new Map<string, BucketAccumulator>();
    const byWeekday = new Map<string, BucketAccumulator>();
    const byDaypart = new Map<string, BucketAccumulator>();
    let totalSum = 0;

    for (const row of rows) {
      participants.add(row.userId);

      const emotion = byEmotion.get(row.emotion.name) ?? {
        count: 0,
        sum: 0,
        users: new Set<string>(),
        colorHex: row.emotion.colorHex,
      };
      emotion.count += 1;
      emotion.sum += row.intensity;
      emotion.users.add(row.userId);
      emotion.colorHex = emotion.colorHex ?? row.emotion.colorHex;
      byEmotion.set(row.emotion.name, emotion);

      const shifted = localOf(row.loggedAt);
      const weekday = WEEKDAY_KEYS[(shifted.getUTCDay() + 6) % 7];
      const daypart = DAYPART_KEYS[Math.floor(shifted.getUTCHours() / 6)];

      this.bump(byDay, dayKey(row.loggedAt), row);
      this.bump(byWeekday, weekday, row);
      this.bump(byDaypart, daypart, row);

      totalSum += row.intensity;
    }

    const suppressed = participants.size < MIN_USERS;

    // Con menos personas que el mínimo, no se publica ningún agregado.
    if (suppressed) {
      return {
        range: { days, from, to: now },
        privacy: {
          minUsers: MIN_USERS,
          participants: participants.size,
          suppressed: true,
          note: this.privacyNote(),
        },
        totalEntries: 0,
        averageIntensity: null,
        dominantEmotion: null,
        emotions: [],
        days: [],
        weekdays: [],
        dayparts: [],
      };
    }

    const emotions = [...byEmotion.entries()]
      .filter(([, data]) => data.users.size >= MIN_USERS)
      .map(([name, data]) => ({
        name,
        colorHex: data.colorHex,
        count: data.count,
        share: rows.length > 0 ? this.round(data.count / rows.length) : 0,
        participants: data.users.size,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const publishedEntries = emotions.reduce((sum, emotion) => sum + emotion.count, 0);

    const dayBuckets: CommunityDayBucket[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(localToday.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
      dayBuckets.push(this.toDayBucket(date, byDay.get(date)));
    }

    return {
      range: { days, from, to: now },
      privacy: {
        minUsers: MIN_USERS,
        participants: participants.size,
        suppressed: false,
        note: this.privacyNote(),
      },
      totalEntries: publishedEntries,
      averageIntensity: rows.length > 0 ? this.round(totalSum / rows.length) : null,
      dominantEmotion: emotions[0] ? { name: emotions[0].name, colorHex: emotions[0].colorHex } : null,
      emotions,
      days: dayBuckets,
      weekdays: this.toMomentBuckets(WEEKDAY_KEYS, byWeekday),
      dayparts: this.toMomentBuckets(DAYPART_KEYS, byDaypart),
    };
  }

  private bump(map: Map<string, BucketAccumulator>, key: string, row: PulseRow): void {
    const acc = map.get(key) ?? { sum: 0, count: 0, users: new Set<string>(), emotions: new Map() };
    acc.sum += row.intensity;
    acc.count += 1;
    acc.users.add(row.userId);

    const current = acc.emotions.get(row.emotion.name) ?? {
      count: 0,
      users: new Set<string>(),
      colorHex: row.emotion.colorHex,
    };
    current.count += 1;
    current.users.add(row.userId);
    current.colorHex = current.colorHex ?? row.emotion.colorHex;
    acc.emotions.set(row.emotion.name, current);

    map.set(key, acc);
  }

  private toDayBucket(date: string, acc: BucketAccumulator | undefined): CommunityDayBucket {
    if (!acc || acc.users.size < MIN_USERS) {
      return { date, entries: 0, averageIntensity: null, emotion: null, suppressed: true };
    }
    return {
      date,
      entries: acc.count,
      averageIntensity: this.round(acc.sum / acc.count),
      emotion: this.topEmotionOf(acc.emotions),
      suppressed: false,
    };
  }

  private toMomentBuckets(
    keys: string[],
    map: Map<string, BucketAccumulator>,
  ): CommunityMomentBucket[] {
    return keys.map((key) => {
      const acc = map.get(key);
      if (!acc || acc.users.size < MIN_USERS) {
        return { key, entries: 0, averageIntensity: null, topEmotion: null, suppressed: true };
      }
      return {
        key,
        entries: acc.count,
        averageIntensity: this.round(acc.sum / acc.count),
        topEmotion: this.topEmotionOf(acc.emotions),
        suppressed: false,
      };
    });
  }

  /**
   * Emoción dominante de un grupo, pero solo si la propia emoción alcanza el
   * mínimo de personas: si el detalle identificara a menos de `MIN_USERS`, se
   * omite aunque el grupo entero sea publicable.
   */
  private topEmotionOf(
    emotions: Map<string, { count: number; users: Set<string>; colorHex: string | null }>,
  ): { name: string; colorHex: string | null } | null {
    const eligible = [...emotions.entries()]
      .filter(([, data]) => data.users.size >= MIN_USERS)
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));

    if (eligible.length === 0) {
      return null;
    }
    const [name, data] = eligible[0];
    return { name, colorHex: data.colorHex };
  }

  private privacyNote(): string {
    return PRIVACY_NOTE.replace('%d', String(MIN_USERS));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
