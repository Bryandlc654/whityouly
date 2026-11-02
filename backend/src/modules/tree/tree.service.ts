import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, TreePath } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TREE_CYCLE_SIZE,
  TREE_DECORATIONS,
  TREE_HISTORY_DAYS,
  TREE_MAX_DROPS_PER_DAY,
  TREE_PATHS,
  TREE_POTS,
  TREE_SPECIES,
  TREE_SPECIES_LABELS,
  TREE_STAGES,
  type TreeDecoration,
  type TreePot,
  type TreeSpecies,
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

export interface TreeCycleView {
  completed: number;
  drops: number;
  number: number;
  goal: number;
}

export interface GardenTreeView {
  index: number;
  species: TreeSpecies;
  pot: TreePot;
  label: string;
}

export interface TreeGardenView {
  decoration: TreeDecoration;
  trees: GardenTreeView[];
  pages: number;
  spaceNumber: number;
  spaceFilled: number;
  spaceSize: number;
}

export interface TreeAchievementView {
  id: string;
  title: string;
  detail: string;
  value: number;
  goal: number;
  unit: string;
  unlocked: boolean;
}

export interface TreeUnlocksView {
  pots: TreePot[];
  species: TreeSpecies[];
  decorations: TreeDecoration[];
}

export interface TreeCustomizationView {
  species: TreeSpecies;
  pot: TreePot;
  decoration: TreeDecoration;
}

export interface TreeView {
  totalDrops: number;
  cycle: TreeCycleView;
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
  garden: TreeGardenView;
  achievements: TreeAchievementView[];
  unlocks: TreeUnlocksView;
  customization: TreeCustomizationView;
}

const DAY_MS = 24 * 60 * 60_000;

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

