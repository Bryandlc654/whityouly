import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { env } from '../../../config/env';

/**
 * Evita que una página de otro sitio pueda usar la cookie de refresco.
 *
 * El refresh token vive en una cookie `httpOnly` con `SameSite=None`, porque el
 * frontend (Vercel) y la API (Render) viven en dominios distintos. `SameSite=None`
 * es obligatorio para que la cookie llegue, pero como consecuencia el navegador
 * la adjunta también a peticiones iniciadas desde cualquier otro origen.
 *
 * CORS ya impide que un atacante lea la respuesta, así que aquí no se roba el
 * token: lo que se evita es que pueda forzarnos a rotar sesiones o cerrar la
 * sesión del usuario desde una web ajena.
 *
 * Solo se aplica a las rutas que se autentican con la cookie. El resto ya exige
 * la cabecera `Authorization`, que un navegador no puede adjuntar solo.
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;

    // Sin `Origin` la petición no viene de un navegador (curl, app nativa,
    // pruebas): no hay cookie que un atacante pueda reutilizar desde su web.
    if (!origin) {
      return true;
    }

    if (env.corsOrigins.includes(origin) || this.isSameHost(request, origin)) {
      return true;
    }

    throw new ForbiddenException('Origen no permitido para esta operación');
  }

  /**
   * Una petición a la API hecha desde la propia API (por ejemplo el botón
   * "Try it out" de Swagger en local) no es cross-site. Se compara solo el
   * host porque detrás de un proxy el esquema puede no coincidir.
   */
  private isSameHost(request: Request, origin: string): boolean {
    const host = request.headers.host;

    if (!host) {
      return false;
    }

    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
}
