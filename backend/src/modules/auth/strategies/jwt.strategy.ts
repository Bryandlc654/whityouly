import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { env } from '../../../config/env';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { sub?: string; email?: string; sid?: string; type?: string }) {
    // Solo aceptamos access tokens; un refresh token no debe autenticar peticiones.
    if (!payload?.sub || payload.type !== 'access') {
      throw new UnauthorizedException('Token inválido');
    }

    // El token debe pertenecer a una sesión viva. Sin esta comprobación un
    // logout, una revocación de dispositivo o una suspensión tardaban hasta 15
    // minutos en surtir efecto sobre el access token.
    if (!payload.sid) {
      throw new UnauthorizedException('Sesión no válida');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { status: true } },
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Sesión cerrada o expirada');
    }

    // Suspender o eliminar una cuenta invalida también sus access tokens.
    if (session.user.status !== 'ACTIVE' && session.user.status !== 'DELETION_PENDING') {
      throw new UnauthorizedException('La cuenta no está activa');
    }

    // Esto inyecta `user` en el objeto request de Express (req.user)
    return { userId: payload.sub, email: payload.email, sessionId: payload.sid };
  }
}