@Injectable()
export class TreeService {
  private readonly logger = new Logger(TreeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async award(userId: string, path: TreePath, sourceType?: string): Promise<boolean> {
    const day = utcDay(new Date());
    try {
      await this.prisma.treeDrop.create({ data: { userId, path, day, sourceType: sourceType ?? null } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      this.logger.warn(`No se pudo registrar la gota del árbol: ${(error as Error).message}`);
      return false;
    }
  }

  async getTree(userId: string): Promise<TreeView> {
    const now = new Date();
    const today = utcDay(now);

    const [drops, character, gardenRow, styles] = await Promise.all([
      this.prisma.treeDrop.findMany({
        where: { userId },
        select: { path: true, day: true },
        orderBy: { day: 'asc' },
      }),
      this.prisma.character.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.treeGarden.findUnique({ where: { userId }, select: { decoration: true } }),
      this.prisma.treeStyle.findMany({
        where: { userId },
        select: { treeIndex: true, species: true, pot: true },
      }),
    ]);

    const totalDrops = drops.length;
    const completed = Math.floor(totalDrops / TREE_CYCLE_SIZE);
    const cycleDrops = totalDrops % TREE_CYCLE_SIZE;
    const cycle: TreeCycleView = {
      completed,
      drops: cycleDrops,
      number: completed + 1,
      goal: TREE_CYCLE_SIZE,
    };

    const pathsByDay = new Map<string, Set<TreePath>>();
    const weeks = new Set<string>();
    for (const drop of drops) {
      const key = dayKey(drop.day);
      const set = pathsByDay.get(key) ?? new Set<TreePath>();
      set.add(drop.path);
      pathsByDay.set(key, set);
      weeks.add(isoWeekKey(drop.day));
    }
    const activeDays = pathsByDay.size;

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

    const stylesByIndex = new Map(styles.map((style) => [style.treeIndex, style]));
    const styleFor = (index: number): { species: TreeSpecies; pot: TreePot } => {
      const stored = stylesByIndex.get(index);
      return {
        species: TREE_SPECIES.includes(stored?.species as TreeSpecies)
          ? (stored?.species as TreeSpecies)
          : 'bonsai',
        pot: TREE_POTS.includes(stored?.pot as TreePot) ? (stored?.pot as TreePot) : 'violet',
      };
    };
    const currentStyle = styleFor(completed);
    const decoration = TREE_DECORATIONS.includes(gardenRow?.decoration as TreeDecoration)
      ? (gardenRow?.decoration as TreeDecoration)
      : 'none';

    const unlocks = this.unlocks(totalDrops, activeDays, completed);
    const gardenTrees = Array.from({ length: completed }, (_, index) => {
      const style = styleFor(index);
      return {
        index,
        species: style.species,
        pot: style.pot,
        label: `Árbol ${index + 1} · ${TREE_SPECIES_LABELS[style.species]}`,
      };
    });
    const garden: TreeGardenView = {
      decoration,
      trees: gardenTrees,
      pages: Math.max(1, Math.ceil(completed / 9)),
      spaceNumber: Math.floor(completed / 3) + 1,
      spaceFilled: completed % 3,
      spaceSize: 3,
    };

    const parts = await this.computeParts(userId, character?.id ?? null, [...weeks], pathsByDay);

    return {
      totalDrops,
      cycle,
      stage: this.buildStage(cycleDrops),
      today: todayBlock,
      parts,
      history,
      stages: TREE_STAGES.map((s) => ({
        key: s.key,
        label: s.label,
        drops: s.drops,
        reached: cycleDrops >= s.drops,
      })),
      garden,
      achievements: this.achievements(totalDrops, activeDays, completed),
      unlocks,
      customization: { ...currentStyle, decoration },
    };
  }

  async updateCustomization(
    userId: string,
    input: { species?: TreeSpecies; pot?: TreePot; decoration?: TreeDecoration },
  ): Promise<TreeView> {
    if (!input.species && !input.pot && !input.decoration) {
      throw new BadRequestException('No hay cambios que guardar.');
    }

    const current = await this.getTree(userId);

    if (input.species && !current.unlocks.species.includes(input.species)) {
      throw new BadRequestException('Esa especie aún no está disponible.');
    }
    if (input.pot && !current.unlocks.pots.includes(input.pot)) {
      throw new BadRequestException('Esa maceta aún no está disponible.');
    }
    if (input.decoration && !current.unlocks.decorations.includes(input.decoration)) {
      throw new BadRequestException('Ese adorno aún no está disponible.');
    }

    if (input.decoration) {
      await this.prisma.treeGarden.upsert({
        where: { userId },
        create: { userId, decoration: input.decoration },
        update: { decoration: input.decoration },
      });
    }

    if (input.species || input.pot) {
      await this.prisma.treeStyle.upsert({
        where: { userId_treeIndex: { userId, treeIndex: current.cycle.completed } },
        create: {
          userId,
          treeIndex: current.cycle.completed,
          species: input.species ?? current.customization.species,
          pot: input.pot ?? current.customization.pot,
        },
        update: {
          ...(input.species ? { species: input.species } : {}),
          ...(input.pot ? { pot: input.pot } : {}),
        },
      });
    }

    return this.getTree(userId);
  }

  private buildStage(cycleDrops: number): TreeView['stage'] {
    let reachedIndex = -1;
    for (let i = 0; i < TREE_STAGES.length; i += 1) {
      if (cycleDrops >= TREE_STAGES[i].drops) reachedIndex = i;
    }

    const currentIndex = Math.max(reachedIndex, 0);
    const current = TREE_STAGES[currentIndex];
    const next = TREE_STAGES[currentIndex + 1] ?? null;
    const reached = reachedIndex >= 0;

    const floor = current.drops;
    const ceiling = next?.drops ?? current.drops;
    const progress =
      next && ceiling > floor ? Math.min(1, Math.max(0, (cycleDrops - floor) / (ceiling - floor))) : 1;

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

  private unlocks(totalDrops: number, activeDays: number, completed: number): TreeUnlocksView {
    return {
      pots: totalDrops >= 1 ? [...TREE_POTS] : ['violet'],
      species:
        completed >= 3
          ? [...TREE_SPECIES]
          : completed >= 1
            ? ['bonsai', 'jacaranda', 'olive']
            : ['bonsai'],
      decorations: [
        'none',
        ...(activeDays >= 7 ? (['flower'] as TreeDecoration[]) : []),
        ...(totalDrops >= 35 ? (['stones'] as TreeDecoration[]) : []),
        ...(activeDays >= 30 ? (['butterfly'] as TreeDecoration[]) : []),
      ],
    };
  }

  private achievements(
    totalDrops: number,
    activeDays: number,
    completed: number,
  ): TreeAchievementView[] {
    const stages: TreeAchievementView[] = TREE_STAGES.slice(1).map((stage, index) => ({
      id: `stage-${index}`,
      title: `Tu primera etapa ${stage.label}`,
      detail:
        stage.drops === 35
          ? 'Desbloquea piedras de río para tu jardín.'
          : `Reconocimiento digital al llegar a ${stage.label}.`,
      value: Math.min(totalDrops, stage.drops),
      goal: stage.drops,
      unit: 'gotas',
      unlocked: totalDrops >= stage.drops,
    }));

    return [
      {
        id: 'first',
        title: 'Un primer momento',
        detail: 'Completa una acción que sume una gota. Puedes elegir una maceta terracota o marfil.',
        value: Math.min(totalDrops, 1),
        goal: 1,
        unit: 'acción',
        unlocked: totalDrops >= 1,
      },
      {
        id: 'days7',
        title: 'Siete días a tu ritmo',
        detail: 'Participa en siete días distintos, aunque no sean consecutivos. Desbloquea flores para el jardín.',
        value: Math.min(activeDays, 7),
        goal: 7,
        unit: 'días',
        unlocked: activeDays >= 7,
      },
      {
        id: 'days30',
        title: 'Un recorrido que continúa',
        detail: 'Participa en treinta días distintos. Desbloquea el adorno de mariposas.',
        value: Math.min(activeDays, 30),
        goal: 30,
        unit: 'días',
        unlocked: activeDays >= 30,
      },
      ...stages,
      {
        id: 'tree1',
        title: 'Tu primer árbol completo',
        detail: 'Conserva tu árbol en el jardín. Elige jacaranda u olivo para el siguiente.',
        value: Math.min(completed, 1),
        goal: 1,
        unit: 'árbol',
        unlocked: completed >= 1,
      },
      {
        id: 'trees3',
        title: 'Un jardín completo',
        detail: 'Completa tres árboles. Amplía tu jardín y desbloquea el cerezo.',
        value: Math.min(completed, 3),
        goal: 3,
        unit: 'árboles',
        unlocked: completed >= 3,
      },
    ];
  }

  private async computeParts(
    userId: string,
    characterId: string | null,
    weeks: string[],
    pathsByDay: Map<string, Set<TreePath>>,
  ): Promise<TreeView['parts']> {
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
