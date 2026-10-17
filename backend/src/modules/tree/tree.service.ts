import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TreePath } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TREE_HISTORY_DAYS,
  TREE_MAX_DROPS_PER_DAY,
  TREE_PATHS,
  TREE_STAGES,
} from './tree.constants';

export interface TreePathStatus {
  key: TreePath;
  label: string;
  hint: string;
  earned: boolean;
}

export interface TreeStageView {
  key: string;
  label: string;
  drops: number;
  reached: boolean;
}

export interface TreeView {
  totalDrops: number;
  stage: {
    key: string;
    label: string;
    index: number;
    reached: boolean;
    nextLabel: string | null;
    nextDrops: number | null;
    /** Progreso hacia la próxima etapa (0 a 1). */
    progress: number;
  };
  today: {
    day: string;
    earned: number;
    max: number;
    complete: boolean;
    paths: TreePathStatus[];
  };
  parts: {
    roots: number;
    rings: number;
    branches: number;
    leaves: number;
    flowers: number;
    fruits: number;
  };
  history: { day: string; paths: TreePath[]; complete: boolean }[];
  stages: TreeStageView[];
}

const DAY_MS = 24 * 60 * 60_000;

/** Fecha (UTC) sin hora, para la columna `DATE` de una gota. */
function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Clave de semana ISO (año-semana) para contar "anillos" sin repetir. */
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // lunes=1 ... domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // jueves de la semana ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

/**
 * Árbol de crecimiento: representación privada del cuidado propio y del
 * acompañamiento. Las "gotas" son la moneda: una por camino y día (nunca
 * retroceden). El estado se calcula al vuelo desde las gotas y desde la
 * actividad real (registros, relatos, acompañamientos, "me ayudó").
 */
@Injectable()
export class TreeService {
  private readonly logger = new Logger(TreeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Concede una gota por el camino indicado en el día de hoy. Es idempotente:
   * la clave única (persona, camino, día) hace que repetir la acción el mismo
   * día no añada nada. Nunca lanza: premiar no debe romper la acción del usuario.
   */
  async award(userId: string, path: TreePath, sourceType?: string): Promise<boolean> {
    const day = utcDay(new Date());
    try {
      await this.prisma.treeDrop.create({ data: { userId, path, day, sourceType: sourceType ?? null } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false; // Ya consiguió esta gota hoy: constancia, no volumen.
      }
      this.logger.warn(`No se pudo registrar la gota del árbol: ${(error as Error).message}`);
      return false;
    }
  }

  async getTree(userId: string): Promise<TreeView> {
    const now = new Date();
    const today = utcDay(now);

    const [drops, character] = await Promise.all([
      this.prisma.treeDrop.findMany({
        where: { userId },
        select: { path: true, day: true },
        orderBy: { day: 'asc' },
      }),
      this.prisma.character.findUnique({ where: { userId }, select: { id: true } }),
    ]);

    const totalDrops = drops.length;
    const pathsByDay = new Map<string, Set<TreePath>>();
    const weeks = new Set<string>();
    for (const drop of drops) {
      const key = dayKey(drop.day);
      const set = pathsByDay.get(key) ?? new Set<TreePath>();
      set.add(drop.path);
      pathsByDay.set(key, set);
      weeks.add(isoWeekKey(drop.day));
    }

    const todayPaths = pathsByDay.get(dayKey(today)) ?? new Set<TreePath>();
    const earnedToday = TREE_PATHS.filter((p) => todayPaths.has(p.key)).length;

    const todayBlock = {
      day: dayKey(today),
      earned: earnedToday,
      max: TREE_MAX_DROPS_PER_DAY,
      complete: earnedToday === TREE_MAX_DROPS_PER_DAY,
      paths: TREE_PATHS.map((p) => ({
        key: p.key,
        label: p.label,
        hint: p.hint,
        earned: todayPaths.has(p.key),
      })),
    };

    const history = Array.from({ length: TREE_HISTORY_DAYS }, (_, index) => {
      const date = new Date(today.getTime() - (TREE_HISTORY_DAYS - 1 - index) * DAY_MS);
      const key = dayKey(date);
      const set = pathsByDay.get(key) ?? new Set<TreePath>();
      const paths = [...set];
      return { day: key, paths, complete: paths.length === TREE_MAX_DROPS_PER_DAY };
    });

    const parts = await this.computeParts(userId, character?.id ?? null, [...weeks], pathsByDay);

    return {
      totalDrops,
      stage: this.buildStage(totalDrops),
      today: todayBlock,
      parts,
      history,
      stages: TREE_STAGES.map((s) => ({ key: s.key, label: s.label, drops: s.drops, reached: totalDrops >= s.drops })),
    };
  }

  private buildStage(totalDrops: number): TreeView['stage'] {
    let reachedIndex = -1;
    for (let i = 0; i < TREE_STAGES.length; i += 1) {
      if (totalDrops >= TREE_STAGES[i].drops) reachedIndex = i;
    }

    // Antes de la primera gota el árbol es una semilla que aún no brota: se
    // muestra la primera etapa como objetivo con progreso en cero.
    const currentIndex = Math.max(reachedIndex, 0);
    const current = TREE_STAGES[currentIndex];
    const next = TREE_STAGES[currentIndex + 1] ?? null;
    const reached = reachedIndex >= 0;

    const floor = current.drops;
    const ceiling = next?.drops ?? current.drops;
    const progress =
      next && ceiling > floor ? Math.min(1, Math.max(0, (totalDrops - floor) / (ceiling - floor))) : 1;

    return {
      key: current.key,
      label: current.label,
      index: currentIndex,
      reached,
      nextLabel: next?.label ?? null,
      nextDrops: next?.drops ?? null,
      progress,
    };
  }

  private async computeParts(
    userId: string,
    characterId: string | null,
    weeks: string[],
    pathsByDay: Map<string, Set<TreePath>>,
  ): Promise<TreeView['parts']> {
    // Frutos: "ciclos completados" = días en los que se recogieron las tres gotas.
    let fruits = 0;
    for (const set of pathsByDay.values()) {
      if (set.size === TREE_MAX_DROPS_PER_DAY) fruits += 1;
    }

    if (!characterId) {
      const roots = await this.prisma.emotionalLog.count({ where: { userId } });
      return { roots, rings: weeks.length, branches: 0, leaves: 0, flowers: 0, fruits };
    }

    const [roots, branchStories, branchUpdates, leaves, flowers] = await Promise.all([
      this.prisma.emotionalLog.count({ where: { userId } }),
      this.prisma.story.count({ where: { characterId, status: { not: 'DELETED' } } }),
      // Solo las etapas posteriores cuentan como "reflexiones": la apertura es
      // parte del propio relato, no una rama aparte.
      this.prisma.storyUpdate.count({ where: { story: { characterId }, stageOrder: { gt: 1 } } }),
      this.prisma.companionship.count({ where: { characterId } }),
      this.prisma.commentHelpful.count({ where: { comment: { characterId } } }),
    ]);

    return {
      roots,
      rings: weeks.length,
      branches: branchStories + branchUpdates,
      leaves,
      flowers,
      fruits,
    };
  }
}
