import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * El catálogo de intereses es pequeño, cerrado y cambia muy rara vez. Se cachea
 * en memoria unos minutos para no consultar la base en cada visita al
 * perfil, y así el selector del diálogo no añade carga por usuario.
 */
const CACHE_TTL_MS = 5 * 60_000;

interface CachedCatalog {
  names: string[];
  expiresAt: number;
}

@Injectable()
export class InterestsService {
  private cache: CachedCatalog | null = null;
  private inFlight: Promise<string[]> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<string[]> {
    const cached = this.cache;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.names;
    }

    // Se comparte la consulta entre llamadas simultáneas: si llegan veinte
    // peticiones con la caché vacía, solo sale una a la base.
    this.inFlight ??= this.prisma.interest
      .findMany({ orderBy: { name: 'asc' }, select: { name: true } })
      .then((rows) => rows.map((row) => row.name))
      .finally(() => {
        this.inFlight = null;
      });

    const names = await this.inFlight;
    this.cache = { names, expiresAt: Date.now() + CACHE_TTL_MS };

    return names;
  }
}
