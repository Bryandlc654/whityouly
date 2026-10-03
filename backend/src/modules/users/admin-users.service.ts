import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionsService } from '../auth/sessions.service';
import { ROLES, type AdminStatus, type RoleName } from './dto/admin-users.dto';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/** Roles con permisos de administración sobre otras cuentas. */
const PRIVILEGED_ROLES: readonly string[] = ['ADMIN', 'SUPERADMIN'];

const USER_SELECT = {
  id: true,
  email: true,
  isEmailVerified: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { characters: true, mediaAssets: true, sessions: true } },
} as const;



@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: SessionsService,
  ) {}

  /** Listado de usuarios para el panel de administración, paginado por cursor. */
  async list(query: {
    search?: string;
    role?: RoleName;
    status?: AdminStatus;
    cursor?: string;
    limit?: number;
  }) {
    const take = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const search = query.search?.trim();

    const rows = await this.prisma.user.findMany({
      where: {
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: USER_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  /**
   * Cambio de rol. El guard ya exige ser SUPERADMIN; aquí van los dos frenos que
   * dependen del estado: nadie cambia el suyo (ni para subir ni para bajar) y el
   * último SUPERADMIN activo no puede ser degradado, porque la instancia se
   * quedaría sin quien administre los roles.
   */
  async updateRole(actorId: string, targetId: string, role: RoleName) {
    if (!ROLES.includes(role)) {
      throw new BadRequestException('Rol desconocido.');
    }

    if (actorId === targetId) {
      throw new ForbiddenException('No puedes cambiarte el propio rol.');
    }

    // El decorador ya exige SUPERADMIN, pero el servicio también lo comprueba:
    // los cambios de rol son el permiso más peligroso del sistema y no
    // dependen de que quien lo llame se acuerde de añadir el decorador.
    const actorRole = await this.actorRole(actorId);
    if (actorRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Solo un SUPERADMIN puede cambiar roles.');
    }

    const target = await this.findTarget(targetId);

    if (target.role === role) {
      return this.toPublicUser(await this.reloaded(target.id));
    }

    if (target.role === 'SUPERADMIN' && role !== 'SUPERADMIN' && target.status === 'ACTIVE') {
      await this.assertAnotherActiveSuperadmin(target.id);
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { role },
      select: USER_SELECT,
    });

    // El rol se lee de la base en cada petición protegida, así que el cambio surte
    // efecto de inmediato. Aun así se revocan las sesiones: un token de acceso
    // puede seguir vivo hasta expirar y conviene que no sirva para nada más.
    await this.sessionsService.revokeAllForUser(target.id);

    return this.toPublicUser(updated);
  }

  /**
   * Suspender o reactivar. Un ADMIN solo actúa sobre cuentas normales; tocar a
   * otro ADMIN o a un SUPERADMIN exige ser SUPERADMIN.
   */
  async updateStatus(actorId: string, targetId: string, status: AdminStatus) {
    if (actorId === targetId) {
      throw new ForbiddenException('No puedes cambiarte el propio estado.');
    }

    // El rol se resuelve aquí y no desde el token: el token es una foto que puede
    // quedar vieja, y la fuente de verdad es la fila del usuario.
    const actorRole = await this.actorRole(actorId);
    const target = await this.findTarget(targetId);

    if (actorRole !== 'SUPERADMIN' && PRIVILEGED_ROLES.includes(target.role)) {
      throw new ForbiddenException('Solo un SUPERADMIN puede modificar cuentas de administración.');
    }

    if (target.role === 'SUPERADMIN' && status === 'SUSPENDED') {
      await this.assertAnotherActiveSuperadmin(target.id);
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { status },
      select: USER_SELECT,
    });

    // Suspender cierra las sesiones: el login ya rechaza estados distintos de
    // ACTIVE, pero una sesión abierta seguiría viva sin este paso.
    if (status === 'SUSPENDED') {
      await this.sessionsService.revokeAllForUser(target.id);
    }

    return this.toPublicUser(updated);
  }

  private async findTarget(id: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });

    if (!target) {
      throw new NotFoundException('Ese usuario no existe.');
    }

    return target;
  }

  private async reloaded(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: USER_SELECT });
  }

  private async actorRole(actorId: string): Promise<string> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });

    if (!actor) {
      throw new NotFoundException('Ese usuario no existe.');
    }

    return actor.role;
  }

  private async assertAnotherActiveSuperadmin(excludingId: string) {
    const others = await this.prisma.user.count({
      where: { role: 'SUPERADMIN', status: 'ACTIVE', NOT: { id: excludingId } },
    });

    if (others === 0) {
      throw new BadRequestException(
        'No puedes dejar la instancia sin SUPERADMIN: primero promociona a otra cuenta.',
      );
    }
  }

  /** Nunca se devuelve el hash ni datos del perfil público. */
  private toPublicUser(user: {
    id: string;
    email: string;
    isEmailVerified: boolean;
    role: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: { characters: number; mediaAssets: number; sessions: number };
  }) {
    return {
      id: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      counts: user._count
        ? {
            characters: user._count.characters,
            media: user._count.mediaAssets,
            activeSessions: user._count.sessions,
          }
        : undefined,
    };
  }
}
