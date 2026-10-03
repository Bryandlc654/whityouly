import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { env } from '../../../config/env';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
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

    // Esto inyecta `user` en el objeto request de Express (req.user)
    return { userId: payload.sub, email: payload.email, sessionId: payload.sid };
  }
}
