import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { env } from '../../../config/env';
import { ROLES_KEY } from '../decorators/roles.decorator';

type AuthenticatedRequest = Request & { user?: { userId?: string } };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { method: string; headers: Record<string, unknown> }>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Sesión no autenticada.');
    }

    // El rol se lee de la base en cada petición privilegiada en lugar de
    // confiar en el token: así una promoción, una degradación o una suspensión
    // surten efecto de inmediato, sin esperar a que caduque el access token.
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true, mfaEnabled: true },
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

    // El SUPERADMIN debe tener MFA activo para usar cualquier ruta de
    // administración. Las mutaciones exigen además un token de step-up fresco
    // (5 minutos) obtenido con el código TOTP.
    if (account.role === 'SUPERADMIN') {
      if (!account.mfaEnabled) {
        throw new ForbiddenException({
          message: 'Activa la verificación en dos pasos para usar el panel de administración.',
          code: 'MFA_ENROLL_REQUIRED',
        });
      }

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
        const token = request.headers['x-step-up'];
        const valid =
          typeof token === 'string' && (await this.validStepUpToken(token, userId));
        if (!valid) {
          throw new ForbiddenException({
            message: 'Confirma la acción con tu código de verificación.',
            code: 'STEP_UP_REQUIRED',
          });
        }
      }
    }

    return true;
  }

  private async validStepUpToken(token: string, userId: string): Promise<boolean> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        type?: string;
      }>(token, { secret: env.jwtSecret, algorithms: ['HS256'] });
      return payload.sub === userId && payload.type === 'step-up';
    } catch {
      return false;
    }
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
