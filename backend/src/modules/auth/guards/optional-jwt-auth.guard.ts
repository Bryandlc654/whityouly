import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Autenticación opcional para rutas públicas.
 *
 * Si llega un token válido, `req.user` queda disponible para aplicar reglas
 * personalizadas (por ejemplo, bloqueos). Si no llega o está caducado, la ruta
 * sigue siendo accesible como invitado. Nunca responde 401 por su cuenta: las
 * rutas que la usan siguen siendo públicas.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = { userId: string } | null>(_error: unknown, user: TUser): TUser | null {
    return user ?? null;
  }
}
