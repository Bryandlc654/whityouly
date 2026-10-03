import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

type AuthenticatedRequest = Request & { user?: { userId?: string } };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const userId = context.switchToHttp().getRequest<AuthenticatedRequest>().user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Sesión no autenticada.');
    }

    // El rol se lee de la base en cada petición privilegiada en lugar de
    // confiar en el token: así una promoción, una degradación o una suspensión
    // surten efecto de inmediato, sin esperar a que caduque el access token.
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });

    if (!account) {
      throw new UnauthorizedException('La cuenta ya no existe.');
    }

    if (account.status !== 'ACTIVE') {
      throw new ForbiddenException(
        account.status === 'SUSPENDED'
          ? 'Tu cuenta está suspendida.'
          : 'Esta cuenta ya no está activa.',
      );
    }

    if (required?.length && !isAllowed(account.role, required)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción.');
    }

    return true;
  }
}

/**
 * Un SUPERADMIN puede en cualquier endpoint que pida un rol de administración:
 * si no, habría que escribir `@Roles('ADMIN', 'SUPERADMIN')` en cada ruta y
 * olvidarlo en una sola sería un agujero. Los demás roles deben aparecer
 * explícitos en la lista: el guard no inventa permisos.
 */
function isAllowed(role: Role, required: Role[]): boolean {
  if (required.includes(role)) {
    return true;
  }
  return role === 'SUPERADMIN' && required.some((candidate) => ADMIN_ROLES.includes(candidate));
}

const ADMIN_ROLES: Role[] = ['MODERATOR', 'ADMIN'];
